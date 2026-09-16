import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, LogOut, Camera, Loader2, Shield, MessageSquare, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CameraCapture } from "@/components/CameraCapture";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { RegistrosHierarchy } from "@/components/RegistrosHierarchy";
import { PhotoZoomDialog } from "@/components/PhotoZoomDialog";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { TicketDialog } from "@/components/TicketDialog";
import { EmployeeOfDayCard } from "@/components/EmployeeOfDayCard";
import { WorkScheduleCard } from "@/components/WorkScheduleCard";
import { useTicketNotifications } from "@/hooks/useTicketNotifications";
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
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState<number>(20);
  const [userEnvironmentId, setUserEnvironmentId] = useState<string | null>(null);
  const { user, profile, signOut, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unreadCount } = useTicketNotifications(isAdmin);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { const loadData = async () => { if (profile) { setAvatarUrl(profile.avatar_url || null); setUserProfile({ id: user?.id || "", full_name: profile.full_name, email: profile.email || null, phone: profile.phone || null, cpf: profile.cpf || null, pix_key: profile.pix_key || null, pix_bank: profile.pix_bank || null, pix_beneficiary_name: profile.pix_beneficiary_name || null, pix_beneficiary_cpf: profile.pix_beneficiary_cpf || null, pix_beneficiary_phone: profile.pix_beneficiary_phone || null, avatar_url: profile.avatar_url || null }); const employeeRate = (profile as any).hourly_rate; if (employeeRate) setHourlyRate(Number(employeeRate)); else { const { data: settings } = await supabase.from("app_settings").select("value").eq("key", "global_hourly_rate").single(); if (settings) setHourlyRate(Number(settings.value)); } } }; loadData(); }, [profile, user]);
  useEffect(() => { const checkAdminAndEnvironment = async () => { if (!user) return; const { data: isAdminData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }); setIsAdmin(!!isAdminData); if (isAdminData) { const { data: roleData } = await supabase.from("user_roles").select("environment_id").eq("user_id", user.id).eq("role", "admin").maybeSingle(); setIsGlobalAdmin(roleData?.environment_id === null); setUserEnvironmentId(roleData?.environment_id || null); } const { data: profileData } = await supabase.from("profiles").select("environment_id").eq("id", user.id).single(); if (profileData?.environment_id && !isGlobalAdmin) setUserEnvironmentId(profileData.environment_id); }; checkAdminAndEnvironment(); }, [user]);
  const fetchRegistros = useCallback(async () => { if (!user) return; try { const { data, error } = await supabase.from("registros").select("*").eq("user_id", user.id).order("timestamp", { ascending: false }); if (error) throw error; setRegistros(data || []); } catch (error) { console.error("Error fetching registros:", error); } finally { setLoading(false); } }, [user]);
  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);
  const handleCapture = async (imageDataUrl: string) => { if (!user || !profile) return; setProcessing(true); try { const timestamp = new Date(); const watermarkedImage = await addWatermarkToImage(imageDataUrl, { fullName: profile.full_name, timestamp }); const blob = dataURLtoBlob(watermarkedImage); let latitude: number | null = null; let longitude: number | null = null; let address: string | null = null; try { const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true })); latitude = position.coords.latitude; longitude = position.coords.longitude; const geocodeResult = await reverseGeocode(latitude, longitude); if (geocodeResult) address = geocodeResult.address; } catch {} const dateStr = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}`; let valuePerRegistro = hourlyRate; const { data: schedule } = await supabase.from("work_schedules").select("start_time, end_time").eq("employee_id", user.id).eq("date", dateStr).maybeSingle(); if (schedule?.start_time && schedule?.end_time) { const [startH, startM] = schedule.start_time.split(":").map(Number); const [endH, endM] = schedule.end_time.split(":").map(Number); const scheduledHours = endH + endM / 60 - (startH + startM / 60); if (scheduledHours > 0) valuePerRegistro = scheduledHours * hourlyRate; } const fileName = `${user.id}/${timestamp.getTime()}.jpg`; const { error: uploadError } = await supabase.storage.from("registros-photos").upload(fileName, blob, { contentType: "image/jpeg" }); if (uploadError) throw uploadError; const { data: { publicUrl } } = supabase.storage.from("registros-photos").getPublicUrl(fileName); const { error: insertError } = await supabase.from("registros").insert({ user_id: user.id, timestamp: timestamp.toISOString(), photo_url: publicUrl, latitude, longitude, address, value_per_registro: valuePerRegistro }); if (insertError) throw insertError; toast({ title: "Ponto registrado!", description: `Registro às ${format(timestamp, "HH:mm:ss")}` }); setShowCamera(false); fetchRegistros(); } catch (error) { console.error("Error registering ponto:", error); toast({ variant: "destructive", title: "Erro ao registrar", description: "Não foi possível registrar o ponto. Tente novamente." }); } finally { setProcessing(false); } };
  const handleProfileSave = () => { refetchProfile?.(); };
  const lastRegistro = registros[0];
  const todayRegistros = registros.filter((r) => new Date(r.timestamp).toDateString() === new Date().toDateString());
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <PhotoZoomDialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)} photoUrl={selectedPhoto || ""} />
      {showCamera && <CameraCapture onCapture={handleCapture} onCancel={() => setShowCamera(false)} isProcessing={processing} initialFacingMode="environment" />}
      <div className="gradient-hero rounded-b-[2rem] px-3 pb-20 pt-6 sm:p-4 sm:pb-20 sm:pt-8">
        <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2 sm:gap-3">{user && profile && <AvatarUpload userId={user.id} currentAvatarUrl={avatarUrl} fullName={profile.full_name} onAvatarUpdate={setAvatarUrl} />}<div className="min-w-0"><p className="text-primary-foreground/80 text-sm">Olá,</p><p className="truncate text-sm font-semibold text-primary-foreground sm:text-base">{profile?.full_name || "Funcionário"}</p></div></div><div className="flex shrink-0 items-center gap-0.5 sm:gap-2">{userProfile && <ProfileEditDialog profile={userProfile} onSave={handleProfileSave} />}<Button variant="ghost" size="icon" aria-label="Tickets" onClick={() => navigate("/tickets")} className="relative h-10 w-10 text-primary-foreground hover:bg-primary-foreground/10"><MessageSquare className="h-5 w-5" />{unreadCount > 0 && <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center border-0 bg-destructive p-0 text-[10px]">{unreadCount > 9 ? "9+" : unreadCount}</Badge>}</Button>{isAdmin && <Button variant="ghost" size="icon" aria-label="Administração" onClick={() => navigate("/admin")} className="h-10 w-10 text-primary-foreground hover:bg-primary-foreground/10"><Shield className="h-5 w-5" /></Button>}<Button variant="ghost" size="icon" aria-label="Sair" onClick={signOut} className="h-10 w-10 text-primary-foreground hover:bg-primary-foreground/10"><LogOut className="h-5 w-5" /></Button></div></div>
        <div className="text-center"><div className="mb-2 flex items-center justify-center gap-2"><Clock className="h-5 w-5 text-primary-foreground/80" /><span className="text-sm text-primary-foreground/80">Hora Atual</span></div><p className="text-4xl font-bold tracking-normal text-primary-foreground sm:text-5xl">{format(currentTime, "HH:mm:ss")}</p><p className="mt-1 px-2 text-sm capitalize text-primary-foreground/80 sm:text-base">{format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}</p></div>
      </div>
      <div className="mx-auto -mt-12 max-w-3xl space-y-4 px-3 pb-8 sm:space-y-6 sm:px-4">
        <Card className="overflow-hidden border-0 shadow-xl"><CardContent className="p-4 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Status de Hoje</p><p className="text-base font-semibold sm:text-lg">{todayRegistros.length} registro{todayRegistros.length !== 1 ? "s" : ""}</p></div>{lastRegistro && <div className="shrink-0 text-right"><p className="text-sm text-muted-foreground">Último Registro</p><p className="text-base font-semibold sm:text-lg">{format(new Date(lastRegistro.timestamp), "HH:mm")}</p></div>}</div><Button onClick={() => setShowCamera(true)} className="h-14 w-full text-base font-semibold gradient-primary shadow-glow sm:text-lg" size="lg"><Camera className="mr-2 h-6 w-6" />Registrar Ponto</Button></CardContent></Card>
        {user && <WorkScheduleCard isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} userId={user.id} environmentId={userEnvironmentId} />}
        <RegistrosHierarchy registros={registros} onPhotoClick={setSelectedPhoto} />
        {isAdmin && user && <EmployeeOfDayCard isAdmin={isAdmin} isGlobalAdmin={isGlobalAdmin} userId={user.id} environmentId={userEnvironmentId} />}
      </div>
    </div>
  );
}
