import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/ArchivePage.tsx"), "utf8");

describe("نتائج الأرشيف وبيانات بطاقة الوثيقة", () => {
  it("تعرض التصنيف والسرية وحالة الأرشفة والكلمات المفتاحية للمراسلات", () => {
    expect(source).toContain("result.classification");
    expect(source).toContain("confidentialityLabel[result.confidentiality]");
    expect(source).toContain("archiveStatusLabel[result.archiveStatus]");
    expect(source).toContain("result.keywords");
  });
});
