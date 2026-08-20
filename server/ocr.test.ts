import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateAttachmentOcr: vi.fn(), fetch: vi.fn() }));
vi.mock("./db", () => mocks);

import { enqueueLocalOcr, receiveLocalOcrResult, supportsLocalOcr } from "./ocr";

const originalEndpoint = process.env.LOCAL_OCR_ENDPOINT;
const originalSecret = process.env.LOCAL_OCR_SHARED_SECRET;

afterEach(() => {
  process.env.LOCAL_OCR_ENDPOINT = originalEndpoint;
  process.env.LOCAL_OCR_SHARED_SECRET = originalSecret;
  mocks.updateAttachmentOcr.mockReset();
  mocks.fetch.mockReset();
  vi.unstubAllGlobals();
});

describe("عقد OCR المحلي", () => {
  it("يدعم PDF وصيغ الصور المصرح بها فقط", () => {
    expect(supportsLocalOcr("application/pdf")).toBe(true);
    expect(supportsLocalOcr("image/jpeg")).toBe(true);
    expect(supportsLocalOcr("text/plain")).toBe(false);
  });

  it("يبقي المهمة في الانتظار عندما لا تُهيأ خدمة OCR المحلية", async () => {
    delete process.env.LOCAL_OCR_ENDPOINT;
    delete process.env.LOCAL_OCR_SHARED_SECRET;
    await expect(enqueueLocalOcr({ attachmentId: 1, fileKey: "tidc/a.pdf", mimeType: "application/pdf" })).resolves.toMatchObject({ status: "pending" });
  });

  it("يرسل فقط بيانات المهمة المصرح بها إلى عامل OCR عند تهيئة الخدمة", async () => {
    process.env.LOCAL_OCR_ENDPOINT = "http://ocr.local";
    process.env.LOCAL_OCR_SHARED_SECRET = "test-ocr-secret";
    mocks.fetch.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mocks.fetch);

    await expect(enqueueLocalOcr({ attachmentId: 7, fileKey: "tidc/7/file.pdf", mimeType: "application/pdf" })).resolves.toEqual({ status: "processing" });
    expect(mocks.fetch).toHaveBeenCalledWith("http://ocr.local/v1/ocr/jobs", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-TIDC-OCR-Secret": "test-ocr-secret" }),
      body: JSON.stringify({ attachmentId: 7, fileKey: "tidc/7/file.pdf", mimeType: "application/pdf" }),
    }));
  });

  it("يفهرس نص نتيجة OCR بعد تقليمه ولا يقبل طلبًا بلا سر مشترك", async () => {
    process.env.LOCAL_OCR_SHARED_SECRET = "test-ocr-secret";
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    const request = { header: (name: string) => name === "X-TIDC-OCR-Secret" ? "test-ocr-secret" : undefined, body: { attachmentId: 8, status: "completed", extractedText: "نص عربي مفهرس".repeat(20_000) } } as any;
    await receiveLocalOcrResult(request, response);
    expect(mocks.updateAttachmentOcr).toHaveBeenCalledWith(expect.objectContaining({ attachmentId: 8, status: "completed", extractedText: expect.stringMatching(/^نص عربي/) }));
    expect(mocks.updateAttachmentOcr.mock.calls[0][0].extractedText.length).toBeLessThanOrEqual(200_000);
    expect(response.json).toHaveBeenCalledWith({ ok: true, attachmentId: 8, status: "completed" });
  });
});
