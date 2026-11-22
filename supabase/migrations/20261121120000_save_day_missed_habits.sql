-- save_day is now sent only the habit checks and metric values that changed,
-- so a value written elsewhere meanwhile (the watch) isn't overwritten with a
-- stale copy. Untouched habits used to be sent as unchecked, which is what made
-- them read as missed in Trends rather than "no entry"; save_day now records
-- that itself, the first time a day gets any habit checks: every active habit
-- gets an unchecked one before the sent checks land. Later saves leave the
-- set alone, so a habit added since isn't a miss on a day before it existed.
-- Otherwise as before.
create or replace function public.save_day(
  entry_date date,
  theme text,
  reflection text,
  intention_lived text, -- 'no' | 'partly' | 'yes', or '' for "not rated yet"
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
  select saved_id, h.id, false
  from public.habits h
  where h.user_id = auth.uid() and not h.archived
    and not exists (select 1 from public.entry_habits e where e.entry_id = saved_id)
  on conflict on constraint entry_habits_pkey do nothing;

  insert into public.entry_habits (entry_id, habit_id, done)
  select saved_id, h.habit_id, h.done
  from jsonb_to_recordset(save_day.habit_checks) as h(habit_id uuid, done boolean)
  on conflict on constraint entry_habits_pkey do update
    set done = excluded.done;
end;
$$;
