import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLocalUserByEmail: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
  toSafeUser: vi.fn((user: Record<string, unknown>) => ({ id: user.id, email: user.email, role: user.role })),
  createLocalSessionToken: vi.fn(),
}));

vi.mock("./db", () => ({
  getLocalUserByEmail: mocks.getLocalUserByEmail,
  updateUserLastSignedIn: mocks.updateUserLastSignedIn,
  toSafeUser: mocks.toSafeUser,
}));
vi.mock("./_core/sdk", () => ({ sdk: { createLocalSessionToken: mocks.createLocalSessionToken } }));

import { appRouter } from "./routers";
import { hashLocalPassword } from "./localAuth";

function context() {
  const cookies: Array<{ name: string; value: string }> = [];
  return { cookies, ctx: { user: null, req: { protocol: "https", headers: {} }, res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: vi.fn() } } as any };
}

describe("تسجيل الدخول المحلي", () => {
  it("ينشئ جلسة موقعة لحساب إداري محلي نشط دون إرجاع بصمة كلمة المرور", async () => {
    const passwordHash = await hashLocalPassword("very-secure-password");
    mocks.getLocalUserByEmail.mockResolvedValueOnce({ id: 12, email: "admin@tidcarchiv", role: "admin", accountType: "local", isActive: "yes", passwordHash });
    mocks.createLocalSessionToken.mockResolvedValueOnce("signed-local-session");
    const { ctx, cookies } = context();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.localLogin({ email: "ADMIN@TIDCARCHIV", password: "very-secure-password" });
    expect(mocks.getLocalUserByEmail).toHaveBeenCalledWith("admin@tidcarchiv");
    expect(mocks.updateUserLastSignedIn).toHaveBeenCalledWith(12);
    expect(cookies[0]?.name).toBe("tidc_local_session");
    expect(result).toEqual({ id: 12, email: "admin@tidcarchiv", role: "admin" });
  });

  it("يرفض الحساب المحلي الموقوف", async () => {
    mocks.getLocalUserByEmail.mockResolvedValueOnce({ id: 13, email: "blocked@tidcarchiv", role: "staff", accountType: "local", isActive: "no", passwordHash: "scrypt-v1$00$00" });
    const { ctx } = context();
    await expect(appRouter.createCaller(ctx).auth.localLogin({ email: "blocked@tidcarchiv", password: "very-secure-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
