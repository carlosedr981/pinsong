import { useState, useEffect } from "react";
import { Star, Crown, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Employee {
  id: string;
  full_name: string;
  avatar_url: string | null;
  environment_id: string | null;
}

interface EmployeeOfDayCardProps {
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  userId: string;
  environmentId?: string | null;
}

export function EmployeeOfDayCard({ 
  isAdmin, 
  isGlobalAdmin, 
  userId,
  environmentId 
}: EmployeeOfDayCardProps) {
  const [employeeOfDay, setEmployeeOfDay] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    fetchEmployeeOfDay();
    if (isAdmin) {
      fetchEmployees();
    }
  }, [isAdmin, environmentId]);

  const fetchEmployeeOfDay = async () => {
    try {
      // Fetch today's employee of day
      const query = supabase
        .from("employee_of_day")
        .select("employee_id")
        .eq("date", today);

      if (environmentId) {
        query.eq("environment_id", environmentId);
      } else if (!isGlobalAdmin) {
        query.is("environment_id", null);
      }

      const { data: eod } = await query.maybeSingle();

      if (eod?.employee_id) {
        // Fetch employee profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, environment_id")
          .eq("id", eod.employee_id)
          .single();

        if (profile) {
          setEmployeeOfDay(profile);
          setSelectedEmployeeId(profile.id);
        }
      }
    } catch (error) {
      console.error("Error fetching employee of day:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      let query = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, environment_id");

      if (!isGlobalAdmin && environmentId) {
        query = query.eq("environment_id", environmentId);
      }

      const { data } = await query;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleSelectEmployee = async (employeeId: string) => {
    try {
      // Delete existing entry for today
      await supabase
        .from("employee_of_day")
        .delete()
        .eq("date", today)
        .eq("environment_id", environmentId || null);

      // Insert new entry
      const { error } = await supabase.from("employee_of_day").insert({
        employee_id: employeeId,
        environment_id: environmentId || null,
        date: today,
        selected_by: userId,
      });

      if (error) throw error;

      // Update local state
      const selected = employees.find((e) => e.id === employeeId);
      if (selected) {
        setEmployeeOfDay(selected);
        setSelectedEmployeeId(employeeId);
      }

      toast({
        title: "Funcionário do dia atualizado!",
        description: `${selected?.full_name} é o funcionário do dia.`,
      });
    } catch (error) {
      console.error("Error setting employee of day:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível definir o funcionário do dia.",
      });
    }
  };

  if (!isAdmin) return null;

  return (
    <Card className="shadow-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5 text-amber-500" />
          Funcionário do Dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {employeeOfDay ? (
          <div className="flex items-center gap-4 p-4 bg-white/60 dark:bg-white/10 rounded-xl">
            <Avatar className="h-16 w-16 ring-4 ring-amber-400 ring-offset-2">
              <AvatarImage src={employeeOfDay.avatar_url || undefined} />
              <AvatarFallback className="bg-amber-100 text-amber-700 text-xl font-bold">
                {employeeOfDay.full_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-lg text-foreground">
                {employeeOfDay.full_name}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                Destaque de {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p>Nenhum funcionário selecionado hoje</p>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Selecionar funcionário do dia:
            </p>
            <Select value={selectedEmployeeId} onValueChange={handleSelectEmployee}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha um funcionário..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={employee.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {employee.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {employee.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
