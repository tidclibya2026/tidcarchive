import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "../client/src/components/StatusBadge";
import { calculateKpis, formatReferenceNumber, getRoleCapabilities, isStatusTransitionAllowed, STATUS_LABELS } from "../shared/archive";

describe("صلاحيات الأدوار المؤسسية", () => {
  it("يمنح المدير العام رؤية شاملة وإحالة واعتماد الوثائق الرسمية", () => {
    expect(getRoleCapabilities("director_general")).toMatchObject({ canViewAll: true, canRefer: true, canCreateDecisionOrCircular: true, canManageUsers: false });
  });

  it("يقصر صلاحيات الموظف على نطاقه التشغيلي", () => {
    expect(getRoleCapabilities("staff")).toMatchObject({ canViewAll: false, canRefer: false, canCreateDecisionOrCircular: false, canManageUsers: false });
  });
});

describe("الترقيم المؤسسي وحالات الدورة", () => {
  it("ينشئ أرقام الوارد والصادر بالتنسيق السنوي المعتمد", () => {
    expect(formatReferenceNumber("incoming", 2026, 123)).toBe("TIDC/و/2026/00123");
    expect(formatReferenceNumber("outgoing", 2026, 87)).toBe("TIDC/ص/2026/00087");
  });

  it("يتضمن تسميات الحالات العربية المعتمدة", () => {
    expect(STATUS_LABELS).toMatchObject({ new: "جديدة", referred: "محالة", in_progress: "قيد المعالجة", completed: "منجزة", archived: "مؤرشفة" });
  });
});

describe("مؤشرات الأداء", () => {
  it("يحسب المعاملات النشطة والمتأخرة ومتوسط زمن الإنجاز", () => {
    const now = new Date("2026-08-20T12:00:00Z");
    const metrics = calculateKpis([
      { status: "in_progress", dueAt: new Date("2026-08-19T12:00:00Z"), createdAt: new Date("2026-08-18T12:00:00Z"), completedAt: null },
      { status: "referred", dueAt: new Date("2026-08-22T12:00:00Z"), createdAt: new Date("2026-08-19T12:00:00Z"), completedAt: null },
      { status: "completed", dueAt: null, createdAt: new Date("2026-08-18T12:00:00Z"), completedAt: new Date("2026-08-20T12:00:00Z") },
      { status: "archived", dueAt: null, createdAt: new Date("2026-08-18T12:00:00Z"), completedAt: null },
    ], now);
    expect(metrics).toEqual({ active: 2, overdue: 1, inProgress: 1, completed: 1, archived: 1, averageCompletionHours: 48 });
  });
});

describe("انتقالات دورة المستند", () => {
  it("يسمح بالانتقالات التشغيلية الصحيحة ويمنع إعادة فتح الأرشيف", () => {
    expect(isStatusTransitionAllowed("referred", "in_progress")).toBe(true);
    expect(isStatusTransitionAllowed("in_progress", "completed")).toBe(true);
    expect(isStatusTransitionAllowed("archived", "new")).toBe(false);
  });
});

describe("مكوّن حالة المعاملة", () => {
  it("يعرض التسمية العربية للحالة المنجزة", () => {
    const html = renderToStaticMarkup(createElement(StatusBadge, { status: "completed" }));
    expect(html).toContain("منجزة");
  });
});
