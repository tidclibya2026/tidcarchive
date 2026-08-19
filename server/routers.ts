import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  canCreateDecisionOrCircular,
  canRefer,
  getRoleCapabilities,
  isExecutiveRole,
  type InstitutionalRole,
} from "../shared/archive";
import * as archiveDb from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { COOKIE_NAME } from "@shared/const";

const correspondenceStatus = z.enum(["new", "referred", "in_progress", "completed", "archived"]);
const priority = z.enum(["normal", "urgent", "confidential"]);
const documentKind = z.enum(["correspondence", "decision", "circular"]);

function roleOf(role: string): InstitutionalRole {
  return role as InstitutionalRole;
}

function ensureCapability(condition: boolean, message = "ليس لديك الإذن لتنفيذ هذا الإجراء.") {
  if (!condition) throw new TRPCError({ code: "FORBIDDEN", message });
}

function scopedDepartment(user: { role: string; departmentId: number | null }) {
  return isExecutiveRole(roleOf(user.role)) ? undefined : user.departmentId || -1;
}

async function ensureRecordAccess(user: { role: string; departmentId: number | null }, correspondenceId: number) {
  const departmentId = scopedDepartment(user);
  if (departmentId === undefined) return;
  const records = await archiveDb.getCorrespondenceList({ departmentId });
  ensureCapability(records.some(item => item.record.id === correspondenceId), "لا يمكنك الوصول إلى هذه المعاملة.");
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  access: router({
    capabilities: protectedProcedure.query(({ ctx }) => ({
      role: ctx.user.role,
      departmentId: ctx.user.departmentId,
      ...getRoleCapabilities(roleOf(ctx.user.role)),
    })),
  }),
  catalog: router({
    departments: protectedProcedure.query(() => archiveDb.listDepartments()),
  }),
  dashboard: router({
    overview: protectedProcedure.query(({ ctx }) => archiveDb.getDashboardData(scopedDepartment(ctx.user))),
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
        sourceEntity: z.string().trim().min(2).max(240),
        destinationEntity: z.string().trim().max(240).optional(),
        documentDate: z.date(),
        priority,
        currentDepartmentId: z.number().int().positive().optional(),
        dueAt: z.date().optional(),
        relatedIncomingId: z.number().int().positive().optional(),
      }))
      .mutation(({ ctx, input }) => archiveDb.createCorrespondence({ ...input, createdById: ctx.user.id })),
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
    list: protectedProcedure.query(() => archiveDb.getDecisions()),
    create: protectedProcedure
      .input(z.object({
        subject: z.string().trim().min(3).max(1500),
        bodyText: z.string().max(20_000).optional(),
        effectiveDate: z.date(),
        issuingDepartmentId: z.number().int().positive().optional(),
        sourceCorrespondenceId: z.number().int().positive().optional(),
      }))
      .mutation(({ ctx, input }) => {
        ensureCapability(canCreateDecisionOrCircular(roleOf(ctx.user.role)));
        return archiveDb.createDecision({ ...input, createdById: ctx.user.id });
      }),
  }),
  circulars: router({
    list: protectedProcedure.query(() => archiveDb.getCirculars()),
    create: protectedProcedure
      .input(z.object({
        subject: z.string().trim().min(3).max(1500),
        bodyText: z.string().max(20_000).optional(),
        issueDate: z.date(),
        issuingDepartmentId: z.number().int().positive().optional(),
        sourceCorrespondenceId: z.number().int().positive().optional(),
        targetDepartmentIds: z.array(z.number().int().positive()).max(100),
      }))
      .mutation(({ ctx, input }) => {
        ensureCapability(canCreateDecisionOrCircular(roleOf(ctx.user.role)));
        return archiveDb.createCircular({ ...input, createdById: ctx.user.id });
      }),
  }),
  archive: router({
    search: protectedProcedure
      .input(z.object({ query: z.string().trim().min(2).max(200) }))
      .query(({ ctx, input }) => archiveDb.searchArchive(input.query, scopedDepartment(ctx.user))),
  }),
  attachments: router({
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
        if (input.documentType === "correspondence") {
          await ensureRecordAccess(ctx.user, input.documentId);
        } else {
          ensureCapability(canCreateDecisionOrCircular(roleOf(ctx.user.role)));
        }
        const rawBase64 = input.base64.includes(",") ? input.base64.split(",").pop()! : input.base64;
        const buffer = Buffer.from(rawBase64, "base64");
        ensureCapability(buffer.length > 0 && buffer.length <= 10 * 1024 * 1024, "يجب ألا يتجاوز حجم المرفق 10 ميغابايت.");
        const sanitized = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 160);
        const fileName = sanitized.includes(".") ? sanitized : `${sanitized}.${extensionForMimeType(input.mimeType)}`;
        const { key, url } = await storagePut(`tidc-archive/${input.documentType}/${input.documentId}/${Date.now()}-${fileName}`, buffer, input.mimeType);
        await archiveDb.createAttachmentRecord({
          documentType: input.documentType,
          documentId: input.documentId,
          fileKey: key,
          fileUrl: url,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: buffer.length,
          extractedText: input.extractedText || undefined,
          uploadedById: ctx.user.id,
        });
        return { url, key, fileName: input.fileName };
      }),
  }),
});

export type AppRouter = typeof appRouter;
