import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { getLocalUserByEmail } from "./db";

const password = process.env.TIDC_TEST_PASSWORD;
const integration = password ? describe : describe.skip;

integration("الحساب الإداري الأولي", () => {
  it("يوجد كحساب محلي نشط بدور مدير النظام ويُنشئ جلسة دخول دون كشف البصمة", async () => {
    const cookies: Array<{ name: string; value: string }> = [];
    const user = await getLocalUserByEmail("admin@tidcarchiv");
    expect(user).toMatchObject({ accountType: "local", role: "admin", isActive: "yes" });
    expect(user?.passwordHash).toMatch(/^scrypt-v1\$/);
    const result = await appRouter.createCaller({ user: null, req: { protocol: "https", headers: {} }, res: { cookie: (name: string, value: string) => cookies.push({ name, value }), clearCookie: () => undefined } } as any).auth.localLogin({ email: "admin@tidcarchiv", password: password! });
    expect(result).toMatchObject({ email: "admin@tidcarchiv", role: "admin" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(cookies[0]?.name).toBe("tidc_local_session");
  });
});
