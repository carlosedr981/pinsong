DROP POLICY IF EXISTS "Admins can view registros by environment" ON public.registros;

CREATE POLICY "Admins can view registros by environment"
ON public.registros FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
      AND (ur.environment_id IS NULL OR ur.environment_id = registros.environment_id)
  )
);

DROP POLICY IF EXISTS "Admins can manage environment assignments" ON public.employee_environments;
CREATE POLICY "Global admins can manage environment assignments"
ON public.employee_environments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role AND ur.environment_id IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role AND ur.environment_id IS NULL
  )
);
