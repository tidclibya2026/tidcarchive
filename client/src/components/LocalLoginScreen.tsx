import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function LocalLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.localLogin.useMutation({
    onSuccess: () => { window.location.assign("/"); },
    onError: error => toast.error(error.message),
  });
  return <div dir="rtl" className="grid min-h-screen place-items-center bg-[#f5f6f1] p-5 text-right"><div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[#d7ddd5] bg-white shadow-[0_25px_80px_rgba(15,43,59,.12)]"><div className="bg-[#103548] px-8 py-7 text-center text-white"><img src="/manus-storage/tidc_e88ddbec.png" alt="شعار مركز المعلومات والتوثيق السياحي" className="mx-auto h-16 w-24 object-contain" /><p className="mt-4 text-[10px] font-bold tracking-[.08em] text-[#e9c87a]">دولة ليبيا · وزارة السياحة والصناعات التقليدية</p><h1 className="mt-2 text-xl font-bold">نظام الأرشفة الإلكترونية</h1></div><form onSubmit={event => { event.preventDefault(); login.mutate({ email, password }); }} className="space-y-4 p-7"><div className="rounded-xl bg-[#f7faf8] px-4 py-3 text-[11px] leading-6 text-[#617b83]"><ShieldCheck className="ml-1 inline h-4 w-4 text-[#2d7b71]" />تسجيل دخول آمن لحسابات المركز المعتمدة.</div><div className="grid gap-2"><Label>البريد الإلكتروني</Label><Input dir="ltr" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@tidc.gov.ly" required /></div><div className="grid gap-2"><Label>كلمة المرور</Label><Input dir="ltr" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••••" required /></div><Button disabled={login.isPending} className="h-11 w-full bg-[#103548] text-white hover:bg-[#17475d]">{login.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <KeyRound className="ml-2 h-4 w-4" />}دخول إلى النظام</Button><button type="button" onClick={() => startLogin()} className="w-full pt-2 text-center text-[11px] font-bold text-[#2a6b7d] hover:underline">الدخول عبر حساب المنصة</button></form></div></div>;
}
