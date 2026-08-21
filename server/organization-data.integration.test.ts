import { describe, expect, it } from "vitest";
import { createExternalEntity, createOrganizationUnit, listExternalEntities, updateOrganizationUnit } from "./db";

const approvedExternalEntities = [
  "وزارة السياحة والصناعات التقليدية", "جهاز تطوير الصناعات التقليدية", "جهاز تطوير المنتزهات الوطنية", "جهاز الشرطة السياحية", "مصلحة الجوازات والهجرة", "وزارة الداخلية", "وزارة المواصلات", "وزارة الاتصالات", "وزارة الزراعة", "وزارة المياه", "وزارة البيئة", "وزارة الرياضة", "وزارة الشباب", "وزارة الخدمة المدنية", "وزارة العمل والتأهيل", "وزارة المالية", "إدارة الميزانية بوزارة المالية", "إدارة المراقبين بوزارة المالية", "مصلحة الطيران المدني", "جهاز تطوير مدينة طرابلس القديمة", "جهاز المدن التاريخية", "جهاز تطوير المدينة القديمة بغدامس", "جهاز تطوير مدينة غدامس",
];

describe("التحقق التكاملـي لسجل الجهات والهيكل", () => {
  it("يحتوي سجل الجهات على الجهات الخارجية الـ23 المعتمدة", async () => {
    const entities = await listExternalEntities();
    expect(approvedExternalEntities.every(name => entities.some(entity => entity.nameAr === name && entity.isActive === "yes"))).toBe(true);
  });

  it("يرفض الوالد التنظيمي غير الموجود أو الوحدة التابعة لنفسها", async () => {
    await expect(createOrganizationUnit({ nameAr: "وحدة اختبار غير صالحة", code: "INVALID_PARENT", type: "unit", parentId: 999999 })).rejects.toThrow("الوحدة التنظيمية الأم");
    await expect(updateOrganizationUnit({ id: 1, parentId: 1 })).rejects.toThrow("نفسها");
  });

  it("يرفض تكرار اسم جهة خارجية أو رمز وحدة قائم قبل إجراء إدراج جديد", async () => {
    await expect(createExternalEntity({ nameAr: "وزارة المالية", category: "ministry" })).rejects.toThrow("مستخدم بالفعل");
    await expect(createOrganizationUnit({ nameAr: "مركز المعلومات والتوثيق السياحي", code: "TIDC", type: "unit" })).rejects.toThrow("مستخدم بالفعل");
  });
});
