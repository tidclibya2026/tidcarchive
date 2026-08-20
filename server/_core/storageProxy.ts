import type { Express } from "express";
import { ENV } from "./env";
import { storageGetLocalObject, usesLocalS3Storage } from "../storage";
import { decryptDocumentFromStorage } from "../documentEncryption";

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

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (usesLocalS3Storage()) {
      try {
        const object = await storageGetLocalObject(key);
        const contentType = object.Metadata?.["tidc-content-type"] || object.ContentType;
        if (contentType) res.type(contentType);
        res.set("Cache-Control", "private, no-store");
        res.set("Content-Disposition", "attachment");
        const body = object.Body as NodeJS.ReadableStream | undefined;
        if (!body?.pipe) {
          res.status(502).send("Local storage returned no response body");
          return;
        }
        const decrypted = decryptDocumentFromStorage(await readStoredBody(body));
        res.set("Content-Length", String(decrypted.length));
        res.send(decrypted);
      } catch (err) {
        console.error("[StorageProxy] local storage failed:", err);
        res.status(404).send("Stored file was not found");
      }
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
