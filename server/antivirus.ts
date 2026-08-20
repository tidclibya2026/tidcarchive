import { TRPCError } from "@trpc/server";
import net from "node:net";

function antivirusEnabled() {
  return process.env.ANTIVIRUS_ENABLED === "true";
}

function scanWithClamAv(buffer: Buffer): Promise<string> {
  const host = process.env.ANTIVIRUS_HOST || "clamav";
  const port = Number(process.env.ANTIVIRUS_PORT || 3310);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    const timeout = setTimeout(() => socket.destroy(new Error("antivirus-timeout")), 20_000);
    socket.once("error", reject);
    socket.on("data", chunk => { response += chunk.toString("utf8"); });
    socket.once("end", () => resolve(response));
    socket.once("connect", () => {
      const size = Buffer.allocUnsafe(4);
      size.writeUInt32BE(buffer.length, 0);
      socket.write("zINSTREAM\0");
      socket.write(size);
      socket.write(buffer);
      socket.write(Buffer.alloc(4));
    });
    socket.once("close", () => clearTimeout(timeout));
  });
}

export async function scanUploadForMalware(buffer: Buffer) {
  if (!antivirusEnabled()) return { scanned: false };
  try {
    const response = await scanWithClamAv(buffer);
    if (/\bOK\b/.test(response)) return { scanned: true };
    if (/\bFOUND\b/.test(response)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "رُفض المرفق لأن فحص الحماية اكتشف محتوى ضاراً." });
    }
    throw new Error("unexpected-antivirus-response");
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[Antivirus] scan failed:", error instanceof Error ? error.message : "unknown");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إتمام فحص حماية المرفق. لم يُخزن الملف حفاظاً على سلامة النظام." });
  }
}
