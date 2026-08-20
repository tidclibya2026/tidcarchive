import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import * as archiveDb from "./db";

type OcrStatus = "pending" | "processing" | "completed" | "failed" | "not_supported";

function equalSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function supportsLocalOcr(mimeType: string) {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

export async function enqueueLocalOcr(input: { attachmentId: number; fileKey: string; mimeType: string }): Promise<{ status: OcrStatus; detail?: string }> {
  if (!supportsLocalOcr(input.mimeType)) return { status: "not_supported" };
  const endpoint = process.env.LOCAL_OCR_ENDPOINT?.replace(/\/+$/, "");
  const secret = process.env.LOCAL_OCR_SHARED_SECRET;
  if (!endpoint || !secret) return { status: "pending", detail: "خدمة OCR المحلية غير مهيأة بعد." };
  try {
    const response = await fetch(`${endpoint}/v1/ocr/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-TIDC-OCR-Secret": secret },
      body: JSON.stringify({ attachmentId: input.attachmentId, fileKey: input.fileKey, mimeType: input.mimeType }),
    });
    if (!response.ok) return { status: "failed", detail: `تعذر قبول مهمة OCR المحلية (${response.status}).` };
    return { status: "processing" };
  } catch {
    return { status: "failed", detail: "تعذر الاتصال بخدمة OCR المحلية." };
  }
}

export async function receiveLocalOcrResult(req: Request, res: Response) {
  const configuredSecret = process.env.LOCAL_OCR_SHARED_SECRET;
  const receivedSecret = req.header("X-TIDC-OCR-Secret") || "";
  if (!configuredSecret || !equalSecret(receivedSecret, configuredSecret)) return res.status(403).json({ error: "ocr-callback-forbidden" });
  const body = req.body as { attachmentId?: unknown; status?: unknown; extractedText?: unknown; error?: unknown };
  const attachmentId = typeof body.attachmentId === "number" && Number.isInteger(body.attachmentId) ? body.attachmentId : 0;
  const status = body.status === "completed" || body.status === "failed" ? body.status : null;
  const extractedText = typeof body.extractedText === "string" ? body.extractedText.trim().slice(0, 200_000) : undefined;
  const error = typeof body.error === "string" ? body.error.trim().slice(0, 500) : undefined;
  if (!attachmentId || !status) return res.status(400).json({ error: "invalid-ocr-payload" });
  if (status === "completed" && !extractedText) return res.status(400).json({ error: "missing-ocr-text" });
  await archiveDb.updateAttachmentOcr({ attachmentId, status, extractedText, error });
  return res.json({ ok: true, attachmentId, status });
}
