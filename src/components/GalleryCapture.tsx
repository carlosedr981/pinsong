import { useState, useRef } from "react";
import { ImagePlus, Loader2, Check, X } from "lucide-react";
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
import { addWatermarkToImage, dataURLtoBlob } from "@/lib/watermark";
import { reverseGeocode } from "@/lib/geocoding";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GalleryCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  onSuccess: () => void;
}

export function GalleryCapture({
  open,
  onOpenChange,
  userId,
  fullName,
  onSuccess,
}: GalleryCaptureProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [customTime, setCustomTime] = useState<string>(format(new Date(), "HH:mm"));
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      // Create timestamp from custom date/time
      const [year, month, day] = customDate.split("-").map(Number);
      const [hours, minutes] = customTime.split(":").map(Number);
      const timestamp = new Date(year, month - 1, day, hours, minutes, 0);

      // Add watermark with custom timestamp
      const watermarkedImage = await addWatermarkToImage(selectedImage, {
        fullName,
        timestamp,
      });

      // Convert to blob
      const blob = dataURLtoBlob(watermarkedImage);

      // Get geolocation and address
      let latitude: number | null = null;
      let longitude: number | null = null;
      let address: string | null = null;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: true,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;

        const geocodeResult = await reverseGeocode(latitude, longitude);
        if (geocodeResult) {
          address = geocodeResult.address;
        }
      } catch {
        // Geolocation not available
      }

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

      // Save registro
      const { error: insertError } = await supabase
        .from("registros")
        .insert({
          user_id: userId,
          timestamp: timestamp.toISOString(),
          photo_url: publicUrl,
          latitude,
          longitude,
          address,
        });

      if (insertError) throw insertError;

      toast({
        title: "Ponto registrado!",
        description: `Registro para ${format(timestamp, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      });

      setSelectedImage(null);
      setCustomDate(format(new Date(), "yyyy-MM-dd"));
      setCustomTime(format(new Date(), "HH:mm"));
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error registering ponto:", error);
      toast({
        variant: "destructive",
        title: "Erro ao registrar",
        description: "Não foi possível registrar o ponto. Tente novamente.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setSelectedImage(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Ponto via Galeria</DialogTitle>
          <DialogDescription>
            Selecione uma foto da galeria e defina a data/hora do registro.
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
              <Label htmlFor="date">Data do Registro</Label>
              <Input
                id="date"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Hora do Registro</Label>
              <Input
                id="time"
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            </div>
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
                Registrar Ponto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
