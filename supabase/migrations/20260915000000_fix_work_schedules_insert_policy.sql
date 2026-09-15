-- Fix work_schedules INSERT RLS policy.
-- The previous FOR ALL policy only defined USING, which does not provide
-- a WITH CHECK condition for INSERT operations.
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.work_schedules;

CREATE POLICY "Admins can manage schedules"
ON public.work_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
