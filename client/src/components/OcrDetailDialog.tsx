import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

const labels: Record<string, string> = { pending: "بانتظار OCR", processing: "جارٍ الاستخراج", completed: "تمت الفهرسة", failed: "تعذر الاستخراج", not_supported: "صيغة غير مدعومة" };

export function OcrDetailDialog({ attachmentId, open, onOpenChange }: { attachmentId: number | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const input = useMemo(() => ({ attachmentId: attachmentId || 0 }), [attachmentId]);
  const query = trpc.attachments.ocrDetail.useQuery(input, { enabled: open && Boolean(attachmentId) });
  const detail = query.data;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="max-h-[85vh] max-w-3xl"><DialogHeader><DialogTitle>مراجعة فهرسة OCR</DialogTitle><DialogDescription>{detail?.fileName || "تفاصيل المرفق الرقمي"}</DialogDescription></DialogHeader>{query.isLoading && <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#2b6a7b]" /></div>}{detail && <div className="space-y-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="bg-[#edf4f2] text-[#356474]">{labels[detail.ocrStatus] || detail.ocrStatus}</Badge>{detail.ocrCompletedAt && <span className="text-[10px] text-[#718793]">اكتملت: {new Date(detail.ocrCompletedAt).toLocaleString("ar-LY")}</span>}</div>{detail.ocrError && <div className="rounded-xl bg-rose-50 p-3 text-xs leading-6 text-rose-700">{detail.ocrError}</div>}<ScrollArea className="h-72 rounded-xl border border-[#e6ece7] bg-[#fbfcf9] p-4"><p className="whitespace-pre-wrap text-xs leading-7 text-[#355565]">{detail.extractedText || "لا يوجد نص مفهرس حتى الآن. ستظهر النتيجة بعد اكتمال خدمة OCR المحلية."}</p></ScrollArea></div>}</DialogContent></Dialog>;
}
