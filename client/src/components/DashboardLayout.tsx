import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Archive,
  BellRing,
  FileCheck2,
  FileInput,
  FileOutput,
  Files,
  Gavel,
  LayoutDashboard,
  LogOut,
  ScrollText,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "لوحة القيادة", path: "/" },
  { icon: FileInput, label: "المراسلات الواردة", path: "/incoming" },
  { icon: FileOutput, label: "المراسلات الصادرة", path: "/outgoing" },
  { icon: Gavel, label: "القرارات الإدارية", path: "/decisions" },
  { icon: ScrollText, label: "المناشير الداخلية", path: "/circulars" },
  { icon: FileCheck2, label: "مكتب المتابعة", path: "/follow-up" },
  { icon: Archive, label: "الأرشيف والبحث", path: "/archive" },
  { icon: Files, label: "التقارير والمؤشرات", path: "/reports" },
];

const roleLabels: Record<string, string> = {
  admin: "إدارة تقنية المعلومات",
  director_general: "المدير العام",
  follow_up: "مكتب المتابعة",
  department_head: "رئيس إدارة",
  staff: "موظف",
  user: "مستخدم",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div dir="rtl" className="min-h-screen grid place-items-center bg-[#f5f6f1] p-5 text-center">
        <div className="w-full max-w-md rounded-[2rem] border border-[#d7ddd5] bg-white p-9 shadow-[0_25px_80px_rgba(15,43,59,.12)]">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-[#103548] text-[#e9c87a]">
            <Archive className="h-8 w-8" />
          </div>
          <p className="text-xs font-bold tracking-[.18em] text-[#9a7a34]">TIDC · من البيانات إلى القرار</p>
          <h1 className="mt-4 text-2xl font-bold text-[#153448]">نظام الأرشفة الإلكترونية</h1>
          <p className="mt-3 leading-7 text-muted-foreground">يلزم تسجيل الدخول للوصول إلى معاملات المركز وأرشيفه الرقمي.</p>
          <Button onClick={() => startLogin()} className="mt-7 h-12 w-full bg-[#103548] text-white hover:bg-[#17475d]">تسجيل الدخول</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ArchiveSidebar />
      <SidebarInset className="min-w-0 bg-[#f5f6f1]">
        <ArchiveHeader />
        <main className="min-h-[calc(100vh-4.5rem)] p-4 md:p-7">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ArchiveSidebar() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  return (
    <Sidebar side="right" className="border-l border-white/10 bg-[#103548] text-slate-100">
      <SidebarHeader className="h-auto p-5 pt-7">
        <button onClick={() => setLocation("/")} className="flex w-full items-center gap-3 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9c87a]">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e9c87a] text-[#103548] shadow-lg shadow-black/10">
            <Archive className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-white">نظام الأرشفة</p>
            <p className="mt-0.5 truncate text-[10px] font-semibold tracking-[.14em] text-[#e9c87a]">TIDC · 2026</p>
          </div>
        </button>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold tracking-[.16em] text-slate-400">إدارة الوثائق</p>
        <SidebarMenu className="gap-1">
          {menuItems.map(item => {
            const active = location === item.path;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={active}
                  onClick={() => setLocation(item.path)}
                  tooltip={item.label}
                  className="h-11 rounded-xl px-3 text-slate-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#e9c87a] data-[active=true]:text-[#103548] data-[active=true]:font-bold"
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[.055] p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9c87a]">
                <Avatar className="h-9 w-9 border border-white/20">
                  <AvatarFallback className="bg-[#326072] text-xs font-bold text-white">{user?.name?.charAt(0).toUpperCase() || "م"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{user?.name || "مستخدم النظام"}</p>
                  <p className="mt-1 truncate text-[10px] text-slate-400">{roleLabels[user?.role || "staff"] || "موظف"}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="ml-2 h-4 w-4" />
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function ArchiveHeader() {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const current = menuItems.find(item => item.path === location)?.label || "نظام الأرشفة";
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dfe5dc] bg-[#f5f6f1]/90 px-4 backdrop-blur md:px-7">
      <div className="flex items-center gap-3">
        {isMobile && <SidebarTrigger className="h-10 w-10 rounded-xl border border-[#d9e0d8] bg-white text-[#103548]" />}
        <div>
          <p className="text-[11px] font-bold tracking-[.15em] text-[#9a7a34]">مركز المعلومات والتوثيق السياحي</p>
          <h2 className="mt-0.5 text-base font-bold text-[#16394d]">{current}</h2>
        </div>
      </div>
      <div className="hidden items-center gap-2 rounded-xl border border-[#d9e0d8] bg-white px-3 py-2 text-xs font-medium text-[#527080] sm:flex">
        <BellRing className="h-4 w-4 text-[#b28937]" />
        بيئة العمل المؤسسية
      </div>
    </header>
  );
}
