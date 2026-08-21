import { and, desc, eq, gte, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accountActivityLogs,
  activityLogs,
  attachments,
  circularRecipients,
  circulars,
  correspondence,
  decisions,
  departments,
    externalEntities,
    notifications,
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

export function toSafeUser<T extends typeof users.$inferSelect>(user: T) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export async function getLocalUserByEmail(email: string) {
  const db = requireDb(await getDb());
  const result = await db.select().from(users).where(and(eq(users.email, email), eq(users.accountType, "local"))).limit(1);
  return result[0];
}

export async function getLocalUserById(id: number) {
  const db = requireDb(await getDb());
  const result = await db.select().from(users).where(and(eq(users.id, id), eq(users.accountType, "local"))).limit(1);
  return result[0];
}

export async function updateUserLastSignedIn(id: number) {
  const db = requireDb(await getDb());
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function listManagedUsers(input: { role?: "admin" | "director_general" | "follow_up" | "department_head" | "staff"; query?: string; isActive?: "yes" | "no" } = {}) {
  const db = requireDb(await getDb());
  const conditions: SQL[] = [];
  if (input.role) conditions.push(eq(users.role, input.role));
  if (input.isActive) conditions.push(eq(users.isActive, input.isActive));
  if (input.query?.trim()) {
    const term = `%${input.query.trim()}%`;
    const textCondition = or(like(users.name, term), like(users.email, term));
    if (textCondition) conditions.push(textCondition);
  }
  const [accountRows, structure] = await Promise.all([db.select().from(users).where(and(...conditions)).orderBy(desc(users.createdAt)), db.select().from(departments)]);
  const names = new Map(structure.map(item => [item.id, item.nameAr]));
  return accountRows.map(user => ({
    ...toSafeUser(user),
    departmentName: user.departmentId ? names.get(user.departmentId) || null : null,
    officeName: user.officeId ? names.get(user.officeId) || null : null,
  }));
}

export async function createLocalUser(input: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "director_general" | "follow_up" | "department_head" | "staff";
  departmentId?: number;
  officeId?: number;
  actorId?: number;
}) {
  const db = requireDb(await getDb());
  return db.transaction(async tx => {
    const result = await tx.insert(users).values({
      openId: input.openId,
      name: input.name,
      email: input.email,
      loginMethod: "local-password",
      accountType: "local",
      passwordHash: input.passwordHash,
      role: input.role,
      departmentId: input.departmentId || null,
      officeId: input.officeId || null,
      isActive: "yes",
      passwordChangedAt: new Date(),
      lastSignedIn: new Date(),
    });
    const id = Number(result[0].insertId);
    await tx.insert(accountActivityLogs).values({ userId: id, actorId: input.actorId || id, action: "account_created", detail: "تم إنشاء حساب محلي." });
    return { id };
  });
}

export async function updateManagedUser(input: {
  userId: number;
  name?: string;
  role?: "admin" | "director_general" | "follow_up" | "department_head" | "staff";
  departmentId?: number | null;
  officeId?: number | null;
  isActive?: "yes" | "no";
  passwordHash?: string;
  actorId: number;
  action: string;
}) {
  const db = requireDb(await getDb());
  const { userId, actorId, action, ...changes } = input;
  await db.transaction(async tx => {
    await tx.update(users).set({ ...changes, passwordChangedAt: changes.passwordHash ? new Date() : undefined }).where(eq(users.id, userId));
    await tx.insert(accountActivityLogs).values({ userId, actorId, action });
  });
}

export async function listNotifications(recipientUserId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(notifications).where(eq(notifications.recipientUserId, recipientUserId)).orderBy(desc(notifications.createdAt)).limit(40);
  return { rows, unreadCount: rows.filter(row => !row.readAt).length };
}

export async function markNotificationRead(notificationId: number, recipientUserId: number) {
  const db = requireDb(await getDb());
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, recipientUserId)));
}

export async function createReportReviewNotifications(input: { title: string; content: string; relatedEntityId?: number; actorId: number }) {
  const db = requireDb(await getDb());
  const recipients = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "follow_up"), eq(users.isActive, "yes"), sql`${users.id} <> ${input.actorId}`));
  if (!recipients.length) return 0;
  await db.insert(notifications).values(recipients.map(recipient => ({ recipientUserId: recipient.id, type: "report_submitted" as const, title: input.title, content: input.content, relatedEntityType: "report", relatedEntityId: input.relatedEntityId || null })));
  return recipients.length;
}

