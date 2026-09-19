import { useEffect, useState } from "react";
import { CalendarDays, Copy, Check, MessageSquare } from "lucide-react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

interface ScheduleShareDialogProps {
  isAdmin: boolean;
  isGlobalAdmin?: boolean;
  environmentId?: string | null;
}

interface ShareSchedule {
  date: string;
  employee_name: string;
  environment_name: string;
  shift_type: string;
}

const periodLabel = (value: string) => ({
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
  regular: "Regular",
}[value] || "Regular");

export function ScheduleShareDialog({ isAdmin, isGlobalAdmin = false, environmentId }: ScheduleShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<ShareSchedule[]>([]);
  const [copied, setCopied] = useState(false);
  const defaultStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const defaultEnd = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const { toast } = useToast();

  const loadSchedules = async () => {
    setLoading(true);
    try {
      if (!startDate || !endDate) {
        toast({ variant: "destructive", title: "Período obrigatório", description: "Selecione a data inicial e a data final." });
        setLoading(false);
        return;
      }
      if (startDate > endDate) {
        toast({ variant: "destructive", title: "Período inválido", description: "A data final deve ser igual ou posterior à data inicial." });
        setLoading(false);
        return;
      }
      let query = db
        .from("work_schedules")
        .select("employee_id, environment_id, date, shift_type")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date")
        .order("shift_type");

      if (!isGlobalAdmin && environmentId) {
        query = query.eq("environment_id", environmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const employeeIds = [...new Set(rows.map((item: any) => item.employee_id).filter(Boolean))];
      const environmentIds = [...new Set(rows.map((item: any) => item.environment_id).filter(Boolean))];

      const [{ data: profiles, error: profilesError }, { data: environments, error: environmentsError }] = await Promise.all([
        employeeIds.length
          ? db.from("profiles").select("id,full_name").in("id", employeeIds)
          : Promise.resolve({ data: [], error: null }),
        environmentIds.length
          ? db.from("environments").select("id,name").in("id", environmentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesError) throw profilesError;
      if (environmentsError) throw environmentsError;

      const profileMap = new Map((profiles || []).map((item: any) => [item.id, item.full_name]));
      const environmentMap = new Map((environments || []).map((item: any) => [item.id, item.name]));

      setSchedules(rows.map((item: any) => ({
        date: item.date,
        employee_name: profileMap.get(item.employee_id) || "Funcionário",
        environment_name: environmentMap.get(item.environment_id) || "Sem ambiente",
        shift_type: item.shift_type || "regular",
      })));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar escala",
        description: error.message || "Não foi possível carregar as escalas do período selecionado.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && isAdmin) {
      loadSchedules();
      setCopied(false);
    }
  }, [open, isAdmin, isGlobalAdmin, environmentId, startDate, endDate]);

  if (!isAdmin) return null;

  const grouped = schedules.reduce<Record<string, ShareSchedule[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const text = Object.entries(grouped)
    .map(([date, items]) => {
      const dateLabel = format(new Date(date + "T12:00:00"), "EEEE, dd/MM", { locale: ptBR });
      const lines = items.map((item) => "• " + item.employee_name + " — " + periodLabel(item.shift_type) + " — " + item.environment_name);
      return "*" + dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1) + "*\n" + lines.join("\n");
    })
    .join("\n\n");

  const message = text
    ? "*ESCALA*\n\n" + text
    : "*ESCALA*\n\nNenhuma escala cadastrada no período selecionado.";

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast({ title: "Escala copiada", description: "Agora é só colar no grupo dos funcionários." });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar", description: "Selecione e copie o texto manualmente." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 w-full border-primary/30 text-primary shadow-sm">
          <MessageSquare className="mr-2 h-5 w-5" />
          Gerar escala para enviar no grupo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Escala para o grupo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="share-start-date">Data inicial</Label>
              <Input id="share-start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="share-end-date">Data final</Label>
              <Input id="share-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Texto pronto para copiar e enviar no grupo dos funcionários.
          </p>
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border bg-muted/30 p-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Gerando escala...</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">{message}</pre>
            )}
          </div>
          <Button onClick={copyMessage} disabled={loading} className="h-12 w-full">
            {copied ? <Check className="mr-2 h-5 w-5" /> : <Copy className="mr-2 h-5 w-5" />}
            {copied ? "Copiado!" : "Copiar escala"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
