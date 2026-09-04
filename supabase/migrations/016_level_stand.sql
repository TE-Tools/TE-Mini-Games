-- Wo andere Spieler stehen: auf der Levelkarte und in der Rangliste.
--
-- Thomas am 04.09.2026: "die perfekte Sekunde kann man bei den Leveln Karte
-- sehen wo andere Spieler stehen das waere schoen. und auch in der Rangliste
-- das Level auf dem die stehen".
--
-- Gleiche Privatsphaere-Regel wie bei allen Ranglisten-Views: Sichtbar ist
-- nur, wer sich einen Benutzernamen gegeben hat -- genau damit meldet man
-- sich fuer die Rangliste an. Wer keinen hat, taucht nirgends auf. Nach
-- draussen gehen Benutzername, Spiel und eine Levelzahl, sonst nichts: keine
-- Nutzer-ID, keine einzelne Runde, kein Zeitpunkt.
--
-- WOHER DIE LEVELZAHL KOMMT. Zwei Quellen, es zaehlt die groessere:
--
--   game_progress.highest_level  der gemeldete Stand -- genau, aber erst seit
--                                dem 04.09.2026 ueberhaupt hochgeladen
--                                (bis dahin wurde er nie mitgeschickt).
--   max(game_results.level)      das hoechste je gespielte Level. Liegt seit
--                                jeher vor und traegt die Karte auch fuer
--                                alle, die seit der Reparatur noch nicht
--                                gespielt haben.
--
-- Ohne die zweite Quelle waere die Karte auf Monate hin leer, obwohl die
-- Daten da sind. Ohne die erste bliebe sie eine Spur hinter dem echten Stand
-- zurueck. Zusammen stimmt sie ab sofort.
--
-- Gefahrlos mehrfach ausfuehrbar.

create or replace view public.level_stand as
with quellen as (
  select r.user_id, r.game_id, max(r.level) as level
    from public.game_results r
   group by r.user_id, r.game_id
  union all
  select g.user_id, g.game_id, g.highest_level
    from public.game_progress g
)
select
  p.username,
  q.game_id,
  max(q.level)::integer as level
from quellen q
join public.profiles p on p.id = q.user_id
where p.username is not null
group by p.username, q.game_id;

comment on view public.level_stand is
  'Hoechstes erreichtes Level je Spieler und Spiel -- fuer die Levelkarte und die Rangliste. Nur Spieler mit Benutzernamen.';

grant select on public.level_stand to anon, authenticated;

-- Die Rangliste je Spiel bekommt dieselbe Zahl gleich mitgeliefert, damit die
-- Seite dafuer keine zweite Abfrage braucht. Neue Spalte am Ende -- so laesst
-- sich die View ersetzen, ohne sie vorher zu loeschen.
create or replace view public.leaderboard_xp_total as
select
  p.username,
  r.game_id,
  sum(r.xp)::integer as total_xp,
  sum(r.score)::integer as total_score,
  count(*)::integer as play_count,
  max(r.created_at) as last_played_at,
  max(r.level)::integer as highest_level
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
group by p.username, r.game_id;

grant select on public.leaderboard_xp_total to anon, authenticated;

-- In der Gesamtrangliste ist das Spielerlevel gemeint, nicht das eines
-- einzelnen Spiels -- ueber alle Spiele hinweg gibt es kein Spiel-Level.
create or replace view public.leaderboard_overall as
select
  p.username,
  sum(r.xp)::integer as total_xp,
  sum(r.score)::integer as total_score,
  count(*)::integer as play_count,
  count(distinct r.game_id)::integer as game_count,
  max(r.created_at) as last_played_at,
  max(p.player_level)::integer as player_level
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
group by p.username;

grant select on public.leaderboard_overall to anon, authenticated;
