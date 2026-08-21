import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const followUpSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/FollowUpPage.tsx"), "utf8");
const usersSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/UsersPage.tsx"), "utf8");
const routerSource = fs.readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
const schemaSource = fs.readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");
const layoutSource = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/components/DashboardLayout.tsx"), "utf8");

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

  it("يوفر تصديرًا رسميًا لقائمة المهام إلى نافذة طباعة PDF", () => {
    expect(followUpSource).toContain("تصدير PDF");
    expect(followUpSource).toContain("exportPendingTasks");
    expect(followUpSource).toContain("مركز المعلومات والتوثيق السياحي");
    expect(followUpSource).toContain("window.print");
  });

  it("يعرض شارة التنبيهات ويثبت الشريط العلوي ويضيف حركة للشعارات", () => {
    expect(layoutSource).toContain("notificationData?.unreadCount");
    expect(layoutSource).toContain("sticky top-0");
    expect(layoutSource).toContain("transition-transform");
    expect(layoutSource).toContain("ministry-logo_002815c1.png");
  });

  it("يدعم البحث باسم المهمة أو المسؤول ويربط التصدير بالنتائج المفلترة", () => {
    expect(followUpSource).toContain("taskSearch");
    expect(followUpSource).toContain("filteredPending");
    expect(followUpSource).toContain("بحث باسم المهمة أو المسؤول");
    expect(followUpSource).toContain("exportPendingTasks(filteredPending)");
  });

  it("يدعم الوضع الليلي وتعليم كل الإشعارات كمقروءة من الشارة", () => {
    expect(layoutSource).toContain("toggleTheme");
    expect(layoutSource).toContain("التبديل إلى الوضع الليلي");
    expect(layoutSource).toContain("notifications.markAllRead");
    expect(routerSource).toContain("markAllRead");
    expect(schemaSource).toContain("readAt");
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
