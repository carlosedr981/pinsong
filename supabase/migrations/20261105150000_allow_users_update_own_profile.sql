-- Allow each authenticated user to update only their own profile row.
-- This policy is intentionally limited by auth.uid() = id.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
