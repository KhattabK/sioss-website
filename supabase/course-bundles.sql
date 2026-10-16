-- Course bundles (run once in Supabase SQL Editor, after course-schema.sql).
-- A buyer of the Personal Trainer Diploma (ptd) also gets the First Aid & CPR course (cpr) free.
-- Buying cpr alone still costs its own price. Removing a ptd access row removes the free cpr too.

create or replace function public.has_course_access(p_course text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin() or exists (
    select 1 from public.course_access a
    where (a.course = p_course or (p_course = 'cpr' and a.course = 'ptd'))
      and (a.user_id = auth.uid() or a.email = lower(auth.jwt() ->> 'email'))
  );
$$;
