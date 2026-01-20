-- Allow admins to insert registros for any user
CREATE POLICY "Admins can insert registros for any user" 
ON public.registros 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));