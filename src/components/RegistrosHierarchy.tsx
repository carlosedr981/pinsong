import { useState, useMemo } from "react";
import { format, getYear, getMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronRight, Calendar, Clock, MapPin, Image, Download, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Registro {
  id: string;
  timestamp: string;
  photo_url: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  paid: boolean;
  paid_at?: string | null;
  receipt_url?: string | null;
  value_per_registro: number;
}

interface RegistrosHierarchyProps {
  registros: Registro[];
  onPhotoClick?: (url: string) => void;
}

interface YearData {
  year: number;
  months: MonthData[];
  totalValue: number;
  paidValue: number;
  unpaidValue: number;
}

interface MonthData {
  month: number;
  monthName: string;
  days: DayData[];
  totalValue: number;
  paidValue: number;
  unpaidValue: number;
}

interface DayData {
  date: string;
  dayName: string;
  dayNumber: number;
  registros: Registro[];
  totalValue: number;
  paidValue: number;
  unpaidValue: number;
}

export function RegistrosHierarchy({ registros, onPhotoClick }: RegistrosHierarchyProps) {
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  // Helper function to parse date string as local date (avoiding UTC shift)
  const parseDateKeyAsLocal = (dateKey: string): Date => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Organize registros into hierarchy
  const hierarchy = useMemo(() => {
    const yearMap = new Map<number, Map<number, Map<string, Registro[]>>>();

    registros.forEach((registro) => {
      const date = new Date(registro.timestamp);
      const year = date.getFullYear();
      const month = date.getMonth();
      // Use local date components to create the dateKey
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;

      if (!monthMap.has(month)) {
        monthMap.set(month, new Map());
      }
      const dayMap = monthMap.get(month)!;

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(registro);
    });

    const years: YearData[] = [];

    yearMap.forEach((monthMap, year) => {
      const months: MonthData[] = [];

      monthMap.forEach((dayMap, month) => {
        const days: DayData[] = [];

        dayMap.forEach((dayRegistros, dateKey) => {
          // Parse using local date to avoid timezone shifts
          const date = parseDateKeyAsLocal(dateKey);
          const paidRegs = dayRegistros.filter((r) => r.paid);
          const unpaidRegs = dayRegistros.filter((r) => !r.paid);

          days.push({
            date: dateKey,
            dayName: format(date, "EEEE", { locale: ptBR }),
            dayNumber: date.getDate(),
            registros: dayRegistros.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            ),
            totalValue: dayRegistros.reduce((sum, r) => sum + Number(r.value_per_registro), 0),
            paidValue: paidRegs.reduce((sum, r) => sum + Number(r.value_per_registro), 0),
            unpaidValue: unpaidRegs.reduce((sum, r) => sum + Number(r.value_per_registro), 0),
          });
        });

        days.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const monthPaidValue = days.reduce((sum, d) => sum + d.paidValue, 0);
        const monthUnpaidValue = days.reduce((sum, d) => sum + d.unpaidValue, 0);

        months.push({
          month,
          monthName: format(new Date(year, month), "MMMM", { locale: ptBR }),
          days,
          totalValue: monthPaidValue + monthUnpaidValue,
          paidValue: monthPaidValue,
          unpaidValue: monthUnpaidValue,
        });
      });

      months.sort((a, b) => b.month - a.month);

      const yearPaidValue = months.reduce((sum, m) => sum + m.paidValue, 0);
      const yearUnpaidValue = months.reduce((sum, m) => sum + m.unpaidValue, 0);

      years.push({
        year,
        months,
        totalValue: yearPaidValue + yearUnpaidValue,
        paidValue: yearPaidValue,
        unpaidValue: yearUnpaidValue,
      });
    });

    return years.sort((a, b) => b.year - a.year);
  }, [registros]);

  const toggleYear = (year: number) => {
    setOpenYears((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleDay = (key: string) => {
    setOpenDays((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (hierarchy.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhum registro encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hierarchy.map((yearData) => (
        <Collapsible
          key={yearData.year}
          open={openYears.has(yearData.year)}
          onOpenChange={() => toggleYear(yearData.year)}
        >
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    "h-5 w-5 text-primary transition-transform",
                    openYears.has(yearData.year) && "rotate-90"
                  )}
                />
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-semibold text-primary">{yearData.year}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-success font-medium">
                  {formatCurrency(yearData.paidValue)}
                </span>
                {yearData.unpaidValue > 0 && (
                  <span className="text-sm text-destructive font-medium">
                    / {formatCurrency(yearData.unpaidValue)} pendente
                  </span>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-4 mt-2 space-y-2">
              {yearData.months.map((monthData) => {
                const monthKey = `${yearData.year}-${monthData.month}`;
                return (
                  <Collapsible
                    key={monthKey}
                    open={openMonths.has(monthKey)}
                    onOpenChange={() => toggleMonth(monthKey)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
                        <div className="flex items-center gap-2">
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 text-foreground transition-transform",
                              openMonths.has(monthKey) && "rotate-90"
                            )}
                          />
                          <span className="font-medium capitalize">{monthData.monthName}</span>
                          <span className="text-xs text-muted-foreground">
                            ({monthData.days.reduce((sum, d) => sum + d.registros.length, 0)} registros)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-success font-medium">
                            {formatCurrency(monthData.paidValue)}
                          </span>
                          {monthData.unpaidValue > 0 && (
                            <span className="text-sm text-destructive font-medium">
                              / {formatCurrency(monthData.unpaidValue)}
                            </span>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-2">
                        {monthData.days.map((dayData) => {
                          const dayKey = dayData.date;
                          return (
                            <Collapsible
                              key={dayKey}
                              open={openDays.has(dayKey)}
                              onOpenChange={() => toggleDay(dayKey)}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight
                                      className={cn(
                                        "h-4 w-4 text-muted-foreground transition-transform",
                                        openDays.has(dayKey) && "rotate-90"
                                      )}
                                    />
                                    <span className="font-medium">{dayData.dayNumber}</span>
                                    <span className="text-sm text-muted-foreground capitalize">
                                      {dayData.dayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      ({dayData.registros.length} registro{dayData.registros.length !== 1 ? "s" : ""})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {dayData.paidValue > 0 && (
                                      <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                                        {formatCurrency(dayData.paidValue)}
                                      </Badge>
                                    )}
                                    {dayData.unpaidValue > 0 && (
                                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                                        {formatCurrency(dayData.unpaidValue)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-6 mt-2 space-y-2">
                                  {dayData.registros.map((registro) => (
                                    <div
                                      key={registro.id}
                                      className="flex gap-3 p-3 rounded-lg bg-background border"
                                    >
                                      <div
                                        className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => onPhotoClick?.(registro.photo_url)}
                                      >
                                        <img
                                          src={registro.photo_url}
                                          alt="Registro"
                                          className="w-full h-full object-cover"
                                        />
                                        <Image className="absolute bottom-1 right-1 h-3 w-3 text-background/80" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                          <p className="font-semibold text-foreground">
                                            {format(new Date(registro.timestamp), "HH:mm:ss")}
                                          </p>
                                          <div className="flex items-center gap-2">
                                            {registro.paid ? (
                                              <Badge className="bg-success/10 text-success border-0 flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Pago
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-destructive/10 text-destructive border-0 flex items-center gap-1">
                                                <XCircle className="h-3 w-3" />
                                                Não Pago
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          <span>{formatCurrency(Number(registro.value_per_registro))}</span>
                                        </div>
                                        {registro.address ? (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                            <MapPin className="h-3 w-3" />
                                            <span className="truncate">{registro.address}</span>
                                          </div>
                                        ) : registro.latitude && registro.longitude ? (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                            <MapPin className="h-3 w-3" />
                                            <span>
                                              {registro.latitude.toFixed(4)}, {registro.longitude.toFixed(4)}
                                            </span>
                                          </div>
                                        ) : null}
                                        {registro.receipt_url && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 mt-1 text-xs text-primary"
                                            asChild
                                          >
                                            <a href={registro.receipt_url} target="_blank" rel="noopener noreferrer">
                                              <Download className="h-3 w-3 mr-1" />
                                              Baixar Comprovante
                                            </a>
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
