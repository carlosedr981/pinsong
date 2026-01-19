import { useState, useRef } from "react";
import { Loader2, Send, MessageSquarePlus, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TicketDialogProps {
  onSuccess?: () => void;
}

export function TicketDialog({ onSuccess }: TicketDialogProps) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("medium");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleImageSelect = (file: File | null) => {
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImage(null);
      setImagePreview("");
    }
  };

  const handleSubmit = async () => {
    if (!user || !subject.trim() || (!message.trim() && !image)) {
      toast({
        variant: "destructive",
        title: "Preencha todos os campos",
        description: "Assunto e mensagem (ou imagem) são obrigatórios.",
      });
      return;
    }

    setSaving(true);
    try {
      // Get user's environment_id from profile
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("environment_id")
        .eq("id", user.id)
        .single();

      // Create the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          subject: subject.trim(),
          priority,
          environment_id: userProfile?.environment_id || null,
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Upload image if exists
      let imageUrl: string | null = null;
      if (image) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${user.id}/${ticket.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("ticket-images")
          .upload(fileName, image);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("ticket-images")
            .getPublicUrl(fileName);
          
          imageUrl = urlData.publicUrl;
        }
      }

      // Add the first message
      const { error: messageError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          message: message.trim(),
          is_admin_reply: false,
          image_url: imageUrl,
        });

      if (messageError) throw messageError;

      toast({
        title: "Ticket criado!",
        description: "Seu ticket foi enviado com sucesso.",
      });

      setSubject("");
      setMessage("");
      setPriority("medium");
      setImage(null);
      setImagePreview("");
      setOpen(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating ticket:", error);
      toast({
        variant: "destructive",
        title: "Erro ao criar ticket",
        description: error.message || "Não foi possível criar o ticket.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            Novo Ticket
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem para a administração.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Digite o assunto do ticket"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva sua solicitação..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Anexar Imagem (opcional)</Label>
            {imagePreview ? (
              <div className="relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="max-w-[150px] max-h-[150px] rounded-lg object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => handleImageSelect(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clique para adicionar uma imagem</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageSelect(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}