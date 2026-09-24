-- Prüfung der Migration 019 (Schützenopoly online) gegen ein echtes Postgres.
--
-- Warum es das gibt: Die Migration ist die einzige Sperre gegen Mitspieler,
-- die ziehen, wenn sie nicht dran sind, gegen Fremde, die in einen Raum
-- schauen, und gegen Räume, die nie wieder verschwinden. Das lässt sich
-- lesen -- oder ausführen. Ausführen ist besser.
--
-- So läuft sie (braucht kein Supabase, nur postgresql-client und ein
-- Postgres, in das man schreiben darf):
--
--   createdb pruefung
--   psql -d pruefung -v ON_ERROR_STOP=1 -f supabase/migrations/pruefung/019_schuetzenopoly.pruefung.sql
--
-- Die Datei baut sich die Supabase-Teile selbst nach (Schema auth, die
-- Rollen anon/authenticated, auth.uid()), spielt 019 ein und prüft danach
-- der Reihe nach alles, was schiefgehen könnte. Am Ende steht "ALLES DURCH";
-- jede Abweichung bricht mit einer Meldung ab.
--
-- Zuletzt gelaufen: 24.09.2026, Postgres 16, alles grün.

\set ON_ERROR_STOP on
\pset pager off

/* ---------------- Was Supabase mitbringt, hier nachgebaut ---------------- */

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);

-- In Supabase liest auth.uid() den angemeldeten Benutzer aus dem Token.
-- Hier tut es eine Sitzungsvariable: So kann die Prüfung zwischen den
-- Konten hin- und herschalten.
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;

\ir ../019_schuetzenopoly.sql

/* ------------------------------- Die Prüfung ---------------------------- */

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555')
on conflict do nothing;

do $$
declare
  thomas uuid := '11111111-1111-1111-1111-111111111111';
  lena   uuid := '22222222-2222-2222-2222-222222222222';
  kai    uuid := '33333333-3333-3333-3333-333333333333';
  dora   uuid := '44444444-4444-4444-4444-444444444444';
  fremd  uuid := '55555555-5555-5555-5555-555555555555';
  v_m uuid; v_code text; v_stand jsonb; v_nr bigint;
