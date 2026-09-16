alter table public.work_schedules
  add column if not exists confirmed boolean not null default false,
  add column if not exists confirmed_at timestamptz null,
  add column if not exists confirmed_by uuid null references public.profiles(id);

create index if not exists work_schedules_confirmed_idx
  on public.work_schedules (date, confirmed);
