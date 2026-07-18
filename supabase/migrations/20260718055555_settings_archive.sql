-- M3 settings: archive (never delete) for config rows. Archived items vanish
-- from the UI but keep their uuid, so historical entry_metric_values /
-- entry_habits rows stay intact and the wellness view still scores old days.

alter table metrics add column archived boolean not null default false;
alter table habits add column archived boolean not null default false;
alter table goals add column archived boolean not null default false;
