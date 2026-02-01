import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, MapPin, Image } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Registro {
  id: string;
  timestamp: string;
  photo_url: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RegistroCardProps {
  registro: Registro;
  index: number;
}

export function RegistroCard({ registro, index }: RegistroCardProps) {
  const date = new Date(registro.timestamp);
  const formattedDate = format(date, "dd 'de' MMMM", { locale: ptBR });
  const formattedTime = format(date, "HH:mm:ss");
  const formattedDay = format(date, "EEEE", { locale: ptBR });
  
  // Compare dates using local date components to avoid timezone issues
  const today = new Date();
  const isToday = 
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate();
  
  return (
    <Card 
      className={cn(
        "overflow-hidden animate-fade-in border-0 shadow-md hover:shadow-lg transition-shadow",
        "gradient-card"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
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
              {isToday && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success/10 text-success">
                  Hoje
                </span>
              )}
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
