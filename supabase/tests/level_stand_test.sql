-- Wo andere Spieler stehen (Migration 016).
--
-- Zwei Dinge muessen stimmen, und beide sind schnell falsch:
--
--  1. Wer keinen Benutzernamen hat, taucht nirgends auf. Der Benutzername ist
--     die Anmeldung zur Rangliste -- ohne ihn spielt man unbeobachtet.
--  2. Die Levelzahl ist die groessere aus gemeldetem Stand und hoechster
--     gespielter Runde. Nimmt man nur eine der beiden Quellen, steht die
--     Karte entweder monatelang leer oder eine Stufe zu tief.
--
--   psql -f supabase/tests/level_stand_test.sql

\set ON_ERROR_STOP on
\pset pager off
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.pruefe(p_name text, p_ok boolean) returns void
language plpgsql as $$
begin
  raise notice '%  %', case when p_ok then 'OK    ' else 'FEHLER' end, p_name;
  if not p_ok then
    perform set_config('test.failed', coalesce(current_setting('test.failed', true), '0')::int + 1 || '', false);
  end if;
end $$;

do $$
declare
  anna uuid := '11111111-1111-1111-1111-111111111111';
  bert uuid := '22222222-2222-2222-2222-222222222222';
  ohne uuid := '33333333-3333-3333-3333-333333333333';
begin
  perform set_config('test.failed', '0', false);

  insert into auth.users (id) values (anna), (bert), (ohne) on conflict do nothing;
  insert into public.profiles (id, username, display_name, total_xp, player_level)
  values (anna, 'anna', 'Anna', 900, 7),
         (bert, 'bert', 'Bert', 300, 3),
         (ohne, null,   'Ohne', 500, 5)
  on conflict (id) do update set username = excluded.username,
    total_xp = excluded.total_xp, player_level = excluded.player_level;

  -- Anna: gemeldeter Stand 12, hoechste gespielte Runde 9 -> 12 gewinnt.
  insert into public.game_results (user_id, game_id, level, score, xp)
  values (anna, 'perfect-second', 9, 800, 90),
         (anna, 'perfect-second', 4, 500, 40);
  insert into public.game_progress (user_id, game_id, current_level, highest_level, total_xp)
  values (anna, 'perfect-second', 13, 12, 130);

  -- Bert: nichts gemeldet, aber gespielt bis 6 -> die Runden tragen die Karte.
  insert into public.game_results (user_id, game_id, level, score, xp)
  values (bert, 'perfect-second', 6, 400, 60),
         (bert, 'kopfrechnen', 2, 200, 20);

  -- Ohne Benutzername: spielt, bleibt aber unsichtbar.
  insert into public.game_results (user_id, game_id, level, score, xp)
  values (ohne, 'perfect-second', 40, 999, 400);
  insert into public.game_progress (user_id, game_id, current_level, highest_level, total_xp)
  values (ohne, 'perfect-second', 41, 40, 400);

  /* ---------------- level_stand ---------------- */

  perform pg_temp.pruefe('Der gemeldete Stand schlaegt die gespielte Runde',
    (select level from public.level_stand where username = 'anna' and game_id = 'perfect-second') = 12);

  perform pg_temp.pruefe('Ohne gemeldeten Stand zaehlt die hoechste Runde',
    (select level from public.level_stand where username = 'bert' and game_id = 'perfect-second') = 6);

  perform pg_temp.pruefe('Wer keinen Benutzernamen hat, taucht nicht auf',
    not exists (select 1 from public.level_stand where username is null)
    and (select count(*) from public.level_stand where game_id = 'perfect-second') = 2);

  perform pg_temp.pruefe('Je Spieler und Spiel genau eine Zeile',
    (select count(*) from public.level_stand where username = 'anna' and game_id = 'perfect-second') = 1);

  perform pg_temp.pruefe('Spiele werden auseinandergehalten',
    (select level from public.level_stand where username = 'bert' and game_id = 'kopfrechnen') = 2);

  perform pg_temp.pruefe('Wer ein Spiel nie gespielt hat, steht dort auch nicht',
    not exists (select 1 from public.level_stand where username = 'anna' and game_id = 'kopfrechnen'));

  /* ---------------- Ranglisten ---------------- */

  perform pg_temp.pruefe('Rangliste je Spiel nennt das hoechste gespielte Level',
    (select highest_level from public.leaderboard_xp_total
      where username = 'anna' and game_id = 'perfect-second') = 9);

  perform pg_temp.pruefe('Rangliste je Spiel rechnet weiterhin richtig zusammen',
    (select total_xp from public.leaderboard_xp_total
      where username = 'anna' and game_id = 'perfect-second') = 130);

  perform pg_temp.pruefe('Gesamtrangliste nennt das Spielerlevel',
    (select player_level from public.leaderboard_overall where username = 'anna') = 7);

  perform pg_temp.pruefe('Gesamtrangliste zaehlt weiterhin alle Spiele',
    (select game_count from public.leaderboard_overall where username = 'bert') = 2);

  perform pg_temp.pruefe('Auch in den Ranglisten bleibt ohne Benutzernamen alles verborgen',
    not exists (select 1 from public.leaderboard_overall where username is null)
    and (select count(*) from public.leaderboard_overall) = 2);

  if current_setting('test.failed')::int > 0 then
    raise exception '% Pruefung(en) fehlgeschlagen', current_setting('test.failed');
  end if;
  raise notice 'ALLE PRUEFUNGEN BESTANDEN';
end $$;
