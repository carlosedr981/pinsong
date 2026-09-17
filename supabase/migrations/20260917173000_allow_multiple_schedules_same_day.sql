-- A single employee may have more than one shift on the same day.
-- Example: 07:00-11:00 and 16:00-21:00 in the same environment/date.
-- Remove the old employee + environment + date uniqueness rule while
-- keeping the existing non-unique employee/date index for lookups.

DROP INDEX IF EXISTS public.uq_work_schedule_employee_date_environment;

DO $$
DECLARE
  item RECORD;
BEGIN
  -- Some deployed databases may have the uniqueness created as a table
  -- constraint instead of the migration index. Remove only matching
  -- work_schedules uniqueness rules.
  FOR item IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'work_schedules'
      AND c.contype = 'u'
      AND c.conname ILIKE '%work_schedules%employee%environment%date%unique%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.work_schedules DROP CONSTRAINT IF EXISTS %I',
      item.conname
    );
  END LOOP;

  -- Also handle a deployed unique index whose name differs from the
  -- repository migration name.
  FOR item IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'work_schedules'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%employee_id%'
      AND indexdef ILIKE '%environment_id%'
      AND indexdef ILIKE '%date%'
      AND indexname <> 'work_schedules_pkey'
  LOOP
    EXECUTE format(
      'DROP INDEX IF EXISTS public.%I',
      item.indexname
    );
  END LOOP;
END $$;

-- Keep a normal (non-unique) lookup index for employee/date queries.
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_date
ON public.work_schedules(employee_id, date);
