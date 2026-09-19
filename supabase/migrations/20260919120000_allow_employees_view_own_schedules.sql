-- Allow each authenticated employee to read only their own schedules.
-- Administrators keep their existing schedule access policies.

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can view own schedules"
ON public.work_schedules;

CREATE POLICY "Employees can view own schedules"
ON public.work_schedules
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid()
);
