import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Archive, ArrowLeft, BarChart3, CheckCircle2, Clock3, FileInput, FilePlus2, FolderSearch, Gauge, Hourglass, Inbox, ListChecks, RefreshCw, TimerReset } from "lucide-react";
import { useLocation } from "wouter";

const number = new Intl.NumberFormat("ar-LY");

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-LY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function Home() {
  const [_, setLocation] = useLocation();
  const { data, isLoading, isFetching, dataUpdatedAt } = trpc.dashboard.overview.useQuery(undefined, { refetchInterval: 30_000 });
  const metrics = data?.metrics;
  const cards = [
    { label: "معاملات نشطة", value: metrics?.active || 0, icon: Inbox, tone: "bg-[#e8f2f4] text-[#216379]", detail: "تحتاج متابعة أو إجراء", href: "/follow-up" },
    { label: "قيد المعالجة", value: metrics?.inProgress || 0, icon: Hourglass, tone: "bg-[#fff3d9] text-[#a36e15]", detail: "لدى الإدارات المختصة", href: "/follow-up" },
    { label: "متأخرة", value: metrics?.overdue || 0, icon: TimerReset, tone: "bg-[#fff0ed] text-[#b64c36]", detail: "تجاوزت تاريخ الاستحقاق", href: "/follow-up" },
    { label: "منجزة", value: metrics?.completed || 0, icon: CheckCircle2, tone: "bg-[#e9f5ed] text-[#2f7d4b]", detail: "خلال الفترة الحالية", href: "/follow-up" },
    { label: "مؤرشفة", value: metrics?.archived || 0, icon: Archive, tone: "bg-slate-100 text-slate-700", detail: "ضمن الأرشيف النهائي", href: "/archive" },
  ];

  return (
    <DashboardLayout>
      <section className="mx-auto max-w-[1500px] space-y-6">
        <div className="relative overflow-hidden rounded-[1.4rem] bg-[#103548] px-5 py-6 text-white shadow-[0_20px_42px_rgba(16,53,72,.18)] sm:rounded-[1.7rem] sm:px-6 sm:py-7 md:px-8 md:py-8">
          <div className="absolute -left-12 -top-12 h-52 w-52 rounded-full bg-[#e6c36f]/15 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-l from-transparent via-[#e9c87a]/70 to-transparent" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#e9c87a]"><Gauge className="h-4 w-4" /> دولة ليبيا · وزارة السياحة والصناعات التقليدية</div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">نظام الأرشفة الإلكترونية</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">مركز المعلومات والتوثيق السياحي — متابعة مركزية للمراسلات والقرارات والمناشير وإجراءات الإدارات.</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-3">
              <Button onClick={() => setLocation("/incoming?create=1")} className="h-11 bg-[#e9c87a] px-3 text-xs text-[#103548] hover:bg-[#f2d998] sm:px-5"><FilePlus2 className="ml-1.5 h-4 w-4 sm:ml-2" />تسجيل وارد</Button>
              <Button onClick={() => setLocation("/outgoing?create=1")} variant="outline" className="h-11 border-white/20 bg-white/10 px-3 text-xs text-white hover:bg-white/20 hover:text-white sm:px-5"><FileInput className="ml-1.5 h-4 w-4 sm:ml-2" />تسجيل صادر</Button>
              <Button onClick={() => setLocation("/archive")} variant="outline" className="h-11 border-white/20 bg-transparent px-3 text-xs text-white hover:bg-white/20 hover:text-white sm:px-4"><FolderSearch className="ml-1.5 h-4 w-4" />البحث</Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-1 text-[10px] text-[#78909a]" aria-live="polite"><span className="flex items-center gap-1.5"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />تتحدث المؤشرات تلقائيًا كل 30 ثانية</span>{dataUpdatedAt > 0 && <span className="hidden sm:inline">آخر تحديث: {new Intl.DateTimeFormat("ar-LY", { hour: "numeric", minute: "numeric" }).format(new Date(dataUpdatedAt))}</span>}</div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:gap-4">
          {cards.map(card => (
            <button key={card.label} type="button" onClick={() => setLocation(card.href)} className="institution-card p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[#b8d0cb] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c49e47] sm:p-5" aria-label={`${card.label}: ${number.format(card.value)}. فتح التفاصيل`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="institution-label">{card.label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-[#143548]">{isLoading ? "—" : number.format(card.value)}</p></div>
                <div className={`grid h-11 w-11 place-items-center rounded-xl ${card.tone}`}><card.icon className="h-5 w-5" /></div>
              </div>
              <p className="mt-3 text-[11px] text-[#78909a]">{card.detail}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
          <section className="institution-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e7ece5] px-5 py-4 md:px-6">
              <div><p className="text-sm font-bold text-[#17394d]">المعاملات النشطة</p><p className="mt-1 text-[11px] text-[#78909a]">أحدث المعاملات التي ما زالت ضمن دورة العمل</p></div>
              <Button onClick={() => setLocation("/follow-up")} variant="ghost" className="h-9 text-xs text-[#236078] hover:bg-[#edf5f5] hover:text-[#103548]">عرض المتابعة <ArrowLeft className="mr-1 h-3.5 w-3.5" /></Button>
            </div>
            <div className="divide-y divide-[#edf0eb]">
              {isLoading && Array.from({ length: 4 }).map((_, index) => <div className="flex items-center gap-3 p-5" key={index}><Skeleton className="h-10 w-10 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/5" /><Skeleton className="h-3 w-1/3" /></div></div>)}
              {!isLoading && data?.active.length === 0 && <EmptyState icon={Archive} text="لا توجد معاملات نشطة ضمن نطاق صلاحياتك." />}
              {!isLoading && data?.active.map(({ record, departmentName }) => (
                <div key={record.id} className="flex flex-col gap-3 p-5 transition-colors hover:bg-[#fbfcf9] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf5f5] text-[#236078]"><FileInput className="h-4 w-4" /></div>
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-[#17394d]">{record.subject}</p><p className="mt-1 text-[10px] text-[#78909a]">{record.referenceNumber} · {departmentName || "غير محالة"} · {formatDate(record.documentDate)}</p></div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end"><StatusBadge status={record.status} /><span className="text-[10px] text-[#8aa0a8]">{record.dueAt ? `استحقاق ${formatDate(record.dueAt)}` : "دون استحقاق"}</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="institution-card p-5 md:p-6">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#b28937]" /><p className="text-sm font-bold text-[#17394d]">إجراء سريع</p></div>
            <p className="mt-2 text-[11px] leading-6 text-[#78909a]">تسجيل الوثائق الجديدة أو الوصول إلى الأرشيف الموحد.</p>
            <div className="mt-5 grid gap-3">
              <button onClick={() => setLocation("/incoming?create=1")} className="group flex items-center justify-between rounded-xl border border-[#dce6df] bg-[#f8fbf8] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[#b8d0cb] hover:bg-white hover:shadow-md"><span><span className="block text-xs font-bold text-[#17394d]">تسجيل معاملة واردة</span><span className="mt-1 block text-[10px] text-[#78909a]">رفع PDF أو تصوير مباشر</span></span><FilePlus2 className="h-4 w-4 text-[#b28937]" /></button>
              <button onClick={() => setLocation("/archive")} className="group flex items-center justify-between rounded-xl border border-[#dce6df] bg-[#f8fbf8] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[#b8d0cb] hover:bg-white hover:shadow-md"><span><span className="block text-xs font-bold text-[#17394d]">البحث في الأرشيف</span><span className="mt-1 block text-[10px] text-[#78909a]">بحث عربي موحّد للوثائق</span></span><Archive className="h-4 w-4 text-[#b28937]" /></button>
              <button onClick={() => setLocation("/reports")} className="group flex items-center justify-between rounded-xl border border-[#dce6df] bg-[#f8fbf8] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[#b8d0cb] hover:bg-white hover:shadow-md"><span><span className="block text-xs font-bold text-[#17394d]">التقارير والمؤشرات</span><span className="mt-1 block text-[10px] text-[#78909a]">ملخص حركة المراسلات والإدارات</span></span><BarChart3 className="h-4 w-4 text-[#b28937]" /></button>
              <button onClick={() => setLocation("/follow-up")} className="group flex items-center justify-between rounded-xl border border-[#dce6df] bg-[#f8fbf8] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[#b8d0cb] hover:bg-white hover:shadow-md"><span><span className="block text-xs font-bold text-[#17394d]">متابعة المعاملات</span><span className="mt-1 block text-[10px] text-[#78909a]">عرض المهام النشطة والمتأخرة</span></span><ListChecks className="h-4 w-4 text-[#b28937]" /></button>
            </div>
            <div className="mt-6 rounded-xl bg-[#103548] p-4 text-white"><p className="text-[10px] font-bold text-[#e9c87a]">متوسط زمن الإنجاز</p><p className="mt-2 text-2xl font-bold">{isLoading ? "—" : number.format(metrics?.averageCompletionHours || 0)} <span className="text-xs font-medium text-slate-300">ساعة</span></p></div>
          </section>
        </div>
      </section>
    </DashboardLayout>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Archive; text: string }) {
  return <div className="flex flex-col items-center justify-center px-5 py-14 text-center"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4f1] text-[#5d8287]"><Icon className="h-5 w-5" /></div><p className="mt-4 max-w-xs text-xs leading-6 text-[#78909a]">{text}</p></div>;
}
