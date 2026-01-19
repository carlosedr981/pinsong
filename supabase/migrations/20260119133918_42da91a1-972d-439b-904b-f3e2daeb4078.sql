-- Add columns for admin control of replies and image support
ALTER TABLE public.tickets 
ADD COLUMN allow_reply BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN locked_by_admin BOOLEAN NOT NULL DEFAULT false;

-- Add image_url column to ticket_messages for image attachments
ALTER TABLE public.ticket_messages 
ADD COLUMN image_url TEXT;