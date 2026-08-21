import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrganizationUnit: vi.fn(),
  createExternalEntity: vi.fn(),
  listOrganizationUnits: vi.fn(),
  listExternalEntities: vi.fn(),
  resolveCorrespondenceParties: vi.fn(),
  createCorrespondence: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";

const adminContext = {
  user: { id: 1, openId: "local_admin", role: "admin", accessLevel: "standard", departmentId: null, officeId: null, accountType: "local", isActive: "yes" },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: vi.fn(), cookie: vi.fn() },
} as any;

const staffContext = {
  user: { id: 18, openId: "local_staff", role: "staff", departmentId: 4, officeId: 9, accountType: "local", isActive: "yes" },
  req: { protocol: "https", headers: {} },
  res: { clearCookie: vi.fn(), cookie: vi.fn() },
} as any;

describe("إدارة الجهات والهيكل التنظيمي", () => {
  it("تسمح للحساب الإداري بإضافة وحدة تنظيمية وجهة خارجية", async () => {
    mocks.createOrganizationUnit.mockResolvedValueOnce({ id: 41 });
    mocks.createExternalEntity.mockResolvedValueOnce({ id: 11 });
    const caller = appRouter.createCaller(adminContext);

    await caller.organization.createUnit({ nameAr: "قسم التخطيط", code: "PLAN", type: "section", parentId: 2 });
    await caller.organization.createExternal({ nameAr: "وزارة السياحة والصناعات التقليدية", category: "ministry" });

    expect(mocks.createOrganizationUnit).toHaveBeenCalledWith({ nameAr: "قسم التخطيط", code: "PLAN", type: "section", parentId: 2 });
    expect(mocks.createExternalEntity).toHaveBeenCalledWith({ nameAr: "وزارة السياحة والصناعات التقليدية", category: "ministry" });
  });

  it("يرفض إدارة الهيكل والجهات للحساب غير المخول", async () => {
    const caller = appRouter.createCaller(staffContext);
    await expect(caller.organization.listUnits()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.organization.createExternal({ nameAr: "جهة غير مخولة", category: "other" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يمرر الجهة الخارجية المختارة لإنشاء مراسلة ويحتفظ باسمها المحلول", async () => {
    mocks.resolveCorrespondenceParties.mockResolvedValueOnce({ sourceEntity: "مكتب المتابعة", destinationEntity: "وزارة المالية", sourceDepartmentId: 9, destinationExternalEntityId: 11 });
    mocks.createCorrespondence.mockResolvedValueOnce({ id: 7, referenceNumber: "TIDC/ص/2026/00007" });
    const caller = appRouter.createCaller(staffContext);

    await caller.correspondence.create({ type: "outgoing", subject: "تجربة جهة خارجية", sourceDepartmentId: 9, destinationExternalEntityId: 11, documentDate: new Date(), priority: "normal" });

    expect(mocks.resolveCorrespondenceParties).toHaveBeenCalledWith(expect.objectContaining({ sourceDepartmentId: 9, destinationExternalEntityId: 11 }));
    expect(mocks.createCorrespondence).toHaveBeenCalledWith(expect.objectContaining({ sourceEntity: "مكتب المتابعة", destinationEntity: "وزارة المالية", sourceDepartmentId: 9, destinationExternalEntityId: 11 }));
  });
});
