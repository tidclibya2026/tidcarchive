import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";
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
import { useIsMobile } from "@/hooks/useMobile";
import {
  Archive,
  BellRing,
  Building2,
  Moon,
  Sun,
  ClipboardList,
  FileCheck2,
  FileInput,
  FileOutput,
  Files,
  Gavel,
  LayoutDashboard,
  LogOut,
  ScrollText,
  ShieldPlus,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { InstitutionalHeading } from "./InstitutionalHeading";
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
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) setLocation("/login", { replace: true });
  }, [loading, setLocation, user]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <DashboardLayoutSkeleton />;

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
            <img src="/manus-storage/tidc-logo_6a455ae1.png" alt="شعار مركز المعلومات والتوثيق السياحي" className="h-9 w-9 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-white">نظام الأرشفة الإلكترونية</p>
            <p className="mt-0.5 truncate text-[10px] font-semibold tracking-[.04em] text-[#e9c87a]">مركز المعلومات والتوثيق السياحي</p>
            <p className="mt-0.5 truncate text-[9px] text-slate-300">دولة ليبيا · وزارة السياحة والصناعات التقليدية</p>
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
          {user?.role === "admin" && <SidebarMenuItem><SidebarMenuButton isActive={location === "/users"} onClick={() => setLocation("/users")} tooltip="إدارة المستخدمين" className="h-11 rounded-xl px-3 text-slate-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#e9c87a] data-[active=true]:text-[#103548] data-[active=true]:font-bold"><ShieldPlus className="h-[18px] w-[18px]" /><span>إدارة المستخدمين</span></SidebarMenuButton></SidebarMenuItem>}
          {user?.role === "admin" && <SidebarMenuItem><SidebarMenuButton isActive={location === "/organization"} onClick={() => setLocation("/organization")} tooltip="الهيكل والجهات" className="h-11 rounded-xl px-3 text-slate-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#e9c87a] data-[active=true]:text-[#103548] data-[active=true]:font-bold"><Building2 className="h-[18px] w-[18px]" /><span>الهيكل والجهات</span></SidebarMenuButton></SidebarMenuItem>}
          {user?.role === "admin" && <SidebarMenuItem><SidebarMenuButton isActive={location === "/audit"} onClick={() => setLocation("/audit")} tooltip="سجل تدقيق الحسابات" className="h-11 rounded-xl px-3 text-slate-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#e9c87a] data-[active=true]:text-[#103548] data-[active=true]:font-bold"><ClipboardList className="h-[18px] w-[18px]" /><span>سجل التدقيق</span></SidebarMenuButton></SidebarMenuItem>}
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
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();
  const { data: notificationData } = trpc.notifications.list.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 30_000 });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });
  const current = menuItems.find(item => item.path === location)?.label || "نظام الأرشفة";
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dfe5dc] bg-[#f5f6f1]/90 px-4 backdrop-blur md:px-7">
      <div className="flex items-center gap-3">
        {isMobile && <SidebarTrigger className="h-10 w-10 rounded-xl border border-[#d9e0d8] bg-white text-[#103548]" />}
        <div className="flex items-center gap-2"><img src="/manus-storage/ministry-logo_002815c1.png" alt="شعار وزارة السياحة والصناعات التقليدية" className="hidden h-10 w-12 object-contain sm:block" /><InstitutionalHeading section={current} /></div>
      </div>
      <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-xl border border-[#d9e0d8] bg-white px-3 py-2 text-xs font-medium text-[#527080] sm:flex"><BellRing className="h-4 w-4 text-[#b28937]" />بيئة العمل المؤسسية</div><button aria-label={`التنبيهات غير المقروءة: ${notificationData?.unreadCount || 0}`} onClick={() => { if ((notificationData?.unreadCount || 0) > 0) markAllRead.mutate(); if (user?.role === "follow_up") window.location.hash = "notifications"; }} className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#d9e0d8] bg-white text-[#526f7a] transition-transform duration-200 hover:-translate-y-0.5 hover:border-[#b28937] hover:text-[#b28937]"><BellRing className="h-4 w-4" />{Boolean(notificationData?.unreadCount) && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#bd5138] px-1 text-[10px] font-bold text-white ring-2 ring-[#f5f6f1]">{(notificationData?.unreadCount || 0) > 99 ? "99+" : notificationData?.unreadCount || 0}</span>}</button><button type="button" aria-label={theme === "dark" ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي"} onClick={() => toggleTheme?.()} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9e0d8] bg-white text-[#526f7a] transition-colors hover:border-[#b28937] hover:text-[#b28937] dark:bg-[#183f50] dark:text-[#e9c87a]"><span className="sr-only">{theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}</span>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><Avatar className="h-10 w-10 border border-[#d9e0d8]"><AvatarFallback className="bg-[#326072] text-xs font-bold text-white">{user?.name?.charAt(0).toUpperCase() || "م"}</AvatarFallback></Avatar></div>
    </header>
  );
}