export async function listAccountActivity(input: { userId?: number; action?: string; dateFrom?: Date; dateTo?: Date } = {}) {
  const db = requireDb(await getDb());
  const conditions: SQL[] = [];
  if (input.userId) conditions.push(eq(accountActivityLogs.userId, input.userId));
  if (input.action) conditions.push(eq(accountActivityLogs.action, input.action));
  if (input.dateFrom) conditions.push(gte(accountActivityLogs.createdAt, input.dateFrom));
  if (input.dateTo) conditions.push(lte(accountActivityLogs.createdAt, input.dateTo));
  const logs = await db.select().from(accountActivityLogs).where(and(...conditions)).orderBy(desc(accountActivityLogs.createdAt)).limit(1000);
  const ids = Array.from(new Set(logs.flatMap(log => [log.userId, log.actorId].filter((id): id is number => typeof id === "number"))));
  const people = ids.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, ids)) : [];
  const directory = new Map(people.map(person => [person.id, person]));
  return logs.map(log => ({
    ...log,
    userName: directory.get(log.userId)?.name || null,
    userEmail: directory.get(log.userId)?.email || null,
    actorName: log.actorId ? directory.get(log.actorId)?.name || null : null,
  }));
}

export async function listDepartments() {
  const db = requireDb(await getDb());
  return db.select().from(departments).where(eq(departments.isActive, "yes")).orderBy(departments.nameAr);
}

type OrganizationUnitType = "office" | "department" | "section" | "unit";
type ExternalEntityCategory = "ministry" | "authority" | "agency" | "service" | "municipality" | "other";

export async function listOrganizationUnits(includeInactive = false) {
  const db = requireDb(await getDb());
  const query = db.select().from(departments);
  return includeInactive ? query.orderBy(departments.nameAr) : query.where(eq(departments.isActive, "yes")).orderBy(departments.nameAr);
}

export async function listExternalEntities(includeInactive = false) {
  const db = requireDb(await getDb());
  const query = db.select().from(externalEntities);
  return includeInactive ? query.orderBy(externalEntities.nameAr) : query.where(eq(externalEntities.isActive, "yes")).orderBy(externalEntities.nameAr);
}

async function assertActiveParent(parentId?: number | null, excludedId?: number) {
  if (!parentId) return;
  if (parentId === excludedId) throw new Error("لا يمكن أن تكون الوحدة التنظيمية التابعة أصلًا لنفسها.");
  const db = requireDb(await getDb());
  const parent = await db.select().from(departments).where(and(eq(departments.id, parentId), eq(departments.isActive, "yes"))).limit(1);
  if (!parent[0]) throw new Error("الوحدة التنظيمية الأم غير موجودة أو غير نشطة.");
  let ancestorId = parent[0].parentId;
  while (ancestorId) {
    if (ancestorId === excludedId) throw new Error("لا يمكن إنشاء دورة في الهيكل التنظيمي.");
    const ancestor = await db.select({ parentId: departments.parentId }).from(departments).where(eq(departments.id, ancestorId)).limit(1);
    ancestorId = ancestor[0]?.parentId || null;
  }
}

async function assertUniqueUnit(input: { nameAr?: string; code?: string; excludedId?: number }) {
  const db = requireDb(await getDb());
  if (input.code) {
    const matches = await db.select({ id: departments.id }).from(departments).where(eq(departments.code, input.code)).limit(1);
    if (matches[0] && matches[0].id !== input.excludedId) throw new Error("رمز الوحدة التنظيمية مستخدم بالفعل.");
  }
  if (input.nameAr) {
    const matches = await db.select({ id: departments.id }).from(departments).where(eq(departments.nameAr, input.nameAr)).limit(1);
    if (matches[0] && matches[0].id !== input.excludedId) throw new Error("اسم الوحدة التنظيمية مستخدم بالفعل.");
  }
}

