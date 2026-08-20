import { describe, expect, it } from "vitest";
import { canAuthenticateLocalAccount, hashLocalPassword, normalizeEmail, verifyLocalPassword } from "./localAuth";
import { getRoleCapabilities } from "../shared/archive";
import { toSafeUser } from "./db";

describe("حسابات TIDC المحلية", () => {
  it("يطبع البريد الإداري قبل البحث عن الحساب", () => {
    expect(normalizeEmail("  ADMIN@TIDCARCHIV  ")).toBe("admin@tidcarchiv");
  });

  it("يخزن كلمة المرور كبصمة مملحة ويتحقق منها دون كشف النص", async () => {
    const hash = await hashLocalPassword("admin@2026");
    expect(hash).toMatch(/^scrypt-v1\$[0-9a-f]+\$[0-9a-f]+$/);
    await expect(verifyLocalPassword("admin@2026", hash)).resolves.toBe(true);
    await expect(verifyLocalPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("يرفض الحسابات الموقوفة أو غير المحلية من المصادقة", () => {
    expect(canAuthenticateLocalAccount({ accountType: "local", isActive: "yes", passwordHash: "hash" })).toBe(true);
    expect(canAuthenticateLocalAccount({ accountType: "local", isActive: "no", passwordHash: "hash" })).toBe(false);
    expect(canAuthenticateLocalAccount({ accountType: "oauth", isActive: "yes", passwordHash: null })).toBe(false);
  });

  it("يقصر إدارة المستخدمين على مدير النظام ولا يسرّب بصمة كلمة المرور", () => {
    expect(getRoleCapabilities("admin").canManageUsers).toBe(true);
    expect(getRoleCapabilities("staff").canManageUsers).toBe(false);
    const safe = toSafeUser({ id: 1, openId: "local_test", name: "اختبار", email: "test@tidc", loginMethod: "local-password", accountType: "local", passwordHash: "secret-hash", isActive: "yes", role: "admin", departmentId: null, officeId: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), passwordChangedAt: new Date() } as any);
    expect(safe).not.toHaveProperty("passwordHash");
  });
});
