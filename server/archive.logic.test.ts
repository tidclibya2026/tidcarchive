import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "../client/src/components/StatusBadge";
import { InstitutionalHeading, INSTITUTIONAL_LABEL } from "../client/src/components/InstitutionalHeading";
import { calculateKpis, formatReferenceNumber, getRoleCapabilities, hasPdfSignature, isStatusTransitionAllowed, STATUS_LABELS, summarizeReportData } from "../shared/archive";

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

describe("تجميعات التقارير الإدارية", () => {
  it("يفصل البريد الوارد والصادر ويجمعه حسب الإدارة والمكتب والجهة", () => {
    const report = summarizeReportData([
      { type: "incoming", departmentName: "إدارة التخطيط", departmentType: "department", entityName: "هيئة السياحة" },
      { type: "outgoing", departmentName: "إدارة التخطيط", departmentType: "department", entityName: "هيئة السياحة" },
      { type: "outgoing", departmentName: "مكتب المتابعة", departmentType: "office", entityName: "وزارة السياحة" },
    ], 2, 1);
    expect(report.documentTypes).toEqual([{ key: "incoming", label: "البريد الوارد", count: 1 }, { key: "outgoing", label: "البريد الصادر", count: 2 }, { key: "decision", label: "القرارات", count: 2 }, { key: "circular", label: "المناشير", count: 1 }]);
    expect(report.byDepartment[0]).toMatchObject({ name: "إدارة التخطيط", incoming: 1, outgoing: 1, total: 2 });
    expect(report.byOffice[0]).toMatchObject({ name: "مكتب المتابعة", outgoing: 1, total: 1 });
    expect(report.byEntity[0]).toMatchObject({ name: "هيئة السياحة", total: 2 });
  });
});

describe("أرشفة PDF والهوية المؤسسية", () => {
  it("يتحقق من توقيع PDF ويرفض أي ملف غير مطابق", () => {
    expect(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(true);
    expect(hasPdfSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("يرسم العنوان المؤسسي لصفحات التقارير", () => {
    const html = renderToStaticMarkup(createElement(InstitutionalHeading, { section: "التقارير والمؤشرات" }));
    expect(html).toContain(INSTITUTIONAL_LABEL);
    expect(html).toContain("التقارير والمؤشرات");
  });
});
