import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const departments = mysqlTable(
  "departments",
  {
    id: int("id").autoincrement().primaryKey(),
    nameAr: varchar("nameAr", { length: 180 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    parentId: int("parentId"),
    type: mysqlEnum("type", ["office", "department", "section", "unit"]).default("department").notNull(),
    isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("departments_code_unique").on(table.code), index("departments_parent_idx").on(table.parentId)],
);

export const externalEntities = mysqlTable(
  "external_entities",
  {
    id: int("id").autoincrement().primaryKey(),
    nameAr: varchar("nameAr", { length: 240 }).notNull(),
    category: mysqlEnum("category", ["ministry", "authority", "agency", "service", "municipality", "other"]).default("other").notNull(),
    isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("external_entities_name_unique").on(table.nameAr), index("external_entities_active_idx").on(table.isActive)],
);

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  accountType: mysqlEnum("accountType", ["oauth", "local"]).default("oauth").notNull(),
  passwordHash: varchar("passwordHash", { length: 512 }),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  accessLevel: mysqlEnum("accessLevel", ["standard", "full"]).default("standard").notNull(),
  role: mysqlEnum("role", [
    "user",
    "admin",
    "director_general",
    "follow_up",
    "department_head",
    "staff",
  ]).default("staff").notNull(),
  departmentId: int("departmentId").references(() => departments.id),
  officeId: int("officeId").references(() => departments.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordChangedAt: timestamp("passwordChangedAt"),
}, table => [
  uniqueIndex("users_email_unique").on(table.email),
  index("users_department_office_idx").on(table.departmentId, table.officeId),
  index("users_account_state_idx").on(table.accountType, table.isActive),
]);

export const accountActivityLogs = mysqlTable(
  "account_activity_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    actorId: int("actorId").references(() => users.id),
    action: varchar("action", { length: 100 }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("account_activity_user_created_idx").on(table.userId, table.createdAt)],
);

export const correspondence = mysqlTable(
  "correspondence",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["incoming", "outgoing"]).notNull(),
    referenceNumber: varchar("referenceNumber", { length: 64 }).notNull(),
    sequenceNumber: int("sequenceNumber").notNull(),
    year: int("year").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("bodyText"),
    sourceEntity: varchar("sourceEntity", { length: 240 }).notNull(),
    destinationEntity: varchar("destinationEntity", { length: 240 }),
    sourceDepartmentId: int("sourceDepartmentId").references(() => departments.id),
    destinationDepartmentId: int("destinationDepartmentId").references(() => departments.id),
    sourceExternalEntityId: int("sourceExternalEntityId").references(() => externalEntities.id),
    destinationExternalEntityId: int("destinationExternalEntityId").references(() => externalEntities.id),
    documentDate: timestamp("documentDate").notNull(),
    receivedAt: timestamp("receivedAt"),
    sentAt: timestamp("sentAt"),
    priority: mysqlEnum("priority", ["normal", "urgent", "confidential"]).default("normal").notNull(),
    status: mysqlEnum("status", ["new", "referred", "in_progress", "completed", "archived"]).default("new").notNull(),
    currentDepartmentId: int("currentDepartmentId").references(() => departments.id),
    createdById: int("createdById").notNull().references(() => users.id),
    relatedIncomingId: int("relatedIncomingId"),
    dueAt: timestamp("dueAt"),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("correspondence_reference_unique").on(table.referenceNumber),
    index("correspondence_status_due_idx").on(table.status, table.dueAt),
    index("correspondence_current_department_idx").on(table.currentDepartmentId),
    index("correspondence_party_lookup_idx").on(table.sourceExternalEntityId, table.destinationExternalEntityId),
  ],
);

export const decisions = mysqlTable(
  "decisions",
  {
    id: int("id").autoincrement().primaryKey(),
    decisionNumber: varchar("decisionNumber", { length: 64 }).notNull(),
    sequenceNumber: int("sequenceNumber").notNull(),
    year: int("year").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("bodyText"),
    issuingDepartmentId: int("issuingDepartmentId").references(() => departments.id),
    sourceCorrespondenceId: int("sourceCorrespondenceId").references(() => correspondence.id),
    effectiveDate: timestamp("effectiveDate").notNull(),
    legalStatus: mysqlEnum("legalStatus", ["active", "amended", "cancelled"]).default("active").notNull(),
    referenceDecisionId: int("referenceDecisionId"),
    createdById: int("createdById").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("decisions_number_unique").on(table.decisionNumber)],
);

