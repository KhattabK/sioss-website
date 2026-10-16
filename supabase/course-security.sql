-- Account-sharing protection for the paid courses (run once in Supabase SQL Editor, after course-schema.sql).
--   1. One active device per learner: signing in on a new device signs the old one out.
--   2. A device log, and a report (for the SQL Editor only) that lists accounts used from many devices.

create table if not exists public.course_devices (
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,
  user_agent text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table if not exists public.course_active_device (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  device_id  text not null,
  claimed_at timestamptz not null default now()
);

-- No policies: the website reaches these tables only through the two functions below.
alter table public.course_devices       enable row level security;
alter table public.course_active_device enable row level security;

-- The learner area calls this when it opens: log the device and make it the active one.
create or replace function public.claim_device(p_device text, p_ua text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or coalesce(length(p_device), 0) not between 8 and 64 then
    return;
  end if;
  insert into public.course_devices (user_id, device_id, user_agent)
  values (auth.uid(), p_device, left(p_ua, 200))
  on conflict (user_id, device_id) do update set last_seen = now(), user_agent = excluded.user_agent;
  insert into public.course_active_device (user_id, device_id)
  values (auth.uid(), p_device)
  on conflict (user_id) do update set device_id = excluded.device_id, claimed_at = now();
end;
$$;

-- The learner area checks this every minute: if another device has claimed the account, it signs out.
create or replace function public.active_device()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select device_id from public.course_active_device where user_id = auth.uid();
$$;

revoke all on function public.claim_device(text, text) from public, anon;
revoke all on function public.active_device() from public, anon;
grant execute on function public.claim_device(text, text) to authenticated;
grant execute on function public.active_device() to authenticated;

-- Report for the course owner. Run in the SQL Editor:
--   select * from public.course_device_report;
-- Accounts at the top used the most devices in the last 30 days.
create or replace view public.course_device_report as
select u.email,
       count(d.device_id)                                           as devices_30_days,
       max(d.last_seen)                                              as last_seen,
       string_agg(distinct a.course, ', ')                           as courses
from public.course_devices d
join auth.users u on u.id = d.user_id
left join public.course_access a on a.user_id = d.user_id or lower(a.email) = lower(u.email)
where d.last_seen > now() - interval '30 days'
group by u.email
order by devices_30_days desc, last_seen desc;

-- The report shows learners' e-mails: keep it away from the website's API roles.
revoke all on public.course_device_report from public, anon, authenticated;

-- To stop an account that is shared (example):
--   delete from public.course_access where lower(email) = lower('person@example.com');
