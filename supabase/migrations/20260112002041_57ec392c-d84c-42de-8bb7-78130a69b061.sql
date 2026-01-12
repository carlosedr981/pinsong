-- Add PIX beneficiary fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pix_bank TEXT,
ADD COLUMN IF NOT EXISTS pix_beneficiary_name TEXT,
ADD COLUMN IF NOT EXISTS pix_beneficiary_cpf TEXT,
ADD COLUMN IF NOT EXISTS pix_beneficiary_phone TEXT;

-- Add address field to registros table
ALTER TABLE public.registros
ADD COLUMN IF NOT EXISTS address TEXT;