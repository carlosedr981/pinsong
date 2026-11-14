-- Adds a planned payment date to each work schedule.
-- NULL means the payment has not been scheduled. paid_at remains the source of truth for completed payments.
ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS payment_scheduled_for DATE;

COMMENT ON COLUMN public.work_schedules.payment_scheduled_for IS
  'Planned date for payment. A non-null value with paid_at null means AGENDADO; paid_at non-null means PAGO.';
