import { useMemo, useState } from "react";
import { format, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Wallet, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { calculateHoursWorked } from "@/lib/geocoding";

interface Registro {
  id: string;
  timestamp: string;
  paid: boolean;
  value_per_registro: number;
  photo_url: string;
  paid_at?: string | null;
  receipt_url?: string | null;
  address?: string | null;
}

interface BalanceCardProps {
  registros: Registro[];
  hourlyRate?: number;
  employeeName?: string;
}

export function BalanceCard({ registros, hourlyRate = 20, employeeName = "" }: BalanceCardProps) {
  const [filterMonth, setFilterMonth] = useState<string>("all");

  // Get available months from registros
  const availableMonths = useMemo(() => {
    const monthsSet = new Map<string, { month: number; year: number; label: string }>();

    registros.forEach((registro) => {
      const date = new Date(registro.timestamp);
      const month = getMonth(date);
      const year = getYear(date);
      const key = `${year}-${month}`;

      if (!monthsSet.has(key)) {
        monthsSet.set(key, {
          month,
          year,
          label: format(date, "MMMM yyyy", { locale: ptBR }),
        });
      }
    });

    return Array.from(monthsSet.entries())
      .sort((a, b) => {
        const [aYear, aMonth] = a[0].split("-").map(Number);
        const [bYear, bMonth] = b[0].split("-").map(Number);
        if (bYear !== aYear) return bYear - aYear;
        return bMonth - aMonth;
      })
      .map(([key, value]) => ({ key, ...value }));
  }, [registros]);

  // Calculate balances based on hours worked
  const { totalPaid, totalPending, filteredPaid, filteredPending, filteredRegistros } = useMemo(() => {
    // Group registros by day
    const dayMap = new Map<string, Registro[]>();
    registros.forEach((reg) => {
      const dateKey = format(new Date(reg.timestamp), "yyyy-MM-dd");
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
      dayMap.get(dateKey)!.push(reg);
    });

    let totalPaid = 0;
    let totalPending = 0;
    let filteredPaid = 0;
    let filteredPending = 0;
    let filteredRegistros: Registro[] = [];

    dayMap.forEach((dayRegs, dateKey) => {
      const hours = calculateHoursWorked(dayRegs);
      const dayValue = hours * hourlyRate;
      const isPaid = dayRegs.every(r => r.paid);
      
      if (isPaid) {
        totalPaid += dayValue;
      } else {
        totalPending += dayValue;
      }

      // Apply filter
      if (filterMonth !== "all") {
        const [year, month] = filterMonth.split("-").map(Number);
        const regDate = new Date(dateKey);
        if (getYear(regDate) === year && getMonth(regDate) === month) {
          filteredRegistros = [...filteredRegistros, ...dayRegs];
          if (isPaid) {
            filteredPaid += dayValue;
          } else {
            filteredPending += dayValue;
          }
        }
      }
    });

    if (filterMonth === "all") {
      filteredPaid = totalPaid;
      filteredPending = totalPending;
      filteredRegistros = registros;
    }

    return { totalPaid, totalPending, filteredPaid, filteredPending, filteredRegistros };
  }, [registros, filterMonth, hourlyRate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card className="shadow-xl border-0 overflow-hidden bg-gradient-to-br from-success/10 to-success/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(filteredPaid)}</p>
            </div>
          </div>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar por mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m.key} value={m.key} className="capitalize">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* PDF Report Button */}
        {filterMonth !== "all" && employeeName && (
          <MonthlyReportDialog
            registros={filteredRegistros}
            employeeName={employeeName}
            month={parseInt(filterMonth.split("-")[1])}
            year={parseInt(filterMonth.split("-")[0])}
            hourlyRate={hourlyRate}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              <span>Recebido</span>
            </div>
            <p className="text-lg font-semibold text-success">{formatCurrency(filteredPaid)}</p>
          </div>
          <div className="p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <Wallet className="h-3 w-3" />
              <span>Pendente</span>
            </div>
            <p className="text-lg font-semibold text-destructive">{formatCurrency(filteredPending)}</p>
          </div>
        </div>

        {filterMonth !== "all" && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Total geral: {formatCurrency(totalPaid)} recebido / {formatCurrency(totalPending)} pendente
          </p>
        )}
      </CardContent>
    </Card>
  );
}
