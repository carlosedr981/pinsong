import { useState, useRef } from "react";
import { Loader2, Upload, CheckCircle2, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Registro {
  id: string;
  timestamp: string;
  paid: boolean;
  value_per_registro: number;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registros: Registro[];
  employeeId: string;
  employeeName: string;
  onSuccess: () => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  registros,
  employeeId,
  employeeName,
  onSuccess,
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const unpaidRegistros = registros.filter((r) => !r.paid);
  const totalValue = unpaidRegistros.reduce((sum, r) => sum + Number(r.value_per_registro), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!validTypes.includes(file.type)) {
        toast({
          variant: "destructive",
          title: "Arquivo inválido",
          description: "Por favor, envie uma imagem (JPG, PNG, WebP) ou PDF.",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB.",
        });
        return;
      }

      setReceiptFile(file);
    }
  };

  const handleSubmit = async () => {
    if (unpaidRegistros.length === 0) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let receiptUrl: string | null = null;

      // Upload receipt if provided
      if (receiptFile) {
        const fileExt = receiptFile.name.split(".").pop();
        const fileName = `${employeeId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(fileName, receiptFile, {
            contentType: receiptFile.type,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("receipts")
          .getPublicUrl(fileName);

        receiptUrl = publicUrl;
      }

      // Update all unpaid registros
      const registroIds = unpaidRegistros.map((r) => r.id);
      
      const { error: updateError } = await supabase
        .from("registros")
        .update({
          paid: true,
          paid_at: new Date().toISOString(),
          paid_by: user.id,
          receipt_url: receiptUrl,
        })
        .in("id", registroIds);

      if (updateError) throw updateError;

      toast({
        title: "Pagamento registrado!",
        description: `${unpaidRegistros.length} registro(s) marcado(s) como pago(s).`,
      });

      setReceiptFile(null);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error processing payment:", error);
      toast({
        variant: "destructive",
        title: "Erro ao processar pagamento",
        description: error.message || "Não foi possível registrar o pagamento.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription>
            Marcar registros de <strong>{employeeName}</strong> como pagos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Registros pendentes</span>
              <span className="font-medium">{unpaidRegistros.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor total</span>
              <span className="text-xl font-bold text-success">{formatCurrency(totalValue)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Comprovante (opcional)</Label>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {receiptFile ? (
                <div className="flex items-center justify-center gap-2">
                  {receiptFile.type === "application/pdf" ? (
                    <FileText className="h-8 w-8 text-primary" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-primary" />
                  )}
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[200px]">{receiptFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(receiptFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Clique para anexar comprovante
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    PDF, JPG, PNG ou WebP (máx. 10MB)
                  </p>
                </>
              )}
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || unpaidRegistros.length === 0}
            className="bg-success hover:bg-success/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Pagamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
