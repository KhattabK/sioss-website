-- SIOSS online courses: fixes from the 25 Nov 2026 audit. Run once in the SQL editor (written 25 Nov 2026, not yet applied).
-- 1. Final exam: one attempt at a time per learner (no parallel requests past the 3-a-day limit), unit progress
--    counted only for real units, the certificate name checked on the server (Latin letters, two words or more),
--    and the right course title and lecturer written to the public graduate registry for every course.
-- 2. Unit progress: a learner may record progress only for a unit that exists in a course they own.
-- 3. Visitor counter (public.visitor_count, page_views.entry) kept here so the repository matches the database.

create or replace function public.submit_final_exam(p_course text, p_answers int[], p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  k        public.course_exam_keys%rowtype;
  v_units  int;
  v_done   int;
  v_score  int := 0;
  v_passed boolean;
  v_cert   text;
  v_title  text;
  v_teach  text;
  v_name   text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  i        int;
begin
  if auth.uid() is null or not public.has_course_access(p_course) then
    raise exception 'no access';
  end if;

  -- One submission at a time per learner and course, so the daily attempt limit cannot be raced.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_course));

  select * into k from public.course_exam_keys where course = p_course;
  if not found then raise exception 'no exam'; end if;
  if coalesce(array_length(p_answers, 1), 0) <> array_length(k.answers, 1) then
    raise exception 'answer every question';
  end if;

  select count(*) into v_units from public.course_units where course = p_course and kind = 'unit';
  select count(*) into v_done
    from public.course_progress p
    join public.course_units u on u.course = p.course and u.n = p.n and u.kind = 'unit'
   where p.course = p_course and p.user_id = auth.uid();
  if v_done < v_units then raise exception 'finish all unit quizzes first'; end if;

  -- At most 3 attempts per 24 hours.
  if (select count(*) from public.course_exam_attempts
      where user_id = auth.uid() and course = p_course and created_at > now() - interval '24 hours') >= 3 then
    return json_build_object('error', 'too_many_attempts');
  end if;

  for i in 1 .. array_length(k.answers, 1) loop
    if p_answers[i] = k.answers[i] then v_score := v_score + 1; end if;
  end loop;
  v_passed := v_score >= k.pass;

  insert into public.course_exam_attempts (user_id, course, score, passed)
  values (auth.uid(), p_course, v_score, v_passed);

  if v_passed then
    select cert_no into v_cert from public.course_certificates where user_id = auth.uid() and course = p_course;
    if v_cert is null then
      if v_name !~ '^[A-Za-z][A-Za-z.''-]*( [A-Za-z][A-Za-z.''-]*)+$' or length(v_name) > 80 then
        raise exception 'name required';
      end if;
      v_cert  := 'SIOSS-' || upper(p_course) || '-' || to_char(current_date, 'YYYY') || '-' ||
                 lpad(nextval('public.course_cert_seq')::text, 4, '0');
      v_title := case p_course
                   when 'ffc' then 'Football Fitness Coach (Online)'
                   when 'tac' then 'Football Tactics (Online)'
                   when 'ptd' then 'Personal Trainer Diploma (Online)'
                   when 'cpr' then 'First Aid & CPR (Online)'
                   when 'hrv' then 'HRV Coach (Online)'
                   else p_course end;
      v_teach := case p_course
                   when 'ffc' then 'Fredrik Björs'
                   when 'tac' then 'Alexander Axén'
                   when 'ptd' then 'Fredrik Björs · Haider Sabah'
                   else 'Dr. Abduladeem Al-Awsi' end;
      insert into public.course_certificates (cert_no, user_id, course, name)
      values (v_cert, auth.uid(), p_course, v_name);
      if to_regclass('public.students') is not null then
        execute 'insert into public.students (name, course, date, instructor) values ($1, $2, $3, $4)'
          using v_name, v_title, to_char(current_date, 'MM/DD/YYYY'), v_teach;
      end if;
    end if;
  end if;

  return json_build_object('score', v_score, 'total', array_length(k.answers, 1),
                           'pass', k.pass, 'passed', v_passed, 'cert_no', v_cert);
end;
$$;

revoke all on function public.submit_final_exam(text, int[], text) from public, anon;
grant execute on function public.submit_final_exam(text, int[], text) to authenticated;

drop policy if exists "Users record own progress" on public.course_progress;
create policy "Users record own progress"
  on public.course_progress for insert to authenticated
  with check (user_id = auth.uid() and public.has_course_access(course)
              and exists (select 1 from public.course_units u
                          where u.course = course_progress.course and u.n = course_progress.n and u.kind = 'unit'));

drop policy if exists "Users update own progress" on public.course_progress;
create policy "Users update own progress"
  on public.course_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_course_access(course)
              and exists (select 1 from public.course_units u
                          where u.course = course_progress.course and u.n = course_progress.n and u.kind = 'unit'));

-- Visitor counter (created 25 Nov 2026).
alter table public.page_views add column if not exists entry boolean not null default false;
create or replace function public.visitor_count()
returns json language sql security definer set search_path = public stable as $f$
  select json_build_object(
    'today', (select count(*) from page_views where event = 'view' and entry
              and created_at >= (date_trunc('day', now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad')),
    'total', (select count(*) from page_views where event = 'view' and entry)
           + (select count(*) from page_views where event = 'view' and created_at < '2026-11-26 00:00+00' and not entry
              and (referrer is not null or utm_source is not null))
  );
$f$;
revoke all on function public.visitor_count() from public;
grant execute on function public.visitor_count() to anon, authenticated;
