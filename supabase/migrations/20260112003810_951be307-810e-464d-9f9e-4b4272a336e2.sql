-- Add environment_id to user_roles to scope admin roles to environments
ALTER TABLE public.user_roles 
ADD COLUMN environment_id UUID REFERENCES public.environments(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_user_roles_environment ON public.user_roles(environment_id);

-- Function to check if user is admin of specific environment
CREATE OR REPLACE FUNCTION public.is_environment_admin(_user_id uuid, _environment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND (environment_id = _environment_id OR environment_id IS NULL)
  )
$$;

-- Policy: Environment admins can view profiles in their environment
CREATE POLICY "Environment admins can view environment profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.environment_id = profiles.environment_id
  )
);

-- Policy: Environment admins can update profiles in their environment
CREATE POLICY "Environment admins can update environment profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.environment_id = profiles.environment_id
  )
);