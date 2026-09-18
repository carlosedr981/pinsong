-- Allow multiple shifts for the same employee, environment and date.
-- The deployed database currently has this exact partial UNIQUE index:
-- work_schedules_employee_environment_date_unique
-- (employee_id, environment_id, date) WHERE environment_id IS NOT NULL.
-- Different start/end times must be allowed on the same date.

DROP INDEX IF EXISTS public.work_schedules_employee_environment_date_unique;

-- Keep the non-unique lookup index already used by the database.
CREATE INDEX IF NOT EXISTS work_schedules_employee_environment_date_idx
ON public.work_schedules(employee_id, environment_id, date);
