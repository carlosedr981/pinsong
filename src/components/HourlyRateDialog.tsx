import { useState, useEffect } from "react";
import { Loader2, DollarSign, Save } from "lucide-react";
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

interface HourlyRateDialogProps {
  employeeId?: string;
  employeeName?: string;
  currentRate: number;
  isGlobal?: boolean;
  onSuccess: () => void;
}

export function HourlyRateDialog({
  employeeId,
  employeeName,
  currentRate,
  isGlobal = false,
  onSuccess,
}: HourlyRateDialogProps) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(currentRate.toString());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setRate(currentRate.toString());
  }, [currentRate]);

  const handleSave = async () => {
    const rateValue = parseFloat(rate);
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
      if (isGlobal) {
        // Update global rate in app_settings
        const { error } = await supabase
          .from("app_settings")
          .update({ value: rateValue.toFixed(2) })
          .eq("key", "global_hourly_rate");

        if (error) throw error;

        toast({
          title: "Taxa global atualizada!",
          description: `Novo valor: R$ ${rateValue.toFixed(2)}/hora`,
        });
      } else if (employeeId) {
        // Update employee's individual rate
        const { error } = await supabase
          .from("profiles")
          .update({ hourly_rate: rateValue })
          .eq("id", employeeId);

        if (error) throw error;

        toast({
          title: "Taxa atualizada!",
          description: `${employeeName}: R$ ${rateValue.toFixed(2)}/hora`,
        });
      }

      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating rate:", error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a taxa.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs h-7"
        >
          <DollarSign className="h-3 w-3" />
          R$ {currentRate.toFixed(2)}/h
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle>
            {isGlobal ? "Taxa Horária Global" : `Taxa de ${employeeName}`}
          </DialogTitle>
          <DialogDescription>
            {isGlobal
              ? "Define o valor padrão por hora para novos funcionários."
              : "Define o valor por hora específico para este funcionário."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rate">Valor por Hora (R$)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="pl-9"
                placeholder="20.00"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted text-sm">
            <p className="text-muted-foreground">
              {isGlobal
                ? "Este valor será usado como padrão para todos os funcionários que não possuem uma taxa específica."
                : "Este valor será usado apenas para este funcionário, sobrescrevendo a taxa global."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
