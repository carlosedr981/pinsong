import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, Check, Loader2, SwitchCamera, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Environment {
  id: string;
  name: string;
}

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  initialFacingMode?: "user" | "environment";
}

export function CameraCapture({
  onCapture,
  onCancel,
  isProcessing,
  initialFacingMode = "environment"
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">(initialFacingMode);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState("");
  const [environmentLoading, setEnvironmentLoading] = useState(true);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);

  const loadEnvironments = useCallback(async () => {
    setEnvironmentLoading(true);
    setEnvironmentError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setEnvironmentError("Sessão expirada. Faça login novamente.");
      setEnvironmentLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("employee_environments")
      .select("environment_id, environments(id, name)")
      .eq("user_id", user.id);

    if (queryError) {
      console.error("Environment selection error:", queryError);
      setEnvironmentError("Não foi possível carregar seus ambientes.");
      setEnvironmentLoading(false);
      return;
    }

    const list = (data || [])
      .map((item: any) => item.environments)
      .filter(Boolean) as Environment[];
    setEnvironments(list);

    const { data: profile } = await supabase
      .from("profiles")
      .select("active_environment_id")
      .eq("id", user.id)
      .maybeSingle();

    const active = list.find((env) => env.id === profile?.active_environment_id);
    if (active) setSelectedEnvironment(active.id);
    else if (list.length === 1) setSelectedEnvironment(list[0].id);
    else if (profile?.active_environment_id && list.some((env) => env.id === profile.active_environment_id)) {
      setSelectedEnvironment(profile.active_environment_id);
    }

    setEnvironmentLoading(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!selectedEnvironment) return;
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setCameraReady(true);
      }
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      console.error("Camera error:", err);
    }
  }, [facingMode, selectedEnvironment]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraReady(false);
    }
  }, [stream]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }, [stopCamera]);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  useEffect(() => {
    if (!selectedEnvironment || capturedImage) return;
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode, selectedEnvironment]);

  const handleEnvironmentChange = async (value: string) => {
    setSelectedEnvironment(value);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error: rpcError } = await supabase.rpc("set_active_environment", {
      _environment_id: value,
    });
    if (rpcError || data !== true) {
      setEnvironmentError("Não foi possível selecionar este ambiente.");
      return;
    }
    stopCamera();
  };

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !selectedEnvironment) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
  }, [facingMode, selectedEnvironment, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage && selectedEnvironment) onCapture(capturedImage);
  }, [capturedImage, selectedEnvironment, onCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  if (environmentLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 text-background animate-spin" />
      </div>
    );
  }

  if (environments.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Ambiente não definido</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">O administrador ainda não vinculou nenhum ambiente ao seu cadastro.</p>
            {environmentError && <p className="text-sm text-destructive">{environmentError}</p>}
            <Button className="w-full" onClick={handleCancel}>Fechar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedEnvironment) {
    return (
      <div className="fixed inset-0 z-50 bg-foreground/95 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Selecionar ambiente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Label>Onde você está trabalhando?</Label>
            <Select value={selectedEnvironment} onValueChange={handleEnvironmentChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o ambiente" /></SelectTrigger>
              <SelectContent>{environments.map((env) => <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>)}</SelectContent>
            </Select>
            {environmentError && <p className="text-sm text-destructive">{environmentError}</p>}
            <Button variant="outline" className="w-full" onClick={handleCancel}>Cancelar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/95 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={handleCancel} className="text-background hover:bg-background/10"><X className="h-6 w-6" /></Button>
        <div className="text-center">
          <h2 className="text-background font-semibold">Registrar Ponto</h2>
          <p className="text-background/70 text-xs">{environments.find((e) => e.id === selectedEnvironment)?.name}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {error ? (
          <div className="text-center p-4"><p className="text-destructive mb-4">{error}</p><Button onClick={startCamera} variant="secondary">Tentar Novamente</Button></div>
        ) : capturedImage ? (
          <img src={capturedImage} alt="Foto capturada" className="max-h-full max-w-full object-contain" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={() => setCameraReady(true)} className={cn("max-h-full max-w-full object-contain", facingMode === "user" && "scale-x-[-1]")} />
            {!cameraReady && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 text-background animate-spin" /></div>}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="p-6 pb-safe">
        {capturedImage ? (
          <div className="flex items-center justify-center gap-8">
            <Button variant="ghost" size="lg" onClick={retakePhoto} disabled={isProcessing} className="text-background hover:bg-background/10 flex flex-col gap-1 h-auto py-3"><RotateCcw className="h-6 w-6" /><span className="text-xs">Nova Foto</span></Button>
            <Button onClick={confirmPhoto} disabled={isProcessing} className="h-16 w-16 rounded-full gradient-primary shadow-glow">{isProcessing ? <Loader2 className="h-8 w-8 animate-spin" /> : <Check className="h-8 w-8" />}</Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8">
            <Button variant="ghost" size="lg" onClick={switchCamera} disabled={!cameraReady} className="text-background hover:bg-background/10 flex flex-col gap-1 h-auto py-3"><SwitchCamera className="h-6 w-6" /><span className="text-xs">Trocar</span></Button>
            <button onClick={takePhoto} disabled={!cameraReady} className="relative h-20 w-20 rounded-full border-4 border-background flex items-center justify-center disabled:opacity-50"><div className="h-16 w-16 rounded-full bg-background" />{cameraReady && <div className="absolute inset-0 rounded-full border-4 border-primary animate-pulse-ring" />}</button>
            <div className="w-16" />
          </div>
        )}
      </div>
    </div>
  );
}
