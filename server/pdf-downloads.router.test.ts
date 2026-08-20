import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listOfficialPdfDownloads: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), listOfficialPdfDownloads: mocks.listOfficialPdfDownloads }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: Partial<NonNullable<TrpcContext["user"]>>): TrpcContext {
  return { user: { id: 1, openId: "test", name: "مختبر", email: "test@tidc.ly", loginMethod: "local-password", accountType: "local", passwordHash: null, isActive: "yes", accessLevel: "standard", role: "staff", departmentId: null, officeId: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), passwordChangedAt: null, ...user }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("مراقبة تنزيلات PDF", () => {
  it("تعرض السجل للحساب التنفيذي ذي الصلاحية الكاملة", async () => {
    mocks.listOfficialPdfDownloads.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(context({ role: "director_general", accessLevel: "full" }));
    await expect(caller.pdfDownloads.list({ documentType: "decision" })).resolves.toEqual([]);
    expect(mocks.listOfficialPdfDownloads).toHaveBeenCalledWith({ documentType: "decision" });
  });

  it("ترفض عرض السجل للحساب غير المخول", async () => {
    const caller = appRouter.createCaller(context({ role: "staff", accessLevel: "standard" }));
    await expect(caller.pdfDownloads.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
