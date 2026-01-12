-- Allow global admins to delete any profile
CREATE POLICY "Admins can delete any profile" 
ON public.profiles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) AND (SELECT environment_id FROM user_roles WHERE user_id = auth.uid() AND role = 'admin') IS NULL);

-- Allow environment admins to delete profiles in their environment
CREATE POLICY "Environment admins can delete environment profiles" 
ON public.profiles 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
    AND ur.environment_id = profiles.environment_id
));

-- Also delete associated registros when profile is deleted (cascade)
-- And delete user_roles when profile is deleted
CREATE POLICY "Admins can delete user roles" 
ON public.user_roles 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));