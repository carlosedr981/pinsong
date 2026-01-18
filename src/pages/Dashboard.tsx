import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, Camera, Loader2, Shield, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CameraCapture } from "@/components/CameraCapture";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { RegistrosHierarchy } from "@/components/RegistrosHierarchy";
import { BalanceCard } from "@/components/BalanceCard";
import { PhotoZoomDialog } from "@/components/PhotoZoomDialog";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { TicketDialog } from "@/components/TicketDialog";
import { addWatermarkToImage, dataURLtoBlob } from "@/lib/watermark";
import { reverseGeocode, calculateHoursWorked } from "@/lib/geocoding";
import { format, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  pix_key: string | null;
  pix_bank: string | null;
  pix_beneficiary_name: string | null;
  pix_beneficiary_cpf: string | null;
  pix_beneficiary_phone: string | null;
  avatar_url: string | null;
  hourly_rate?: number | null;
}

interface AppSettings {
  global_hourly_rate: number;
}

export default function Dashboard() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number>(20);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  const { user, profile, signOut, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set avatar URL and profile from auth profile + fetch hourly rate
  useEffect(() => {
    const loadData = async () => {
      if (profile) {
        setAvatarUrl(profile.avatar_url || null);
        setUserProfile({
          id: user?.id || "",
          full_name: profile.full_name,
          email: profile.email || null,
          phone: profile.phone || null,
          cpf: profile.cpf || null,
          pix_key: profile.pix_key || null,
          pix_bank: profile.pix_bank || null,
          pix_beneficiary_name: profile.pix_beneficiary_name || null,
          pix_beneficiary_cpf: profile.pix_beneficiary_cpf || null,
          pix_beneficiary_phone: profile.pix_beneficiary_phone || null,
          avatar_url: profile.avatar_url || null,
        });

        // Fetch hourly rate (employee specific or global)
        const employeeRate = (profile as any).hourly_rate;
        if (employeeRate) {
          setHourlyRate(Number(employeeRate));
        } else {
          // Fetch global rate
          const { data: settings } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "global_hourly_rate")
            .single();
          if (settings) {
            setHourlyRate(Number(settings.value));
          }
        }
      }
    };
    loadData();
  }, [profile, user]);

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      
      setIsAdmin(!!data);
    };
    
    checkAdmin();
  }, [user]);

  // Fetch registros - all registros for hierarchy view
  const fetchRegistros = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("registros")
        .select("*")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false });

      if (error) throw error;
      setRegistros(data || []);
    } catch (error) {
      console.error("Error fetching registros:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  // Handle photo capture
  const handleCapture = async (imageDataUrl: string) => {
    if (!user || !profile) return;
    
    setProcessing(true);
    
    try {
      // Get current timestamp for watermark
      const timestamp = new Date();
      
      // Add watermark to image
      const watermarkedImage = await addWatermarkToImage(imageDataUrl, {
        fullName: profile.full_name,
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
        
        // Reverse geocode to get address
        const geocodeResult = await reverseGeocode(latitude, longitude);
        if (geocodeResult) {
          address = geocodeResult.address;
        }
      } catch {
        // Geolocation not available or denied
      }
      
      // Upload to storage
      const fileName = `${user.id}/${timestamp.getTime()}.jpg`;
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
          user_id: user.id,
          timestamp: timestamp.toISOString(),
          photo_url: publicUrl,
          latitude,
          longitude,
          address,
        });

      if (insertError) throw insertError;
      
      toast({
        title: "Ponto registrado!",
        description: `Registro às ${format(timestamp, "HH:mm:ss")}`,
      });
      
      setShowCamera(false);
      fetchRegistros();
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

  const handleProfileSave = () => {
    refetchProfile?.();
  };

  const lastRegistro = registros[0];
  const todayRegistros = registros.filter(
    (r) => new Date(r.timestamp).toDateString() === new Date().toDateString()
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Photo Zoom Dialog */}
      <PhotoZoomDialog
        open={!!selectedPhoto}
        onOpenChange={(open) => !open && setSelectedPhoto(null)}
        photoUrl={selectedPhoto || ""}
      />

      {/* Camera Overlay - now starts with rear camera */}
      {showCamera && (
        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setShowCamera(false)}
          isProcessing={processing}
          initialFacingMode="environment"
        />
      )}

      {/* Header */}
      <div className="gradient-hero p-4 pt-8 pb-20 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {user && profile && (
              <AvatarUpload
                userId={user.id}
                currentAvatarUrl={avatarUrl}
                fullName={profile.full_name}
                onAvatarUpdate={setAvatarUrl}
              />
            )}
            <div>
              <p className="text-primary-foreground/80 text-sm">Olá,</p>
              <p className="text-primary-foreground font-semibold">
                {profile?.full_name || "Funcionário"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {userProfile && (
              <ProfileEditDialog 
                profile={userProfile} 
                onSave={handleProfileSave}
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/tickets")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Shield className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Clock */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-primary-foreground/80" />
            <span className="text-primary-foreground/80 text-sm">Hora Atual</span>
          </div>
          <p className="text-5xl font-bold text-primary-foreground tracking-tight">
            {format(currentTime, "HH:mm:ss")}
          </p>
          <p className="text-primary-foreground/80 mt-1 capitalize">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 -mt-12 pb-8 space-y-6">
        {/* Register Button Card */}
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Status de Hoje</p>
                <p className="text-lg font-semibold">
                  {todayRegistros.length} registro{todayRegistros.length !== 1 ? "s" : ""}
                </p>
              </div>
              {lastRegistro && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Último Registro</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(lastRegistro.timestamp), "HH:mm")}
                  </p>
                </div>
              )}
            </div>
            
            <Button
              onClick={() => setShowCamera(true)}
              className="w-full h-14 text-lg font-semibold gradient-primary shadow-glow"
              size="lg"
            >
              <Camera className="h-6 w-6 mr-2" />
              Registrar Ponto
            </Button>
          </CardContent>
        </Card>

        {/* Balance Card with PDF Report */}
        {registros.length > 0 && (
          <BalanceCard 
            registros={registros} 
            hourlyRate={hourlyRate}
            employeeName={profile?.full_name || ""}
          />
        )}

        {/* Registros Hierarchy */}
        <Card className="shadow-xl border-0">
          <CardContent className="p-4">
            <h2 className="font-semibold text-foreground mb-4">Meus Registros</h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <RegistrosHierarchy 
                registros={registros} 
                onPhotoClick={setSelectedPhoto}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
