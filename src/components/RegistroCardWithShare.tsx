import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, Image, Share2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PhotoDialog } from "@/components/PhotoDialog";
import { useToast } from "@/hooks/use-toast";

interface Registro {
  id: string;
  timestamp: string;
  photo_url: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RegistroCardWithShareProps {
  registro: Registro;
  index: number;
  fullName: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

export function RegistroCardWithShare({ 
  registro, 
  index, 
  fullName,
  selectable = false,
  selected = false,
  onSelectChange
}: RegistroCardWithShareProps) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const { toast } = useToast();
  
  const date = new Date(registro.timestamp);
  const formattedDate = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = format(date, "HH:mm:ss");
  const formattedDay = format(date, "EEEE", { locale: ptBR });
  
  const isToday = new Date().toDateString() === date.toDateString();

  const handleShareWhatsApp = async () => {
    const message = 
      `📋 *Registro de Ponto*\n\n` +
      `👤 *Funcionário:* ${fullName}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Hora:* ${formattedTime}\n` +
      `📆 *Dia:* ${formattedDay}\n` +
      `${registro.latitude && registro.longitude ? `📍 *Localização:* ${registro.latitude.toFixed(6)}, ${registro.longitude.toFixed(6)}\n` : ""}` +
      `\n📷 *Foto:* ${registro.photo_url}`;

    // Try to use Web Share API with image
    if (navigator.share && navigator.canShare) {
      try {
        // Fetch the image and convert to blob
        const response = await fetch(registro.photo_url);
        const blob = await response.blob();
        const file = new File([blob], `registro-${registro.id}.jpg`, { type: "image/jpeg" });
        
        const shareData = {
          text: message,
          files: [file],
        };
        
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (error) {
        console.log("Web Share with file failed, falling back to WhatsApp URL:", error);
      }
    }

    // Fallback to WhatsApp URL scheme
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
    
    toast({
      title: "Compartilhamento via link",
      description: "O link da foto foi incluído na mensagem.",
    });
  };
  
  return (
    <>
      <PhotoDialog
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        photoUrl={registro.photo_url}
        alt={`Registro de ponto - ${formattedDate}`}
      />
      
      <Card 
        className={cn(
          "overflow-hidden animate-fade-in border-0 shadow-md hover:shadow-lg transition-shadow",
          "gradient-card"
        )}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <CardContent className="p-0">
          <div className="flex gap-4">
            {/* Selection Checkbox */}
            {selectable && (
              <div 
                className="flex items-center pl-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onSelectChange?.(!!checked)}
                  className="h-5 w-5"
                />
              </div>
            )}
            
            {/* Photo Thumbnail */}
            <div 
              className={cn(
                "relative w-20 h-20 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity",
                selectable && "ml-0"
              )}
              onClick={() => setPhotoOpen(true)}
            >
              <img
                src={registro.photo_url}
                alt="Registro de ponto"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 to-transparent" />
              <Image className="absolute bottom-1 right-1 h-3 w-3 text-background/80" />
            </div>
            
            {/* Details */}
            <div className="flex-1 py-3 pr-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-foreground">{formattedTime}</p>
                  <p className="text-sm text-muted-foreground capitalize">{formattedDay}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isToday && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success/10 text-success">
                      Hoje
                    </span>
                  )}
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareWhatsApp();
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formattedDate}</span>
                </div>
                {registro.latitude && registro.longitude && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>Localizado</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
