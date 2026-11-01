import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Check, Clipboard, Loader2, Printer, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const getDay = (date: string | null | undefined) => Number(String(date || "").slice(8, 10)) || 0;
const localMonth = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const currentFortnight = (): "first" | "second" => new Date().getDate() <= 15 ? "first" : "second";
const formatDate = (date: string) => { const [, month, day] = date.split("-"); return `${day}/${month}`; };

export default function Financial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [month, setMonth] = useState(localMonth());
  const [environments, setEnvironments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedPaidEmployees, setExpandedPaidEmployees] = useState<Set<string>>(new Set());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedFortnight, setSelectedFortnight] = useState<"all" | "first" | "second">(currentFortnight());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      if (!user) return;
      const { data: global, error: roleError } = await db.from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").is("environment_id", null).limit(1).maybeSingle();
      if (roleError) throw roleError;
      if (!global) { navigate("/admin", { replace: true }); return; }
      const [year, monthNumber] = month.split("-").map(Number);
      const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
      const start = `${month}-01`;
      const end = `${nextMonth}-01`;
      const [envResult, scheduleResult, registroResult, profileResult] = await Promise.all([
        db.from("environments").select("id, name").order("name"),
        db.from("work_schedules").select("id, employee_id, environment_id, date, start_time, end_time, daily_rate, shift_type, notes, confirmed, paid_at").gte("date", start).lt("date", end).order("date"),
        db.from("registros").select("user_id, environment_id, timestamp, value_per_registro").gte("timestamp", `${start}T00:00:00`).lt("timestamp", `${end}T00:00:00`),
        db.from("profiles").select("id, full_name").order("full_name"),
      ]);
      if (envResult.error) throw envResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      if (registroResult.error) throw registroResult.error;
      if (profileResult.error) throw profileResult.error;
      if (cancelled) return;
      setEnvironments(envResult.data || []); setSchedules(scheduleResult.data || []); setRegistros(registroResult.data || []); setProfiles(profileResult.data || []); setLoading(false);
    };
    load().catch((error) => { if (cancelled) return; console.error("Erro ao carregar financeiro:", error); toast({ variant: "destructive", title: "Erro financeiro", description: error?.message || "Não foi possível carregar os valores." }); setLoading(false); });
    return () => { cancelled = true; };
  }, [user, month, navigate, toast]);

  const visibleSchedules = useMemo(() => schedules.filter((s) => (selectedEmployee === "all" || s.employee_id === selectedEmployee) && (selectedFortnight === "all" || (selectedFortnight === "first" ? getDay(s.date) >= 1 && getDay(s.date) <= 15 : getDay(s.date) >= 16))), [schedules, selectedEmployee, selectedFortnight]);

  const byEnvironment = useMemo(() => environments.filter((env) => visibleSchedules.some((s) => s.environment_id === env.id && Number(s.daily_rate || 0) > 0)).map((env) => {
    const envSchedules = visibleSchedules.filter((s) => s.environment_id === env.id);
    const envRegistros = registros.filter((r) => r.environment_id === env.id && (selectedEmployee === "all" || r.user_id === selectedEmployee));
    const scheduledTotal = envSchedules.reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const confirmedScheduleTotal = envSchedules.filter((s) => s.confirmed === true).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const pendingScheduleTotal = envSchedules.filter((s) => s.confirmed !== true).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const registeredRecordsTotal = envRegistros.reduce((sum, r) => sum + Number(r.value_per_registro || 0), 0);
    const registeredTotal = registeredRecordsTotal + confirmedScheduleTotal;
    const firstTotal = envSchedules.filter((s) => getDay(s.date) <= 15 && getDay(s.date) > 0).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const secondTotal = envSchedules.filter((s) => getDay(s.date) > 15).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
    const employees = [...new Set(envSchedules.map((s) => s.employee_id))].map((id) => {
      const p = profiles.find((x) => x.id === id); const employeeSchedules = envSchedules.filter((s) => s.employee_id === id);
      return { id, name: p?.full_name || "Funcionário", first: employeeSchedules.filter((s) => getDay(s.date) <= 15 && getDay(s.date) > 0).reduce((a, s) => a + Number(s.daily_rate || 0), 0), second: employeeSchedules.filter((s) => getDay(s.date) > 15).reduce((a, s) => a + Number(s.daily_rate || 0), 0) };
    });
    return { ...env, registeredTotal, registeredRecordsTotal, confirmedScheduleTotal, scheduledTotal, firstTotal, secondTotal, pendingTotal: pendingScheduleTotal, employees };
  }), [environments, visibleSchedules, registros, profiles, selectedEmployee]);

  const scheduleList = useMemo(() => byEnvironment.map((env) => ({ ...env, schedules: env.employees.map((employee) => ({ ...employee, schedules: visibleSchedules.filter((s) => s.environment_id === env.id && s.employee_id === employee.id).sort((a, b) => String(a.date).localeCompare(String(b.date))) })) })), [byEnvironment, visibleSchedules]);

  const markEmployeePaid = async (env: any, employee: any) => {
    const schedulesToPay = employee.schedules || [];
    if (!schedulesToPay.length || !schedulesToPay.every((s: any) => s.confirmed === true)) {
      toast({ variant: "destructive", title: "Pagamento não liberado", description: "Todas as escalas precisam estar confirmadas com a bolinha verde." });
      return;
    }
    if (schedulesToPay.every((s: any) => !!s.paid_at)) return;
    setPayingId(`${env.id}-${employee.id}`);
    try {
      const paidAt = new Date().toISOString();
      const ids = schedulesToPay.map((s: any) => s.id);
      const { error } = await db.from("work_schedules").update({ paid_at: paidAt }).in("id", ids);
      if (error) throw error;
      setSchedules((current) => current.map((schedule) => ids.includes(schedule.id) ? { ...schedule, paid_at: paidAt } : schedule));
      setExpandedPaidEmployees((current) => { const next = new Set(current); next.delete(`${env.id}-${employee.id}`); return next; });
      toast({ title: "Pagamento confirmado", description: `${employee.name} marcado como PAGO.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao confirmar pagamento", description: error?.message || "Não foi possível salvar o pagamento." });
    } finally { setPayingId(null); }
  };

  const copyEmployee = async (env: any, employee: any) => {
    const lines = [
      `*${employee.name}*`,
      `*${env.name}*`,
      "",
      ...employee.schedules.map((s: any) => {
        const time = s.start_time && s.end_time ? `${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}` : "--";
        const confirmation = s.confirmed === true ? " 🟢" : "";
        return `${formatDate(s.date)}${confirmation ? " 🟢" : ""} ${time} ${money(Number(s.daily_rate || 0))}`;
      }),
      "",
      `*Total do período: ${money(employee.schedules.reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0))}*`,
      `Confirmado: ${money(employee.schedules.filter((s: any) => s.confirmed === true).reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0))}`,
      `Pendente: ${money(employee.schedules.filter((s: any) => s.confirmed !== true).reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0))}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedId(`${env.id}-${employee.id}`);
      toast({ title: "Copiado", description: `Escala de ${employee.name} pronta para o WhatsApp.` });
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch { toast({ variant: "destructive", title: "Não foi possível copiar", description: "Selecione e copie o texto manualmente." }); }
  };

  const totals = byEnvironment.reduce((a, e) => ({ registered: a.registered + e.registeredTotal, pending: a.pending + e.pendingTotal }), { registered: 0, pending: 0 });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return <div className="min-h-screen bg-background">
    <div className="gradient-hero p-4 pt-8 pb-6"><div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 max-w-6xl mx-auto"><Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-primary-foreground"><ArrowLeft /></Button><div className="flex-1 min-w-0"><h1 className="text-xl font-bold text-primary-foreground">Financeiro por Ambiente</h1><p className="text-sm text-primary-foreground/80">Os valores pendentes são calculados pelas escalas ainda não confirmadas. As escalas confirmadas entram automaticamente no total registrado.</p></div><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row print:hidden"><div className="flex flex-col sm:flex-row gap-2 print:hidden"><select value={selectedFortnight} onChange={(e) => setSelectedFortnight(e.target.value as "all" | "first" | "second")} className="h-11 w-full sm:w-auto rounded-md border bg-background px-3 text-base sm:text-sm"><option value="first">1ª quinzena (1–15)</option><option value="second">2ª quinzena (16–fim)</option><option value="all">Mês inteiro</option></select><select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="h-11 w-full sm:w-auto rounded-md border bg-background px-3 text-base sm:text-sm"><option value="all">Todos os funcionários</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select><Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Relatório mensal</Button></div><input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setSelectedFortnight(currentFortnight()); }} className="h-11 w-full sm:w-auto rounded-md border-0 px-2 bg-background/90 text-foreground text-base sm:text-sm" /></div></div></div>
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3"><Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total registrado</p><p className="text-2xl font-bold">{money(totals.registered)}</p></CardContent></Card><Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total pendente das escalas</p><p className="text-2xl font-bold">{money(totals.pending)}</p></CardContent></Card></div>
      {byEnvironment.map((env) => <Card key={env.id} className="border-0 shadow-card"><CardHeader><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div><div className="flex-1"><CardTitle className="text-base">{env.name}</CardTitle><p className="text-xs text-muted-foreground">Registrado: {money(env.registeredTotal)}</p></div><Badge variant="secondary">Pendente: {money(env.pendingTotal)}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 p-3"><p className="text-sm font-medium">1º pagamento — dias 1 a 15</p><p className="text-lg font-semibold mt-1">{money(env.firstTotal)}</p></div><div className="rounded-lg bg-muted/50 p-3"><p className="text-sm font-medium">2º pagamento — dias 16 a fim</p><p className="text-lg font-semibold mt-1">{money(env.secondTotal)}</p></div></div><div className="space-y-2">{env.employees.map((e) => <div key={e.id} className="flex flex-wrap items-center gap-3 border rounded-lg p-3"><span className="font-medium flex-1 min-w-[140px]">{e.name}</span><span className="text-xs text-muted-foreground">1–15: {money(e.first)}</span><span className="text-xs text-muted-foreground">16–fim: {money(e.second)}</span></div>)}</div></CardContent></Card>)}
      <Card className="border-0 shadow-card"><CardHeader><CardTitle className="text-base">Relatório mensal</CardTitle><p className="text-sm text-muted-foreground">Resumo por ambiente e funcionário para o mês selecionado.</p></CardHeader><CardContent className="space-y-3">{byEnvironment.map((env) => <div key={env.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><span className="font-semibold">{env.name}</span><span className="font-semibold">{money(env.registeredTotal + env.pendingTotal)}</span></div>{env.employees.map((e:any)=><div key={e.id} className="mt-2 flex justify-between border-t pt-2 text-sm"><span>{e.name}</span><span>{money(e.first + e.second)}</span></div>)}</div>)}<div className="border-t pt-3 flex justify-between font-bold"><span>Total previsto</span><span>{money(totals.registered + totals.pending)}</span></div></CardContent></Card>{scheduleList.length > 0 && <Card className="border-0 shadow-card"><CardHeader><div><CardTitle className="text-base">Escalas para WhatsApp</CardTitle><p className="text-sm text-muted-foreground">Cada funcionário tem uma cópia própria, compacta e organizada.</p></div></CardHeader><CardContent className="space-y-4">{scheduleList.map((env) => <div key={env.id} className="space-y-2"><p className="text-sm font-semibold border-b pb-1">{env.name}</p><div className="space-y-3">{env.schedules.map((employee: any) => { const copyId = `${env.id}-${employee.id}`; const isPaid = employee.schedules.length > 0 && employee.schedules.every((s: any) => !!s.paid_at); const allConfirmed = employee.schedules.length > 0 && employee.schedules.every((s: any) => s.confirmed === true); const isExpanded = !isPaid || expandedPaidEmployees.has(copyId); const total = employee.schedules.reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0); const confirmed = employee.schedules.filter((s: any) => s.confirmed === true).reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0); const pending = employee.schedules.filter((s: any) => s.confirmed !== true).reduce((sum: number, s: any) => sum + Number(s.daily_rate || 0), 0); return <div key={employee.id} className={`rounded-xl border bg-card p-3 sm:p-4 space-y-3 ${isPaid ? "border-emerald-200 dark:border-emerald-900/60" : ""}`}><div className="flex flex-col gap-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="font-semibold text-base break-words">{employee.name}</p><p className="text-sm text-muted-foreground">{employee.schedules.length} registro(s) <span className="mx-1">·</span> {money(total)}</p></div>{isPaid && <Badge className="shrink-0 bg-emerald-600 text-white border-0 px-2.5 py-1"><CheckCircle2 className="h-3.5 w-3.5 mr-1" />PAGO</Badge>}</div><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><span className="text-emerald-700 dark:text-emerald-400">Confirmado: {money(confirmed)}</span><span className="text-muted-foreground">Pendente: {money(pending)}</span></div><div className="flex flex-wrap items-center gap-2">{!isPaid && allConfirmed && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={payingId === copyId} onClick={() => markEmployeePaid(env, employee)}>{payingId === copyId ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando</> : <><CheckCircle2 className="h-4 w-4 mr-1" />Marcar como PAGO</>}</Button>}<Button size="sm" variant="outline" onClick={() => copyEmployee(env, employee)}>{copiedId === copyId ? <><Check className="h-4 w-4 mr-1" />Copiado</> : <><Clipboard className="h-4 w-4 mr-1" />Copiar</>}</Button>{isPaid && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setExpandedPaidEmployees((current) => { const next = new Set(current); if (next.has(copyId)) next.delete(copyId); else next.add(copyId); return next; })}>{isExpanded ? <><ChevronUp className="h-4 w-4 mr-1" />Recolher</> : <><ChevronDown className="h-4 w-4 mr-1" />Visualizar</>}</Button>}</div></div>{isExpanded && <div className="rounded-lg bg-muted/40 px-3 py-3 text-sm"><div className="space-y-2">{employee.schedules.map((s: any) => <div key={s.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2"><span className="font-semibold tabular-nums">{formatDate(s.date)}</span><span className="min-w-0">{s.confirmed === true && <span className="mr-1" aria-label="Confirmado">🟢</span>}{s.start_time && s.end_time ? `${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}` : "--"}</span><span className="text-right tabular-nums whitespace-nowrap">{money(Number(s.daily_rate || 0))}</span></div>{s.notes?.trim()&&<div className="ml-1 rounded-md border border-amber-200/70 bg-amber-50/70 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"><span className="font-semibold">Observação:</span><p className="mt-0.5 whitespace-pre-wrap break-words">{s.notes}</p></div>}</div>)}</div><div className="mt-3 border-t pt-3 space-y-1.5"><div className="font-semibold">Total do período: {money(total)}</div><div className="text-emerald-700 dark:text-emerald-400">Confirmado: {money(confirmed)}</div><div className="text-muted-foreground">Pendente: {money(pending)}</div>{isPaid && <p className="pt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Pagamento confirmado</p>}</div></div>}</div>; })}</div></div>)}</CardContent></Card>}
      {byEnvironment.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma escala com valor lançada no mês selecionado.</CardContent></Card>}
    </div>
  </div>;
}
