import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { FileDown, FileSearch, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

const roleLabels: Record<string, string> = { admin: "إدارة النظام", director_general: "المدير العام", follow_up: "مكتب المتابعة", department_head: "رئيس إدارة", staff: "موظف" };

export default function PdfDownloadMonitorPage() {
  const [userId, setUserId] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const filters = useMemo(() => ({
    userId: userId === "all" ? undefined : Number(userId),
    documentType: documentType === "all" ? undefined : documentType as "decision" | "circular",
    dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`) : undefined,
    dateTo: dateTo ? new Date(`${dateTo}T23:59:59`) : undefined,
  }), [dateFrom, dateTo, documentType, userId]);
  const downloads = trpc.pdfDownloads.list.useQuery(filters);
  const users = trpc.users.list.useQuery();

  return <DashboardLayout><section className="mx-auto max-w-[1500px] space-y-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="institution-label">المراقبة والحماية</p><h1 className="mt-2 text-2xl font-bold text-[#17394d]">مراقبة تنزيلات PDF</h1><p className="mt-2 text-xs leading-6 text-[#718793]">يسجل النظام محاولات التنزيل المصرح بها للقرارات والمناشير دون الاحتفاظ بمحتوى المستند أو الرابط الموقّع.</p></div><div className="flex items-center gap-2 rounded-xl border border-[#d8e5de] bg-[#f5fbf7] px-4 py-3 text-[11px] font-bold text-[#2f6c51]"><ShieldCheck className="h-4 w-4" />سجل مقيد للحسابات التنفيذية المخولة</div></div><div className="institution-card grid gap-3 p-4 md:grid-cols-5"><div className="md:col-span-2"><Select value={userId} onValueChange={setUserId}><SelectTrigger><SelectValue placeholder="كل المستخدمين" /></SelectTrigger><SelectContent><SelectItem value="all">كل المستخدمين</SelectItem>{users.data?.map(user => <SelectItem key={user.id} value={String(user.id)}>{user.name || user.email || `حساب ${user.id}`}</SelectItem>)}</SelectContent></Select></div><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue placeholder="كل الوثائق" /></SelectTrigger><SelectContent><SelectItem value="all">كل الوثائق</SelectItem><SelectItem value="decision">القرارات</SelectItem><SelectItem value="circular">المناشير</SelectItem></SelectContent></Select><Input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label="من تاريخ" /><Input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label="إلى تاريخ" /></div><div className="institution-card overflow-hidden"><div className="flex items-center gap-2 border-b border-[#e7ece5] px-5 py-4"><FileDown className="h-4 w-4 text-[#b28937]" /><p className="text-sm font-bold text-[#17394d]">سجل التنزيلات المصرح بها</p><Badge variant="secondary" className="mr-auto bg-[#edf4f2] text-[10px] text-[#356474]">{downloads.data?.length || 0} عملية</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-right"><thead className="bg-[#f8faf7]"><tr className="text-[10px] font-bold text-[#718793]"><th className="px-5 py-4">التوقيت</th><th className="px-5 py-4">المستند</th><th className="px-5 py-4">النوع</th><th className="px-5 py-4">المستخدم</th><th className="px-5 py-4">الدور عند التنزيل</th></tr></thead><tbody>{downloads.isLoading && <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#527080]" /></td></tr>}{!downloads.isLoading && !downloads.data?.length && <tr><td colSpan={5} className="p-10 text-center text-xs text-[#78909a]"><FileSearch className="mx-auto mb-2 h-5 w-5" />لا توجد تنزيلات مرصودة ضمن المرشحات الحالية.</td></tr>}{downloads.data?.map(log => <tr key={log.id} className="border-t border-[#edf0eb]"><td className="px-5 py-4 text-[10px] text-[#58737d]">{new Date(log.createdAt).toLocaleString("ar-LY")}</td><td className="px-5 py-4"><p className="text-xs font-bold text-[#264654]">{log.documentNumber}</p><p className="mt-1 max-w-[300px] truncate text-[10px] text-[#78909a]">{log.subject}</p></td><td className="px-5 py-4"><Badge variant="secondary" className="bg-[#edf4f2] text-[10px] text-[#356474]">{log.documentType === "decision" ? "قرار" : "منشور"}</Badge></td><td className="px-5 py-4"><p className="text-xs font-bold text-[#264654]">{log.userName || "حساب غير متاح"}</p><p dir="ltr" className="mt-1 text-[10px] text-[#7c9299]">{log.userEmail || "—"}</p></td><td className="px-5 py-4 text-[10px] text-[#58737d]">{roleLabels[log.userRole] || log.userRole}</td></tr>)}</tbody></table></div></div></section></DashboardLayout>;
}
