-- Add hourly_rate to profiles table for per-employee rate (default R$20/hour)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 20.00;

-- Create a settings table for global configurations
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Insert default global hourly rate
INSERT INTO public.app_settings (key, value) 
VALUES ('global_hourly_rate', '20.00')
ON CONFLICT (key) DO NOTHING;

-- RLS policies for app_settings
CREATE POLICY "Anyone can view settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only global admins can update settings" 
ON public.app_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND environment_id IS NULL
  )
);

CREATE POLICY "Only global admins can insert settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin' 
    AND environment_id IS NULL
  )
);

-- Create trigger for updated_at on app_settings
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();