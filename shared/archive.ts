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
