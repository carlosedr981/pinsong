import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, Image, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}

export function RegistroCardWithShare({ registro, index, fullName }: RegistroCardWithShareProps) {
  const date = new Date(registro.timestamp);
  const formattedDate = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = format(date, "HH:mm:ss");
  const formattedDay = format(date, "EEEE", { locale: ptBR });
  
  const isToday = new Date().toDateString() === date.toDateString();

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `📋 *Registro de Ponto*\n\n` +
      `👤 *Funcionário:* ${fullName}\n` +
      `📅 *Data:* ${formattedDate}\n` +
      `🕐 *Hora:* ${formattedTime}\n` +
      `📆 *Dia:* ${formattedDay}\n` +
      `${registro.latitude && registro.longitude ? `📍 *Localização:* ${registro.latitude.toFixed(6)}, ${registro.longitude.toFixed(6)}\n` : ""}` +
      `\n📷 *Foto:* ${registro.photo_url}`
    );
    
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };
  
  return (
    <Card 
      className={cn(
        "overflow-hidden animate-fade-in border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer",
        "gradient-card"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={handleShareWhatsApp}
    >
      <CardContent className="p-0">
        <div className="flex gap-4">
          {/* Photo Thumbnail */}
          <div className="relative w-20 h-20 flex-shrink-0">
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
  );
}
