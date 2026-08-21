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
    expect(source).toContain('type === "decision" ? 5 : 1');
    expect(source).toContain("pdfArchives");
  });

  it("تحصر جهة إصدار القرار في الجهات القيادية المعتمدة", () => {
    expect(source).toContain("الجهة الصادرة للقرار");
    expect(source).toContain("رئيس الحكومة");
    expect(source).toContain("وزير السياحة");
    expect(source).toContain("المدير العام");
  });
});
