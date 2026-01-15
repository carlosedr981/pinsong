-- Add payment fields to registros table
ALTER TABLE public.registros 
ADD COLUMN paid boolean NOT NULL DEFAULT false,
ADD COLUMN paid_at timestamp with time zone,
ADD COLUMN paid_by uuid REFERENCES auth.users(id),
ADD COLUMN receipt_url text,
ADD COLUMN value_per_registro numeric(10,2) NOT NULL DEFAULT 50.00;

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
CREATE POLICY "Admins can upload receipts"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update receipts"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'receipts' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone authenticated can view receipts"
ON storage.objects
FOR SELECT
USING (bucket_id = 'receipts');

-- Allow admins to update registros for payment
CREATE POLICY "Admins can update registros for payment"
ON public.registros
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));