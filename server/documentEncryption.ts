import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("TIDCENC1", "ascii");
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const encoded = process.env.DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!encoded) return null;
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte AES-256 key");
  return key;
}

export function documentEncryptionEnabled() {
  return Boolean(getEncryptionKey());
}

export function encryptDocumentForStorage(data: Buffer) {
  const key = getEncryptionKey();
  if (!key) return data;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decryptDocumentFromStorage(data: Buffer) {
  const key = getEncryptionKey();
  if (!key) return data;
  const minimumLength = MAGIC.length + IV_LENGTH + TAG_LENGTH + 1;
  if (data.length < minimumLength || !data.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Encrypted document envelope is missing or invalid");
  }
  const ivStart = MAGIC.length;
  const tagStart = ivStart + IV_LENGTH;
  const ciphertextStart = tagStart + TAG_LENGTH;
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(ivStart, tagStart));
  decipher.setAuthTag(data.subarray(tagStart, ciphertextStart));
  return Buffer.concat([decipher.update(data.subarray(ciphertextStart)), decipher.final()]);
}
