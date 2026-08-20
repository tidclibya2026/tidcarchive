import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const password = process.env.ADMIN_PASSWORD;
if (!password) throw new Error("ADMIN_PASSWORD is required");

const scrypt = promisify(scryptCallback);
const salt = randomBytes(16).toString("hex");
const derived = await scrypt(password, salt, 64);
console.log(`scrypt-v1$${salt}$${Buffer.from(derived).toString("hex")}`);
