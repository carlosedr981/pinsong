-- Create table for employee of the day
CREATE TABLE public.employee_of_day (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  environment_id UUID REFERENCES public.environments(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  selected_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, environment_id)
);

-- Enable RLS
ALTER TABLE public.employee_of_day ENABLE ROW LEVEL SECURITY;

-- Policies for employee_of_day
CREATE POLICY "Admins can manage employee of day"
ON public.employee_of_day
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view employee of day for their environment"
ON public.employee_of_day
FOR SELECT
USING (
  environment_id IN (
    SELECT environment_id FROM public.profiles WHERE id = auth.uid()
  )
  OR environment_id IS NULL
);

-- Create table for work schedules
CREATE TABLE public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID REFERENCES public.environments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  shift_type TEXT DEFAULT 'regular',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- Policies for work_schedules
CREATE POLICY "Admins can manage schedules"
ON public.work_schedules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own schedules"
ON public.work_schedules
FOR SELECT
USING (employee_id = auth.uid());

CREATE POLICY "Users can view schedules in their environment"
ON public.work_schedules
FOR SELECT
USING (
  environment_id IN (
    SELECT environment_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_work_schedules_updated_at
BEFORE UPDATE ON public.work_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();