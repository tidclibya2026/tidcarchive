import React from "react";
import { Landmark } from "lucide-react";

export const REPORTS_TITLE = "تقارير المراسلات والوثائق الرسمية";
export const REPORTS_SUBTITLE = "إحصاءات مباشرة من سجلات النظام للبريد الوارد والصادر والقرارات والمناشير وتوزيع الرسائل على الجهات التنظيمية.";

export function ReportsHeading() {
  return <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="institution-label">إحصاءات ورسومات إدارية</p><h1 className="mt-2 text-2xl font-bold text-[#17394d]">{REPORTS_TITLE}</h1><p className="mt-2 text-xs leading-6 text-[#718793]">{REPORTS_SUBTITLE}</p></div><div className="flex items-center gap-2 rounded-xl border border-[#d5e2dd] bg-white px-4 py-2 text-[10px] font-bold text-[#47707a]"><Landmark className="h-4 w-4 text-[#b28937]" />دولة ليبيا · وزارة السياحة والصناعات التقليدية</div></div>;
}
