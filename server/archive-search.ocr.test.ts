import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resultSets: [] as unknown[][],
  select: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({ select: mocks.select }),
}));

import { searchArchive } from "./db";

function queueSelectResults(...resultSets: unknown[][]) {
  mocks.resultSets = [...resultSets];
  mocks.select.mockImplementation(() => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.from = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => Promise.resolve(mocks.resultSets.shift() || []));
    return chain;
  });
}

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  mocks.resultSets = [];
  mocks.select.mockReset();
});

describe("البحث الموحد في نص OCR", () => {
  it("يعرض المرفق المفهرس عندما يتطابق البحث مع النص العربي المستخرج", async () => {
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/tidc_test";
    queueSelectResults(
      [],
      [],
      [],
      [{
        id: 81,
        documentType: "correspondence",
        documentId: 15,
        fileName: "خطاب-سياحي.pdf",
        createdAt: new Date("2026-08-20T00:00:00Z"),
        ocrStatus: "completed",
        extractedText: "خطة تطوير المسارات السياحية في ليبيا",
      }],
    );

    const results = await searchArchive({ query: "المسارات السياحية" });

    expect(results).toContainEqual(expect.objectContaining({
      id: 81,
      type: "attachment",
      number: "خطاب-سياحي.pdf",
      ocrStatus: "completed",
    }));
  });

  it("يقيد البحث المتقدم بنوع المرفق والفترة الزمنية", async () => {
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/tidc_test";
    queueSelectResults([{
      id: 93,
      documentType: "correspondence",
      documentId: 18,
      fileName: "برنامج-تدريبي.pdf",
      createdAt: new Date("2026-08-18T00:00:00Z"),
      ocrStatus: "completed",
      extractedText: "برنامج تدريب الأرشفة الإلكترونية",
    }]);

    const results = await searchArchive({
      query: "تدريب الأرشفة",
      documentType: "attachment",
      dateFrom: new Date("2026-08-01T00:00:00Z"),
      dateTo: new Date("2026-08-31T23:59:59Z"),
    });

    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(results).toContainEqual(expect.objectContaining({ id: 93, type: "attachment" }));
  });

  it("لا يعرض أنواعًا لا تملك الحالة المختارة ضمن البحث المتقدم", async () => {
    process.env.DATABASE_URL = "mysql://test:test@localhost:3306/tidc_test";

    const results = await searchArchive({ query: "ساري", documentType: "circular", status: "active" });

    expect(mocks.select).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });
});
