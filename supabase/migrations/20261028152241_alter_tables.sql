alter table public.candidates
  drop constraint candidates_status_check,
  add constraint candidates_status_check check (status in (
    'submitted',
    'qualified',
    'hired',
    'rejected'
  )),
  add column deleted_at timestamptz;

alter table public.referrals
  add column created_at timestamptz not null default now();
