import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getOfficialPdfAttachment: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  usesLocalS3Storage: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getOfficialPdfAttachment: mocks.getOfficialPdfAttachment }));
vi.mock("./storage", () => ({
  storageGetSignedUrl: mocks.storageGetSignedUrl,
  usesLocalS3Storage: mocks.usesLocalS3Storage,
  storageGetLocalObject: vi.fn(),
}));

import { canDownloadOfficialPdf, registerOfficialPdfDownloadRoute } from "./officialPdfDownload";

function createResponse() {
  return {
    headersSent: false,
    set: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
    redirect: vi.fn(),
  };
}

function getDownloadHandler() {
  const registered = vi.fn();
  registerOfficialPdfDownloadRoute({ get: registered } as never);
  return registered.mock.calls[0]?.[1] as (req: any, res: any) => Promise<void>;
}

describe("تفويض تنزيل ملفات PDF الرسمية", () => {
  it("يسمح للحساب التنفيذي أو ذي الصلاحية الشاملة بتنزيل القرار", () => {
    expect(canDownloadOfficialPdf({ role: "director_general", accessLevel: "standard", departmentId: null, officeId: null }, 99)).toBe(true);
    expect(canDownloadOfficialPdf({ role: "department_head", accessLevel: "full", departmentId: 4, officeId: null }, 99)).toBe(true);
  });

  it("يسمح للحساب الإداري داخل نطاق الجهة المصدرة فقط", () => {
    expect(canDownloadOfficialPdf({ role: "staff", accessLevel: "standard", departmentId: 7, officeId: null }, 7)).toBe(true);
    expect(canDownloadOfficialPdf({ role: "staff", accessLevel: "standard", departmentId: 7, officeId: null }, 8)).toBe(false);
  });

  it("يرفض حسابًا غير تنفيذي ولا يملك نطاقًا تنظيميًا", () => {
    expect(canDownloadOfficialPdf({ role: "staff", accessLevel: "standard", departmentId: null, officeId: null }, 7)).toBe(false);
  });

  it("لا يسمح بالوصول إلى التخزين قبل تحقق جلسة المستخدم", async () => {
    mocks.authenticateRequest.mockRejectedValueOnce(new Error("no session"));
    const res = createResponse();

    await getDownloadHandler()({ params: { documentType: "decision", documentId: "11" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.getOfficialPdfAttachment).not.toHaveBeenCalled();
  });

  it("يرفض المستخدم خارج نطاق القرار قبل طلب رابط التخزين", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ role: "staff", accessLevel: "standard", departmentId: 7, officeId: null });
    mocks.getOfficialPdfAttachment.mockResolvedValueOnce({ fileKey: "tidc-archive/decision/11/file.pdf", fileName: "قرار.pdf", mimeType: "application/pdf", issuingDepartmentId: 8 });
    const res = createResponse();

    await getDownloadHandler()({ params: { documentType: "decision", documentId: "11" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("يولّد تنزيلًا قصير المدة للحساب المخوّل بعد تحقق النطاق", async () => {
    mocks.authenticateRequest.mockResolvedValueOnce({ role: "staff", accessLevel: "standard", departmentId: 7, officeId: null });
    mocks.getOfficialPdfAttachment.mockResolvedValueOnce({ fileKey: "tidc-archive/decision/11/file.pdf", fileName: "قرار.pdf", mimeType: "application/pdf", issuingDepartmentId: 7 });
    mocks.usesLocalS3Storage.mockReturnValueOnce(false);
    mocks.storageGetSignedUrl.mockResolvedValueOnce("https://storage.example.test/signed-file");
    const res = createResponse();

    await getDownloadHandler()({ params: { documentType: "decision", documentId: "11" } }, res);

    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("tidc-archive/decision/11/file.pdf");
    expect(res.redirect).toHaveBeenCalledWith(307, "https://storage.example.test/signed-file");
  });
});
