ALTER TABLE public.environments
ADD COLUMN IF NOT EXISTS fortnightly_revenue numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.environments.fortnightly_revenue IS
'Valor contratado a receber por quinzena para este ambiente.';
