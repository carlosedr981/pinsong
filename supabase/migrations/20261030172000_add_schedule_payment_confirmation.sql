alter table public.work_schedules
  add column if not exists paid_at timestamptz null;

create index if not exists work_schedules_paid_at_idx
  on public.work_schedules (paid_at)
  where paid_at is not null;
