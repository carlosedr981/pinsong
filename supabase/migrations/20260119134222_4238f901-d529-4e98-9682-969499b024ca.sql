-- Create storage bucket for ticket images
INSERT INTO storage.buckets (id, name, public)
VALUES ('ticket-images', 'ticket-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload ticket images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-images');

-- Allow anyone to view ticket images (since bucket is public)
CREATE POLICY "Anyone can view ticket images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'ticket-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own ticket images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ticket-images' AND auth.uid()::text = (storage.foldername(name))[1]);