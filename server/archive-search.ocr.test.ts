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

    const results = await searchArchive("المسارات السياحية");

    expect(results).toContainEqual(expect.objectContaining({
      id: 81,
      type: "attachment",
      number: "خطاب-سياحي.pdf",
      ocrStatus: "completed",
    }));
  });
});
