-- Schedule audit history and reusable schedule templates.

CREATE TABLE IF NOT EXISTS public.work_schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NULL REFERENCES public.work_schedules(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created','updated','deleted','confirmed')),
  changed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_data JSONB,
  new_data JSONB
);
CREATE INDEX IF NOT EXISTS work_schedule_history_schedule_idx ON public.work_schedule_history(schedule_id, changed_at DESC);
ALTER TABLE public.work_schedule_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view schedule history" ON public.work_schedule_history;
CREATE POLICY "Admins can view schedule history" ON public.work_schedule_history FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.log_work_schedule_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.work_schedule_history(schedule_id, action, changed_by, new_data) VALUES (NEW.id, 'created', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.work_schedule_history(schedule_id, action, changed_by, old_data, new_data)
    VALUES (NEW.id, CASE WHEN OLD.confirmed IS DISTINCT FROM NEW.confirmed AND NEW.confirmed = true THEN 'confirmed' ELSE 'updated' END, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.work_schedule_history(schedule_id, action, changed_by, old_data) VALUES (OLD.id, 'deleted', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS work_schedule_history_trigger ON public.work_schedules;
CREATE TRIGGER work_schedule_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.work_schedules FOR EACH ROW EXECUTE FUNCTION public.log_work_schedule_history();
CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, shift_type TEXT NOT NULL DEFAULT 'regular', daily_rate NUMERIC NOT NULL DEFAULT 0, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage schedule templates" ON public.schedule_templates;
CREATE POLICY "Admins can manage schedule templates" ON public.schedule_templates FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS schedule_templates_created_by_idx ON public.schedule_templates(created_by, created_at DESC);
