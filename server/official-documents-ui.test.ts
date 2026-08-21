import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/OfficialDocumentsPage.tsx"), "utf8");

describe("واجهة القرارات والوثائق الرسمية", () => {
  it("توفر بحثًا داخل قائمة المراسلات المرجعية", () => {
    expect(source).toContain("ابحث برقم المراسلة أو موضوعها أو جهتها");
    expect(source).toContain("CommandInput");
    expect(source).toContain("ReferenceCorrespondencePicker");
  });

  it("تدعم ملفات PDF متعددة للقرار وتعرضها في السجل", () => {
    expect(source).toContain("multiple={type === \"decision\"}");
    expect(source).toContain("حتى خمسة ملفات PDF");
    expect(source).toContain("pdfArchives");
  });
});
