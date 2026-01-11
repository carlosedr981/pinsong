-- Add phone and cpf columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN phone text,
ADD COLUMN cpf text;

-- Add unique constraint on cpf
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_cpf_unique UNIQUE (cpf);