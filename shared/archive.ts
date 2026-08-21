export const ROLE_LABELS = {
  admin: "إدارة تقنية المعلومات",
  director_general: "المدير العام",
  follow_up: "مكتب المتابعة",
  department_head: "رئيس إدارة",
  staff: "موظف",
  user: "مستخدم",
} as const;

export const STATUS_LABELS = {
  new: "جديدة",
  referred: "محالة",
  in_progress: "قيد المعالجة",
  completed: "منجزة",
  archived: "مؤرشفة",
} as const;

export const PRIORITY_LABELS = {
  normal: "عادي",
  urgent: "عاجل",
  confidential: "سري",
} as const;

export const DOCUMENT_TYPE_LABELS = {
  incoming: "وارد",
  outgoing: "صادر",
  decision: "قرار",
  circular: "منشور",
} as const;

export type InstitutionalRole = keyof typeof ROLE_LABELS;
export type WorkflowStatus = keyof typeof STATUS_LABELS;

export function isExecutiveRole(role: InstitutionalRole) {
  return role === "admin" || role === "director_general" || role === "follow_up";
}

export function canRefer(role: InstitutionalRole) {
  return isExecutiveRole(role) || role === "department_head";
}

export function canCreateDecisionOrCircular(role: InstitutionalRole) {
  return role === "admin" || role === "director_general" || role === "follow_up";
}

export function getRoleCapabilities(role: InstitutionalRole) {
  return {
    canViewAll: isExecutiveRole(role),
    canRefer: canRefer(role),
    canCreateDecisionOrCircular: canCreateDecisionOrCircular(role),
    canManageUsers: role === "admin",
    canViewFollowUp: isExecutiveRole(role),
  };
}

export function hasFullSystemAccess(user: { role: string; accessLevel?: string | null }) {
  return user.role === "admin" || user.accessLevel === "full";
}

export function getUserCapabilities(user: { role: string; accessLevel?: string | null }) {
  if (hasFullSystemAccess(user)) return getRoleCapabilities("admin");
  return getRoleCapabilities(user.role as InstitutionalRole);
}

export function formatReferenceNumber(type: "incoming" | "outgoing", year: number, sequence: number) {
  const symbol = type === "incoming" ? "و" : "ص";
  return `TIDC/${symbol}/${year}/${String(sequence).padStart(5, "0")}`;
}

type KpiRecord = {
  status: WorkflowStatus;
  dueAt: Date | null;
  createdAt: Date;
  completedAt: Date | null;
};

export function calculateKpis(records: KpiRecord[], now = new Date()) {
  const active = records.filter(record => record.status !== "completed" && record.status !== "archived");
  const overdue = active.filter(record => record.dueAt && record.dueAt.getTime() < now.getTime());
  const completed = records.filter(record => record.status === "completed" && record.completedAt);
  const averageCompletionHours = completed.length
    ? Math.round(completed.reduce((total, record) => total + ((record.completedAt!.getTime() - record.createdAt.getTime()) / 3_600_000), 0) / completed.length)
    : 0;
  return { active: active.length, overdue: overdue.length, inProgress: records.filter(record => record.status === "in_progress").length, completed: completed.length, archived: records.filter(record => record.status === "archived").length, averageCompletionHours };
}

const statusTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
  new: ["referred", "in_progress", "archived"],
  referred: ["in_progress", "archived"],
  in_progress: ["referred", "completed", "archived"],
  completed: ["archived"],
  archived: [],
};

export function isStatusTransitionAllowed(current: WorkflowStatus, next: WorkflowStatus) {
  return current === next || statusTransitions[current].includes(next);
}

type ReportSource = {
  type: "incoming" | "outgoing";
  departmentName?: string | null;
  departmentType?: "office" | "department" | "section" | "unit" | null;
  entityName?: string | null;
};

type ReportDistribution = { name: string; incoming: number; outgoing: number; total: number };

export function summarizeReportData(records: ReportSource[], decisionCount: number, circularCount: number) {
  const group = (items: ReportSource[], key: "departmentName" | "entityName") => Object.values(items.reduce<Record<string, ReportDistribution>>((groups, item) => {
    const name = item[key] || "غير محددة";
    const row = groups[name] || { name, incoming: 0, outgoing: 0, total: 0 };
    row[item.type] += 1;
    row.total += 1;
    groups[name] = row;
    return groups;
  }, {})).sort((a, b) => b.total - a.total);
  const incomingCount = records.filter(record => record.type === "incoming").length;
  const outgoingCount = records.filter(record => record.type === "outgoing").length;
  return {
    documentTypes: [
      { key: "incoming", label: "البريد الوارد", count: incomingCount },
      { key: "outgoing", label: "البريد الصادر", count: outgoingCount },
      { key: "decision", label: "القرارات", count: decisionCount },
      { key: "circular", label: "المناشير", count: circularCount },
    ],
    byDepartment: group(records.filter(record => record.departmentType === "department"), "departmentName"),
    byOffice: group(records.filter(record => record.departmentType === "office"), "departmentName"),
    byEntity: group(records, "entityName").slice(0, 12),
  };
}

export function hasPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}
