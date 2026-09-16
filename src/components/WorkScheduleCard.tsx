import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Plus, Trash2, Users, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const db = supabase as any;

interface Schedule {
  id: string;
  employee_id: string;
  environment_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string;
  notes: string | null;
  daily_rate: number | null;
  employee_name?: string;
}

interface Employee {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Environment {
  id: string;
  name: string;
}

interface WorkScheduleCardProps {
  isAdmin: boolean;
  userId: string;
  environmentId?: string | null;
}

export function WorkScheduleCard({ isAdmin, userId, environmentId }: WorkScheduleCardProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEnvironment, setSelectedEnvironment] = useState(environmentId || "");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [dailyRate, setDailyRate] = useState("");
  const [shiftType, setShiftType] = useState("regular");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = format(weekStart, "yyyy-MM-dd");
      const endDate = format(weekEnd, "yyyy-MM-dd");
      let query = db.from("work_schedules").select("*").gte("date", startDate).lte("date", endDate).order("date", { ascending: true }).order("start_time", { ascending: true });

      if (!isAdmin) query = query.eq("employee_id", userId);
      if (environmentId) query = query.eq("environment_id", environmentId);

      const { data, error } = await query;
      if (error) throw error;

      const employeeIds = [...new Set((data || []).map((s: Schedule) => s.employee_id))];
      let profiles: Employee[] = [];
      if (employeeIds.length) {
        const { data: profileData, error: profileError } = await db.from("profiles").select("id, full_name, avatar_url").in("id", employeeIds);
        if (profileError) throw profileError;
        profiles = profileData || [];
      }
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      setSchedules((data || []).map((s: Schedule) => ({ ...s, employee_name: profileMap.get(s.employee_id)?.full_name || "Funcionário" })));
    } catch (error: any) {
      console.error("Error fetching schedules:", error);
      toast({ variant: "destructive", title: "Erro ao carregar escala", description: error.message || "Não foi possível carregar a escala." });
    } finally {
      setLoading(false);
    }
  }, [weekStart, isAdmin, userId, environmentId, toast]);

  const fetchEmployees = useCallback(async () => {
    try {
      let query = db.from("profiles").select("id, full_name, avatar_url").order("full_name");
      if (environmentId) query = query.eq("environment_id", environmentId);
      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast({ variant: "destructive", title: "Erro", description: error.message || "Não foi possível carregar os funcionários." });
    }
  }, [environmentId, toast]);

  const fetchEnvironments = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await db.from("environments").select("id, name").order("name");
    if (!error) setEnvironments(data || []);
  }, [isAdmin]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
      fetchEnvironments();
    }
  }, [isAdmin, fetchEmployees, fetchEnvironments]);

  useEffect(() => {
    setSelectedEnvironment(environmentId || "");
  }, [environmentId]);

  const handleAddSchedule = async () => {
    if (!selectedEmployee || !selectedDate) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione um funcionário e uma data." });
      return;
    }
    if (environmentId === null && isAdmin && !selectedEnvironment) {
      toast({ variant: "destructive", title: "Erro", description: "Selecione o ambiente da escala." });
      return;
    }
    if (startTime >= endTime) {
      toast({ variant: "destructive", title: "Horário inválido", description: "O término deve ser depois do início." });
      return;
    }

    try {
      const payload = {
        employee_id: selectedEmployee,
        environment_id: selectedEnvironment || environmentId || null,
        date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        shift_type: shiftType,
        notes: notes || null,
        daily_rate: dailyRate ? Number(dailyRate) : 0,
        created_by: userId,
      };
      const { error } = await db.from("work_schedules").insert(payload);
      if (error) throw error;

      toast({ title: "Escala adicionada!", description: "Ela aparecerá automaticamente na semana correspondente." });
      setDialogOpen(false);
      resetForm();
      const targetWeek = startOfWeek(new Date(`${selectedDate}T12:00:00`), { weekStartsOn: 1 });
      setWeekStart(targetWeek);
      fetchSchedules();
    } catch (error: any) {
      console.error("Error adding schedule:", error);
      toast({ variant: "destructive", title: "Erro ao adicionar escala", description: error.message || "Não foi possível adicionar a escala." });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await db.from("work_schedules").delete().eq("id", scheduleId);
      if (error) throw error;
      toast({ title: "Escala removida", description: "A escala foi removida com sucesso." });
      fetchSchedules();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message || "Não foi possível remover a escala." });
    }
  };

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("08:00");
    setEndTime("17:00");
    setDailyRate("");
    setShiftType("regular");
    setNotes("");
  };

  const getShiftLabel = (type: string) => ({ morning: "Manhã", afternoon: "Tarde", night: "Noite", regular: "Regular" }[type] || "Regular");
  const getShiftBadgeColor = (type: string) => ({ morning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", afternoon: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", night: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", regular: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" }[type] || "bg-muted text-foreground");

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><Calendar className="h-5 w-5 text-primary" />Escala da Semana</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{format(weekStart, "dd/MM/yyyy")} — {format(weekEnd, "dd/MM/yyyy")}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} title="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Semana atual</Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} title="Próxima semana"><ChevronRight className="h-4 w-4" /></Button>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild><Button size="sm" className="gradient-primary"><Plus className="h-4 w-4 mr-1" />Adicionar</Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Nova Escala</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Funcionário</Label><Select value={selectedEmployee} onValueChange={setSelectedEmployee}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>)}</SelectContent></Select></div>
                    {isAdmin && !environmentId && <div className="space-y-2"><Label>Ambiente</Label><Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}><SelectTrigger><SelectValue placeholder="Selecione o ambiente..." /></SelectTrigger><SelectContent>{environments.map((env) => <SelectItem key={env.id} value={env.id}><span className="flex items-center gap-2"><Building2 className="h-3 w-3" />{env.name}</span></SelectItem>)}</SelectContent></Select></div>}
                    <div className="space-y-2"><Label>Data</Label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Entrada</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div><div className="space-y-2"><Label>Saída</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></div>
                    <div className="space-y-2"><Label>Valor da diária (R$)</Label><Input type="number" min="0" step="0.01" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="Ex.: 120,00" /></div>
                    <div className="space-y-2"><Label>Turno</Label><Select value={shiftType} onValueChange={setShiftType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="morning">Manhã</SelectItem><SelectItem value="afternoon">Tarde</SelectItem><SelectItem value="night">Noite</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={2} /></div>
                    <Button onClick={handleAddSchedule} className="w-full gradient-primary">Salvar Escala</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando escala...</div> : <div className="space-y-3">
          {weekDays.map((day) => {
            const daySchedules = schedules.filter((s) => isSameDay(new Date(`${s.date}T12:00:00`), day));
            const isToday = isSameDay(day, new Date());
            return <div key={day.toISOString()} className={`p-3 rounded-xl border ${isToday ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-transparent"}`}>
              <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><span className={`text-sm font-medium capitalize ${isToday ? "text-primary" : "text-muted-foreground"}`}>{format(day, "EEEE", { locale: ptBR })}</span><span className="text-xs text-muted-foreground">{format(day, "dd/MM")}</span>{isToday && <Badge variant="secondary" className="text-xs">Hoje</Badge>}</div></div>
              {daySchedules.length ? <div className="space-y-2">{daySchedules.map((schedule) => <div key={schedule.id} className="flex items-center justify-between gap-2 p-2 bg-background rounded-lg"><div className="flex items-center gap-2 min-w-0"><Users className="h-4 w-4 text-muted-foreground shrink-0" /><span className="text-sm font-medium truncate">{schedule.employee_name}</span><Badge className={getShiftBadgeColor(schedule.shift_type)}>{getShiftLabel(schedule.shift_type)}</Badge>{schedule.start_time && schedule.end_time && <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap"><Clock className="h-3 w-3" />{schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}</span>}{schedule.daily_rate ? <span className="text-xs font-medium whitespace-nowrap">R$ {Number(schedule.daily_rate).toFixed(2).replace(".", ",")}</span> : null}</div>{isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => handleDeleteSchedule(schedule.id)}><Trash2 className="h-4 w-4" /></Button>}</div>)}</div> : <p className="text-sm text-muted-foreground py-2">Sem escalas programadas</p>}
            </div>;
          })}
        </div>}
      </CardContent>
    </Card>
  );
}
