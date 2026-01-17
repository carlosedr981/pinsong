import { useState, useEffect } from "react";
import { Loader2, DollarSign, Save, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Employee {
  id: string;
  full_name: string;
  avatar_url: string | null;
  hourly_rate?: number | null;
}

interface HourlyRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
}

export function HourlyRateDialog({
  open,
  onOpenChange,
  employees,
}: HourlyRateDialogProps) {
  const [globalRate, setGlobalRate] = useState("20.00");
  const [employeeRates, setEmployeeRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingEmployeeId, setSavingEmployeeId] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch global rate
  useEffect(() => {
    const fetchGlobalRate = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "global_hourly_rate")
        .maybeSingle();

      if (!error && data) {
        setGlobalRate(data.value);
      }
    };

    if (open) {
      fetchGlobalRate();
      // Initialize employee rates
      const rates: Record<string, string> = {};
      employees.forEach((emp) => {
        rates[emp.id] = emp.hourly_rate?.toString() || "";
      });
      setEmployeeRates(rates);
    }
  }, [open, employees]);

  const handleSaveGlobal = async () => {
    const rateValue = parseFloat(globalRate);
    if (isNaN(rateValue) || rateValue < 0) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Por favor, insira um valor válido.",
      });
      return;
    }

    setSaving(true);
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "global_hourly_rate")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: rateValue.toFixed(2) })
          .eq("key", "global_hourly_rate");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key: "global_hourly_rate", value: rateValue.toFixed(2) });

        if (error) throw error;
      }

      toast({
        title: "Taxa global atualizada!",
        description: `Novo valor padrão: R$ ${rateValue.toFixed(2)}/hora`,
      });
    } catch (error: any) {
      console.error("Error updating global rate:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a taxa global.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmployeeRate = async (employeeId: string, employeeName: string) => {
    const rateStr = employeeRates[employeeId];
    const rateValue = rateStr ? parseFloat(rateStr) : null;

    if (rateStr && (isNaN(rateValue!) || rateValue! < 0)) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Por favor, insira um valor válido ou deixe em branco.",
      });
      return;
    }

    setSavingEmployeeId(employeeId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ hourly_rate: rateValue })
        .eq("id", employeeId);

      if (error) throw error;

      toast({
        title: "Taxa atualizada!",
        description: rateValue
          ? `${employeeName}: R$ ${rateValue.toFixed(2)}/hora`
          : `${employeeName}: usando taxa global`,
      });
    } catch (error: any) {
      console.error("Error updating employee rate:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a taxa.",
      });
    } finally {
      setSavingEmployeeId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurar Valores
          </DialogTitle>
          <DialogDescription>
            Configure o valor por hora global e por funcionário.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="global" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global">Taxa Global</TabsTrigger>
            <TabsTrigger value="employees">Por Funcionário</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="global-rate">Valor Padrão por Hora (R$)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="global-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={globalRate}
                  onChange={(e) => setGlobalRate(e.target.value)}
                  className="pl-9"
                  placeholder="20.00"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted text-sm">
              <p className="text-muted-foreground">
                Este valor será usado para todos os funcionários que não possuem uma taxa específica.
              </p>
            </div>

            <Button onClick={handleSaveGlobal} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Taxa Global
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="employees" className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Deixe em branco para usar a taxa global (R$ {globalRate}/h).
            </p>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {employees.map((employee) => {
                  const initials = employee.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={employee.id}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={employee.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {employee.full_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={employeeRates[employee.id] || ""}
                            onChange={(e) =>
                              setEmployeeRates((prev) => ({
                                ...prev,
                                [employee.id]: e.target.value,
                              }))
                            }
                            className="pl-6 h-8 text-sm"
                            placeholder="Global"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            handleSaveEmployeeRate(employee.id, employee.full_name)
                          }
                          disabled={savingEmployeeId === employee.id}
                        >
                          {savingEmployeeId === employee.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
