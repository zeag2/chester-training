-- PalDex: one-tap daily logs (fed, scooped, played, the daily health check) are care items of kind 'daily'.
-- Until this is run, the app keeps them on the phone that logged them and syncs everything else. Safe to run again.
alter table public.care drop constraint if exists care_kind_check;
alter table public.care add constraint care_kind_check check (kind in ('food', 'vet', 'symptom', 'weight', 'groom', 'med', 'doc', 'daily'));
