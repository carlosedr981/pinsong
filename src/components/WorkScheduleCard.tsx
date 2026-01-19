import { useState, useEffect } from "react";
import { Calendar, Clock, Plus, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Schedule {
  id: string;
  employee_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  shift_type: string;
  notes: string | null;
  employee_name?: string;
  employee_avatar?: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface WorkScheduleCardProps {
  isAdmin: boolean;
  userId: string;
  environmentId?: string | null;
}

export function WorkScheduleCard({ isAdmin, userId, environmentId }: WorkScheduleCardProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("08:00");
  const [endTime, setEndTime] = useState<string>("17:00");
  const [shiftType, setShiftType] = useState<string>("regular");
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();

  // Generate week days starting from today
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  useEffect(() => {
    fetchSchedules();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [isAdmin, environmentId]);

  const fetchSchedules = async () => {
    try {
      const startDate = format(new Date(), "yyyy-MM-dd");
      const endDate = format(addDays(new Date(), 7), "yyyy-MM-dd");

      let query = supabase
        .from("work_schedules")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

      if (!isAdmin) {
        query = query.eq("employee_id", userId);
      } else if (environmentId) {
        query = query.eq("environment_id", environmentId);
      }

      const { data } = await query;

      if (data) {
        // Fetch employee names for each schedule
        const employeeIds = [...new Set(data.map((s) => s.employee_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", employeeIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        
        const enrichedSchedules = data.map((s) => ({
          ...s,
          employee_name: profileMap.get(s.employee_id)?.full_name || "Unknown",
          employee_avatar: profileMap.get(s.employee_id)?.avatar_url,
        }));

        setSchedules(enrichedSchedules);
      }
    } catch (error) {
      console.error("Error fetching schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from("profiles")
        .select("id, full_name, avatar_url");

      if (environmentId) {
        query = query.eq("environment_id", environmentId);
      }

      const { data } = await query;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedEmployee || !selectedDate) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um funcionário e uma data.",
      });
      return;
    }

    try {
      const { error } = await supabase.from("work_schedules").insert({
        employee_id: selectedEmployee,
        environment_id: environmentId || null,
        date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        shift_type: shiftType,
        notes: notes || null,
        created_by: userId,
      });

      if (error) throw error;

      toast({
        title: "Escala adicionada!",
        description: "A escala foi configurada com sucesso.",
      });

      setDialogOpen(false);
      resetForm();
      fetchSchedules();
    } catch (error) {
      console.error("Error adding schedule:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível adicionar a escala.",
      });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from("work_schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;

      toast({
        title: "Escala removida",
        description: "A escala foi removida com sucesso.",
      });

      fetchSchedules();
    } catch (error) {
      console.error("Error deleting schedule:", error);
    }
  };

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("08:00");
    setEndTime("17:00");
    setShiftType("regular");
    setNotes("");
  };

  const getShiftBadgeColor = (type: string) => {
    switch (type) {
      case "morning":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "afternoon":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "night":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      default:
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    }
  };

  const getShiftLabel = (type: string) => {
    switch (type) {
      case "morning":
        return "Manhã";
      case "afternoon":
        return "Tarde";
      case "night":
        return "Noite";
      default:
        return "Regular";
    }
  };

  const getSchedulesForDate = (date: Date) => {
    return schedules.filter((s) => isSameDay(new Date(s.date + "T00:00:00"), date));
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Escala da Semana
          </CardTitle>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary">
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nova Escala</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Funcionário</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      min={format(new Date(), "yyyy-MM-dd")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Término</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Turno</Label>
                    <Select value={shiftType} onValueChange={setShiftType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="morning">Manhã</SelectItem>
                        <SelectItem value="afternoon">Tarde</SelectItem>
                        <SelectItem value="night">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas adicionais..."
                      rows={2}
                    />
                  </div>

                  <Button onClick={handleAddSchedule} className="w-full gradient-primary">
                    Salvar Escala
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {weekDays.map((day) => {
            const daySchedules = getSchedulesForDate(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`p-3 rounded-xl border ${
                  isToday
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30 border-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium capitalize ${
                        isToday ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "EEEE", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(day, "dd/MM")}
                    </span>
                    {isToday && (
                      <Badge variant="secondary" className="text-xs">
                        Hoje
                      </Badge>
                    )}
                  </div>
                </div>

                {daySchedules.length > 0 ? (
                  <div className="space-y-2">
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="flex items-center justify-between p-2 bg-background rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {schedule.employee_name}
                            </span>
                          </div>
                          <Badge className={getShiftBadgeColor(schedule.shift_type)}>
                            {getShiftLabel(schedule.shift_type)}
                          </Badge>
                          {schedule.start_time && schedule.end_time && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    Sem escalas programadas
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
