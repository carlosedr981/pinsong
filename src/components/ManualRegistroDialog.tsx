import { useState, useRef, useEffect } from "react";
import { ImagePlus, Loader2, Check, X, Calendar, Clock } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { addWatermarkToImage, dataURLtoBlob } from "@/lib/watermark";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ManualRegistroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  onSuccess: () => void;
}

export function ManualRegistroDialog({
  open,
  onOpenChange,
  userId,
  fullName,
  onSuccess,
}: ManualRegistroDialogProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [customTime, setCustomTime] = useState<string>(format(new Date(), "HH:mm"));
  const [address, setAddress] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number>(20);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch employee's hourly rate
  useEffect(() => {
    const fetchHourlyRate = async () => {
      // First try employee-specific rate
      const { data: profile } = await supabase
        .from("profiles")
        .select("hourly_rate")
        .eq("id", userId)
        .single();
      
      if (profile?.hourly_rate) {
        setHourlyRate(Number(profile.hourly_rate));
        return;
      }
      
      // Fallback to global rate
      const { data: settings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "global_hourly_rate")
        .single();
      
      if (settings) {
        setHourlyRate(Number(settings.value));
      }
    };
    
    if (open && userId) {
      fetchHourlyRate();
    }
  }, [open, userId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedImage) return;

    setProcessing(true);
    try {
      // Create timestamp from custom date/time using local components
      const [year, month, day] = customDate.split("-").map(Number);
      const [hours, minutes] = customTime.split(":").map(Number);
      const timestamp = new Date(year, month - 1, day, hours, minutes, 0);

      // Calculate value based on work schedule for that date
      let valuePerRegistro = hourlyRate;
      
      const { data: schedule } = await supabase
        .from("work_schedules")
        .select("start_time, end_time")
        .eq("employee_id", userId)
        .eq("date", customDate)
        .single();
      
      if (schedule?.start_time && schedule?.end_time) {
        const [startH, startM] = schedule.start_time.split(":").map(Number);
        const [endH, endM] = schedule.end_time.split(":").map(Number);
        const scheduledHours = (endH + endM / 60) - (startH + startM / 60);
        if (scheduledHours > 0) {
          valuePerRegistro = scheduledHours * hourlyRate;
        }
      }

      // Add watermark with custom timestamp
      const watermarkedImage = await addWatermarkToImage(selectedImage, {
        fullName,
        timestamp,
      });

      // Convert to blob
      const blob = dataURLtoBlob(watermarkedImage);

      // Upload to storage
      const fileName = `${userId}/${timestamp.getTime()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("registros-photos")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("registros-photos")
        .getPublicUrl(fileName);

      // Save registro with calculated value
      const { error: insertError } = await supabase
        .from("registros")
        .insert({
          user_id: userId,
          timestamp: timestamp.toISOString(),
          photo_url: publicUrl,
          address: address || null,
          value_per_registro: valuePerRegistro,
        });

      if (insertError) throw insertError;

      toast({
        title: "Registro adicionado!",
        description: `Registro para ${fullName} em ${format(timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      // Reset form
      setSelectedImage(null);
      setCustomDate(format(new Date(), "yyyy-MM-dd"));
      setCustomTime(format(new Date(), "HH:mm"));
      setAddress("");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error adding registro:", error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar",
        description: "Não foi possível adicionar o registro. Tente novamente.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    setAddress("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Registro Manual</DialogTitle>
          <DialogDescription>
            Adicionar registro para <strong>{fullName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image Selection */}
          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedImage ? (
              <div className="relative">
                <img
                  src={selectedImage}
                  alt="Foto selecionada"
                  className="max-h-48 mx-auto rounded-lg object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Clique para selecionar uma foto
                </p>
              </>
            )}
          </div>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Date/Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Data
              </Label>
              <Input
                id="date"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Hora
              </Label>
              <Input
                id="time"
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </div>
          </div>

          {/* Address (optional) */}
          <div className="space-y-2">
            <Label htmlFor="address">Endereço (opcional)</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Rua das Flores, 123 - Centro"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={processing}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={processing || !selectedImage}
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Adicionar Registro
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
