import React from "react";

export const INSTITUTIONAL_LABEL = "دولة ليبيا · وزارة السياحة والصناعات التقليدية";

export function InstitutionalHeading({ section }: { section: string }) {
  return <div>
    <p className="text-[10px] font-bold tracking-[.06em] text-[#9a7a34]">{INSTITUTIONAL_LABEL}</p>
    <h2 className="mt-0.5 text-base font-bold text-[#16394d]">{section}</h2>
  </div>;
}
