-- Create environments (companies) table
CREATE TABLE public.environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;

-- Link profiles to environments
ALTER TABLE public.profiles 
ADD COLUMN environment_id UUID REFERENCES public.environments(id);

-- Create index for performance
CREATE INDEX idx_profiles_environment ON public.profiles(environment_id);

-- RLS policies for environments
-- Admins can view all environments
CREATE POLICY "Admins can view all environments"
ON public.environments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create environments
CREATE POLICY "Admins can create environments"
ON public.environments
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update environments
CREATE POLICY "Admins can update environments"
ON public.environments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete environments
CREATE POLICY "Admins can delete environments"
ON public.environments
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own environment
CREATE POLICY "Users can view their own environment"
ON public.environments
FOR SELECT
USING (
  id IN (
    SELECT environment_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Update profiles RLS to allow admins to update any profile in any environment
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));