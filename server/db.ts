import { and, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  activityLogs,
  attachments,
  circularRecipients,
  circulars,
  correspondence,
  decisions,
  departments,
  InsertUser,
  referrals,
  users,
} from "../drizzle/schema";
import { calculateKpis, formatReferenceNumber, isStatusTransitionAllowed, summarizeReportData } from "../shared/archive";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = requireDb(await getDb());
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listDepartments() {
  const db = requireDb(await getDb());
  return db.select().from(departments).where(eq(departments.isActive, "yes")).orderBy(departments.nameAr);
}

async function nextCorrespondenceSequence(type: "incoming" | "outgoing", year: number) {
  const db = requireDb(await getDb());
  const result = await db
    .select({ maximum: sql<number>`coalesce(max(${correspondence.sequenceNumber}), 0)` })
    .from(correspondence)
    .where(and(eq(correspondence.type, type), eq(correspondence.year, year)));
  return Number(result[0]?.maximum ?? 0) + 1;
}

async function nextOfficialSequence(entity: "decision" | "circular", year: number) {
  const db = requireDb(await getDb());
  const target = entity === "decision" ? decisions : circulars;
  const result = await db
    .select({ maximum: sql<number>`coalesce(max(${target.sequenceNumber}), 0)` })
    .from(target)
    .where(eq(target.year, year));
  return Number(result[0]?.maximum ?? 0) + 1;
}

