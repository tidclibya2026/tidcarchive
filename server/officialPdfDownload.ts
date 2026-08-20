import type { Express } from "express";
import { hasFullSystemAccess, isExecutiveRole, type InstitutionalRole } from "../shared/archive";
import * as archiveDb from "./db";
import { decryptDocumentFromStorage } from "./documentEncryption";
import { storageGetLocalObject, storageGetSignedUrl, usesLocalS3Storage } from "./storage";
import { sdk } from "./_core/sdk";

type DownloadUser = {
  role: string;
  accessLevel?: string | null;
  departmentId: number | null;
  officeId: number | null;
};

type OfficialDocumentType = "decision" | "circular";

function isOfficialDocumentType(value: string): value is OfficialDocumentType {
  return value === "decision" || value === "circular";
}

export function canDownloadOfficialPdf(user: DownloadUser, issuingDepartmentId: number | null) {
  if (hasFullSystemAccess(user) || isExecutiveRole(user.role as InstitutionalRole)) return true;
  const userScope = user.officeId || user.departmentId;
  return Boolean(userScope && issuingDepartmentId && userScope === issuingDepartmentId);
}

async function readStoredBody(body: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    const part = Buffer.from(chunk);
    total += part.length;
    if (total > 11 * 1024 * 1024) throw new Error("stored-object-too-large");
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

function setDownloadHeaders(res: Parameters<Express["get"]>[1] extends (...args: infer Args) => unknown ? Args[1] : never, fileName: string) {
  const safeFallbackName = "tidc-official-document.pdf";
  res.set("Cache-Control", "private, no-store, max-age=0");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="${safeFallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
}

export function registerOfficialPdfDownloadRoute(app: Express) {
  app.get("/api/official-documents/:documentType/:documentId/download", async (req, res) => {
    const { documentType, documentId: rawDocumentId } = req.params;
    const documentId = Number(rawDocumentId);
    if (!isOfficialDocumentType(documentType) || !Number.isSafeInteger(documentId) || documentId <= 0) {
      res.status(404).send("لم يُعثر على المستند المطلوب.");
      return;
    }

    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).send("تتطلب هذه العملية تسجيل الدخول.");
      return;
    }

    try {
      const attachment = await archiveDb.getOfficialPdfAttachment(documentType, documentId);
      if (!attachment || !canDownloadOfficialPdf(user, attachment.issuingDepartmentId)) {
        res.status(404).send("لم يُعثر على المستند المطلوب.");
        return;
      }

      setDownloadHeaders(res, attachment.fileName);
      if (!usesLocalS3Storage()) {
        res.redirect(307, await storageGetSignedUrl(attachment.fileKey));
        return;
      }

      const object = await storageGetLocalObject(attachment.fileKey);
      const body = object.Body as NodeJS.ReadableStream | undefined;
      if (!body?.pipe) throw new Error("Local storage returned no response body");
      const decrypted = decryptDocumentFromStorage(await readStoredBody(body));
      res.set("Content-Length", String(decrypted.length));
      res.send(decrypted);
    } catch (error) {
      console.error("[OfficialPdfDownload] failed to serve authorized document:", error);
      if (!res.headersSent) res.status(502).send("تعذر تنزيل المستند حاليًا.");
    }
  });
}
