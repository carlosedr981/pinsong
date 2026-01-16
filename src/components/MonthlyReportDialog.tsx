import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { Download, FileText, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

interface Registro {
  id: string;
  timestamp: string;
  photo_url: string;
  paid: boolean;
  paid_at?: string | null;
  receipt_url?: string | null;
  value_per_registro: number;
  address?: string | null;
}

interface MonthlyReportDialogProps {
  registros: Registro[];
  employeeName: string;
  month: number;
  year: number;
  hourlyRate: number;
}

export function MonthlyReportDialog({ 
  registros, 
  employeeName, 
  month, 
  year,
  hourlyRate,
}: MonthlyReportDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const monthName = format(new Date(year, month), "MMMM", { locale: ptBR });

  const calculateDayHours = (dayRegistros: Registro[]) => {
    if (dayRegistros.length < 2) return 0;
    
    // Sort by timestamp
    const sorted = [...dayRegistros].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Calculate hours between first and last registro
    const first = new Date(sorted[0].timestamp);
    const last = new Date(sorted[sorted.length - 1].timestamp);
    const diffMs = last.getTime() - first.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return diffHours;
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Relatorio de Dias Trabalhados", pageWidth / 2, 20, { align: "center" });
      
      // Employee and Month info
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Funcionario: ${employeeName}`, 20, 35);
      doc.text(`Periodo: ${monthName} de ${year}`, 20, 42);
      doc.text(`Valor por hora: R$ ${hourlyRate.toFixed(2)}`, 20, 49);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`, 20, 56);
      
      // Group registros by day
      const dayMap = new Map<string, Registro[]>();
      registros.forEach((reg) => {
        const dateKey = format(new Date(reg.timestamp), "yyyy-MM-dd");
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, []);
        }
        dayMap.get(dateKey)!.push(reg);
      });

      // Sort days
      const sortedDays = Array.from(dayMap.entries()).sort((a, b) => 
        new Date(a[0]).getTime() - new Date(b[0]).getTime()
      );

      // Table header
      let yPos = 70;
      doc.setFillColor(51, 122, 183);
      doc.rect(15, yPos - 5, pageWidth - 30, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Data", 18, yPos + 1);
      doc.text("Dia", 42, yPos + 1);
      doc.text("Entrada", 65, yPos + 1);
      doc.text("Saida", 88, yPos + 1);
      doc.text("Horas", 111, yPos + 1);
      doc.text("Valor", 134, yPos + 1);
      doc.text("Status", 165, yPos + 1);
      
      yPos += 12;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");

      let totalHours = 0;
      let totalValue = 0;
      let totalPaid = 0;

      sortedDays.forEach(([dateKey, dayRegs]) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const date = new Date(dateKey);
        const sortedRegs = [...dayRegs].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const hours = calculateDayHours(dayRegs);
        const dayValue = hours * hourlyRate;
        const isPaid = dayRegs.every(r => r.paid);
        
        totalHours += hours;
        totalValue += dayValue;
        if (isPaid) totalPaid += dayValue;

        doc.text(format(date, "dd/MM"), 18, yPos);
        doc.text(format(date, "EEE", { locale: ptBR }).slice(0, 3), 42, yPos);
        doc.text(format(new Date(sortedRegs[0].timestamp), "HH:mm"), 65, yPos);
        doc.text(
          sortedRegs.length > 1 
            ? format(new Date(sortedRegs[sortedRegs.length - 1].timestamp), "HH:mm") 
            : "-",
          88, 
          yPos
        );
        doc.text(`${hours.toFixed(1)}h`, 111, yPos);
        doc.text(`R$ ${dayValue.toFixed(2)}`, 134, yPos);
        
        if (isPaid) {
          doc.setTextColor(46, 125, 50);
          doc.text("Pago", 165, yPos);
        } else {
          doc.setTextColor(198, 40, 40);
          doc.text("Pendente", 165, yPos);
        }
        doc.setTextColor(0, 0, 0);
        
        yPos += 8;
      });

      // Summary
      yPos += 10;
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }

      doc.setDrawColor(200, 200, 200);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo do Mes", 20, yPos);
      yPos += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Total de dias trabalhados: ${sortedDays.length}`, 25, yPos);
      yPos += 7;
      doc.text(`Total de horas trabalhadas: ${totalHours.toFixed(1)}h`, 25, yPos);
      yPos += 7;
      doc.text(`Valor total: R$ ${totalValue.toFixed(2)}`, 25, yPos);
      yPos += 7;
      doc.setTextColor(46, 125, 50);
      doc.text(`Valor recebido: R$ ${totalPaid.toFixed(2)}`, 25, yPos);
      yPos += 7;
      doc.setTextColor(198, 40, 40);
      doc.text(`Valor pendente: R$ ${(totalValue - totalPaid).toFixed(2)}`, 25, yPos);
      
      // Save PDF
      const fileName = `relatorio_${employeeName.replace(/\s+/g, "_")}_${monthName}_${year}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "PDF gerado!",
        description: `O relatório foi baixado como ${fileName}`,
      });
      
      setOpen(false);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório. Tente novamente.",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (registros.length === 0) return null;

  const daysWorked = new Set(registros.map(r => format(new Date(r.timestamp), "yyyy-MM-dd"))).size;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Baixar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Relatório PDF</DialogTitle>
          <DialogDescription>
            Baixar relatório de dias trabalhados de <strong className="capitalize">{monthName} de {year}</strong>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Dias trabalhados</p>
            <p className="text-xl font-bold">{daysWorked} dias</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Total de registros</p>
            <p className="text-xl font-bold">{registros.length} registros</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button onClick={generatePDF} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
