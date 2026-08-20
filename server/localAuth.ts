import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateLocalPassword(password: string) {
  return password.length >= 10 && password.length <= 128;
}

export function canAuthenticateLocalAccount(account: { accountType: string; isActive: string; passwordHash: string | null }) {
  return account.accountType === "local" && account.isActive === "yes" && Boolean(account.passwordHash);
}

export async function hashLocalPassword(password: string) {
  if (!validateLocalPassword(password)) throw new Error("يجب أن تتكون كلمة المرور من 10 أحرف على الأقل.");
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt-v1$${salt}$${derived.toString("hex")}`;
}

export async function verifyLocalPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt-v1" || !salt || !expectedHex) return false;
  try {
    const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
