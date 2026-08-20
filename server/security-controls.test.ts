import { describe, expect, it, beforeEach } from "vitest";
import { applySecurityHeaders, enforceIdentifierRateLimit, enforceRequestRateLimit, resetSecurityRateLimits } from "./security";
import { decodeAndValidateUpload, sanitizeUploadFileName } from "./uploadSecurity";

describe("ضوابط أمن المرفقات", () => {
  it("يعيد تسمية الملف ويقبل فقط توقيع PNG الصحيح", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const result = decodeAndValidateUpload({
      base64: png.toString("base64"),
      fileName: "../../خطاب رسمي.PNG",
      mimeType: "image/png",
    });

    expect(result.buffer).toEqual(png);
    expect(result.fileName).toBe("document.png");
    expect(sanitizeUploadFileName("report.exe", "application/pdf")).toBe("report.pdf");
  });

  it("يرفض الترميز غير الصحيح أو المحتوى الذي لا يطابق نوعه", () => {
    expect(() => decodeAndValidateUpload({ base64: "not-base64!", fileName: "a.pdf", mimeType: "application/pdf" })).toThrow("ترميز الملف المرفوع غير صالح");
    expect(() => decodeAndValidateUpload({ base64: Buffer.from("not a PDF").toString("base64"), fileName: "a.pdf", mimeType: "application/pdf" })).toThrow("توقيع PDF صالح");
  });
});

describe("حدود الطلبات والرؤوس الأمنية", () => {
  beforeEach(() => resetSecurityRateLimits());

  it("يحظر تجاوز الحد المحدد بحسب المصدر والمعرف", () => {
    const req = { ip: "10.10.0.7", headers: {}, socket: {} } as any;
    enforceRequestRateLimit(req, "login", 2, 60_000);
    enforceRequestRateLimit(req, "login", 2, 60_000);
    expect(() => enforceRequestRateLimit(req, "login", 2, 60_000)).toThrow("تجاوز الحد المؤقت");

    enforceIdentifierRateLimit("email", "user@tidc", 1, 60_000);
    expect(() => enforceIdentifierRateLimit("email", "user@tidc", 1, 60_000)).toThrow("تجاوز الحد المؤقت");
  });

  it("يرسل سياسة محتوى ورؤوس منع التضمين والتخمين مع HSTS على HTTPS", () => {
    const headers = new Map<string, string>();
    const req = { secure: true, protocol: "https", headers: {}, ip: "127.0.0.1", socket: {} } as any;
    const res = { setHeader: (name: string, value: string) => headers.set(name, value) } as any;
    const next = () => undefined;

    applySecurityHeaders(req, res, next);

    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });
});
