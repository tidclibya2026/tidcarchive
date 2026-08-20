import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

async function hashLocalPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `scrypt-v1$${salt}$${derived.toString("hex")}`;
}

async function ensureInitialAdmin() {
  const email = (process.env.TIDC_INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.TIDC_INITIAL_ADMIN_PASSWORD || "";
  if (!email || password.length < 10) throw new Error("تعذر تهيئة المدير: عيّن بريد المدير وكلمة مرور لا تقل عن 10 أحرف في ملف .env.");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [existing] = await connection.execute("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (Array.isArray(existing) && existing.length > 0) return;

    const passwordHash = await hashLocalPassword(password);
    const openId = `local_admin_${randomBytes(12).toString("hex")}`;
    const [result] = await connection.execute(
      "INSERT INTO users (openId, name, email, loginMethod, accountType, passwordHash, role, isActive, accessLevel, passwordChangedAt, lastSignedIn) VALUES (?, ?, ?, 'local-password', 'local', ?, 'admin', 'yes', 'full', NOW(), NOW())",
      [openId, "مدير النظام", email, passwordHash],
    );
    const userId = result.insertId;
    await connection.execute(
      "INSERT INTO account_activity_logs (userId, actorId, action, detail) VALUES (?, ?, 'account_created', 'تم إنشاء حساب مدير النظام أثناء التهيئة المحلية.')",
      [userId, userId],
    );
    console.log(`[TIDC] Created initial local administrator: ${email}`);
  } finally {
    await connection.end();
  }
}

await run(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "migrate"]);
await ensureInitialAdmin();
await run(process.execPath, ["dist/index.js"]);
