import { useState, useRef } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AvatarUploadProps {
  userId: string;
  currentAvatarUrl: string | null;
  fullName: string;
  onAvatarUpdate: (url: string) => void;
}

export function AvatarUpload({ userId, currentAvatarUrl, fullName, onAvatarUpdate }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
      });
      return;
    }

    setUploading(true);
    let uploadedPath: string | null = null;

    try {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const fileName = `${userId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;
      uploadedPath = fileName;

      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      const urlWithCacheBust = `${data.publicUrl}?t=${Date.now()}`;

      const { data: savedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBust })
        .eq("id", userId)
        .select("id, avatar_url")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!savedProfile?.avatar_url) {
        throw new Error("O Supabase não confirmou a gravação da foto. Verifique as permissões de atualização da tabela profiles (RLS).");
      }

      onAvatarUpdate(savedProfile.avatar_url);
      toast({
        title: "Foto atualizada!",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
    } catch (error: unknown) {
      console.error("Error uploading avatar:", error);

      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([uploadedPath]);
        if (cleanupError) console.error("Error cleaning up uploaded avatar:", cleanupError);
      }

      const errorMessage = error instanceof Error ? error.message : "Verifique sua conexão e tente novamente.";
      toast({
        variant: "destructive",
        title: "Erro ao atualizar foto",
        description: errorMessage,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => currentAvatarUrl && setPreviewOpen(true)}
        className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Ampliar foto de perfil"
        disabled={!currentAvatarUrl}
      >
        <Avatar className="h-16 w-16 border-2 border-background shadow-md">
          <AvatarImage src={currentAvatarUrl || undefined} alt={fullName} />
          <AvatarFallback className="bg-secondary text-secondary-foreground text-lg font-semibold">
            {initials || <User className="h-6 w-6" />}
          </AvatarFallback>
        </Avatar>
      </button>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[min(92vw,560px)] border-0 bg-black/95 p-2">
          <DialogTitle className="sr-only">Foto de perfil de {fullName}</DialogTitle>
          <img src={currentAvatarUrl || undefined} alt={fullName} className="max-h-[80vh] w-full rounded-md object-contain" />
        </DialogContent>
      </Dialog>

      <Button
        size="icon"
        variant="secondary"
        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full shadow-md"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
