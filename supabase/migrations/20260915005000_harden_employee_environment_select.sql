DROP POLICY IF EXISTS "Users can view their environment assignments" ON public.employee_environments;

CREATE POLICY "Users can view their environment assignments"
ON public.employee_environments FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::app_role
      AND ur.environment_id IS NULL
  )
);
