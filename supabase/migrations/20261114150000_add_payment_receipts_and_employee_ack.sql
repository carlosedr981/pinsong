-- Payment proof and employee acknowledgement.
ALTER TABLE public.work_schedules
  ADD COLUMN IF NOT EXISTS payment_receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by_employee_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf'];

DROP POLICY IF EXISTS "Admins upload payment receipts" ON storage.objects;
CREATE POLICY "Admins upload payment receipts" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.environment_id IS NULL
  )
);

DROP POLICY IF EXISTS "Admins and owners read payment receipts" ON storage.objects;
CREATE POLICY "Admins and owners read payment receipts" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin' AND ur.environment_id IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.work_schedules ws
      WHERE ws.employee_id = auth.uid()
        AND ws.payment_receipt_path = storage.objects.name
        AND ws.paid_at IS NOT NULL
    )
  )
);

CREATE OR REPLACE FUNCTION public.confirm_work_schedule_payment_receipt(p_schedule_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.work_schedules
  SET payment_confirmed_by_employee_at = NOW()
  WHERE id = ANY(p_schedule_ids)
    AND employee_id = auth.uid()
    AND paid_at IS NOT NULL
    AND payment_receipt_path IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum comprovante pendente encontrado para este funcionário.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_work_schedule_payment_receipt(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_work_schedule_payment_receipt(UUID[]) TO authenticated;