begin
  -- Thomas macht einen öffentlichen Tisch auf.
  perform set_config('test.uid', thomas::text, false);
  select match_id, code into v_m, v_code from public.schopoly_create_match('Thomas');
  perform public.schopoly_set_public(v_m, true);

  -- Lena findet ihn unter den offenen Räumen und setzt sich dazu.
  perform set_config('test.uid', lena::text, false);
  if not exists (
    select 1 from public.schopoly_public_matches()
    where code = v_code and host_name = 'Thomas' and size = 1 and plaetze = 4
  ) then
    raise exception 'FEHLER: Der öffentliche Tisch steht nicht in der Liste';
  end if;
  perform public.schopoly_join_match(v_code, 'Lena');

  perform set_config('test.uid', kai::text, false);
  perform public.schopoly_join_match(v_code, 'Kai');

  -- Starten darf nur der Gastgeber.
  begin
    perform public.schopoly_start(v_m, 20);
    raise exception 'FEHLER: Kai durfte starten';
  exception when others then
    if sqlerrm not like '%Nur wer die Partie%' then raise; end if;
  end;

  -- Wer nicht mitspielt, sieht den Stand nicht.
  perform set_config('test.uid', fremd::text, false);
  begin
    perform public.schopoly_get_state(v_m);
    raise exception 'FEHLER: Ein Fremder konnte den Stand lesen';
  exception when others then
    if sqlerrm not like '%nicht dabei%' then raise; end if;
  end;

  -- Der Gastgeber startet: Jetzt fällt der Startwert -- auf dem Server.
  perform set_config('test.uid', thomas::text, false);
  perform public.schopoly_start(v_m, 20);
  v_stand := public.schopoly_get_state(v_m);
  if (v_stand -> 'match' ->> 'phase') <> 'spiel' then
    raise exception 'FEHLER: Phase ist %', v_stand -> 'match' ->> 'phase';
  end if;
  if (v_stand -> 'match' ->> 'seed') is null then
    raise exception 'FEHLER: Es gibt keinen Startwert';
  end if;

  -- Nach dem Start kommt niemand mehr dazu.
  perform set_config('test.uid', dora::text, false);
  begin
    perform public.schopoly_join_match(v_code, 'Dora');
    raise exception 'FEHLER: Dora kam in die laufende Partie';
  exception when others then
    if sqlerrm not like '%läuft schon%' then raise; end if;
  end;

  -- Wer nicht am Zug ist, schreibt nichts ins Zugbuch.
  perform set_config('test.uid', lena::text, false);
  begin
    perform public.schopoly_aktion(v_m, '{"art":"wuerfeln"}'::jsonb, 1);
    raise exception 'FEHLER: Lena durfte ziehen, obwohl Thomas dran war';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  -- Thomas zieht und gibt weiter.
  perform set_config('test.uid', thomas::text, false);
  perform public.schopoly_aktion(v_m, '{"art":"wuerfeln"}'::jsonb, 1);
  perform public.schopoly_aktion(v_m, '{"art":"ankommen"}'::jsonb, 1);
  perform public.schopoly_aktion(v_m, '{"art":"kaufen"}'::jsonb, 1);
  v_nr := public.schopoly_aktion(v_m, '{"art":"zug_ende"}'::jsonb, 2);
  if v_nr <> 4 then raise exception 'FEHLER: Zugnummer % statt 4', v_nr; end if;

  -- Und danach nicht noch einmal.
  begin
    perform public.schopoly_aktion(v_m, '{"art":"wuerfeln"}'::jsonb, 2);
    raise exception 'FEHLER: Thomas durfte zweimal hintereinander';
  exception when others then
    if sqlerrm not like '%nicht am Zug%' then raise; end if;
  end;

  perform set_config('test.uid', lena::text, false);
  perform public.schopoly_aktion(v_m, '{"art":"wuerfeln"}'::jsonb, 2);

  -- Aufgeben geht immer, auch wenn ein anderer würfelt.
  perform set_config('test.uid', kai::text, false);
  perform public.schopoly_aktion(v_m, '{"art":"aufgeben"}'::jsonb, 2);

  -- Das Zugbuch ist vollständig, und p_ab liefert nur das Neue.
  perform set_config('test.uid', thomas::text, false);
  v_stand := public.schopoly_get_state(v_m);
  if jsonb_array_length(v_stand -> 'zuege') <> 6 then
    raise exception 'FEHLER: % Einträge statt 6', jsonb_array_length(v_stand -> 'zuege');
  end if;
  if jsonb_array_length(public.schopoly_get_state(v_m, 4) -> 'zuege') <> 2 then
    raise exception 'FEHLER: p_ab filtert nicht';
  end if;

  -- Wer geht, verschwindet vom Tisch; der Tisch bleibt.
  perform set_config('test.uid', lena::text, false);
  perform public.schopoly_leave_match(v_m);
  perform set_config('test.uid', thomas::text, false);
  if (public.schopoly_get_state(v_m) -> 'match' ->> 'size')::int <> 2 then
    raise exception 'FEHLER: Lena sitzt noch am Tisch';
  end if;

  -- Ein Tisch, an dem zwanzig Minuten niemand war, wird abgeräumt --
  -- mitsamt Zugbuch (Migration 018 gilt hier genauso).
  update public.schopoly_matches set updated_at = now() - interval '30 minutes' where id = v_m;
  perform public.schopoly_cleanup();
  if exists (select 1 from public.schopoly_matches where id = v_m) then
    raise exception 'FEHLER: Der verwaiste Tisch steht noch';
  end if;
  if exists (select 1 from public.schopoly_zuege where match_id = v_m) then
    raise exception 'FEHLER: Das Zugbuch blieb liegen';
  end if;

  raise notice 'ALLES DURCH';
end $$;
