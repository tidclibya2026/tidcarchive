import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfficialPdfDownloadLink } from "../client/src/components/OfficialPdfDownloadLink";

describe("تنزيل PDF المؤرشف", () => {
  it("يعرض رابط التنزيل المحمي باسم الملف ورقم الوثيقة", () => {
    const html = renderToStaticMarkup(
      createElement(OfficialPdfDownloadLink, {
        documentType: "decision",
        documentId: 17,
        fileName: "قرار-2026-1.pdf",
        documentNumber: "قرار/2026/0001",
      }),
    );

    expect(html).toContain('href="/api/official-documents/decision/17/download"');
    expect(html).not.toContain("/manus-storage/");
    expect(html).toContain('download="قرار-2026-1.pdf"');
    expect(html).toContain("تنزيل PDF");
    expect(html).toContain("قرار/2026/0001");
  });
});
