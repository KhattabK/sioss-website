-- Cookieless visit log for www.sioss.se (course project). Run once in the SQL editor.
-- The site may only append rows; nobody can read them with the public key, only the dashboard.
create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  event        text not null default 'view' check (event in ('view', 'buy_click')),
  path         text not null check (char_length(path) <= 200),
  referrer     text check (char_length(referrer) <= 120),
  utm_source   text check (char_length(utm_source) <= 60),
  utm_campaign text check (char_length(utm_campaign) <= 60),
  lang         text check (char_length(lang) <= 10),
  device       text check (device in ('mobile', 'desktop'))
);
create index if not exists page_views_created_at on public.page_views (created_at desc);

alter table public.page_views enable row level security;
drop policy if exists "site appends visits" on public.page_views;
create policy "site appends visits" on public.page_views for insert to anon, authenticated with check (true);
revoke select, update, delete on public.page_views from anon, authenticated;

-- Report: visits and pay-button clicks per page and source over the last 30 days.
create or replace view public.page_views_report with (security_invoker = true) as
select path,
       coalesce(utm_source, referrer, 'direct') as source,
       count(*) filter (where event = 'view')      as views,
       count(*) filter (where event = 'buy_click') as buy_clicks,
       count(*) filter (where event = 'view' and device = 'mobile') as mobile_views
from public.page_views
where created_at > now() - interval '30 days'
group by 1, 2
order by views desc;
revoke all on public.page_views_report from anon, authenticated;
