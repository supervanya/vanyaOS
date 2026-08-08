-- entry_wellness_scores was created with the default (definer) semantics, so
-- queries through it ran as the view owner and bypassed RLS on the underlying
-- tables, exposing other users' scores. security_invoker makes the view run
-- as the calling user, so the existing RLS policies apply.
alter view public.entry_wellness_scores set (security_invoker = true);
