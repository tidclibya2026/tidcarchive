import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/Home.tsx"), "utf8");

describe("سهولة استخدام لوحة القيادة", () => {
  it("يوفر إجراءات سريعة للوارد والصادر والبحث والمتابعة والتقارير", () => {
    expect(homeSource).toContain("تسجيل وارد");
    expect(homeSource).toContain("تسجيل صادر");
    expect(homeSource).toContain("البحث في الأرشيف");
    expect(homeSource).toContain("متابعة المعاملات");
    expect(homeSource).toContain("التقارير والمؤشرات");
  });

  it("يحافظ على بطاقات المؤشرات القابلة للوصول والتخطيط المتجاوب", () => {
    expect(homeSource).toContain("aria-label={`${card.label}: ${number.format(card.value)}. فتح التفاصيل`}");
    expect(homeSource).toContain("focus-visible:ring-2 focus-visible:ring-[#c49e47]");
    expect(homeSource).toContain("grid w-full grid-cols-2");
    expect(homeSource).toContain("sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5");
    expect(homeSource).toContain("تتحدث المؤشرات تلقائيًا كل 30 ثانية");
  });

  it("يعرض الإحصاءات السريعة للوارد والصادر والقرارات", () => {
    expect(homeSource).toContain("إحصاءات التسجيل السريعة");
    expect(homeSource).toContain("quickStats?.incoming");
    expect(homeSource).toContain("quickStats?.outgoing");
    expect(homeSource).toContain("quickStats?.decisions");
    expect(homeSource).toContain("المراسلات الواردة");
    expect(homeSource).toContain("المراسلات الصادرة");
    expect(homeSource).toContain("القرارات الإدارية");
  });
});
