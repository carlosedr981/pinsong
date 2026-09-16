import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, DollarSign, Loader2, Plus, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
type Schedule = { id: string; employee_id: string; date: string; start_time: string | null; end_time: string | null; daily_rate: number; environment_id: string | null; shift_type: string | null; notes: string | null; employee_name?: string; environment_name?: string };
type Employee = { id: string; full_name: string };
type Environment = { id: string; name: string };

function monthDates(month: string) {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(year, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${year}-${String(m).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`);
}

export function MonthlyScheduleCard({ isAdmin, userId, environmentId }: { isAdmin: boolean; userId: string; environmentId?: string | null }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [employee, setEmployee] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState(environmentId || "");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [dailyRate, setDailyRate] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    let query = db.from("work_schedules").select("*").gte("date", `${month}-01`).lte("date", `${month}-31`).order("date");
    if (!isAdmin) query = query.eq("employee_id", userId);
    else if (environmentId) query = query.eq("environment_id", environmentId);
    const { data } = await query;
    const rows = data || [];
    const ids = [...new Set(rows.map((r: Schedule) => r.employee_id))];
    const envIds = [...new Set(rows.map((r: Schedule) => r.environment_id).filter(Boolean))];
    const [{ data: profiles }, { data: envs }] = await Promise.all([
      ids.length ? db.from("profiles").select("id, full_name").in("id", ids) : Promise.resolve({ data: [] }),
      envIds.length ? db.from("environments").select("id, name").in("id", envIds) : Promise.resolve({ data: [] }),
    ]);
    const pm = new Map((profiles || []).map((p: Employee) => [p.id, p.full_name]));
    const em = new Map((envs || []).map((e: Environment) => [e.id, e.name]));
    setSchedules(rows.map((r: Schedule) => ({ ...r, employee_name: pm.get(r.employee_id) || "Funcionário", environment_name: r.environment_id ? em.get(r.environment_id) : undefined })));
    if (isAdmin) {
      let eq = db.from("profiles").select("id, full_name").order("full_name");
      if (environmentId) eq = eq.eq("environment_id", environmentId);
      const [{ data: eps }, { data: ens }] = await Promise.all([eq, db.from("environments").select("id, name").order("name")]);
      setEmployees(eps || []); setEnvironments(ens || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [month, isAdmin, userId, environmentId]);

  const saveMonthly = async () => {
    if (!employee || !selectedEnvironment || Number(dailyRate) < 0) {
      toast({ variant: "destructive", title: "Preencha a escala", description: "Selecione funcionário, ambiente e informe a diária." });
      return;
    }
    setSaving(true);
    try {
      const dates = monthDates(month);
      const { error: deleteError } = await db.from("work_schedules").delete().eq("employee_id", employee).eq("environment_id", selectedEnvironment).gte("date", `${month}-01`).lte("date", `${month}-31`);
      if (deleteError) throw deleteError;
      const payload = dates.map((date) => ({ employee_id: employee, environment_id: selectedEnvironment, date, start_time: start, end_time: end, daily_rate: Number(dailyRate), shift_type: "regular", notes: null, created_by: userId }));
      const { error } = await db.from("work_schedules").insert(payload);
      if (error) throw error;
      toast({ title: "Escala mensal criada", description: `${dates.length} dia(s) configurados.` });
      await load();
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao criar escala", description: error?.message || "Não foi possível salvar a escala mensal." });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    const { error } = await db.from("work_schedules").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Erro", description: error.message }); else load();
  };
  const grouped = useMemo(() => schedules, [schedules]);

  return <Card className="shadow-xl border-0">
    <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-primary" />Escala Mensal</CardTitle><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[150px]" /></div></CardHeader>
    <CardContent className="space-y-4">
      {isAdmin && <div className="rounded-xl border p-4 space-y-3"><div className="grid sm:grid-cols-2 gap-3"><div><Label>Funcionário</Label><Select value={employee} onValueChange={setEmployee}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select></div><div><Label>Ambiente</Label><Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{environments.filter((e) => !environmentId || e.id === environmentId).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Entrada</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div><div><Label>Saída</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div><div><Label>Valor da diária (R$)</Label><Input type="number" min="0" step="0.01" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} /></div></div><Button onClick={saveMonthly} disabled={saving} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Criar escala do mês"}</Button></div>}
      {loading ? <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : grouped.length === 0 ? <p className="text-sm text-muted-foreground py-4">Nenhuma escala neste mês.</p> : <div className="space-y-2 max-h-[520px] overflow-y-auto">{grouped.map((s) => <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="min-w-[56px] text-center"><p className="text-lg font-bold">{s.date.slice(8, 10)}</p><p className="text-[10px] text-muted-foreground">{s.date.slice(5, 7)}</p></div><div className="flex-1 min-w-0"><p className="font-medium truncate">{s.employee_name}</p><div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</span><span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />R$ {Number(s.daily_rate || 0).toFixed(2)}</span>{s.environment_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{s.environment_name}</span>}</div></div>{isAdmin && <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}<Badge variant="secondary">{s.shift_type || "Regular"}</Badge></div>)}</div>}
    </CardContent>
  </Card>;
}
