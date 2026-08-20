import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createDecision: vi.fn(),
  createCircular: vi.fn(),
}));

vi.mock("./db", () => ({
  createDecision: dbMocks.createDecision,
  createCircular: dbMocks.createCircular,
}));

import { appRouter } from "./routers";

const ctx = {
  user: { id: 7, openId: "director", name: "مدير عام", email: null, loginMethod: "test", role: "director_general", departmentId: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: vi.fn() },
} as any;

const validBase = { subject: "قرار تنظيمي للاختبار", bodyText: "ملخص", issuingDepartmentId: undefined, sourceCorrespondenceId: undefined };

describe("إجراءات القرارات والمناشير المؤرشفة", () => {
  it("يرفض القرار والمنشور عند غياب ملف PDF الإلزامي", async () => {
    const caller = appRouter.createCaller(ctx);
    await expect(caller.decisions.create({ ...validBase, effectiveDate: new Date() } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.circulars.create({ ...validBase, issueDate: new Date(), targetDepartmentIds: [] } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يرفض ملف PDF الذي لا يحمل توقيعًا صالحًا ضمن مسار إنشاء القرار", async () => {
    dbMocks.createDecision.mockResolvedValueOnce({ id: 99, decisionNumber: "ق/2026/0001" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.decisions.create({ ...validBase, effectiveDate: new Date(), pdf: { fileName: "invalid.pdf", base64: "data:application/pdf;base64,SGVsbG8gV0VMQ09NRQ==" } })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "الملف المرفق لا يحمل توقيع PDF صالحًا." });
  });
});
