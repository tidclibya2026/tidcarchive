import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/CorrespondencePage.tsx"), "utf8");

describe("بطاقة بيانات الأرشفة للمراسلات", () => {
  it("تعرض الحقول الأرشيفية المطلوبة باللغة العربية", () => {
    expect(source).toContain("تصنيف الوثيقة");
    expect(source).toContain("درجة السرية");
    expect(source).toContain("الكلمات المفتاحية");
    expect(source).toContain("حالة الوثيقة");
    expect(source).toContain("الرقم الإشاري وتاريخ الإدخال يُنشآن تلقائيًا");
  });

  it("يجعل الرقم الإشاري الحقل الأساسي والإلزامي", () => {
    expect(source).toContain("الرقم الإشاري *");
    expect(source).toContain("الرقم الإشاري هو المعرّف الأساسي للمعاملة");
    expect(source).toContain("referenceNumber: referenceNumber.trim()");
  });

  it("يستخدم قوائم الجهات الداخلية والخارجية المحفوظة بدل الإدخال النصي الحر", () => {
    expect(source).toContain("trpc.catalog.organizationUnits.useQuery");
    expect(source).toContain("trpc.catalog.externalEntities.useQuery");
    expect(source).toContain("PartySelect");
    expect(source).toContain("اختر جهة خارجية");
  });
});
