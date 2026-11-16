import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Wallet, TrendingUp, Banknote, BriefcaseBusiness, Loader2, BarChart3, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const db = supabase as any;
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => format(new Date(value + "T12:00:00"), "dd/MM/yyyy");
type Schedule = { id: string; date: string; start_time: string | null; end_time: string | null; daily_rate: number | null; confirmed: boolean | null; paid_at: string | null; payment_scheduled_for: string | null; payment_receipt_path: string | null; payment_confirmed_by_employee_at: string | null; environment_id: string | null; notes: string | null };

export default function EmployeeDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [environmentNames, setEnvironmentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"6" | "12" | "all">("6");
  const [financialMonth, setFinancialMonth] = useState(format(new Date(), "yyyy-MM"));
  const [pendingReceipt, setPendingReceipt] = useState<{ path: string; url: string; ids: string[]; paidAt: string; amount: number } | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const scheduleResult = await db.from("work_schedules").select("id,date,start_time,end_time,daily_rate,confirmed,paid_at,payment_scheduled_for,payment_receipt_path,payment_confirmed_by_employee_at,environment_id,notes").eq("employee_id", user.id).order("date", { ascending: false });
        if (scheduleResult.error) throw scheduleResult.error;
        const rows = (scheduleResult.data || []) as Schedule[];
        const ids = [...new Set(rows.map((s) => s.environment_id).filter(Boolean))] as string[];
        let names: Record<string, string> = {};
        if (ids.length) {
          const { data, error } = await db.from("environments").select("id,name").in("id", ids);
          if (error) throw error;
          names = Object.fromEntries((data || []).map((e: any) => [e.id, e.name]));
        }
        if (!active) return;
        setSchedules(rows);
        setEnvironmentNames(names);
      } catch (error: any) {
        if (!active) return;
        toast({ variant: "destructive", title: "Não foi possível carregar seu dashboard", description: error?.message || "Tente novamente em instantes." });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user, toast]);

  useEffect(() => {
    if (!user || pendingReceipt) return;
    const firstUnconfirmed = schedules.find((row) => !!row.paid_at && !!row.payment_receipt_path && !row.payment_confirmed_by_employee_at);
    if (!firstUnconfirmed?.payment_receipt_path) return;
    let active = true;
    const loadReceipt = async () => {
      setReceiptLoading(true);
      const { data, error } = await db.storage.from("payment-receipts").createSignedUrl(firstUnconfirmed.payment_receipt_path!, 3600);
      if (!active) return;
      setReceiptLoading(false);
      if (error) { toast({ variant: "destructive", title: "Comprovante indisponível", description: error.message }); return; }
      const related = schedules.filter((row) => row.payment_receipt_path === firstUnconfirmed.payment_receipt_path && !!row.paid_at && !row.payment_confirmed_by_employee_at);
      const paymentMonth = firstUnconfirmed.date.slice(0, 7);
      const paymentDay = Number(firstUnconfirmed.date.slice(8, 10));
      const isFirstFortnight = paymentDay <= 15;
      const totalForFortnight = schedules
        .filter((row) => row.date.slice(0, 7) === paymentMonth && (isFirstFortnight ? Number(row.date.slice(8, 10)) <= 15 : Number(row.date.slice(8, 10)) > 15))
        .reduce((sum, row) => sum + Number(row.daily_rate || 0), 0);
      setPendingReceipt({ path: firstUnconfirmed.payment_receipt_path!, url: data.signedUrl, ids: related.map((row) => row.id), paidAt: firstUnconfirmed.paid_at!, amount: totalForFortnight });
    };
    loadReceipt();
    return () => { active = false; };
  }, [user, schedules, pendingReceipt, toast]);

  const confirmReceipt = async () => {
    if (!pendingReceipt) return;
    try {
      const { error } = await db.rpc("confirm_work_schedule_payment_receipt", { p_schedule_ids: pendingReceipt.ids });
      if (error) throw error;
      const confirmedAt = new Date().toISOString();
      setSchedules((current) => current.map((row) => pendingReceipt.ids.includes(row.id) ? { ...row, payment_confirmed_by_employee_at: confirmedAt } : row));
      setPendingReceipt(null);
      toast({ title: "Comprovante confirmado", description: "Sua confirmação foi registrada." });
    } catch (error: any) { toast({ variant: "destructive", title: "Não foi possível confirmar", description: error?.message || "Tente novamente." }); }
  };

  const openHistoricalReceipt = async (path: string) => {
    const { data, error } = await db.storage.from("payment-receipts").createSignedUrl(path, 300);
    if (error) { toast({ variant: "destructive", title: "Erro ao abrir comprovante", description: error.message }); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const completed = schedules.filter((s) => s.date < today);
    const upcoming = schedules.filter((s) => s.date >= today);
    const confirmed = schedules.filter((s) => s.confirmed === true);
    const paid = schedules.filter((s) => !!s.paid_at);
    const totalValue = schedules.reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const paidValue = paid.reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const confirmedValue = confirmed.reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const scheduledValue = schedules.filter((s) => !!s.payment_scheduled_for && !s.paid_at).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const pendingValue = schedules.filter((s) => s.confirmed === true && !s.paid_at && !s.payment_scheduled_for).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const hours = schedules.reduce((sum, s) => {
      if (!s.start_time || !s.end_time) return sum;
      const [sh, sm] = s.start_time.split(":").map(Number);
      const [eh, em] = s.end_time.split(":").map(Number);
      let duration = eh + em / 60 - sh - sm / 60;
      if (duration < 0) duration += 24;
      return sum + duration;
    }, 0);
    const averageValue = schedules.length ? totalValue / schedules.length : 0;
    const confirmationRate = schedules.length ? confirmed.length / schedules.length * 100 : 0;
    const paymentRate = schedules.length ? paid.length / schedules.length * 100 : 0;
    return { total: schedules.length, completed: completed.length, upcoming: upcoming.length, confirmed: confirmed.length, pending: schedules.filter((s) => s.confirmed !== true).length, paid: paid.length, totalValue, paidValue, confirmedValue, pendingValue, scheduledValue, hours, averageValue, confirmationRate, paymentRate, totalReceived: paidValue, totalPending: pendingValue };
  }, [schedules]);

  const monthly = useMemo(() => {
    const count = period === "all" ? 12 : Number(period);
    const months = Array.from({ length: count }, (_, i) => startOfMonth(subMonths(new Date(), count - i - 1)));
    return months.map((date) => {
      const key = format(date, "yyyy-MM");
      const rows = schedules.filter((s) => s.date.startsWith(key));
      return { month: format(date, "MMM", { locale: ptBR }), escalas: rows.length, valor: rows.reduce((sum, s) => sum + Number(s.daily_rate || 0), 0), recebido: rows.filter((s) => !!s.paid_at).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0) };
    });
  }, [schedules, period]);

  const financialSchedules = useMemo(() => schedules.filter((s) => s.date.startsWith(financialMonth)), [schedules, financialMonth]);
  const financialGroups = useMemo(() => {
    const grouped = new Map<string, Schedule[]>();
    financialSchedules.forEach((schedule) => {
      const key = schedule.environment_id || "no-environment";
      const current = grouped.get(key) || [];
      current.push(schedule);
      grouped.set(key, current);
    });
    return Array.from(grouped.entries()).map(([environmentId, rows]) => {
      const total = rows.reduce((sum, row) => sum + Number(row.daily_rate || 0), 0);
      const confirmed = rows.filter((row) => row.confirmed === true).reduce((sum, row) => sum + Number(row.daily_rate || 0), 0);
      const pending = rows.filter((row) => row.confirmed !== true || (!row.paid_at && !row.payment_scheduled_for)).reduce((sum, row) => sum + Number(row.daily_rate || 0), 0);
      const scheduled = rows.filter((row) => !!row.payment_scheduled_for && !row.paid_at).reduce((sum, row) => sum + Number(row.daily_rate || 0), 0);
      const paid = rows.filter((row) => !!row.paid_at).reduce((sum, row) => sum + Number(row.daily_rate || 0), 0);
      return {
        id: environmentId,
        name: environmentId === "no-environment" ? "Sem ambiente" : environmentNames[environmentId] || "Ambiente",
        rows: [...rows].sort((a, b) => a.date.localeCompare(b.date)),
        total, confirmed, pending, scheduled, paid,
        allPaid: rows.length > 0 && rows.every((row) => !!row.paid_at),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [financialSchedules, environmentNames]);
  const financialTotals = useMemo(() => financialGroups.reduce((totals, group) => ({
    total: totals.total + group.total,
    confirmed: totals.confirmed + group.confirmed,
    pending: totals.pending + group.pending,
    paid: totals.paid + group.paid,
    scheduled: totals.scheduled + group.scheduled,
  }), { total: 0, confirmed: 0, pending: 0, paid: 0, scheduled: 0 }), [financialGroups]);

  const paymentMix = [
    { name: "Pago em escalas", value: stats.paidValue },
    { name: "A receber (pendente)", value: stats.pendingValue },
    { name: "Pagamento agendado", value: stats.scheduledValue },
    { name: "Aguardando confirmação", value: Math.max(0, stats.totalValue - stats.paidValue - stats.pendingValue - stats.scheduledValue) },
  ].filter((x) => x.value > 0);
  const environmentBreakdown = useMemo(() => Object.entries(schedules.reduce((acc, s) => { const name = s.environment_id ? environmentNames[s.environment_id] || "Ambiente" : "Sem ambiente"; acc[name] = (acc[name] || 0) + Number(s.daily_rate || 0); return acc; }, {} as Record<string, number>)).map(([ambiente, valor]) => ({ ambiente, valor })).sort((a, b) => b.valor - a.valor), [schedules, environmentNames]);
  const shiftBreakdown = useMemo(() => { const counts = schedules.reduce((acc, s) => { const hour = Number((s.start_time || "00:00").slice(0, 2)); const key = hour >= 5 && hour < 12 ? "Manhã" : hour >= 12 && hour < 18 ? "Tarde" : hour >= 18 || hour < 5 ? "Noite" : "Não definido"; acc[key] = (acc[key] || 0) + 1; return acc; }, {} as Record<string, number>); return Object.entries(counts).map(([turno, quantidade]) => ({ turno, quantidade })); }, [schedules]);
  const activities = useMemo(() => [
    ...schedules.map((s) => ({ id: "s-" + s.id, date: s.date, title: "Escala", detail: [s.start_time && s.end_time ? s.start_time.slice(0, 5) + "–" + s.end_time.slice(0, 5) : "", s.environment_id ? environmentNames[s.environment_id] || "Ambiente" : ""].filter(Boolean).join(" · "), value: Number(s.daily_rate || 0), status: s.paid_at ? "Pago" : s.payment_scheduled_for ? "Agendado" : s.confirmed ? "A receber" : "Aguardando confirmação", type: "schedule" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8), [schedules, environmentNames]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return <>
    <Dialog open={!!pendingReceipt} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
        <DialogHeader><DialogTitle className="text-xl text-emerald-700 dark:text-emerald-400">Pagamento realizado!</DialogTitle><DialogDescription>O pagamento da sua quinzena foi efetuado. Confira o comprovante abaixo e confirme o recebimento da informação.</DialogDescription></DialogHeader>
        {pendingReceipt && <div className="space-y-3"><div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30"><p><strong>Valor:</strong> {money(pendingReceipt.amount)}</p><p><strong>Data do pagamento:</strong> {format(new Date(pendingReceipt.paidAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p></div><img src={pendingReceipt.url} alt="Comprovante de pagamento" className="max-h-[48vh] w-full rounded-lg border bg-muted object-contain" /></div>}
        <DialogFooter><Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={receiptLoading || !pendingReceipt} onClick={confirmReceipt}><CheckCircle2 className="mr-2 h-4 w-4" />Confirmado</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="min-h-screen bg-background pb-8">
    <header className="gradient-hero px-4 pb-8 pt-7 text-primary-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-primary-foreground"><ArrowLeft /></Button>
          <div className="min-w-0 flex-1"><p className="text-sm text-primary-foreground/75">Visão geral do seu desempenho</p><h1 className="truncate text-2xl font-bold">Meu Dashboard</h1></div>
          <BarChart3 className="h-7 w-7 opacity-80" />
        </div>
        <p className="mt-4 text-sm text-primary-foreground/85">Olá, {profile?.full_name || "Funcionário"}. Aqui está seu histórico completo de escalas e pagamentos.</p>
      </div>
    </header>
    <main className="mx-auto -mt-4 max-w-6xl space-y-4 px-3 sm:px-4">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-0 shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Escalas no total</span><CalendarDays className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">{stats.completed} realizadas · {stats.upcoming} futuras</p></CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Horas escaladas</span><Clock3 className="h-4 w-4 text-primary" /></div><p className="mt-2 text-2xl font-bold">{stats.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</p><p className="text-xs text-muted-foreground">Somatório dos horários cadastrados</p></CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Total pago em escalas</span><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div><p className="mt-2 text-xl font-bold">{money(stats.paidValue)}</p><p className="text-xs text-muted-foreground">{stats.paid} escalas pagas</p></CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">A receber confirmado</span><Wallet className="h-4 w-4 text-primary" /></div><p className="mt-2 text-xl font-bold">{money(stats.pendingValue)}</p><p className="text-xs text-muted-foreground">Escalas confirmadas e não pagas</p></CardContent></Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor total das escalas</p><p className="mt-1 text-lg font-bold">{money(stats.totalValue)}</p></CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Confirmadas</p><p className="mt-1 text-lg font-bold">{stats.confirmed} <span className="text-xs font-normal text-muted-foreground">/ {stats.total}</span></p></CardContent></Card>
        <Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aguardando confirmação</p><p className="mt-1 text-lg font-bold">{stats.pending}</p></CardContent></Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Média por escala</p><p className="mt-1 text-lg font-bold">{money(stats.averageValue)}</p><p className="text-xs text-muted-foreground">Considera todo o histórico</p></CardContent></Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Evolução mensal</CardTitle><p className="text-xs text-muted-foreground">Quantidade de escalas e valores previstos</p></div><select aria-label="Período do gráfico" value={period} onChange={(e) => setPeriod(e.target.value as any)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="6">6 meses</option><option value="12">12 meses</option><option value="all">Últimos 12 meses</option></select></CardHeader>
          <CardContent className="h-72 px-2 pb-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" allowDecimals={false} width={28} tick={{ fontSize: 10 }} /><YAxis yAxisId="right" orientation="right" width={48} tick={{ fontSize: 10 }} tickFormatter={(v) => "R$" + v} /><Tooltip formatter={(value: number, name: string) => [name === "Escalas" ? value : money(value), name]} /><Bar yAxisId="left" dataKey="escalas" name="Escalas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /><Bar yAxisId="right" dataKey="valor" name="Valor previsto" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardHeader><CardTitle className="text-base">Situação dos pagamentos</CardTitle><p className="text-xs text-muted-foreground">Distribuição dos valores das escalas</p></CardHeader>
          <CardContent className="h-64">
            {paymentMix.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={paymentMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>{paymentMix.map((_, i) => <Cell key={i} fill={["hsl(var(--chart-2))", "hsl(var(--primary))", "hsl(var(--muted-foreground))"][i]} />)}</Pie><Tooltip formatter={(value: number) => money(value)} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Ainda não há valores de escalas.</div>}
            <div className="space-y-2">{paymentMix.map((item, i) => <div key={item.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ["hsl(var(--chart-2))", "hsl(var(--primary))", "hsl(var(--muted-foreground))"][i] }} />{item.name}</span><strong>{money(item.value)}</strong></div>)}</div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-card"><CardHeader><CardTitle className="text-base">Valores por ambiente</CardTitle><p className="text-xs text-muted-foreground">Soma de todas as escalas do seu histórico.</p></CardHeader><CardContent className="h-64">{environmentBreakdown.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={environmentBreakdown} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => "R$" + v} /><YAxis type="category" dataKey="ambiente" width={100} tick={{ fontSize: 10 }} /><Tooltip formatter={(value: number) => money(value)} /><Bar dataKey="valor" name="Valor previsto" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem escalas cadastradas.</div>}</CardContent></Card>
        <Card className="border-0 shadow-card"><CardHeader><CardTitle className="text-base">Escalas por turno</CardTitle><p className="text-xs text-muted-foreground">Distribuição de todas as escalas registradas.</p></CardHeader><CardContent className="space-y-4 pt-2">{shiftBreakdown.length ? shiftBreakdown.map((item) => <div key={item.turno}><div className="mb-1 flex justify-between text-sm"><span>{item.turno}</span><strong>{item.quantidade} ({stats.total ? Math.round(item.quantidade / stats.total * 100) : 0}%)</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: (stats.total ? item.quantidade / stats.total * 100 : 0) + "%" }} /></div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Sem escalas cadastradas.</p>}</CardContent></Card>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4 text-primary" />Resumo financeiro</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="flex justify-between gap-3"><span className="text-sm text-muted-foreground">Total previsto nas escalas</span><strong>{money(stats.totalValue)}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-sm text-muted-foreground">Já pago</span><strong className="text-emerald-600">{money(stats.paidValue)}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-sm text-muted-foreground">Confirmado a receber</span><strong>{money(stats.pendingValue)}</strong></div>
          <div className="flex justify-between gap-3"><span className="text-sm text-muted-foreground">Pendente de confirmação</span><strong>{money(Math.max(0, stats.totalValue - stats.confirmedValue))}</strong></div>
        </CardContent></Card>
        <Card className="border-0 shadow-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BriefcaseBusiness className="h-4 w-4 text-primary" />Desempenho nas escalas</CardTitle></CardHeader><CardContent className="space-y-4">
          <div><div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Taxa de confirmação</span><strong>{stats.total ? Math.round(stats.confirmationRate) : 0}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: (stats.total ? stats.confirmed / stats.total * 100 : 0) + "%" }} /></div></div>
          <div><div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Taxa de pagamento</span><strong>{stats.total ? Math.round(stats.paymentRate) : 0}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-600" style={{ width: (stats.total ? stats.paid / stats.total * 100 : 0) + "%" }} /></div></div>
          <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Valor médio por escala</p><strong>{money(stats.averageValue)}</strong></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Média de horas por escala</p><strong>{(stats.total ? stats.hours / stats.total : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h</strong></div></div>
        </CardContent></Card>
      </section>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" />Meu financeiro</CardTitle><p className="text-xs text-muted-foreground">Detalhamento das suas escalas, confirmações e pagamentos.</p></div>
            <input aria-label="Mês do financeiro" type="month" value={financialMonth} onChange={(e) => setFinancialMonth(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-auto" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Total do período</p><p className="mt-1 font-bold">{money(financialTotals.total)}</p><p className="text-[11px] text-muted-foreground">{financialSchedules.length} registro(s)</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Confirmado</p><p className="mt-1 font-bold text-emerald-700 dark:text-emerald-400">{money(financialTotals.confirmed)}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Pendente de confirmação</p><p className="mt-1 font-bold">{money(financialTotals.pending)}</p></div>
            <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30"><p className="text-xs text-muted-foreground">Agendado</p><p className="mt-1 font-bold text-blue-700 dark:text-blue-400">{money(financialTotals.scheduled)}</p></div><div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30"><p className="text-xs text-muted-foreground">Já pago</p><p className="mt-1 font-bold text-emerald-700 dark:text-emerald-400">{money(financialTotals.paid)}</p></div>
          </div>
          {financialGroups.length ? financialGroups.map((group) => (
            <div key={group.id} className="overflow-hidden rounded-xl border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 p-3">
                <div><p className="font-semibold">{group.name}</p><p className="text-xs text-muted-foreground">{group.rows.length} registro(s) · {money(group.total)}</p></div>
                {group.allPaid && <Badge className="border-0 bg-emerald-600 text-white"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />PAGO</Badge>}
              </div>
              <div className="space-y-0 px-3">
                {group.rows.map((schedule) => {
                  const isPaid = !!schedule.paid_at;
                  const isConfirmed = schedule.confirmed === true;
                  const isScheduled = !!schedule.payment_scheduled_for && !isPaid;
                  return <div key={schedule.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 last:border-b-0">
                    <span className="w-12 shrink-0 font-semibold tabular-nums">{dateLabel(schedule.date).slice(0, 5)}</span>
                    <span className="min-w-0 flex-1 text-sm tabular-nums">{isConfirmed && <span className="mr-1" aria-label="Confirmado">🟢</span>}{schedule.start_time && schedule.end_time ? `${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}` : "Horário não definido"}</span>
                    <span className="font-medium tabular-nums">{money(Number(schedule.daily_rate || 0))}</span>{schedule.payment_receipt_path && <Button size="sm" variant="outline" className="h-8" onClick={() => openHistoricalReceipt(schedule.payment_receipt_path!)}>Ver comprovante</Button>}
                    <Badge variant={isPaid ? "default" : isScheduled ? "secondary" : isConfirmed ? "outline" : "outline"} className={isPaid ? "shrink-0 border-0 bg-emerald-600 text-white" : isScheduled ? "shrink-0 border-0 bg-blue-600 text-white" : "shrink-0"}>{isPaid ? "PAGO" : isScheduled ? "AGENDADO" : isConfirmed ? "PENDENTE" : "AGUARDANDO"}</Badge>{isScheduled && <span className="w-full pl-12 text-xs font-medium text-blue-700 dark:text-blue-400">Pagamento previsto para {dateLabel(schedule.payment_scheduled_for!)}</span>}
                  </div>;
                })}
              </div>
              <div className="space-y-1 border-t bg-muted/20 p-3 text-sm">
                <div className="flex justify-between font-semibold"><span>Total do período</span><span>{money(group.total)}</span></div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400"><span>Confirmado</span><span>{money(group.confirmed)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Pendente</span><span>{money(group.pending)}</span></div>
                <div className="flex justify-between text-blue-700 dark:text-blue-400"><span>Agendado</span><span>{money(group.scheduled)}</span></div>
                <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400"><span>Pago</span><span>{money(group.paid)}</span></div>
              </div>
            </div>
          )) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma escala com valor encontrada neste mês.</p>}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-primary" />Atividades recentes</CardTitle><p className="text-xs text-muted-foreground">Últimas escalas vinculadas à sua conta</p></CardHeader><CardContent>
        {activities.length ? <div className="divide-y">{activities.map((item) => <div key={item.id} className="flex items-center gap-3 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">{item.type === "schedule" ? <CalendarDays className="h-4 w-4 text-primary" /> : <Clock3 className="h-4 w-4 text-primary" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title} · {dateLabel(item.date)}</p><p className="truncate text-xs text-muted-foreground">{item.detail || "Sem detalhes adicionais"}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold">{money(item.value)}</p><Badge variant={item.status === "Pago" ? "default" : item.status === "Confirmada" ? "secondary" : "outline"} className="mt-1 text-[10px]">{item.status}</Badge></div></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Ainda não existem atividades registradas.</p>}
      </CardContent></Card>
      <p className="px-1 text-center text-xs text-muted-foreground">Indicadores calculados com base nas escalas vinculadas à sua conta.</p>
    </main>
    </div>
  </>;
}
