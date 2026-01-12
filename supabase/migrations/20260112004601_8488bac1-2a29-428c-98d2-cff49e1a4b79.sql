-- Allow anyone to check if an environment exists by slug (needed for login validation)
CREATE POLICY "Anyone can check environment existence" 
ON public.environments 
FOR SELECT 
USING (true);