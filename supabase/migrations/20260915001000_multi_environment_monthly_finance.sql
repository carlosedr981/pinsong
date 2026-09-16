-- Employees may belong to multiple environments while retaining a selected active environment.
CREATE TABLE IF NOT EXISTS public.employee_environments (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, environment_id)
);

ALTER TABLE public.employee_environments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their environment assignments"
ON public.employee_environments FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage environment assignments"
ON public.employee_environments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL;

INSERT INTO public.employee_environments (user_id, environment_id)
SELECT id, environment_id
FROM public.profiles
WHERE environment_id IS NOT NULL
ON CONFLICT (user_id, environment_id) DO NOTHING;

UPDATE public.profiles
SET active_environment_id = environment_id
WHERE active_environment_id IS NULL AND environment_id IS NOT NULL;

ALTER TABLE public.registros
ADD COLUMN IF NOT EXISTS environment_id UUID REFERENCES public.environments(id) ON DELETE SET NULL;

ALTER TABLE public.work_schedules
ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_employee_environments_environment
ON public.employee_environments(environment_id);

CREATE INDEX IF NOT EXISTS idx_registros_environment_timestamp
ON public.registros(environment_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_work_schedules_employee_date
ON public.work_schedules(employee_id, date);

-- Populate the environment on every new point from the employee's active selection.
CREATE OR REPLACE FUNCTION public.set_registro_environment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.environment_id IS NULL THEN
    SELECT active_environment_id INTO NEW.environment_id
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_registro_environment_before_insert ON public.registros;
CREATE TRIGGER set_registro_environment_before_insert
BEFORE INSERT ON public.registros
FOR EACH ROW EXECUTE FUNCTION public.set_registro_environment();

-- Keep legacy environment_id useful as the currently selected environment.
CREATE OR REPLACE FUNCTION public.set_active_environment(_environment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employee_environments
    WHERE user_id = auth.uid() AND environment_id = _environment_id
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET active_environment_id = _environment_id,
      environment_id = _environment_id
  WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_environment(UUID) TO authenticated;

-- Global admins can read all financial data; environment admins are scoped to their environment.
CREATE POLICY "Admins can view registros by environment"
ON public.registros FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = user_id
);

-- Schedules are visible to the employee and administrators.
DROP POLICY IF EXISTS "Employees can view own schedules" ON public.work_schedules;
CREATE POLICY "Employees can view own schedules"
ON public.work_schedules FOR SELECT
USING (auth.uid() = employee_id OR has_role(auth.uid(), 'admin'::app_role));

-- Prevent duplicate monthly rows for the same employee/day/environment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_schedule_employee_date_environment
ON public.work_schedules(employee_id, date, COALESCE(environment_id, '00000000-0000-0000-0000-000000000000'::uuid));
