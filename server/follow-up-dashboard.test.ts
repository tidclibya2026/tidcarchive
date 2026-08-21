import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const followUpSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/FollowUpPage.tsx"), "utf8");
const usersSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/UsersPage.tsx"), "utf8");
const routerSource = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
const schemaSource = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");

describe("لوحة مكتب المتابعة والإشعارات والتصفية الوظيفية", () => {
  it("يعرض المهام المعلقة ومؤشرات الحالات والتنبيهات غير المقروءة", () => {
    expect(followUpSource).toContain("لوحة تشغيلية مخصصة");
    expect(followUpSource).toContain("المهام المعلقة");
    expect(followUpSource).toContain("تنبيهات جديدة");
    expect(followUpSource).toContain("notifications.data?.unreadCount");
    expect(followUpSource).toContain("statusLabels");
  });

  it("يوفر مسار إرسال التقرير للمراجعة ومسارات قراءة الإشعار وتعليمه كمقروء", () => {
    expect(routerSource).toContain("submitForReview");
    expect(routerSource).toContain("notifications: router");
    expect(routerSource).toContain("markRead");
    expect(schemaSource).toContain('"notifications"');
    expect(schemaSource).toContain('"report_submitted"');
  });

  it("يدعم البحث والتصفية حسب الدور والحالة في قائمة المستخدمين", () => {
    expect(usersSource).toContain("roleFilter");
    expect(usersSource).toContain("activeFilter");
    expect(usersSource).toContain("البحث بالاسم أو البريد");
    expect(usersSource).toContain("مسح التصفية");
    expect(routerSource).toContain("list: protectedProcedure");
    expect(routerSource).toContain("role: z.enum");
  });
});
