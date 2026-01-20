import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  MessageSquare,
  Clock,
  Send,
  ChevronDown,
  User,
  Shield,
  Lock,
  Unlock,
  Image as ImageIcon,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { cn } from "@/lib/utils";

interface TicketMessage {
  id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
  user_id: string;
  image_url?: string | null;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  allow_reply: boolean;
  locked_by_admin: boolean;
  messages?: TicketMessage[];
  isOpen?: boolean;
  user_name?: string;
}

interface TicketListProps {
  isAdmin?: boolean;
  refreshTrigger?: number;
  statusFilter?: "all" | "open" | "closed";
}

export function TicketList({ isAdmin = false, refreshTrigger, statusFilter = "all" }: TicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyImage, setReplyImage] = useState<Record<string, File | null>>({});
  const [replyImagePreview, setReplyImagePreview] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [togglingLock, setTogglingLock] = useState<string | null>(null);
  const [deletingTicket, setDeletingTicket] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("tickets")
        .select("*")
        .order("updated_at", { ascending: false });

      // Apply status filter
      if (statusFilter === "open") {
        query = query.in("status", ["open", "in_progress"]);
      } else if (statusFilter === "closed") {
        query = query.eq("status", "closed");
      }

      const { data: ticketsData, error: ticketsError } = await query;

      if (ticketsError) throw ticketsError;

      // Fetch messages for each ticket
      const ticketsWithMessages = await Promise.all(
        (ticketsData || []).map(async (ticket) => {
          const { data: messages } = await supabase
            .from("ticket_messages")
            .select("*")
            .eq("ticket_id", ticket.id)
            .order("created_at", { ascending: true });

          // If admin, get user name
          let user_name = "";
          if (isAdmin) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", ticket.user_id)
              .single();
            user_name = profile?.full_name || "Usuário";
          }

          return {
            ...ticket,
            messages: messages || [],
            isOpen: false,
            user_name,
          };
        })
      );

      setTickets(ticketsWithMessages);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets, refreshTrigger]);

  const toggleTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, isOpen: !t.isOpen } : t
      )
    );
  };

  const handleImageSelect = (ticketId: string, file: File | null) => {
    if (file) {
      setReplyImage((prev) => ({ ...prev, [ticketId]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setReplyImagePreview((prev) => ({ ...prev, [ticketId]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    } else {
      setReplyImage((prev) => ({ ...prev, [ticketId]: null }));
      setReplyImagePreview((prev) => ({ ...prev, [ticketId]: "" }));
    }
  };

  const handleSendReply = async (ticketId: string) => {
    const text = replyText[ticketId]?.trim();
    const image = replyImage[ticketId];
    
    if ((!text && !image) || !user) return;

    setSendingReply(ticketId);
    try {
      let imageUrl: string | null = null;

      // Upload image if exists
      if (image) {
        const fileExt = image.name.split(".").pop();
        const fileName = `${user.id}/${ticketId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("ticket-images")
          .upload(fileName, image);

        if (uploadError) {
          // Try to create bucket and upload again
          console.log("Creating bucket...");
        }

        const { data: urlData } = supabase.storage
          .from("ticket-images")
          .getPublicUrl(fileName);
        
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        user_id: user.id,
        message: text || "",
        is_admin_reply: isAdmin,
        image_url: imageUrl,
      });

      if (error) throw error;

      // Update ticket updated_at
      await supabase
        .from("tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      setReplyText((prev) => ({ ...prev, [ticketId]: "" }));
      setReplyImage((prev) => ({ ...prev, [ticketId]: null }));
      setReplyImagePreview((prev) => ({ ...prev, [ticketId]: "" }));
      toast({ title: "Mensagem enviada!" });
      fetchTickets();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar",
        description: error.message,
      });
    } finally {
      setSendingReply(null);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingStatus(ticketId);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: newStatus })
        .eq("id", ticketId);

      if (error) throw error;

      toast({ title: "Status atualizado!" });
      fetchTickets();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message,
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleToggleLock = async (ticketId: string, currentLocked: boolean) => {
    setTogglingLock(ticketId);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ 
          locked_by_admin: !currentLocked,
          allow_reply: currentLocked // If unlocking, allow reply; if locking, disallow
        })
        .eq("id", ticketId);

      if (error) throw error;

      toast({ 
        title: currentLocked ? "Ticket desbloqueado" : "Ticket bloqueado",
        description: currentLocked 
          ? "O funcionário pode responder novamente" 
          : "O funcionário não pode mais responder"
      });
      fetchTickets();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message,
      });
    } finally {
      setTogglingLock(null);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Tem certeza que deseja excluir este ticket? Esta ação não pode ser desfeita.")) {
      return;
    }

    setDeletingTicket(ticketId);
    try {
      // First delete all messages
      const { error: messagesError } = await supabase
        .from("ticket_messages")
        .delete()
        .eq("ticket_id", ticketId);

      if (messagesError) throw messagesError;

      // Then delete the ticket
      const { error: ticketError } = await supabase
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (ticketError) throw ticketError;

      toast({ title: "Ticket excluído com sucesso!" });
      fetchTickets();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    } finally {
      setDeletingTicket(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/30";
      case "medium":
        return "bg-warning/10 text-warning border-warning/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-primary/10 text-primary";
      case "in_progress":
        return "bg-warning/10 text-warning";
      case "closed":
        return "bg-success/10 text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Aberto";
      case "in_progress":
        return "Respondido";
      case "closed":
        return "Fechado";
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return priority;
    }
  };

  // Check if ticket has admin reply to determine if it's "responded"
  const hasAdminReply = (ticket: Ticket) => {
    return ticket.messages?.some(m => m.is_admin_reply) || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          {isAdmin ? "Nenhum ticket encontrado" : "Você ainda não tem tickets"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => {
        const canUserReply = !ticket.locked_by_admin && ticket.allow_reply && ticket.status !== "closed";
        const canReply = isAdmin || canUserReply;
        
        return (
          <Collapsible
            key={ticket.id}
            open={ticket.isOpen}
            onOpenChange={() => toggleTicket(ticket.id)}
          >
            <Card className="border shadow-sm overflow-hidden">
              <CollapsibleTrigger asChild>
                <CardHeader className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm sm:text-base line-clamp-2 sm:truncate">
                          {ticket.subject}
                        </CardTitle>
                        {isAdmin && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Por: {ticket.user_name}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span className="hidden sm:inline">
                            {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="sm:hidden">
                            {format(new Date(ticket.created_at), "dd/MM/yy HH:mm")}
                          </span>
                          {ticket.locked_by_admin && (
                            <Lock className="h-3 w-3 ml-2 text-destructive" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <Badge className={cn("text-xs", getPriorityColor(ticket.priority))}>
                        {getPriorityLabel(ticket.priority)}
                      </Badge>
                      <Badge className={cn("text-xs", getStatusColor(hasAdminReply(ticket) && ticket.status === "open" ? "in_progress" : ticket.status))}>
                        {hasAdminReply(ticket) && ticket.status === "open" ? "Respondido" : getStatusLabel(ticket.status)}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground transition-transform flex-shrink-0",
                          ticket.isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-3 sm:p-4 pt-0 border-t">
                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Select
                          value={ticket.status}
                          onValueChange={(value) => handleStatusChange(ticket.id, value)}
                          disabled={updatingStatus === ticket.id}
                        >
                          <SelectTrigger className="w-[140px] sm:w-[160px] h-8 text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Aberto</SelectItem>
                            <SelectItem value="in_progress">Respondido</SelectItem>
                            <SelectItem value="closed">Fechado</SelectItem>
                          </SelectContent>
                        </Select>
                        {updatingStatus === ticket.id && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={ticket.locked_by_admin ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => handleToggleLock(ticket.id, ticket.locked_by_admin)}
                          disabled={togglingLock === ticket.id}
                          className="h-8 text-xs"
                        >
                          {togglingLock === ticket.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : ticket.locked_by_admin ? (
                            <>
                              <Unlock className="h-3 w-3 mr-1" />
                              Desbloquear
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Bloquear Resposta
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTicket(ticket.id)}
                          disabled={deletingTicket === ticket.id}
                          className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          {deletingTicket === ticket.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3 mr-1" />
                              Excluir
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Locked message for users */}
                  {!isAdmin && ticket.locked_by_admin && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-lg mt-3 mb-3">
                      <Lock className="h-4 w-4" />
                      <span>Este ticket foi bloqueado pelo administrador</span>
                    </div>
                  )}

                  {/* Messages */}
                  <ScrollArea className="h-[200px] sm:h-[250px] pr-4 mt-3">
                    <div className="space-y-3">
                      {ticket.messages?.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "p-2 sm:p-3 rounded-lg",
                            msg.is_admin_reply
                              ? "bg-primary/10 ml-4 sm:ml-8"
                              : "bg-muted mr-4 sm:mr-8"
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {msg.is_admin_reply ? (
                              <Shield className="h-3 w-3 text-primary" />
                            ) : (
                              <User className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs font-medium">
                              {msg.is_admin_reply ? "Administrador" : (isAdmin ? ticket.user_name : "Você")}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(msg.created_at), "dd/MM HH:mm")}
                            </span>
                          </div>
                          {msg.message && (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          )}
                          {msg.image_url && (
                            <div className="mt-2">
                              <img 
                                src={msg.image_url} 
                                alt="Anexo" 
                                className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-80"
                                onClick={() => window.open(msg.image_url!, "_blank")}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Reply input */}
                  {canReply && (
                    <div className="mt-4 space-y-2">
                      {/* Image preview */}
                      {replyImagePreview[ticket.id] && (
                        <div className="relative inline-block">
                          <img 
                            src={replyImagePreview[ticket.id]} 
                            alt="Preview" 
                            className="max-w-[100px] max-h-[100px] rounded-lg object-cover"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                            onClick={() => handleImageSelect(ticket.id, null)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <div className="flex-1 flex gap-2">
                          <Textarea
                            value={replyText[ticket.id] || ""}
                            onChange={(e) =>
                              setReplyText((prev) => ({
                                ...prev,
                                [ticket.id]: e.target.value,
                              }))
                            }
                            placeholder="Digite sua resposta..."
                            className="min-h-[60px] sm:min-h-[80px] text-sm resize-none flex-1"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageSelect(ticket.id, e.target.files?.[0] || null)}
                            />
                            <div className="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          </label>
                          <Button
                            size="icon"
                            onClick={() => handleSendReply(ticket.id)}
                            disabled={sendingReply === ticket.id || (!replyText[ticket.id]?.trim() && !replyImage[ticket.id])}
                            className="h-9 w-9"
                          >
                            {sendingReply === ticket.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}