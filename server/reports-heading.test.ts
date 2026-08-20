import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportsHeading, REPORTS_SUBTITLE, REPORTS_TITLE } from "../client/src/components/ReportsHeading";

describe("عنوان صفحة التقارير", () => {
  it("يعرض التسميات العربية والهوية المؤسسية المطلوبة", () => {
    const html = renderToStaticMarkup(createElement(ReportsHeading));
    expect(html).toContain(REPORTS_TITLE);
    expect(html).toContain(REPORTS_SUBTITLE);
    expect(html).toContain("دولة ليبيا · وزارة السياحة والصناعات التقليدية");
  });
});

