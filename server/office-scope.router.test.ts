import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCorrespondenceList: vi.fn(),
  createCorrespondence: vi.fn(),
  getDecisions: vi.fn(),
  getCirculars: vi.fn(),
  searchArchive: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";

const staffContext = {
  user: { id: 18, openId: "local_staff", role: "staff", departmentId: 4, officeId: 9, accountType: "local", isActive: "yes" },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: vi.fn(), cookie: vi.fn() },
} as any;

describe("نطاق المكتب في الأرشيف", () => {
  it("يمرر نطاق المكتب إلى القوائم والبحث الموحد", async () => {
    mocks.getDecisions.mockResolvedValueOnce([]);
    mocks.getCirculars.mockResolvedValueOnce([]);
    mocks.searchArchive.mockResolvedValueOnce([]);
    mocks.getCorrespondenceList.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(staffContext);
    await caller.decisions.list();
    await caller.circulars.list();
    await caller.archive.search({ query: "وثيقة" });
    await caller.correspondence.list({});
    expect(mocks.getDecisions).toHaveBeenCalledWith(9);
    expect(mocks.getCirculars).toHaveBeenCalledWith(9);
    expect(mocks.searchArchive).toHaveBeenCalledWith(expect.objectContaining({ query: "وثيقة" }), 9);
    expect(mocks.getCorrespondenceList).toHaveBeenCalledWith(expect.objectContaining({ departmentId: 9 }));
  });

  it("يرفض تسجيل مراسلة في إدارة خارج نطاق مكتب الموظف", async () => {
    const caller = appRouter.createCaller(staffContext);
    await expect(caller.correspondence.create({ type: "incoming", subject: "اختبار نطاق مكتب", sourceEntity: "جهة اختبار", documentDate: new Date(), priority: "normal", currentDepartmentId: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createCorrespondence).not.toHaveBeenCalled();
  });
});
