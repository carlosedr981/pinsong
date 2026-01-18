import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Send,
  ChevronDown,
  User,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  messages?: TicketMessage[];
  isOpen?: boolean;
  user_name?: string;
}

interface TicketListProps {
  isAdmin?: boolean;
  refreshTrigger?: number;
}

export function TicketList({ isAdmin = false, refreshTrigger }: TicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .order("updated_at", { ascending: false });

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
  }, [user, isAdmin]);

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

  const handleSendReply = async (ticketId: string) => {
    const text = replyText[ticketId]?.trim();
    if (!text || !user) return;

    setSendingReply(ticketId);
    try {
      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        user_id: user.id,
        message: text,
        is_admin_reply: isAdmin,
      });

      if (error) throw error;

      // Update ticket updated_at
      await supabase
        .from("tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      setReplyText((prev) => ({ ...prev, [ticketId]: "" }));
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
        return "Em Andamento";
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
      {tickets.map((ticket) => (
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <Badge className={cn("text-xs", getPriorityColor(ticket.priority))}>
                      {getPriorityLabel(ticket.priority)}
                    </Badge>
                    <Badge className={cn("text-xs", getStatusColor(ticket.status))}>
                      {getStatusLabel(ticket.status)}
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
                {/* Admin status selector */}
                {isAdmin && (
                  <div className="flex items-center gap-2 mb-4 pt-3">
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
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                    {updatingStatus === ticket.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
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
                            {msg.is_admin_reply ? "Administrador" : "Você"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(msg.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Reply input */}
                {ticket.status !== "closed" && (
                  <div className="flex gap-2 mt-4">
                    <Textarea
                      value={replyText[ticket.id] || ""}
                      onChange={(e) =>
                        setReplyText((prev) => ({
                          ...prev,
                          [ticket.id]: e.target.value,
                        }))
                      }
                      placeholder="Digite sua resposta..."
                      className="min-h-[60px] sm:min-h-[80px] text-sm resize-none"
                    />
                    <Button
                      size="icon"
                      onClick={() => handleSendReply(ticket.id)}
                      disabled={sendingReply === ticket.id || !replyText[ticket.id]?.trim()}
                      className="h-auto self-end"
                    >
                      {sendingReply === ticket.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
