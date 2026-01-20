-- Allow global admins to delete any ticket
CREATE POLICY "Global admins can delete any ticket" 
ON public.tickets 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin' 
  AND user_roles.environment_id IS NULL
));

-- Allow environment admins to delete environment tickets
CREATE POLICY "Environment admins can delete environment tickets" 
ON public.tickets 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = 'admin' 
  AND ur.environment_id = tickets.environment_id
));

-- Allow global admins to delete any ticket messages
CREATE POLICY "Global admins can delete messages" 
ON public.ticket_messages 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin' 
  AND user_roles.environment_id IS NULL
));

-- Allow environment admins to delete environment ticket messages
CREATE POLICY "Environment admins can delete environment messages" 
ON public.ticket_messages 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM tickets t
  JOIN user_roles ur ON ur.environment_id = t.environment_id
  WHERE t.id = ticket_messages.ticket_id 
  AND ur.user_id = auth.uid() 
  AND ur.role = 'admin'
));