import { PRIORITY_LABELS, STATUS_LABELS } from "../../../shared/archive";
import React from "react";

const statusStyle: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 ring-sky-700/10",
  referred: "bg-violet-50 text-violet-700 ring-violet-700/10",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-700/10",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-700/10",
  archived: "bg-slate-100 text-slate-700 ring-slate-600/10",
};

export function StatusBadge({ status }: { status: keyof typeof STATUS_LABELS }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyle[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: keyof typeof PRIORITY_LABELS }) {
  const urgent = priority === "urgent";
  const confidential = priority === "confidential";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${urgent ? "bg-rose-50 text-rose-700" : confidential ? "bg-[#173d51] text-[#f4d998]" : "bg-[#f4f1e8] text-[#76643a]"}`}>{PRIORITY_LABELS[priority]}</span>;
}
