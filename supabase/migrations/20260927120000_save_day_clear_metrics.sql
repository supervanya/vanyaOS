-- Lets save_day clear a metric value: an entry of { "metric_id", "value": null }
-- deletes that day's value instead of upserting it. The client sends null for
-- every active metric left unset, so a slider reset back to "no value" stays
-- reset after a reload. Archived metrics are never sent, so their history is
-- still never deleted.
create or replace function public.save_day(
  entry_date date,
  theme text,
  reflection text,
  metric_values jsonb, -- [{ "metric_id": uuid, "value": number | null }]
  habit_checks jsonb   -- [{ "habit_id": uuid, "done": boolean }]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  insert into public.entries (user_id, entry_date, theme, reflection)
  values (auth.uid(), save_day.entry_date, save_day.theme, save_day.reflection)
  on conflict on constraint entries_user_id_entry_date_key do update
    set theme = excluded.theme, reflection = excluded.reflection
  returning id into saved_id;

  delete from public.entry_metric_values m
  using jsonb_to_recordset(save_day.metric_values) as v(metric_id uuid, value numeric)
  where m.entry_id = saved_id and m.metric_id = v.metric_id and v.value is null;

  insert into public.entry_metric_values (entry_id, metric_id, value)
  select saved_id, v.metric_id, v.value
  from jsonb_to_recordset(save_day.metric_values) as v(metric_id uuid, value numeric)
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
