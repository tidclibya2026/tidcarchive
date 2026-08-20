import { Download } from "lucide-react";
import React from "react";

type OfficialPdfDownloadLinkProps = {
  documentType: "decision" | "circular";
  documentId: number;
  fileName: string;
  documentNumber: string;
};

export function OfficialPdfDownloadLink({ documentType, documentId, fileName, documentNumber }: OfficialPdfDownloadLinkProps) {
  const href = `/api/official-documents/${documentType}/${documentId}/download`;
  return (
    <a
      href={href}
      download={fileName}
      aria-label={`تنزيل ملف PDF للوثيقة ${documentNumber}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f5ed] px-3 py-1.5 text-[10px] font-bold text-[#2f7d4b] hover:bg-[#dceee2]"
    >
      <Download className="h-3.5 w-3.5" />
      تنزيل PDF
    </a>
  );
}
