CREATE OR REPLACE FUNCTION public.set_schedule_daily_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_rate NUMERIC;
  start_minutes INTEGER;
  end_minutes INTEGER;
  hours NUMERIC;
BEGIN
  IF COALESCE(NEW.daily_rate, 0) > 0 OR NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(hourly_rate, 20) INTO employee_rate
  FROM public.profiles WHERE id = NEW.employee_id;

  start_minutes := EXTRACT(HOUR FROM NEW.start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM NEW.start_time)::INTEGER;
  end_minutes := EXTRACT(HOUR FROM NEW.end_time)::INTEGER * 60 + EXTRACT(MINUTE FROM NEW.end_time)::INTEGER;
  hours := CASE WHEN end_minutes >= start_minutes THEN (end_minutes - start_minutes) / 60.0 ELSE (1440 - start_minutes + end_minutes) / 60.0 END;
  NEW.daily_rate := ROUND(employee_rate * hours, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_schedule_daily_rate_before_write ON public.work_schedules;
CREATE TRIGGER set_schedule_daily_rate_before_write
BEFORE INSERT OR UPDATE ON public.work_schedules
FOR EACH ROW EXECUTE FUNCTION public.set_schedule_daily_rate();

UPDATE public.work_schedules ws
SET daily_rate = ROUND(COALESCE(p.hourly_rate, 20) * CASE
  WHEN EXTRACT(EPOCH FROM (ws.end_time - ws.start_time)) >= 0 THEN EXTRACT(EPOCH FROM (ws.end_time - ws.start_time)) / 3600.0
  ELSE EXTRACT(EPOCH FROM (ws.end_time - ws.start_time + INTERVAL '24 hours')) / 3600.0
END, 2)
FROM public.profiles p
WHERE p.id = ws.employee_id
  AND COALESCE(ws.daily_rate, 0) = 0
  AND ws.start_time IS NOT NULL
  AND ws.end_time IS NOT NULL;
