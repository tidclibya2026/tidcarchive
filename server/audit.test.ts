import { describe, expect, it } from "vitest";
import { exportAccountActivityCsv } from "../shared/audit";

describe("تصدير سجل تدقيق الحسابات", () => {
  it("ينشئ ملف CSV عربيًا بعلامة BOM ويحمي القيم التي تحتوي علامات اقتباس", () => {
    const csv = exportAccountActivityCsv([{ createdAt: new Date("2026-08-20T00:00:00.000Z"), action: "account_updated", detail: "تعديل \"صلاحية\"", userName: "مدير النظام", userEmail: "admin@tidcarchiv", actorName: "مدير النظام" }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"تعديل \"\"صلاحية\"\"\"");
    expect(csv).toContain("البريد الإلكتروني");
  });
});
