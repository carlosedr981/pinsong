-- Enable realtime for tickets and ticket_messages tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;