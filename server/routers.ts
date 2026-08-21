import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  canCreateDecisionOrCircular,
  canRefer,
  getUserCapabilities,
  hasPdfSignature,
  hasFullSystemAccess,
  isExecutiveRole,
  type InstitutionalRole,
} from "../shared/archive";
import * as archiveDb from "./db";
import { canAuthenticateLocalAccount, hashLocalPassword, normalizeEmail, verifyLocalPassword } from "./localAuth";
import { getLocalSessionCookieOptions, getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { enqueueLocalOcr, supportsLocalOcr } from "./ocr";
import { COOKIE_NAME, LOCAL_SESSION_COOKIE, LOCAL_SESSION_MAX_AGE_MS } from "@shared/const";
import { exportAccountActivityCsv } from "../shared/audit";
import { enforceIdentifierRateLimit, enforceRequestRateLimit } from "./security";
import { decodeAndValidateUpload, sanitizeUploadFileName, type PermittedUploadMimeType } from "./uploadSecurity";
import { scanUploadForMalware } from "./antivirus";

const correspondenceStatus = z.enum(["new", "referred", "in_progress", "completed", "archived"]);
const priority = z.enum(["normal", "urgent", "confidential"]);
const documentKind = z.enum(["correspondence", "decision", "circular"]);
const organizationUnitType = z.enum(["office", "department", "section", "unit"]);
const externalEntityCategory = z.enum(["ministry", "authority", "agency", "service", "municipality", "other"]);
const institutionalEmail = z.string().trim().min(3).max(320).regex(/^[^\s@]+@[^\s@]+$/, "أدخل بريدًا إداريًا صالحًا.");
const requiredPdf = z.object({
  fileName: z.string().trim().min(1).max(255),
  base64: z.string().min(20).max(16_000_000),
});

function roleOf(role: string): InstitutionalRole {
  return role as InstitutionalRole;
}

function ensureCapability(condition: boolean, message = "ليس لديك الإذن لتنفيذ هذا الإجراء.") {
  if (!condition) throw new TRPCError({ code: "FORBIDDEN", message });
}

function scopedDepartment(user: { role: string; accessLevel?: string | null; departmentId: number | null; officeId: number | null }) {
  return hasFullSystemAccess(user) || isExecutiveRole(roleOf(user.role)) ? undefined : user.officeId || user.departmentId || -1;
}

function scopedInputDepartment(user: { role: string; accessLevel?: string | null; departmentId: number | null; officeId: number | null }, requested?: number) {
  const scope = scopedDepartment(user);
  if (scope === undefined) return requested;
  if (requested && requested !== scope) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك اختيار إدارة أو مكتب خارج نطاق حسابك." });
  return scope;
}

async function ensureRecordAccess(user: { role: string; accessLevel?: string | null; departmentId: number | null; officeId: number | null }, correspondenceId: number) {
  const departmentId = scopedDepartment(user);
  if (departmentId === undefined) return;
  const records = await archiveDb.getCorrespondenceList({ departmentId });
  ensureCapability(records.some(item => item.record.id === correspondenceId), "لا يمكنك الوصول إلى هذه المعاملة.");
}

function ensureFullAccess(user: { role: string; accessLevel?: string | null }) {
  ensureCapability(hasFullSystemAccess(user), "إدارة الحسابات وسجل التدقيق متاحان للحسابات التنفيذية المخولة فقط.");
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function archiveOfficialPdf(input: {
  documentType: "decision" | "circular";
  documentId: number;
  fileName: string;
  base64: string;
  extractedText?: string;
  uploadedById: number;
}) {
  const { buffer, fileName } = decodeAndValidateUpload({ base64: input.base64, fileName: input.fileName, mimeType: "application/pdf" });
  await scanUploadForMalware(buffer);
  const { key, url } = await storagePut(`tidc-archive/${input.documentType}/${input.documentId}/${Date.now()}-${fileName}`, buffer, "application/pdf");
  const attachment = await archiveDb.createAttachmentRecord({
    documentType: input.documentType,
    documentId: input.documentId,
    fileKey: key,
    fileUrl: url,
    fileName,
    mimeType: "application/pdf",
    sizeBytes: buffer.length,
  uploadedById: input.uploadedById,
  });
  const ocr = await enqueueLocalOcr({ attachmentId: attachment.id, fileKey: key, mimeType: "application/pdf" });
  if (ocr.status !== "pending") await archiveDb.updateAttachmentOcr({ attachmentId: attachment.id, status: ocr.status === "processing" ? "processing" : ocr.status, error: ocr.detail });
  return { url, key, fileName: input.fileName, attachmentId: attachment.id, ocrStatus: ocr.status };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? archiveDb.toSafeUser(opts.ctx.user) : null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...getLocalSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
    localLogin: publicProcedure
      .input(z.object({ email: institutionalEmail, password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const email = normalizeEmail(input.email);
        enforceRequestRateLimit(ctx.req, "local-login", 6, 15 * 60 * 1000);
        enforceIdentifierRateLimit("local-login-email", email, 6, 15 * 60 * 1000);
        const user = await archiveDb.getLocalUserByEmail(email);
        const isValid = user && canAuthenticateLocalAccount(user) && await verifyLocalPassword(input.password, user.passwordHash);
        if (!isValid || !user) throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة أو الحساب غير نشط." });
        const token = await sdk.createLocalSessionToken(user.id, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS });
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, { ...getLocalSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
        await archiveDb.updateUserLastSignedIn(user.id);
        return archiveDb.toSafeUser(user);
      }),
  }),
  users: router({
    list: protectedProcedure.query(({ ctx }) => {
      ensureFullAccess(ctx.user);
      return archiveDb.listManagedUsers();
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(3).max(240), email: institutionalEmail, password: z.string().min(10).max(128), role: z.enum(["admin", "director_general", "follow_up", "department_head", "staff"]), departmentId: z.number().int().positive().optional(), officeId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        ensureFullAccess(ctx.user);
        const email = normalizeEmail(input.email);
        if (await archiveDb.getLocalUserByEmail(email)) throw new TRPCError({ code: "CONFLICT", message: "يوجد حساب محلي بهذا البريد الإلكتروني." });
        const passwordHash = await hashLocalPassword(input.password);
        const result = await archiveDb.createLocalUser({ ...input, email, passwordHash, openId: `local_${randomUUID()}`, actorId: ctx.user.id });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), name: z.string().trim().min(3).max(240).optional(), role: z.enum(["admin", "director_general", "follow_up", "department_head", "staff"]).optional(), departmentId: z.number().int().positive().nullable().optional(), officeId: z.number().int().positive().nullable().optional(), isActive: z.enum(["yes", "no"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        ensureFullAccess(ctx.user);
        if (input.userId === ctx.user.id && input.isActive === "no") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعطيل الحساب الإداري الحالي." });
        const { userId, ...changes } = input;
        await archiveDb.updateManagedUser({ userId, ...changes, actorId: ctx.user.id, action: "account_updated" });
        return { success: true };
      }),
    resetPassword: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), password: z.string().min(10).max(128) }))
      .mutation(async ({ ctx, input }) => {
        ensureFullAccess(ctx.user);
        await archiveDb.updateManagedUser({ userId: input.userId, passwordHash: await hashLocalPassword(input.password), actorId: ctx.user.id, action: "password_reset" });
        return { success: true };
      }),
  }),
  audit: router({
    list: protectedProcedure
      .input(z.object({ userId: z.number().int().positive().optional(), action: z.string().max(100).optional(), dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(({ ctx, input }) => {
        ensureFullAccess(ctx.user);
        return archiveDb.listAccountActivity(input);
      }),
    exportCsv: protectedProcedure
      .input(z.object({ userId: z.number().int().positive().optional(), action: z.string().max(100).optional(), dateFrom: z.date().optional(), dateTo: z.date().optional() }).optional())
      .query(async ({ ctx, input }) => {
        ensureFullAccess(ctx.user);
        const rows = await archiveDb.listAccountActivity(input);
        return { fileName: `tidc-account-audit-${new Date().toISOString().slice(0, 10)}.csv`, csv: exportAccountActivityCsv(rows) };
      }),
  }),
  access: router({
    capabilities: protectedProcedure.query(({ ctx }) => ({
      role: ctx.user.role,
      departmentId: ctx.user.departmentId,
      ...getUserCapabilities(ctx.user),
    })),
  }),
  catalog: router({
    departments: protectedProcedure.query(() => archiveDb.listDepartments()),
    organizationUnits: protectedProcedure.query(() => archiveDb.listOrganizationUnits()),
    externalEntities: protectedProcedure.query(() => archiveDb.listExternalEntities()),
  }),
  organization: router({
    listUnits: protectedProcedure.query(({ ctx }) => { ensureFullAccess(ctx.user); return archiveDb.listOrganizationUnits(true); }),
    createUnit: protectedProcedure
      .input(z.object({ nameAr: z.string().trim().min(2).max(180), code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/, "استخدم رمزًا إنجليزيًا أو أرقامًا فقط."), type: organizationUnitType, parentId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => { ensureFullAccess(ctx.user); return archiveDb.createOrganizationUnit(input); }),
    updateUnit: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), nameAr: z.string().trim().min(2).max(180).optional(), code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).optional(), type: organizationUnitType.optional(), parentId: z.number().int().positive().nullable().optional(), isActive: z.enum(["yes", "no"]).optional() }))
      .mutation(async ({ ctx, input }) => { ensureFullAccess(ctx.user); await archiveDb.updateOrganizationUnit(input); return { success: true }; }),
    listExternal: protectedProcedure.query(({ ctx }) => { ensureFullAccess(ctx.user); return archiveDb.listExternalEntities(true); }),
    createExternal: protectedProcedure
      .input(z.object({ nameAr: z.string().trim().min(2).max(240), category: externalEntityCategory }))
      .mutation(async ({ ctx, input }) => { ensureFullAccess(ctx.user); return archiveDb.createExternalEntity(input); }),
    updateExternal: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), nameAr: z.string().trim().min(2).max(240).optional(), category: externalEntityCategory.optional(), isActive: z.enum(["yes", "no"]).optional() }))
      .mutation(async ({ ctx, input }) => { ensureFullAccess(ctx.user); await archiveDb.updateExternalEntity(input); return { success: true }; }),
  }),
  dashboard: router({
    overview: protectedProcedure.query(({ ctx }) => archiveDb.getDashboardData(scopedDepartment(ctx.user))),
  }),
  reports: router({
    analytics: protectedProcedure.query(({ ctx }) => {
      ensureCapability(isExecutiveRole(roleOf(ctx.user.role)), "التقارير الإدارية متاحة للمدير العام ومكتب المتابعة وإدارة تقنية المعلومات.");
      return archiveDb.getReportingAnalytics();
    }),
  }),
  correspondence: router({
    list: protectedProcedure
      .input(z.object({ type: z.enum(["incoming", "outgoing"]).optional(), status: correspondenceStatus.optional(), priority: priority.optional(), departmentId: z.number().int().positive().optional(), dateFrom: z.date().optional(), dateTo: z.date().optional(), query: z.string().max(200).optional() }).optional())
      .query(({ ctx, input }) => archiveDb.getCorrespondenceList({ ...input, departmentId: scopedDepartment(ctx.user) ?? input?.departmentId })),
    create: protectedProcedure
      .input(z.object({
        type: z.enum(["incoming", "outgoing"]),
        subject: z.string().trim().min(3).max(1500),
        bodyText: z.string().max(20_000).optional(),
        sourceEntity: z.string().trim().min(2).max(240).optional(),
        destinationEntity: z.string().trim().max(240).optional(),
        sourceDepartmentId: z.number().int().positive().optional(),
        destinationDepartmentId: z.number().int().positive().optional(),
        sourceExternalEntityId: z.number().int().positive().optional(),
        destinationExternalEntityId: z.number().int().positive().optional(),
        documentDate: z.date(),
        priority,
        currentDepartmentId: z.number().int().positive().optional(),
        dueAt: z.date().optional(),
        relatedIncomingId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { sourceEntity, destinationEntity, sourceDepartmentId, destinationDepartmentId, sourceExternalEntityId, destinationExternalEntityId, ...document } = input;
        const currentDepartmentId = scopedInputDepartment(ctx.user, document.currentDepartmentId);
        if (!hasFullSystemAccess(ctx.user) && sourceDepartmentId && sourceDepartmentId !== (ctx.user.officeId || ctx.user.departmentId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك اختيار مصدر داخلي خارج نطاق حسابك." });
        const parties = await archiveDb.resolveCorrespondenceParties({ sourceEntity, destinationEntity, sourceDepartmentId, destinationDepartmentId, sourceExternalEntityId, destinationExternalEntityId });
        return archiveDb.createCorrespondence({ ...document, ...parties, currentDepartmentId, createdById: ctx.user.id });
      }),
    updateStatus: protectedProcedure
      .input(z.object({ correspondenceId: z.number().int().positive(), status: correspondenceStatus, note: z.string().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await ensureRecordAccess(ctx.user, input.correspondenceId);
        await archiveDb.updateCorrespondenceStatus({ ...input, actorId: ctx.user.id });
        return { success: true };
      }),
    refer: protectedProcedure
      .input(z.object({
        correspondenceId: z.number().int().positive(),
        toDepartmentId: z.number().int().positive(),
        instruction: z.string().trim().min(3).max(4000),
        dueAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        ensureCapability(canRefer(roleOf(ctx.user.role)));
        await ensureRecordAccess(ctx.user, input.correspondenceId);
        await archiveDb.referCorrespondence({
          ...input,
          fromDepartmentId: ctx.user.departmentId || undefined,
          referredById: ctx.user.id,
        });
        return { success: true };
      }),
  }),
  decisions: router({
    list: protectedProcedure.query(({ ctx }) => archiveDb.getDecisions(scopedDepartment(ctx.user))),
    create: protectedProcedure
      .input(z.object({
        subject: z.string().trim().min(3).max(1500),
        bodyText: z.string().max(20_000).optional(),
        effectiveDate: z.date(),
        issuingDepartmentId: z.number().int().positive().optional(),
        sourceCorrespondenceId: z.number().int().positive().optional(),
        pdf: requiredPdf,
      }))
      .mutation(async ({ ctx, input }) => {
        ensureCapability(canCreateDecisionOrCircular(roleOf(ctx.user.role)));
        const { pdf, ...document } = input;
        if (document.sourceCorrespondenceId) await ensureRecordAccess(ctx.user, document.sourceCorrespondenceId);
        const result = await archiveDb.createDecision({ ...document, issuingDepartmentId: scopedInputDepartment(ctx.user, document.issuingDepartmentId), createdById: ctx.user.id });
        await archiveOfficialPdf({ documentType: "decision", documentId: result.id, fileName: pdf.fileName, base64: pdf.base64, extractedText: document.bodyText, uploadedById: ctx.user.id });
        return result;
      }),
  }),
  circulars: router({
    list: protectedProcedure.query(({ ctx }) => archiveDb.getCirculars(scopedDepartment(ctx.user))),
    create: protectedProcedure
      .input(z.object({
        subject: z.string().trim().min(3).max(1500),
        bodyText: z.string().max(20_000).optional(),
        issueDate: z.date(),
        issuingDepartmentId: z.number().int().positive().optional(),
        sourceCorrespondenceId: z.number().int().positive().optional(),
        targetDepartmentIds: z.array(z.number().int().positive()).max(100),
        pdf: requiredPdf,
      }))
      .mutation(async ({ ctx, input }) => {
        ensureCapability(canCreateDecisionOrCircular(roleOf(ctx.user.role)));
        const { pdf, ...document } = input;
        if (document.sourceCorrespondenceId) await ensureRecordAccess(ctx.user, document.sourceCorrespondenceId);
        const result = await archiveDb.createCircular({ ...document, issuingDepartmentId: scopedInputDepartment(ctx.user, document.issuingDepartmentId), createdById: ctx.user.id });
        await archiveOfficialPdf({ documentType: "circular", documentId: result.id, fileName: pdf.fileName, base64: pdf.base64, extractedText: document.bodyText, uploadedById: ctx.user.id });
        return result;
      }),
  }),
  archive: router({
    search: protectedProcedure
      .input(z.object({
        query: z.string().trim().min(2).max(200),
        documentType: z.enum(["incoming", "outgoing", "decision", "circular", "attachment"]).optional(),
        status: z.enum(["new", "referred", "in_progress", "completed", "archived", "active", "amended", "cancelled"]).optional(),
        priority: z.enum(["normal", "urgent", "confidential"]).optional(),
        departmentId: z.number().int().positive().optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
      }).refine(input => !input.dateFrom || !input.dateTo || input.dateFrom <= input.dateTo, { message: "يجب أن يكون تاريخ البداية قبل تاريخ النهاية." }))
      .query(({ ctx, input }) => archiveDb.searchArchive(input, scopedDepartment(ctx.user))),
  }),
  attachments: router({
    ocrDetail: protectedProcedure
      .input(z.object({ attachmentId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const attachment = await archiveDb.getAttachmentOcrDetail(input.attachmentId);
        if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "لم يُعثر على المرفق المطلوب." });
        if (attachment.documentType === "correspondence") await ensureRecordAccess(ctx.user, attachment.documentId);
        else ensureCapability(isExecutiveRole(roleOf(ctx.user.role)) || canCreateDecisionOrCircular(roleOf(ctx.user.role)), "لا تملك صلاحية مراجعة نص OCR لهذا المرفق.");
        return attachment;
      }),
    upload: protectedProcedure
      .input(z.object({
        documentType: documentKind,
        documentId: z.number().int().positive(),
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(20).max(16_000_000),
        extractedText: z.string().max(20_000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        enforceRequestRateLimit(ctx.req, "attachments-upload", 24, 5 * 60 * 1000);
        if (input.documentType === "correspondence") {
          await ensureRecordAccess(ctx.user, input.documentId);
        } else {
          ensureCapability(canCreateDecisionOrCircular(roleOf(ctx.user.role)));
        }
        const { buffer, fileName } = decodeAndValidateUpload({ base64: input.base64, fileName: input.fileName, mimeType: input.mimeType as PermittedUploadMimeType });
        await scanUploadForMalware(buffer);
        const { key, url } = await storagePut(`tidc-archive/${input.documentType}/${input.documentId}/${Date.now()}-${fileName}`, buffer, input.mimeType);
        const attachment = await archiveDb.createAttachmentRecord({
          documentType: input.documentType,
          documentId: input.documentId,
          fileKey: key,
          fileUrl: url,
          fileName: sanitizeUploadFileName(input.fileName, input.mimeType as PermittedUploadMimeType),
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          extractedText: input.extractedText || undefined,
          uploadedById: ctx.user.id,
        });
        const ocr = await enqueueLocalOcr({ attachmentId: attachment.id, fileKey: key, mimeType: input.mimeType });
        if (ocr.status !== "pending") await archiveDb.updateAttachmentOcr({ attachmentId: attachment.id, status: ocr.status === "processing" ? "processing" : ocr.status, error: ocr.detail });
        return { url, key, fileName: input.fileName, attachmentId: attachment.id, ocrStatus: ocr.status, ocrSupported: supportsLocalOcr(input.mimeType) };
      }),
  }),
});

export type AppRouter = typeof appRouter;
