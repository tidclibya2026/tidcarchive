import { TRPCError } from "@trpc/server";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const signatures: Record<"application/pdf" | "image/jpeg" | "image/png" | "image/webp", (buffer: Buffer) => boolean> = {
  "application/pdf": buffer => buffer.subarray(0, 5).toString("ascii") === "%PDF-",
  "image/jpeg": buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/png": buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": buffer => buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP",
};

const extensions = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PermittedUploadMimeType = keyof typeof signatures;

export function sanitizeUploadFileName(fileName: string, mimeType: PermittedUploadMimeType) {
  const basename = fileName.replace(/\\/g, "/").split("/").pop() || "";
  const cleaned = basename
    .replace(/[\u0000-\u001f]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
  const stem = cleaned.replace(/\.[a-zA-Z0-9]+$/, "").replace(/^[._-]+|[._-]+$/g, "") || "document";
  return `${stem}.${extensions[mimeType]}`;
}

export function decodeAndValidateUpload(input: { base64: string; fileName: string; mimeType: PermittedUploadMimeType }) {
  const raw = input.base64.includes(",") ? input.base64.split(",").pop() || "" : input.base64;
  if (!raw || raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "ترميز الملف المرفوع غير صالح." });
  }
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "يجب ألا يتجاوز حجم المرفق 10 ميغابايت." });
  }
  if (!signatures[input.mimeType](buffer)) {
    const message = input.mimeType === "application/pdf"
      ? "الملف المرفق لا يحمل توقيع PDF صالحًا."
      : "نوع الملف الفعلي لا يطابق النوع المصرح به.";
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
  return { buffer, fileName: sanitizeUploadFileName(input.fileName, input.mimeType) };
}
