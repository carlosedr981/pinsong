-- Allow occasional workers to be scheduled without creating an account.
-- Registered employees keep employee_id; temporary workers use guest_name.
ALTER TABLE public.work_schedules
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

ALTER TABLE public.work_schedules
  DROP CONSTRAINT IF EXISTS work_schedules_employee_or_guest_check;

ALTER TABLE public.work_schedules
  ADD CONSTRAINT work_schedules_employee_or_guest_check
  CHECK (
    (employee_id IS NOT NULL AND guest_name IS NULL)
    OR
    (employee_id IS NULL AND NULLIF(btrim(guest_name), '') IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS work_schedules_guest_name_idx
  ON public.work_schedules (environment_id, date, guest_name)
  WHERE employee_id IS NULL;
