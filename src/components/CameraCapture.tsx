import { useState, useRef, useCallback } from "react";
import { Camera, X, RotateCcw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
}

export function CameraCapture({ onCapture, onCancel, isProcessing }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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
  }, [facingMode]);

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

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Mirror for selfie camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);
    stopCamera();
  }, [facingMode, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  // Start camera on mount
  useState(() => {
    startCamera();
  });

  return (
    <div className="fixed inset-0 z-50 bg-foreground/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          className="text-background hover:bg-background/10"
        >
          <X className="h-6 w-6" />
        </Button>
        <h2 className="text-background font-semibold">Registrar Ponto</h2>
        <div className="w-10" />
      </div>

      {/* Camera/Preview Area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {error ? (
          <div className="text-center p-4">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={startCamera} variant="secondary">
              Tentar Novamente
            </Button>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Foto capturada"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setCameraReady(true)}
              className={cn(
                "max-h-full max-w-full object-contain",
                facingMode === "user" && "scale-x-[-1]"
              )}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-background animate-spin" />
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="p-6 pb-safe">
        {capturedImage ? (
          <div className="flex items-center justify-center gap-8">
            <Button
              variant="ghost"
              size="lg"
              onClick={retakePhoto}
              disabled={isProcessing}
              className="text-background hover:bg-background/10 flex flex-col gap-1 h-auto py-3"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="text-xs">Nova Foto</span>
            </Button>
            
            <Button
              onClick={confirmPhoto}
              disabled={isProcessing}
              className="h-16 w-16 rounded-full gradient-primary shadow-glow"
            >
              {isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <Check className="h-8 w-8" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8">
            <Button
              variant="ghost"
              size="lg"
              onClick={switchCamera}
              disabled={!cameraReady}
              className="text-background hover:bg-background/10 flex flex-col gap-1 h-auto py-3"
            >
              <RotateCcw className="h-6 w-6" />
              <span className="text-xs">Trocar</span>
            </Button>
            
            <button
              onClick={takePhoto}
              disabled={!cameraReady}
              className="relative h-20 w-20 rounded-full border-4 border-background flex items-center justify-center disabled:opacity-50"
            >
              <div className="h-16 w-16 rounded-full bg-background" />
              {cameraReady && (
                <div className="absolute inset-0 rounded-full border-4 border-primary animate-pulse-ring" />
              )}
            </button>
            
            <div className="w-16" />
          </div>
        )}
      </div>
    </div>
  );
}