export async function getCorrespondenceList(input: {
  type?: "incoming" | "outgoing";
  status?: "new" | "referred" | "in_progress" | "completed" | "archived";
  query?: string;
  departmentId?: number;
  priority?: "normal" | "urgent" | "confidential";
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = requireDb(await getDb());
  const conditions: SQL[] = [];
  if (input.type) conditions.push(eq(correspondence.type, input.type));
  if (input.status) conditions.push(eq(correspondence.status, input.status));
  if (input.priority) conditions.push(eq(correspondence.priority, input.priority));
  if (input.departmentId) conditions.push(eq(correspondence.currentDepartmentId, input.departmentId));
  if (input.dateFrom) conditions.push(gte(correspondence.documentDate, input.dateFrom));
  if (input.dateTo) conditions.push(lte(correspondence.documentDate, input.dateTo));
  const search = input.query?.trim();
  const searchCondition = search
    ? or(
        like(correspondence.referenceNumber, `%${search}%`),
        like(correspondence.subject, `%${search}%`),
        like(correspondence.sourceEntity, `%${search}%`),
        like(correspondence.destinationEntity, `%${search}%`),
        like(correspondence.bodyText, `%${search}%`),
      )
    : undefined;

  const results = await db
    .select({ record: correspondence, departmentName: departments.nameAr })
    .from(correspondence)
    .leftJoin(departments, eq(correspondence.currentDepartmentId, departments.id))
    .where(and(...conditions, searchCondition))
    .orderBy(desc(correspondence.updatedAt));
  const ids = results.map(row => row.record.id);
  if (!ids.length) return results.map(row => ({ ...row, latestAction: undefined }));
  const logs = await db.select().from(activityLogs).where(and(eq(activityLogs.entityType, "correspondence"), inArray(activityLogs.entityId, ids))).orderBy(desc(activityLogs.createdAt));
  const latestByRecord = new Map<number, (typeof logs)[number]>();
  logs.forEach(log => { if (!latestByRecord.has(log.entityId)) latestByRecord.set(log.entityId, log); });
  return results.map(row => ({ ...row, latestAction: latestByRecord.get(row.record.id) }));
}

export async function createCorrespondence(input: {
  type: "incoming" | "outgoing";
  subject: string;
  bodyText?: string;
  sourceEntity: string;
  destinationEntity?: string;
  documentDate: Date;
  priority: "normal" | "urgent" | "confidential";
  currentDepartmentId?: number;
  dueAt?: Date;
  relatedIncomingId?: number;
  createdById: number;
}) {
  const db = requireDb(await getDb());
  const year = input.documentDate.getUTCFullYear();
  const sequence = await nextCorrespondenceSequence(input.type, year);
  const referenceNumber = formatReferenceNumber(input.type, year, sequence);
  const result = await db.insert(correspondence).values({
    type: input.type,
    sequenceNumber: sequence,
    year,
    referenceNumber,
    subject: input.subject,
    bodyText: input.bodyText || null,
    sourceEntity: input.sourceEntity,
    destinationEntity: input.destinationEntity || null,
    documentDate: input.documentDate,
    receivedAt: input.type === "incoming" ? input.documentDate : null,
    sentAt: input.type === "outgoing" ? input.documentDate : null,
    priority: input.priority,
    currentDepartmentId: input.currentDepartmentId || null,
    dueAt: input.dueAt || null,
    relatedIncomingId: input.relatedIncomingId || null,
    createdById: input.createdById,
  });
  const id = Number(result[0].insertId);
  await db.insert(activityLogs).values({
    entityType: "correspondence",
    entityId: id,
    action: "registration",
    nextStatus: "new",
    note: "تم تسجيل المعاملة في النظام.",
    actorId: input.createdById,
  });
  return { id, referenceNumber };
}

export async function referCorrespondence(input: {
  correspondenceId: number;
  fromDepartmentId?: number;
  toDepartmentId: number;
  instruction: string;
  dueAt?: Date;
  referredById: number;
}) {
  const db = requireDb(await getDb());
  return db.transaction(async tx => {
    const record = await tx.select().from(correspondence).where(eq(correspondence.id, input.correspondenceId)).limit(1);
    if (!record[0]) throw new Error("لم يتم العثور على المعاملة المطلوبة.");
    await tx.insert(referrals).values({
      correspondenceId: input.correspondenceId,
      fromDepartmentId: input.fromDepartmentId || record[0].currentDepartmentId || null,
      toDepartmentId: input.toDepartmentId,
      referredById: input.referredById,
      instruction: input.instruction,
      dueAt: input.dueAt || null,
    });
    await tx
      .update(correspondence)
      .set({ currentDepartmentId: input.toDepartmentId, status: "referred", dueAt: input.dueAt || record[0].dueAt })
      .where(eq(correspondence.id, input.correspondenceId));
    await tx.insert(activityLogs).values({
      entityType: "correspondence",
      entityId: input.correspondenceId,
      action: "referral",
      previousStatus: record[0].status,
      nextStatus: "referred",
      note: input.instruction,
      actorId: input.referredById,
    });
  });
}

export async function updateCorrespondenceStatus(input: {
  correspondenceId: number;
  status: "new" | "referred" | "in_progress" | "completed" | "archived";
  note?: string;
  actorId: number;
}) {
  const db = requireDb(await getDb());
  const record = await db.select().from(correspondence).where(eq(correspondence.id, input.correspondenceId)).limit(1);
  if (!record[0]) throw new Error("لم يتم العثور على المعاملة المطلوبة.");
  if (!isStatusTransitionAllowed(record[0].status, input.status)) throw new Error("انتقال الحالة المطلوب غير مسموح ضمن دورة المستند.");
  const now = new Date();
  await db
    .update(correspondence)
    .set({
      status: input.status,
      completedAt: input.status === "completed" ? now : record[0].completedAt,
      archivedAt: input.status === "archived" ? now : record[0].archivedAt,
    })
    .where(eq(correspondence.id, input.correspondenceId));
  await db.insert(activityLogs).values({
    entityType: "correspondence",
    entityId: input.correspondenceId,
    action: "status_change",
    previousStatus: record[0].status,
    nextStatus: input.status,
    note: input.note || null,
    actorId: input.actorId,
  });
}

export async function getDecisions() {
  const db = requireDb(await getDb());
  const [records, pdfFiles] = await Promise.all([
    db.select().from(decisions).orderBy(desc(decisions.effectiveDate)),
    db.select({ documentId: attachments.documentId, fileName: attachments.fileName, fileUrl: attachments.fileUrl }).from(attachments).where(and(eq(attachments.documentType, "decision"), eq(attachments.mimeType, "application/pdf"))),
  ]);
  const archiveByDecision = new Map(pdfFiles.map(file => [file.documentId, file]));
  return records.map(record => ({ ...record, pdfArchive: archiveByDecision.get(record.id) || null }));
}

export async function createDecision(input: {
  subject: string;
  bodyText?: string;
  effectiveDate: Date;
  issuingDepartmentId?: number;
  sourceCorrespondenceId?: number;
  createdById: number;
}) {
  const db = requireDb(await getDb());
  const year = input.effectiveDate.getUTCFullYear();
  const sequence = await nextOfficialSequence("decision", year);
  const decisionNumber = `TIDC/ق/${year}/${String(sequence).padStart(3, "0")}`;
  const result = await db.insert(decisions).values({
    decisionNumber,
    sequenceNumber: sequence,
    year,
    subject: input.subject,
    bodyText: input.bodyText || null,
    effectiveDate: input.effectiveDate,
    issuingDepartmentId: input.issuingDepartmentId || null,
    sourceCorrespondenceId: input.sourceCorrespondenceId || null,
    createdById: input.createdById,
  });
  const id = Number(result[0].insertId);
  await db.insert(activityLogs).values({ entityType: "decision", entityId: id, action: "registration", actorId: input.createdById });
  return { id, decisionNumber };
}

export async function getCirculars() {
  const db = requireDb(await getDb());
  const [records, pdfFiles] = await Promise.all([
    db.select().from(circulars).orderBy(desc(circulars.issueDate)),
    db.select({ documentId: attachments.documentId, fileName: attachments.fileName, fileUrl: attachments.fileUrl }).from(attachments).where(and(eq(attachments.documentType, "circular"), eq(attachments.mimeType, "application/pdf"))),
  ]);
  const archiveByCircular = new Map(pdfFiles.map(file => [file.documentId, file]));
  return records.map(record => ({ ...record, pdfArchive: archiveByCircular.get(record.id) || null }));
}

export async function createCircular(input: {
  subject: string;
  bodyText?: string;
  issueDate: Date;
  issuingDepartmentId?: number;
  sourceCorrespondenceId?: number;
  targetDepartmentIds: number[];
  createdById: number;
}) {
  const db = requireDb(await getDb());
  const year = input.issueDate.getUTCFullYear();
  const sequence = await nextOfficialSequence("circular", year);
  const circularNumber = `TIDC/م/${year}/${String(sequence).padStart(3, "0")}`;
  return db.transaction(async tx => {
    const result = await tx.insert(circulars).values({
      circularNumber,
      sequenceNumber: sequence,
      year,
      subject: input.subject,
      bodyText: input.bodyText || null,
      issueDate: input.issueDate,
      issuingDepartmentId: input.issuingDepartmentId || null,
      sourceCorrespondenceId: input.sourceCorrespondenceId || null,
      createdById: input.createdById,
    });
    const id = Number(result[0].insertId);
    if (input.targetDepartmentIds.length) {
      await tx.insert(circularRecipients).values(input.targetDepartmentIds.map(departmentId => ({ circularId: id, departmentId })));
    }
    await tx.insert(activityLogs).values({ entityType: "circular", entityId: id, action: "registration", actorId: input.createdById });
    return { id, circularNumber };
  });
}

export async function createAttachmentRecord(input: {
  documentType: "correspondence" | "decision" | "circular";
  documentId: number;
  fileKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText?: string;
  uploadedById: number;
}) {
  const db = requireDb(await getDb());
  await db.insert(attachments).values(input);
}

export async function getDashboardData(departmentId?: number) {
  const records = await getCorrespondenceList({ departmentId });
  const now = new Date();
  const all = records.map(row => row.record);
  const kpis = calculateKpis(all, now);
  const workload = Object.values(
    records.reduce<Record<string, { name: string; count: number }>>((acc, row) => {
      const name = row.departmentName || "غير محددة";
      acc[name] = { name, count: (acc[name]?.count || 0) + 1 };
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count);
  const db = requireDb(await getDb());
  const latestActions = await db
    .select({ log: activityLogs, actorName: users.name })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(8);
  return {
    metrics: {
      ...kpis,
    },
    active: records.filter(row => row.record.status !== "completed" && row.record.status !== "archived").slice(0, 8),
    overdue: records.filter(row => row.record.dueAt && row.record.dueAt.getTime() < now.getTime() && row.record.status !== "completed" && row.record.status !== "archived").slice(0, 8),
    workload,
    latestActions,
  };
}

export async function getReportingAnalytics() {
  const db = requireDb(await getDb());
  const [rows, decisionsResult, circularsResult] = await Promise.all([
    db.select({ record: correspondence, departmentName: departments.nameAr, departmentType: departments.type })
      .from(correspondence)
      .leftJoin(departments, eq(correspondence.currentDepartmentId, departments.id)),
    db.select({ count: sql<number>`count(*)` }).from(decisions),
    db.select({ count: sql<number>`count(*)` }).from(circulars),
  ]);

  return summarizeReportData(rows.map(row => ({
    type: row.record.type,
    departmentName: row.departmentName,
    departmentType: row.departmentType,
    entityName: row.record.type === "incoming" ? row.record.sourceEntity : row.record.destinationEntity || row.record.sourceEntity,
  })), Number(decisionsResult[0]?.count || 0), Number(circularsResult[0]?.count || 0));
}

export async function searchArchive(query: string, departmentId?: number) {
  const db = requireDb(await getDb());
  const term = `%${query.trim()}%`;
  const correspondenceResults = await getCorrespondenceList({ query, departmentId });
  const [decisionResults, circularResults, attachmentResults] = await Promise.all([
    db.select({ record: decisions, linkedNumber: correspondence.referenceNumber, linkedSubject: correspondence.subject }).from(decisions).leftJoin(correspondence, eq(decisions.sourceCorrespondenceId, correspondence.id)).where(or(like(decisions.decisionNumber, term), like(decisions.subject, term), like(decisions.bodyText, term), like(correspondence.referenceNumber, term), like(correspondence.subject, term))).orderBy(desc(decisions.effectiveDate)),
    db.select({ record: circulars, linkedNumber: correspondence.referenceNumber, linkedSubject: correspondence.subject }).from(circulars).leftJoin(correspondence, eq(circulars.sourceCorrespondenceId, correspondence.id)).where(or(like(circulars.circularNumber, term), like(circulars.subject, term), like(circulars.bodyText, term), like(correspondence.referenceNumber, term), like(correspondence.subject, term))).orderBy(desc(circulars.issueDate)),
    db.select().from(attachments).where(or(like(attachments.fileName, term), like(attachments.extractedText, term))).orderBy(desc(attachments.createdAt)),
  ]);
  return [
    ...correspondenceResults.map(({ record }) => ({ id: record.id, type: record.type, number: record.referenceNumber, subject: record.subject, date: record.documentDate, status: record.status })),
    ...decisionResults.map(({ record, linkedNumber, linkedSubject }) => ({ id: record.id, type: "decision" as const, number: record.decisionNumber, subject: linkedNumber ? `${record.subject} — مرجع: ${linkedNumber}${linkedSubject ? ` (${linkedSubject})` : ""}` : record.subject, date: record.effectiveDate, status: record.legalStatus })),
    ...circularResults.map(({ record, linkedNumber, linkedSubject }) => ({ id: record.id, type: "circular" as const, number: record.circularNumber, subject: linkedNumber ? `${record.subject} — مرجع: ${linkedNumber}${linkedSubject ? ` (${linkedSubject})` : ""}` : record.subject, date: record.issueDate, status: "issued" })),
    ...attachmentResults.map(record => ({ id: record.id, type: "attachment" as const, number: record.fileName, subject: `مرفق رقمي: ${record.fileName}`, date: record.createdAt, status: record.documentType })),
  ];
}
