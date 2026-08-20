import { afterEach, describe, expect, it } from "vitest";
import { decryptDocumentFromStorage, documentEncryptionEnabled, encryptDocumentForStorage } from "./documentEncryption";

const originalKey = process.env.DOCUMENT_ENCRYPTION_KEY;

afterEach(() => {
  process.env.DOCUMENT_ENCRYPTION_KEY = originalKey;
});

describe("تشفير المستندات المحلية", () => {
  it("يشفّر ويفك تشفير المستند باستخدام مفتاح AES-256 دون بقاء النص الأصلي في المخزن", () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const original = Buffer.from("مراسلة سياحية سرية");
    const encrypted = encryptDocumentForStorage(original);

    expect(documentEncryptionEnabled()).toBe(true);
    expect(encrypted).not.toEqual(original);
    expect(encrypted.toString("utf8")).not.toContain("مراسلة سياحية سرية");
    expect(decryptDocumentFromStorage(encrypted)).toEqual(original);
  });

  it("يرفض المستند المشفّر الذي تم العبث به", () => {
    process.env.DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    const encrypted = encryptDocumentForStorage(Buffer.from("document"));
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => decryptDocumentFromStorage(encrypted)).toThrow();
  });
});
