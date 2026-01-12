-- Add pix_key column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key text;