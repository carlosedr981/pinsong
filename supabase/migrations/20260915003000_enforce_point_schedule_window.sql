CREATE OR REPLACE FUNCTION public.validate_registro_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  local_now TIMESTAMP;
  schedule_row RECORD;
  punches_today INTEGER;
  start_minutes INTEGER;
  end_minutes INTEGER;
  current_minutes INTEGER;
  allowed_from INTEGER;
  allowed_until INTEGER;
BEGIN
  -- Administrative/manual registrations are not subject to the employee time window.
  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  local_now := current_timestamp AT TIME ZONE 'America/Sao_Paulo';
  SELECT * INTO schedule_row
  FROM public.work_schedules
  WHERE employee_id = NEW.user_id
    AND date = local_now::date
  ORDER BY created_at DESC
  LIMIT 1;

  IF schedule_row.id IS NULL OR schedule_row.start_time IS NULL OR schedule_row.end_time IS NULL THEN
    RAISE EXCEPTION 'Não há escala configurada para hoje';
  END IF;

  start_minutes := EXTRACT(HOUR FROM schedule_row.start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM schedule_row.start_time)::INTEGER;
  end_minutes := EXTRACT(HOUR FROM schedule_row.end_time)::INTEGER * 60 + EXTRACT(MINUTE FROM schedule_row.end_time)::INTEGER;
  current_minutes := EXTRACT(HOUR FROM local_now)::INTEGER * 60 + EXTRACT(MINUTE FROM local_now)::INTEGER;
  allowed_from := GREATEST(0, start_minutes - 10);
  allowed_until := end_minutes;

  IF current_minutes < allowed_from OR current_minutes > allowed_until THEN
    RAISE EXCEPTION 'Registro fora do horário permitido. O ponto é liberado 10 minutos antes da entrada e encerra no horário de saída';
  END IF;

  SELECT COUNT(*) INTO punches_today
  FROM public.registros
  WHERE user_id = NEW.user_id
    AND (timestamp AT TIME ZONE 'America/Sao_Paulo')::date = local_now::date;

  IF punches_today >= 2 THEN
    RAISE EXCEPTION 'Limite de 2 registros diários atingido';
  END IF;

  IF NEW.environment_id IS NULL THEN
    RAISE EXCEPTION 'Selecione um ambiente antes de registrar o ponto';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.employee_environments
    WHERE user_id = NEW.user_id AND environment_id = NEW.environment_id
  ) THEN
    RAISE EXCEPTION 'Ambiente não autorizado para este funcionário';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_registro_schedule_before_insert ON public.registros;
CREATE TRIGGER validate_registro_schedule_before_insert
BEFORE INSERT ON public.registros
FOR EACH ROW EXECUTE FUNCTION public.validate_registro_schedule();
