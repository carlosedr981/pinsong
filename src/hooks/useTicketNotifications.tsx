import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface TicketNotification {
  id: string;
  type: "new_ticket" | "new_reply" | "status_change";
  message: string;
  ticketId: string;
  timestamp: Date;
}

export function useTicketNotifications(isAdmin: boolean = false) {
  const [notifications, setNotifications] = useState<TicketNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const addNotification = useCallback((notification: TicketNotification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 20)); // Keep last 20
    setUnreadCount((prev) => prev + 1);
    
    // Show toast notification
    toast({
      title: notification.type === "new_ticket" 
        ? "🎫 Novo Ticket"
        : notification.type === "new_reply" 
        ? "💬 Nova Resposta" 
        : "📋 Status Atualizado",
      description: notification.message,
    });
  }, [toast]);

  const clearNotifications = useCallback(() => {
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to tickets changes
    const ticketsChannel = supabase
      .channel("tickets-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tickets",
        },
        async (payload) => {
          const newTicket = payload.new as any;
          
          // For admins, notify about all new tickets
          if (isAdmin) {
            // Get user name
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", newTicket.user_id)
              .single();
            
            addNotification({
              id: `ticket-${newTicket.id}`,
              type: "new_ticket",
              message: `Novo ticket: "${newTicket.subject}" de ${profile?.full_name || "Funcionário"}`,
              ticketId: newTicket.id,
              timestamp: new Date(),
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tickets",
        },
        async (payload) => {
          const updatedTicket = payload.new as any;
          const oldTicket = payload.old as any;
          
          // Notify about status changes
          if (oldTicket.status !== updatedTicket.status) {
            // For the ticket owner
            if (updatedTicket.user_id === user.id && !isAdmin) {
              const statusLabels: Record<string, string> = {
                open: "Aberto",
                in_progress: "Respondido",
                closed: "Fechado",
              };
              addNotification({
                id: `status-${updatedTicket.id}-${Date.now()}`,
                type: "status_change",
                message: `Seu ticket "${updatedTicket.subject}" foi atualizado para: ${statusLabels[updatedTicket.status] || updatedTicket.status}`,
                ticketId: updatedTicket.id,
                timestamp: new Date(),
              });
            }
          }
        }
      )
      .subscribe();

    // Subscribe to ticket_messages changes
    const messagesChannel = supabase
      .channel("ticket-messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Get ticket info
          const { data: ticket } = await supabase
            .from("tickets")
            .select("subject, user_id")
            .eq("id", newMessage.ticket_id)
            .single();
          
          if (!ticket) return;

          // Don't notify the sender
          if (newMessage.user_id === user.id) return;

          // For regular users: notify if admin replied to their ticket
          if (!isAdmin && ticket.user_id === user.id && newMessage.is_admin_reply) {
            addNotification({
              id: `reply-${newMessage.id}`,
              type: "new_reply",
              message: `Nova resposta no seu ticket: "${ticket.subject}"`,
              ticketId: newMessage.ticket_id,
              timestamp: new Date(),
            });
          }

          // For admins: notify about new messages in tickets they can see
          if (isAdmin && !newMessage.is_admin_reply) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", newMessage.user_id)
              .single();
            
            addNotification({
              id: `reply-${newMessage.id}`,
              type: "new_reply",
              message: `${profile?.full_name || "Funcionário"} respondeu: "${ticket.subject}"`,
              ticketId: newMessage.ticket_id,
              timestamp: new Date(),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user, isAdmin, addNotification]);

  return {
    notifications,
    unreadCount,
    clearNotifications,
  };
}
