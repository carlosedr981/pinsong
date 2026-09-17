-- Final cleanup for deployed databases: work_schedules must allow
-- multiple shifts for the same employee/environment/date.
-- The original work_schedules schema did not require a unique rule on
-- employee + environment + date, so remove any remaining UNIQUE rule
-- that represents that old restriction, regardless of its generated name.

DO $$
DECLARE
  item RECORD;
BEGIN
  -- Drop matching UNIQUE constraints by their actual key columns.
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
      'ALTER TABLE public.work_schedules DROP CONSTRAINT %I',
      item.conname
    );
  END LOOP;

  -- Drop any remaining standalone UNIQUE index containing the old key.
  -- This covers custom/generated index names and the older COALESCE
  -- expression index used for NULL environments.
  FOR item IN
    SELECT i.indexrelid::regclass::text AS index_name
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'work_schedules'
      AND i.indisunique
      AND NOT i.indisprimary
      AND pg_get_indexdef(i.indexrelid) ILIKE '%employee_id%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%environment_id%'
      AND pg_get_indexdef(i.indexrelid) ILIKE '%date%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %s', item.index_name);
  END LOOP;
END $$;

-- Keep the normal lookup index used by the application.
CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_date
ON public.work_schedules(employee_id, date);
