-- 17_020_punkte_ohne_deckel.sql
-- Aus 020_punkte_ohne_deckel.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.game_results'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%score%1000%'
  loop
    execute format('alter table public.game_results drop constraint %I', v_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.game_results'::regclass and conname = 'game_results_score_check'
  ) then
    alter table public.game_results
      add constraint game_results_score_check check (score >= 0 and score <= 1000000);
  end if;
end $$;

do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.personal_records'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%best_score%1000%'
  loop
    execute format('alter table public.personal_records drop constraint %I', v_name);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.personal_records'::regclass
      and conname = 'personal_records_best_score_check'
  ) then
    alter table public.personal_records
      add constraint personal_records_best_score_check
      check (best_score >= 0 and best_score <= 1000000);
  end if;
end $$;

drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000000
    and xp >= 0 and xp <= 20000
    and level >= 1 and level <= 500
  );

drop policy if exists personal_records_insert_own on public.personal_records;
create policy personal_records_insert_own on public.personal_records
  for insert with check (
    auth.uid() = user_id and best_score >= 0 and best_score <= 1000000
  );