async function assertUniqueExternalEntity(nameAr?: string, excludedId?: number) {
  if (!nameAr) return;
  const db = requireDb(await getDb());
  const matches = await db.select({ id: externalEntities.id }).from(externalEntities).where(eq(externalEntities.nameAr, nameAr)).limit(1);
  if (matches[0] && matches[0].id !== excludedId) throw new Error("اسم الجهة الخارجية مستخدم بالفعل.");
}

export async function createOrganizationUnit(input: { nameAr: string; code: string; type: OrganizationUnitType; parentId?: number; }) {
  await assertUniqueUnit(input);
  await assertActiveParent(input.parentId);
  const db = requireDb(await getDb());
  const result = await db.insert(departments).values({ nameAr: input.nameAr, code: input.code, type: input.type, parentId: input.parentId || null, isActive: "yes" });
  return { id: Number(result[0].insertId) };
}

export async function updateOrganizationUnit(input: { id: number; nameAr?: string; code?: string; type?: OrganizationUnitType; parentId?: number | null; isActive?: "yes" | "no"; }) {
  await assertUniqueUnit({ nameAr: input.nameAr, code: input.code, excludedId: input.id });
  if (input.parentId !== undefined) await assertActiveParent(input.parentId, input.id);
  const db = requireDb(await getDb());
  await db.update(departments).set({ nameAr: input.nameAr, code: input.code, type: input.type, parentId: input.parentId, isActive: input.isActive }).where(eq(departments.id, input.id));
}

export async function createExternalEntity(input: { nameAr: string; category: ExternalEntityCategory; }) {
  await assertUniqueExternalEntity(input.nameAr);
  const db = requireDb(await getDb());
  const result = await db.insert(externalEntities).values({ nameAr: input.nameAr, category: input.category, isActive: "yes" });
  return { id: Number(result[0].insertId) };
}

export async function updateExternalEntity(input: { id: number; nameAr?: string; category?: ExternalEntityCategory; isActive?: "yes" | "no"; }) {
  await assertUniqueExternalEntity(input.nameAr, input.id);
  const db = requireDb(await getDb());
  await db.update(externalEntities).set({ nameAr: input.nameAr, category: input.category, isActive: input.isActive }).where(eq(externalEntities.id, input.id));
}