export const circulars = mysqlTable(
  "circulars",
  {
    id: int("id").autoincrement().primaryKey(),
    circularNumber: varchar("circularNumber", { length: 64 }).notNull(),
    sequenceNumber: int("sequenceNumber").notNull(),
    year: int("year").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("bodyText"),
    issueDate: timestamp("issueDate").notNull(),
    issuingDepartmentId: int("issuingDepartmentId").references(() => departments.id),
    sourceCorrespondenceId: int("sourceCorrespondenceId").references(() => correspondence.id),
    createdById: int("createdById").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("circulars_number_unique").on(table.circularNumber)],
);

export const circularRecipients = mysqlTable(
  "circular_recipients",
  {
    id: int("id").autoincrement().primaryKey(),
    circularId: int("circularId").notNull().references(() => circulars.id),
    departmentId: int("departmentId").notNull().references(() => departments.id),
    acknowledgementStatus: mysqlEnum("acknowledgementStatus", ["unread", "acknowledged"]).default("unread").notNull(),
    acknowledgedAt: timestamp("acknowledgedAt"),
  },
  table => [uniqueIndex("circular_recipient_unique").on(table.circularId, table.departmentId)],
);

export const referrals = mysqlTable(
  "referrals",
  {
    id: int("id").autoincrement().primaryKey(),
    correspondenceId: int("correspondenceId").notNull().references(() => correspondence.id),
    fromDepartmentId: int("fromDepartmentId").references(() => departments.id),
    toDepartmentId: int("toDepartmentId").notNull().references(() => departments.id),
    referredById: int("referredById").notNull().references(() => users.id),
    instruction: text("instruction").notNull(),
    statusAfterReferral: mysqlEnum("statusAfterReferral", ["referred", "in_progress"]).default("referred").notNull(),
    dueAt: timestamp("dueAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("referrals_correspondence_created_idx").on(table.correspondenceId, table.createdAt)],
);

export const attachments = mysqlTable(
  "attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    documentType: mysqlEnum("documentType", ["correspondence", "decision", "circular"]).notNull(),
    documentId: int("documentId").notNull(),
    fileKey: varchar("fileKey", { length: 500 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 700 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 100 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    extractedText: text("extractedText"),
    ocrStatus: mysqlEnum("ocrStatus", ["pending", "processing", "completed", "failed", "not_supported"]).default("pending").notNull(),
    ocrAttemptedAt: timestamp("ocrAttemptedAt"),
    ocrCompletedAt: timestamp("ocrCompletedAt"),
    ocrError: varchar("ocrError", { length: 500 }),
    uploadedById: int("uploadedById").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("attachments_document_idx").on(table.documentType, table.documentId), index("attachments_ocr_status_idx").on(table.ocrStatus)],
);

export const officialPdfDownloadLogs = mysqlTable(
  "official_pdf_download_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    documentType: mysqlEnum("documentType", ["decision", "circular"]).notNull(),
    documentId: int("documentId").notNull(),
    userId: int("userId").notNull().references(() => users.id),
    userRole: varchar("userRole", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("official_pdf_download_document_created_idx").on(table.documentType, table.documentId, table.createdAt),
    index("official_pdf_download_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const activityLogs = mysqlTable(
  "activity_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("entityType", ["correspondence", "decision", "circular"]).notNull(),
    entityId: int("entityId").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    note: text("note"),
    previousStatus: varchar("previousStatus", { length: 40 }),
    nextStatus: varchar("nextStatus", { length: 40 }),
    actorId: int("actorId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("activity_logs_entity_created_idx").on(table.entityType, table.entityId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Correspondence = typeof correspondence.$inferSelect;
export type InsertCorrespondence = typeof correspondence.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
