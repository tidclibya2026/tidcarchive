import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listAccountActivity: vi.fn() }));
vi.mock("./db", () => mocks);

import { appRouter } from "./routers";

const adminContext = { user: { id: 1, openId: "admin", role: "admin", departmentId: 1, officeId: null, accountType: "local", isActive: "yes" }, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as any;
const staffContext = { user: { id: 2, openId: "staff", role: "staff", departmentId: 2, officeId: null, accountType: "local", isActive: "yes" }, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as any;

describe("إجراءات سجل تدقيق الحسابات", () => {
  it("يمرر مرشحات المدير إلى طبقة البيانات ويعيد السجل", async () => {
    const filter = { action: "account_created", userId: 5 };
    mocks.listAccountActivity.mockResolvedValueOnce([]);
    await expect(appRouter.createCaller(adminContext).audit.list(filter)).resolves.toEqual([]);
    expect(mocks.listAccountActivity).toHaveBeenCalledWith(filter);
  });

  it("يرفض طلب سجل التدقيق من المستخدم غير الإداري", async () => {
    await expect(appRouter.createCaller(staffContext).audit.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ينشئ بيانات CSV من الصفوف المصرح بها", async () => {
    mocks.listAccountActivity.mockResolvedValueOnce([{ id: 7, createdAt: new Date("2026-08-20T00:00:00.000Z"), action: "account_created", detail: null, userName: "موظف", userEmail: "user@tidc.local", actorName: "مدير النظام" }]);
    const result = await appRouter.createCaller(adminContext).audit.exportCsv();
    expect(result.fileName).toMatch(/^tidc-account-audit-.*\.csv$/);
    expect(result.csv).toContain("user@tidc.local");
  });
});
