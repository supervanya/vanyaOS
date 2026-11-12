-- M5: one day, two halves (ARCHITECTURE.md "One day, two halves").
--
-- A day is still one `entries` row. The morning half is `intention` plus the
-- values of metrics whose `timing` is 'morning'; the evening half is
-- `reflection`, `intention_lived`, the evening metric values and the habit
-- checks. Each half saves through its own function, and each filters
-- `metric_values` by `metrics.timing` here in SQL, so a stale client can't make
-- one half clear the other's sliders.

-- When a metric is asked. Every existing metric is an evening one.
alter table public.metrics
  add column timing text not null default 'evening'
    check (timing in ('morning', 'evening'));

-- The morning's intention, and the evening's verdict on it (null = not rated).
alter table public.entries
  add column intention text not null default '',
  add column intention_lived text
    check (intention_lived in ('no', 'partly', 'yes'));

-- ---------------------------------------------------------------------------
-- save_day: the evening half. Gains `intention_lived` and now writes only
-- evening-timed metric values; it never touches `intention`. The signature
-- changes, so the old function is dropped rather than left as an overload.
-- ---------------------------------------------------------------------------

drop function public.save_day(date, text, text, jsonb, jsonb);

create function public.save_day(
  entry_date date,
  theme text,
  reflection text,
  -- 'no' | 'partly' | 'yes', or '' (or null) for "not rated yet". The generated
  -- client types make every argument non-null, so the app sends ''. No default
  -- on purpose: a stale client still calling the old signature fails loudly
  -- instead of silently clearing the rating.
  intention_lived text,
  metric_values jsonb,  -- [{ "metric_id": uuid, "value": number | null }]
  habit_checks jsonb    -- [{ "habit_id": uuid, "done": boolean }]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  -- Conflicts name their constraint: a column list would clash with the
  -- parameter of the same name (`entry_date`).
  insert into public.entries (user_id, entry_date, theme, reflection, intention_lived)
  values (
    auth.uid(), save_day.entry_date, save_day.theme, save_day.reflection,
    nullif(save_day.intention_lived, '')
  )
  on conflict on constraint entries_user_id_entry_date_key do update
    set theme = excluded.theme,
        reflection = excluded.reflection,
        intention_lived = excluded.intention_lived
  returning id into saved_id;

  -- A value sent as null clears it — but only for an evening metric, so a
  -- morning slider the evening page doesn't show is left alone.
  delete from public.entry_metric_values ev
  using jsonb_to_recordset(save_day.metric_values) as v(metric_id uuid, value numeric),
        public.metrics m
  where ev.entry_id = saved_id
    and ev.metric_id = v.metric_id
    and v.value is null
    and m.id = v.metric_id
    and m.timing = 'evening';

  insert into public.entry_metric_values (entry_id, metric_id, value)
  select saved_id, v.metric_id, v.value
  from jsonb_to_recordset(save_day.metric_values) as v(metric_id uuid, value numeric)
  join public.metrics m on m.id = v.metric_id and m.timing = 'evening'
  where v.value is not null
  on conflict on constraint entry_metric_values_pkey do update
    set value = excluded.value;

  insert into public.entry_habits (entry_id, habit_id, done)
  select saved_id, h.habit_id, h.done
  from jsonb_to_recordset(save_day.habit_checks) as h(habit_id uuid, done boolean)
  on conflict on constraint entry_habits_pkey do update
    set done = excluded.done;
end;
$$;

-- Functions need their own grant, like tables: only signed-in users save days.
revoke execute on function public.save_day from public, anon;
grant execute on function public.save_day to authenticated;

-- ---------------------------------------------------------------------------
-- save_morning: the morning half. Upserts the day row touching only
-- `intention` (and `theme`, when it creates the row), and writes only
-- morning-timed metric values (null clears one, as in save_day).
--
-- The morning locks once the evening is started: the row has non-blank
-- `reflection`, or `intention_lived` is set, or any evening-timed metric has a
-- value. Habit checks don't count — the dashboard writes them all day. A locked
-- day raises
--
--   SQLSTATE 'MLOCK', message 'morning_locked'
--
-- which PostgREST returns as HTTP 400 with `code: "MLOCK"`; the client should
-- match on that code. The raise rolls back the whole call, so nothing is saved.
-- ---------------------------------------------------------------------------

create function public.save_morning(
  entry_date date,
  theme text,
  intention text,
  metric_values jsonb -- [{ "metric_id": uuid, "value": number | null }]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  -- Lock the day's row first, so an evening save can't land between the
  -- check and the write.
  select e.id into saved_id
  from public.entries e
  where e.user_id = auth.uid() and e.entry_date = save_morning.entry_date
  for update;

  if exists (
    select 1
    from public.entries e
    where e.id = saved_id
      and (
        btrim(e.reflection) <> ''
        or e.intention_lived is not null
        or exists (
          select 1
          from public.entry_metric_values ev
          join public.metrics m on m.id = ev.metric_id
          where ev.entry_id = e.id and m.timing = 'evening'
        )
      )
  ) then
    raise exception 'morning_locked'
      using errcode = 'MLOCK',
            detail = format('The evening of %s is started, so its morning is read-only.',
                            save_morning.entry_date);
  end if;

  insert into public.entries (user_id, entry_date, theme, intention)
  values (auth.uid(), save_morning.entry_date, save_morning.theme, save_morning.intention)
  on conflict on constraint entries_user_id_entry_date_key do update
    set intention = excluded.intention
  returning id into saved_id;

  delete from public.entry_metric_values ev
  using jsonb_to_recordset(save_morning.metric_values) as v(metric_id uuid, value numeric),
        public.metrics m
  where ev.entry_id = saved_id
    and ev.metric_id = v.metric_id
    and v.value is null
    and m.id = v.metric_id
    and m.timing = 'morning';

  insert into public.entry_metric_values (entry_id, metric_id, value)
  select saved_id, v.metric_id, v.value
  from jsonb_to_recordset(save_morning.metric_values) as v(metric_id uuid, value numeric)
  join public.metrics m on m.id = v.metric_id and m.timing = 'morning'
  where v.value is not null
  on conflict on constraint entry_metric_values_pkey do update
    set value = excluded.value;
end;
$$;

revoke execute on function public.save_morning from public, anon;
grant execute on function public.save_morning to authenticated;
