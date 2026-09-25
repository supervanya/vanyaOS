-- Saves a day — its entry row, metric values and habit checks — in one call.
-- A function body runs in one transaction, so a failure part-way rolls the
-- whole day back instead of leaving it half-saved behind a reported success
-- (as the three separate client-side upserts it replaces could).
--
-- Upserts only, like before: values missing from the arguments stay as they
-- are, so history under archived metrics and habits is never deleted.
-- Security invoker, so the caller's RLS policies apply to every write.
create function public.save_day(
  entry_date date,
  theme text,
  reflection text,
  metric_values jsonb, -- [{ "metric_id": uuid, "value": number }]
  habit_checks jsonb   -- [{ "habit_id": uuid, "done": boolean }]
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
  insert into public.entries (user_id, entry_date, theme, reflection)
  values (auth.uid(), save_day.entry_date, save_day.theme, save_day.reflection)
  on conflict on constraint entries_user_id_entry_date_key do update
    set theme = excluded.theme, reflection = excluded.reflection
  returning id into saved_id;

  insert into public.entry_metric_values (entry_id, metric_id, value)
  select saved_id, v.metric_id, v.value
  from jsonb_to_recordset(save_day.metric_values) as v(metric_id uuid, value numeric)
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
