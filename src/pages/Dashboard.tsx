import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, Shield, MessageSquare, Users, Wallet, BarChart3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { WorkScheduleCard } from "@/components/WorkScheduleCard";
import { ScheduleShareDialog } from "@/components/ScheduleShareDialog";
import { useTicketNotifications } from "@/hooks/useTicketNotifications";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  pix_key: string | null;
  pix_bank: string | null;
  pix_beneficiary_name: string | null;
  pix_beneficiary_cpf: string | null;
  pix_beneficiary_phone: string | null;
  avatar_url: string | null;
  hourly_rate?: number | null;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [userEnvironmentId, setUserEnvironmentId] = useState<string | null>(null);
  const [scheduleStats, setScheduleStats] = useState({ total: 0, confirmed: 0, pending: 0, value: 0 });
  const [personalFinancial, setPersonalFinancial] = useState({ receivable: 0, pending: 0, firstReceivable: 0, firstPending: 0, secondReceivable: 0, secondPending: 0 });
  const [pendingReceipt, setPendingReceipt] = useState<{ url: string; ids: string[]; paidAt: string; amount: number } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const { user, profile, signOut, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unreadCount } = useTicketNotifications(isAdmin);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (profile) {
        setAvatarUrl(profile.avatar_url || null);
        setUserProfile({
          id: user?.id || "",
          full_name: profile.full_name,
          email: profile.email || null,
          phone: profile.phone || null,
          cpf: profile.cpf || null,
          pix_key: profile.pix_key || null,
          pix_bank: profile.pix_bank || null,
          pix_beneficiary_name: profile.pix_beneficiary_name || null,
          pix_beneficiary_cpf: profile.pix_beneficiary_cpf || null,
          pix_beneficiary_phone: profile.pix_beneficiary_phone || null,
          avatar_url: profile.avatar_url || null,
        });
      }
    };
    loadData();
  }, [profile, user]);

  useEffect(() => {
    const checkAdminAndEnvironment = async () => {
      if (!user) return;
      const { data: isAdminData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(!!isAdminData);
      if (isAdminData) {
        const { data: roleData } = await supabase.from("user_roles").select("environment_id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        setIsGlobalAdmin(roleData?.environment_id === null);
        setUserEnvironmentId(roleData?.environment_id || null);
      }
      const { data: profileData } = await supabase.from("profiles").select("environment_id").eq("id", user.id).single();
      if (profileData?.environment_id && !isGlobalAdmin) setUserEnvironmentId(profileData.environment_id);
    };
    checkAdminAndEnvironment();
  }, [user]);

  useEffect(() => { setLoading(false); }, []);
  useEffect(() => {
    if (!user) return;
    const loadScheduleStats = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      let query: any = supabase.from("work_schedules").select("confirmed, daily_rate").eq("date", today);
      if (!isAdmin) query = query.eq("employee_id", user.id);
      const { data, error } = await query;
      if (error) return;
      const rows = data || [];
      setScheduleStats({ total: rows.length, confirmed: rows.filter((s: any) => s.confirmed === true).length, pending: rows.filter((s: any) => s.confirmed !== true).length, value: rows.reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0) });
    };
    loadScheduleStats();
    const timer = window.setInterval(loadScheduleStats, 30000);
    return () => window.clearInterval(timer);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const loadPersonalFinancial = async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const nextMonthDate = new Date(year, month + 1, 1);
      const end = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("work_schedules")
        .select("date, daily_rate, confirmed")
        .eq("employee_id", user.id)
        .gte("date", start)
        .lt("date", end);
      if (error) return;
      const rows = data || [];
      const sumValue = (items: any[]) => items.reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0);
      const confirmed = rows.filter((s: any) => s.confirmed === true);
      const pending = rows.filter((s: any) => s.confirmed !== true);
      const firstHalf = (s: any) => Number(String(s.date || "").slice(8, 10)) <= 15;
      setPersonalFinancial({
        receivable: sumValue(confirmed),
        pending: sumValue(pending),
        firstReceivable: sumValue(confirmed.filter(firstHalf)),
        firstPending: sumValue(pending.filter(firstHalf)),
        secondReceivable: sumValue(confirmed.filter((s: any) => !firstHalf(s))),
        secondPending: sumValue(pending.filter((s: any) => !firstHalf(s))),
      });
    };
    loadPersonalFinancial();
    const timer = window.setInterval(loadPersonalFinancial, 30000);
    return () => window.clearInterval(timer);
  }, [user, isAdmin]);


  useEffect(() => {
    if (!user || isAdmin || pendingReceipt) return;
    let active = true;
    const loadPendingReceipt = async () => {
      const { data: rows, error } = await (supabase as any).from("work_schedules")
        .select("id,date,daily_rate,paid_at,payment_receipt_path,payment_confirmed_by_employee_at")
        .eq("employee_id", user.id)
        .order("paid_at", { ascending: true });
      if (!active || error || !rows?.length) return;
      const first = rows.find((row: any) => !!row.paid_at && !!row.payment_receipt_path && !row.payment_confirmed_by_employee_at);
      if (!first) return;
      const related = rows.filter((row: any) => row.payment_receipt_path === first.payment_receipt_path && !!row.paid_at && !row.payment_confirmed_by_employee_at);
      const paymentMonth = String(first.date || "").slice(0, 7);
      const paymentDay = Number(String(first.date || "").slice(8, 10));
      const isFirstFortnight = paymentDay <= 15;
      const totalForFortnight = rows
        .filter((row: any) => String(row.date || "").slice(0, 7) === paymentMonth && (isFirstFortnight ? Number(String(row.date || "").slice(8, 10)) <= 15 : Number(String(row.date || "").slice(8, 10)) > 15))
        .reduce((sum: number, row: any) => sum + Number(row.daily_rate || 0), 0);
      setReceiptLoading(true);
      const { data, error: signedUrlError } = await (supabase as any).storage.from("payment-receipts").createSignedUrl(first.payment_receipt_path, 3600);
      if (!active) return;
      setReceiptLoading(false);
      if (signedUrlError) {
        toast({ variant: "destructive", title: "Comprovante indisponível", description: signedUrlError.message });
        return;
      }
      setPendingReceipt({ url: data.signedUrl, ids: related.map((row: any) => row.id), paidAt: first.paid_at, amount: totalForFortnight });
    };
    loadPendingReceipt();
    return () => { active = false; };
  }, [user, isAdmin, pendingReceipt, toast]);

  const confirmPaymentReceipt = async () => {
    if (!pendingReceipt) return;
    try {
      const { error } = await (supabase as any).rpc("confirm_work_schedule_payment_receipt", { p_schedule_ids: pendingReceipt.ids });
      if (error) throw error;
      setPendingReceipt(null);
      toast({ title: "Comprovante confirmado", description: "Sua confirmação foi registrada." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Não foi possível confirmar", description: error?.message || "Tente novamente." });
    }
  };

  const handleProfileSave = () => { refetchProfile?.(); };

  return (
    <>
      <Dialog open={!!pendingReceipt} onOpenChange={() => {}}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl text-emerald-700 dark:text-emerald-400">Pagamento realizado!</DialogTitle>
            <DialogDescription>Um pagamento foi realizado. Confira o comprovante abaixo e confirme o recebimento da informação.</DialogDescription>
          </DialogHeader>
          {pendingReceipt && <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
              <p><strong>Valor:</strong> {pendingReceipt.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              <p><strong>Data do pagamento:</strong> {format(new Date(pendingReceipt.paidAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
            <img src={pendingReceipt.url} alt="Comprovante de pagamento" className="max-h-[48vh] w-full rounded-lg border bg-muted object-contain" />
          </div>}
          <DialogFooter>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={receiptLoading || !pendingReceipt} onClick={confirmPaymentReceipt}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Confirmado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="min-h-screen overflow-x-hidden bg-background">
      <div className="gradient-hero rounded-b-[2rem] px-3 pb-20 pt-6 sm:p-4 sm:pb-20 sm:pt-8">
        <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {user && profile && <AvatarUpload userId={user.id} currentAvatarUrl={avatarUrl} fullName={profile.full_name} onAvatarUpdate={(url) => { setAvatarUrl(url); refetchProfile(); }} />}
            <div className="min-w-0"><p className="text-primary-foreground/80 text-sm">Olá,</p><p className="truncate text-sm font-semibold text-primary-foreground sm:text-base">{profile?.full_name || "Funcionário"}</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            {userProfile && <ProfileEditDialog profile={userProfile} onSave={handleProfileSave} />}
            <Button variant="ghost" size="sm" aria-label="Meu Dashboard" onClick={() => navigate("/my-dashboard")} className="h-10 gap-1.5 px-2 text-primary-foreground hover:bg-primary-foreground/10"><BarChart3 className="h-5 w-5 shrink-0" /><span className="hidden sm:inline">Meu progresso</span></Button>
            <Button variant="ghost" size="icon" aria-label="Tickets" onClick={() => navigate("/tickets")} className="relative h-10 w-10 text-primary-foreground hover:bg-primary-foreground/10"><MessageSquare className="h-5 w-5" />{unreadCount > 0 && <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center border-0 bg-destructive p-0 text-[10px]">{unreadCount > 9 ? "9+" : unreadCount}</Badge>}</Button>
            {isAdmin && <Button variant="ghost" size="icon" aria-label="Administração" onClick={() => navigate("/admin")} className="h-10 w-10 text-primary-foreground hover:bg-primary-foreground/10"><Shield className="h-5 w-5" /></Button>}
            <Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut} className="h-10 w-10 text-primary-foreground hover:bg-primary-foreground/10"><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
        <div className="text-center"><div className="mb-2 flex items-center justify-center gap-2"><Clock className="h-5 w-5 text-primary-foreground/80" /><span className="text-sm text-primary-foreground/80">Hora Atual</span></div><p className="text-4xl font-bold tracking-normal text-primary-foreground sm:text-5xl">{format(currentTime, "HH:mm:ss")}</p><p className="mt-1 px-2 text-sm capitalize text-primary-foreground/80 sm:text-base">{format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p></div>
      </div>
      <div className="mx-auto -mt-12 max-w-3xl space-y-4 px-3 pb-8 sm:space-y-6 sm:px-4">
        <Card className="overflow-hidden border-0 shadow-xl"><CardContent className="p-4 sm:p-6"><div className="mb-2"><p className="text-sm text-muted-foreground">Controle de Hoje</p><p className="text-base font-semibold sm:text-lg">Acompanhamento pelas escalas</p></div><p className="text-sm text-muted-foreground">Suas atividades e confirmações são acompanhadas exclusivamente pelas escalas cadastradas.</p></CardContent></Card>
<Card className="border-0 shadow-xl"><CardContent className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Resumo das escalas de hoje</p><p className="text-xs text-muted-foreground">Acompanhe rapidamente o que está confirmado.</p></div><Users className="h-5 w-5 text-primary" /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Escalas</p><p className="text-xl font-bold">{scheduleStats.total}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Confirmadas</p><p className="text-xl font-bold">{scheduleStats.confirmed}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Pendentes</p><p className="text-xl font-bold">{scheduleStats.pending}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Valor previsto</p><p className="text-base font-bold">{scheduleStats.value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div></div></CardContent></Card><Card className="border-0 shadow-xl"><CardContent className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Meu financeiro</p><p className="text-xs text-muted-foreground">Valores conforme as escalas programadas deste mês.</p></div><Wallet className="h-5 w-5 text-primary" /></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">A receber</p><p className="text-xl font-bold">{personalFinancial.receivable.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Pendente</p><p className="text-xl font-bold">{personalFinancial.pending.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div></div><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="rounded-lg border p-3"><p className="text-sm font-semibold">1ª quinzena · dias 1 a 15</p><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-xs text-muted-foreground">Confirmado</p><p className="text-sm font-semibold">{personalFinancial.firstReceivable.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div><div><p className="text-xs text-muted-foreground">Pendente</p><p className="text-sm font-semibold">{personalFinancial.firstPending.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div></div></div><div className="rounded-lg border p-3"><p className="text-sm font-semibold">2ª quinzena · dias 16 ao fim</p><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-xs text-muted-foreground">Confirmado</p><p className="text-sm font-semibold">{personalFinancial.secondReceivable.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div><div><p className="text-xs text-muted-foreground">Pendente</p><p className="text-sm font-semibold">{personalFinancial.secondPending.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</p></div></div></div></div></CardContent></Card>
        {user && <WorkScheduleCard isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} userId={user.id} environmentId={userEnvironmentId} />}
        <ScheduleShareDialog isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} environmentId={userEnvironmentId} />
      </div>
      </div>
    </>
  );
}
