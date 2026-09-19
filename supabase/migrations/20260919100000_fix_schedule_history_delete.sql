-- Fix schedule history when deleting a schedule.
-- The deleted work_schedules row no longer exists when an AFTER DELETE
-- trigger inserts the audit record, so schedule_id must be NULL for deletes.

CREATE OR REPLACE FUNCTION public.log_work_schedule_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.work_schedule_history (
      schedule_id,
      action,
      changed_by,
      new_data
    )
    VALUES (
      NEW.id,
      'created',
      auth.uid(),
      to_jsonb(NEW)
    );

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.work_schedule_history (
      schedule_id,
      action,
      changed_by,
      old_data,
      new_data
    )
    VALUES (
      NEW.id,
      CASE
        WHEN OLD.confirmed IS DISTINCT FROM NEW.confirmed
             AND NEW.confirmed = true
        THEN 'confirmed'
        ELSE 'updated'
      END,
      auth.uid(),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );

    RETURN NEW;

  ELSE
    INSERT INTO public.work_schedule_history (
      schedule_id,
      action,
      changed_by,
      old_data
    )
    VALUES (
      NULL,
      'deleted',
      auth.uid(),
      to_jsonb(OLD)
    );

    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS work_schedule_history_trigger
ON public.work_schedules;

CREATE TRIGGER work_schedule_history_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.work_schedules
FOR EACH ROW
EXECUTE FUNCTION public.log_work_schedule_history();
