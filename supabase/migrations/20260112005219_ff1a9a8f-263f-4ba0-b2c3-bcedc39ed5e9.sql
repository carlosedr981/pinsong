-- Allow admins to delete registros (needed when deleting employees)
CREATE POLICY "Admins can delete registros" 
ON public.registros 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));