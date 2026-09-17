-- Allow an employee to have multiple shifts on the same date/environment.
-- The deployed database may contain the old rule as either a UNIQUE
-- constraint or a unique index, with a generated/custom name.

DO $$
DECLARE
  item RECORD;
BEGIN
  -- Remove a UNIQUE constraint whose key is exactly employee_id,
  -- environment_id and date, regardless of its generated name.
  FOR item IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'work_schedules'
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM pg_attribute a
        WHERE a.attrelid = c.conrelid
          AND a.attnum = ANY(c.conkey)
      ) = ARRAY['date', 'employee_id', 'environment_id']::text[]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.work_schedules DROP CONSTRAINT IF EXISTS %I',
      item.conname
    );
  END LOOP;

  -- Remove a standalone UNIQUE index with the old employee/environment/date
  -- key. This also covers the previous expression index using COALESCE.
  FOR item IN
    SELECT i.indexrelid::regclass::text AS index_name
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'work_schedules'
      AND i.indisunique
      AND i.indexrelid <> t.reltoastrelid
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conindid = i.indexrelid
      )
      AND pg_get_indexdef(i.indexrelid) ILIKE '%employee_id%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%environment_id%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%date%'
      AND pg_get_indexdef(i.indexrelid) NOT ILIKE '%work_schedules_pkey%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %s', item.index_name);
  END LOOP;
END $$;

-- Keep a normal lookup index for employee/date queries.
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_date
ON public.work_schedules(employee_id, date);
