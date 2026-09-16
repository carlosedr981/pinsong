import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarRange, Loader2, Users } from "lucide-react";
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

export default function Financial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [environments, setEnvironments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const { data: global, error: roleError } = await db
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .is("environment_id", null)
        .limit(1)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!global) {
        navigate("/admin", { replace: true });
        return;
      }

      const start = `${month}-01`;
      const end = `${month}-31`;
      const [envResult, scheduleResult, registroResult, profileResult] = await Promise.all([
        db.from("environments").select("id, name").order("name"),
        db.from("work_schedules").select("employee_id, environment_id, date, daily_rate").gte("date", start).lte("date", end),
        db.from("registros").select("user_id, environment_id, timestamp, value_per_registro").gte("timestamp", `${start}T00:00:00`).lte("timestamp", `${end}T23:59:59`),
        db.from("profiles").select("id, full_name").order("full_name"),
      ]);

      if (envResult.error) throw envResult.error;
      if (scheduleResult.error) throw scheduleResult.error;
      if (registroResult.error) throw registroResult.error;
      if (profileResult.error) throw profileResult.error;

      setEnvironments(envResult.data || []);
      setSchedules(scheduleResult.data || []);
      setRegistros(registroResult.data || []);
      setProfiles(profileResult.data || []);
      setLoading(false);
    };

    load().catch((error) => {
      console.error("Erro ao carregar financeiro:", error);
      toast({ variant: "destructive", title: "Erro financeiro", description: error?.message || "Não foi possível carregar os valores." });
      setLoading(false);
    });
  }, [user, month, navigate, toast]);

  const byEnvironment = useMemo(() => environments
    .filter((env) => schedules.some((s) => s.environment_id === env.id))
    .map((env) => {
      const envSchedules = schedules.filter((s) => s.environment_id === env.id);
      const envRegistros = registros.filter((r) => r.environment_id === env.id);
      const scheduledTotal = envSchedules.reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
      const registeredTotal = envRegistros.reduce((sum, r) => sum + Number(r.value_per_registro || 0), 0);
      const firstTotal = envSchedules.filter((s) => getDay(s.date) <= 15 && getDay(s.date) > 0).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
      const secondTotal = envSchedules.filter((s) => getDay(s.date) > 15).reduce((sum, s) => sum + Number(s.daily_rate || 0), 0);
      const employees = [...new Set(envSchedules.map((s) => s.employee_id))].map((id) => {
        const p = profiles.find((x) => x.id === id);
        const employeeSchedules = envSchedules.filter((s) => s.employee_id === id);
        return {
          id,
          name: p?.full_name || "Funcionário",
          first: employeeSchedules.filter((s) => getDay(s.date) <= 15 && getDay(s.date) > 0).reduce((a, s) => a + Number(s.daily_rate || 0), 0),
          second: employeeSchedules.filter((s) => getDay(s.date) > 15).reduce((a, s) => a + Number(s.daily_rate || 0), 0),
        };
      });
      return { ...env, registeredTotal, scheduledTotal, firstTotal, secondTotal, pendingTotal: scheduledTotal, employees };
    }), [environments, schedules, registros, profiles]);

  const totals = byEnvironment.reduce((a, e) => ({ registered: a.registered + e.registeredTotal, pending: a.pending + e.pendingTotal }), { registered: 0, pending: 0 });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return <div className="min-h-screen bg-background">
    <div className="gradient-hero p-4 pt-8 pb-6"><div className="flex items-center gap-3 max-w-6xl mx-auto"><Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-primary-foreground"><ArrowLeft /></Button><div className="flex-1"><h1 className="text-xl font-bold text-primary-foreground">Financeiro por Ambiente</h1><p className="text-sm text-primary-foreground/80">Os valores pendentes são calculados diretamente das escalas lançadas e das diárias informadas.</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 rounded-md border-0 px-2 bg-background/90 text-foreground" /></div></div>
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="grid sm:grid-cols-2 gap-3"><Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total registrado</p><p className="text-2xl font-bold">{money(totals.registered)}</p></CardContent></Card><Card className="border-0 shadow-card"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total pendente das escalas</p><p className="text-2xl font-bold">{money(totals.pending)}</p></CardContent></Card></div>
      {byEnvironment.map((env) => <Card key={env.id} className="border-0 shadow-card"><CardHeader><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div><div className="flex-1"><CardTitle className="text-base">{env.name}</CardTitle><p className="text-xs text-muted-foreground">Registrado: {money(env.registeredTotal)}</p></div><Badge variant="secondary">Pendente: {money(env.pendingTotal)}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="grid sm:grid-cols-2 gap-3"><div className="rounded-lg bg-muted/50 p-3"><div className="flex items-center gap-2 text-sm font-medium"><CalendarRange className="h-4 w-4" />1º pagamento — dias 1 a 15</div><p className="text-lg font-semibold mt-1">{money(env.firstTotal)}</p></div><div className="rounded-lg bg-muted/50 p-3"><div className="flex items-center gap-2 text-sm font-medium"><CalendarRange className="h-4 w-4" />2º pagamento — dias 16 a fim</div><p className="text-lg font-semibold mt-1">{money(env.secondTotal)}</p></div></div><div className="space-y-2">{env.employees.map((e) => <div key={e.id} className="flex items-center gap-3 border rounded-lg p-3"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-medium flex-1">{e.name}</span><span className="text-xs text-muted-foreground">1–15: {money(e.first)}</span><span className="text-xs text-muted-foreground">16–fim: {money(e.second)}</span></div>)}</div></CardContent></Card>)}
      {byEnvironment.length === 0 && <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma escala com valor lançada no mês selecionado.</CardContent></Card>}
    </div>
  </div>;
}