export async function resolveCorrespondenceParties(input: {
  sourceEntity?: string;
  destinationEntity?: string;
  sourceDepartmentId?: number;
  destinationDepartmentId?: number;
  sourceExternalEntityId?: number;
  destinationExternalEntityId?: number;
}) {
  const sourceChoiceCount = Number(Boolean(input.sourceDepartmentId)) + Number(Boolean(input.sourceExternalEntityId));
  const destinationChoiceCount = Number(Boolean(input.destinationDepartmentId)) + Number(Boolean(input.destinationExternalEntityId));
  if (sourceChoiceCount > 1 || destinationChoiceCount > 1) throw new Error("اختر جهة واحدة فقط لكل من المصدر والوجهة.");
  const db = requireDb(await getDb());
  const unitIds = [input.sourceDepartmentId, input.destinationDepartmentId].filter((id): id is number => Boolean(id));
  const entityIds = [input.sourceExternalEntityId, input.destinationExternalEntityId].filter((id): id is number => Boolean(id));
  const [units, entities] = await Promise.all([
    unitIds.length ? db.select().from(departments).where(and(inArray(departments.id, unitIds), eq(departments.isActive, "yes"))) : [],
    entityIds.length ? db.select().from(externalEntities).where(and(inArray(externalEntities.id, entityIds), eq(externalEntities.isActive, "yes"))) : [],
  ]);
  const unitsById = new Map(units.map(item => [item.id, item.nameAr]));
  const entitiesById = new Map(entities.map(item => [item.id, item.nameAr]));
  const sourceEntity = input.sourceDepartmentId ? unitsById.get(input.sourceDepartmentId) : input.sourceExternalEntityId ? entitiesById.get(input.sourceExternalEntityId) : input.sourceEntity?.trim();
  const destinationEntity = input.destinationDepartmentId ? unitsById.get(input.destinationDepartmentId) : input.destinationExternalEntityId ? entitiesById.get(input.destinationExternalEntityId) : input.destinationEntity?.trim();
  if (!sourceEntity) throw new Error("اختر أو أدخل جهة مصدر صالحة.");
  if (input.sourceDepartmentId && !unitsById.has(input.sourceDepartmentId)) throw new Error("جهة المصدر الداخلية غير موجودة أو غير نشطة.");
  if (input.destinationDepartmentId && !unitsById.has(input.destinationDepartmentId)) throw new Error("جهة الوجهة الداخلية غير موجودة أو غير نشطة.");
  if (input.sourceExternalEntityId && !entitiesById.has(input.sourceExternalEntityId)) throw new Error("جهة المصدر الخارجية غير موجودة أو غير نشطة.");
  if (input.destinationExternalEntityId && !entitiesById.has(input.destinationExternalEntityId)) throw new Error("جهة الوجهة الخارجية غير موجودة أو غير نشطة.");
  return { sourceEntity, destinationEntity: destinationEntity || undefined, sourceDepartmentId: input.sourceDepartmentId, destinationDepartmentId: input.destinationDepartmentId, sourceExternalEntityId: input.sourceExternalEntityId, destinationExternalEntityId: input.destinationExternalEntityId };
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

async function getScopedUnitIds(rootUnitId: number) {
  const db = requireDb(await getDb());
  const units = await db.select({ id: departments.id, parentId: departments.parentId }).from(departments).where(eq(departments.isActive, "yes"));
  const children = new Map<number, number[]>();
  units.forEach(unit => {
    if (unit.parentId) children.set(unit.parentId, [...(children.get(unit.parentId) || []), unit.id]);
  });
  const ids = new Set<number>([rootUnitId]);
  const pending = [rootUnitId];
  while (pending.length) {
    const current = pending.pop()!;
    (children.get(current) || []).forEach(childId => {
      if (!ids.has(childId)) {
        ids.add(childId);
        pending.push(childId);
      }
    });
  }
  return Array.from(ids);
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
  if (input.departmentId) {
    const scopedUnitIds = await getScopedUnitIds(input.departmentId);
    conditions.push(or(inArray(correspondence.currentDepartmentId, scopedUnitIds), inArray(correspondence.sourceDepartmentId, scopedUnitIds), inArray(correspondence.destinationDepartmentId, scopedUnitIds))!);
  }
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
        like(correspondence.classification, `%${search}%`),
        like(correspondence.keywords, `%${search}%`),
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

export async function getCorrespondenceById(id: number) {
  const db = requireDb(await getDb());
  const record = await db.select().from(correspondence).where(eq(correspondence.id, id)).limit(1);
  return record[0] || null;
}

export async function createCorrespondence(input: {
  type: "incoming" | "outgoing";
  referenceNumber: string;
  subject: string;
  bodyText?: string;
  sourceEntity: string;
  destinationEntity?: string;
  sourceDepartmentId?: number;
  destinationDepartmentId?: number;
  sourceExternalEntityId?: number;
  destinationExternalEntityId?: number;
  documentDate: Date;
  priority: "normal" | "urgent" | "confidential";
  classification: string;
  confidentiality: "public" | "internal" | "confidential" | "secret";
  keywords?: string;
  archiveStatus: "registered" | "approved" | "archived";
  currentDepartmentId?: number;
  dueAt?: Date;
  relatedIncomingId?: number;
  createdById: number;
}) {
  const db = requireDb(await getDb());
  const year = input.documentDate.getUTCFullYear();
  const sequence = await nextCorrespondenceSequence(input.type, year);
  const referenceNumber = input.referenceNumber.trim();
  const duplicate = await db.select({ id: correspondence.id }).from(correspondence).where(eq(correspondence.referenceNumber, referenceNumber)).limit(1);
  if (duplicate[0]) throw new Error("الرقم الإشاري مستخدم مسبقًا. أدخل رقمًا إشاريًا مختلفًا.");
  const result = await db.insert(correspondence).values({
    type: input.type,
    sequenceNumber: sequence,
    year,
    referenceNumber,
    subject: input.subject,
    bodyText: input.bodyText || null,
    sourceEntity: input.sourceEntity,
    destinationEntity: input.destinationEntity || null,
    sourceDepartmentId: input.sourceDepartmentId || null,
    destinationDepartmentId: input.destinationDepartmentId || null,
    sourceExternalEntityId: input.sourceExternalEntityId || null,
    destinationExternalEntityId: input.destinationExternalEntityId || null,
    documentDate: input.documentDate,
    receivedAt: input.type === "incoming" ? input.documentDate : null,
    sentAt: input.type === "outgoing" ? input.documentDate : null,
    priority: input.priority,
    classification: input.classification,
    confidentiality: input.confidentiality,
    keywords: input.keywords || null,
    archiveStatus: input.archiveStatus,
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

export async function getDecisions(departmentId?: number) {
  const db = requireDb(await getDb());
  const scopedUnitIds = departmentId ? await getScopedUnitIds(departmentId) : [];
  const relatedCorrespondenceIds = departmentId ? (await getCorrespondenceList({ departmentId })).map(item => item.record.id) : [];
  const scope = departmentId ? or(inArray(decisions.issuingDepartmentId, scopedUnitIds), inArray(decisions.sourceCorrespondenceId, relatedCorrespondenceIds)) : undefined;
  const [records, pdfFiles] = await Promise.all([
    db.select().from(decisions).where(scope).orderBy(desc(decisions.effectiveDate)),
    db.select({ id: attachments.id, documentId: attachments.documentId, fileName: attachments.fileName, fileUrl: attachments.fileUrl }).from(attachments).where(and(eq(attachments.documentType, "decision"), eq(attachments.mimeType, "application/pdf"))),
  ]);
  const archivesByDecision = new Map<number, typeof pdfFiles>();
  pdfFiles.forEach(file => archivesByDecision.set(file.documentId, [...(archivesByDecision.get(file.documentId) || []), file]));
  return records.map(record => {
    const pdfArchives = archivesByDecision.get(record.id) || [];
    return { ...record, pdfArchive: pdfArchives[0] || null, pdfArchives };
  });
}

export async function createDecision(input: {
  subject: string;
  bodyText?: string;
  effectiveDate: Date;
  issuingAuthority: "prime_minister" | "tourism_minister" | "director_general";
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
    issuingAuthority: input.issuingAuthority,
    effectiveDate: input.effectiveDate,
    issuingDepartmentId: input.issuingDepartmentId || null,
    sourceCorrespondenceId: input.sourceCorrespondenceId || null,
    createdById: input.createdById,
  });
  const id = Number(result[0].insertId);
  await db.insert(activityLogs).values({ entityType: "decision", entityId: id, action: "registration", actorId: input.createdById });
  return { id, decisionNumber };
}

export async function getCirculars(departmentId?: number) {
  const db = requireDb(await getDb());
  const scopedUnitIds = departmentId ? await getScopedUnitIds(departmentId) : [];
  const recipientRows = departmentId ? await db.select({ circularId: circularRecipients.circularId }).from(circularRecipients).where(inArray(circularRecipients.departmentId, scopedUnitIds)) : [];
  const relatedCorrespondenceIds = departmentId ? (await getCorrespondenceList({ departmentId })).map(item => item.record.id) : [];
  const scope = departmentId ? or(inArray(circulars.issuingDepartmentId, scopedUnitIds), inArray(circulars.id, recipientRows.map(row => row.circularId)), inArray(circulars.sourceCorrespondenceId, relatedCorrespondenceIds)) : undefined;
  const [records, pdfFiles] = await Promise.all([
    db.select().from(circulars).where(scope).orderBy(desc(circulars.issueDate)),
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
  const result = await db.insert(attachments).values({ ...input, ocrStatus: input.extractedText ? "completed" : "pending" });
  return { id: Number(result[0].insertId) };
}

export async function updateAttachmentOcr(input: { attachmentId: number; status: "processing" | "completed" | "failed" | "not_supported"; extractedText?: string; error?: string }) {
  const db = requireDb(await getDb());
  const now = new Date();
  await db.update(attachments).set({
    ocrStatus: input.status,
    ocrAttemptedAt: now,
    ocrCompletedAt: input.status === "completed" ? now : undefined,
    extractedText: input.status === "completed" ? input.extractedText : undefined,
    ocrError: input.status === "failed" ? input.error || "تعذرت معالجة OCR." : null,
  }).where(eq(attachments.id, input.attachmentId));
}

export async function getAttachmentOcrDetail(attachmentId: number) {
  const db = requireDb(await getDb());
  const result = await db.select({ id: attachments.id, documentType: attachments.documentType, documentId: attachments.documentId, fileName: attachments.fileName, ocrStatus: attachments.ocrStatus, extractedText: attachments.extractedText, ocrError: attachments.ocrError, ocrAttemptedAt: attachments.ocrAttemptedAt, ocrCompletedAt: attachments.ocrCompletedAt }).from(attachments).where(eq(attachments.id, attachmentId)).limit(1);
  return result[0];
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
  const [visibleDecisions, visibleCirculars] = await Promise.all([getDecisions(departmentId), getCirculars(departmentId)]);
  const visibleCorrespondenceIds = records.map(row => row.record.id);
  const visibleDecisionIds = visibleDecisions.map(row => row.id);
  const visibleCircularIds = visibleCirculars.map(row => row.id);
  const visibleActivity = departmentId
    ? or(
        visibleCorrespondenceIds.length ? and(eq(activityLogs.entityType, "correspondence"), inArray(activityLogs.entityId, visibleCorrespondenceIds)) : eq(activityLogs.entityId, -1),
        visibleDecisionIds.length ? and(eq(activityLogs.entityType, "decision"), inArray(activityLogs.entityId, visibleDecisionIds)) : eq(activityLogs.entityId, -1),
        visibleCircularIds.length ? and(eq(activityLogs.entityType, "circular"), inArray(activityLogs.entityId, visibleCircularIds)) : eq(activityLogs.entityId, -1),
      )
    : undefined;
  const latestActions = await db
    .select({ log: activityLogs, actorName: users.name })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.actorId, users.id))
    .where(visibleActivity)
    .orderBy(desc(activityLogs.createdAt))
    .limit(8);
  return {
    metrics: {
      ...kpis,
    },
    quickStats: {
      incoming: records.filter(row => row.record.type === "incoming").length,
      outgoing: records.filter(row => row.record.type === "outgoing").length,
      decisions: visibleDecisions.length,
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

export async function searchArchive(input: {
  query: string;
  documentType?: "incoming" | "outgoing" | "decision" | "circular" | "attachment";
  status?: "new" | "referred" | "in_progress" | "completed" | "archived" | "active" | "amended" | "cancelled";
  priority?: "normal" | "urgent" | "confidential";
  departmentId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}, scopedDepartmentId?: number) {
  const db = requireDb(await getDb());
  const term = `%${input.query.trim()}%`;
  const departmentId = scopedDepartmentId ?? input.departmentId;
  const visibleDecisionIds = departmentId ? (await getDecisions(departmentId)).map(record => record.id) : [];
  const visibleCircularIds = departmentId ? (await getCirculars(departmentId)).map(record => record.id) : [];
  const correspondenceType = input.documentType === "incoming" || input.documentType === "outgoing" ? input.documentType : undefined;
  const correspondenceStatus = ["new", "referred", "in_progress", "completed", "archived"].includes(input.status || "") ? input.status as "new" | "referred" | "in_progress" | "completed" | "archived" : undefined;
  const decisionStatus = ["active", "amended", "cancelled"].includes(input.status || "") ? input.status as "active" | "amended" | "cancelled" : undefined;
  const includeCorrespondence = (!input.documentType || Boolean(correspondenceType)) && (!input.status || Boolean(correspondenceStatus));
  const includeDecisions = (!input.documentType || input.documentType === "decision") && (!input.status || Boolean(decisionStatus));
  const includeCirculars = (!input.documentType || input.documentType === "circular") && !input.status;
  const includeAttachments = (!input.documentType || input.documentType === "attachment") && !input.status;
  const correspondenceResults = !includeCorrespondence
    ? []
    : await getCorrespondenceList({ query: input.query, type: correspondenceType, status: correspondenceStatus, priority: input.priority, departmentId, dateFrom: input.dateFrom, dateTo: input.dateTo });
  const decisionConditions: SQL[] = [
    departmentId ? (visibleDecisionIds.length ? inArray(decisions.id, visibleDecisionIds) : eq(decisions.id, -1)) : undefined,
    input.documentType && input.documentType !== "decision" ? undefined : or(like(decisions.decisionNumber, term), like(decisions.subject, term), like(decisions.bodyText, term), like(correspondence.referenceNumber, term), like(correspondence.subject, term)),
    input.dateFrom ? gte(decisions.effectiveDate, input.dateFrom) : undefined,
    input.dateTo ? lte(decisions.effectiveDate, input.dateTo) : undefined,
    decisionStatus ? eq(decisions.legalStatus, decisionStatus) : undefined,
  ].filter((condition): condition is SQL => Boolean(condition));
  const circularConditions: SQL[] = [
    departmentId ? (visibleCircularIds.length ? inArray(circulars.id, visibleCircularIds) : eq(circulars.id, -1)) : undefined,
    input.documentType && input.documentType !== "circular" ? undefined : or(like(circulars.circularNumber, term), like(circulars.subject, term), like(circulars.bodyText, term), like(correspondence.referenceNumber, term), like(correspondence.subject, term)),
    input.dateFrom ? gte(circulars.issueDate, input.dateFrom) : undefined,
    input.dateTo ? lte(circulars.issueDate, input.dateTo) : undefined,
  ].filter((condition): condition is SQL => Boolean(condition));
  const attachmentConditions: SQL[] = [
    input.documentType && input.documentType !== "attachment" ? undefined : or(like(attachments.fileName, term), like(attachments.extractedText, term)),
    input.dateFrom ? gte(attachments.createdAt, input.dateFrom) : undefined,
    input.dateTo ? lte(attachments.createdAt, input.dateTo) : undefined,
  ].filter((condition): condition is SQL => Boolean(condition));
  const [decisionResults, circularResults, attachmentResults] = await Promise.all([
    !includeDecisions ? [] : db.select({ record: decisions, linkedNumber: correspondence.referenceNumber, linkedSubject: correspondence.subject }).from(decisions).leftJoin(correspondence, eq(decisions.sourceCorrespondenceId, correspondence.id)).where(and(...decisionConditions)).orderBy(desc(decisions.effectiveDate)),
    !includeCirculars ? [] : db.select({ record: circulars, linkedNumber: correspondence.referenceNumber, linkedSubject: correspondence.subject }).from(circulars).leftJoin(correspondence, eq(circulars.sourceCorrespondenceId, correspondence.id)).where(and(...circularConditions)).orderBy(desc(circulars.issueDate)),
    !includeAttachments ? [] : db.select().from(attachments).where(and(...attachmentConditions)).orderBy(desc(attachments.createdAt)),
  ]);
  const allowedAttachments = departmentId ? attachmentResults.filter(record =>
    (record.documentType === "correspondence" && correspondenceResults.some(item => item.record.id === record.documentId)) ||
    (record.documentType === "decision" && decisionResults.some(item => item.record.id === record.documentId)) ||
    (record.documentType === "circular" && circularResults.some(item => item.record.id === record.documentId)),
  ) : attachmentResults;
  return [
    ...correspondenceResults.map(({ record }) => ({ id: record.id, type: record.type, number: record.referenceNumber, subject: record.subject, date: record.documentDate, status: record.status, priority: record.priority, classification: record.classification, confidentiality: record.confidentiality, keywords: record.keywords, archiveStatus: record.archiveStatus })),
    ...decisionResults.map(({ record, linkedNumber, linkedSubject }) => ({ id: record.id, type: "decision" as const, number: record.decisionNumber, subject: linkedNumber ? `${record.subject} — مرجع: ${linkedNumber}${linkedSubject ? ` (${linkedSubject})` : ""}` : record.subject, date: record.effectiveDate, status: record.legalStatus, priority: null })),
    ...circularResults.map(({ record, linkedNumber, linkedSubject }) => ({ id: record.id, type: "circular" as const, number: record.circularNumber, subject: linkedNumber ? `${record.subject} — مرجع: ${linkedNumber}${linkedSubject ? ` (${linkedSubject})` : ""}` : record.subject, date: record.issueDate, status: "issued", priority: null })),
    ...allowedAttachments.map(record => ({ id: record.id, type: "attachment" as const, number: record.fileName, subject: `مرفق رقمي: ${record.fileName}`, date: record.createdAt, status: record.documentType, ocrStatus: record.ocrStatus, priority: null })),
  ];
}
