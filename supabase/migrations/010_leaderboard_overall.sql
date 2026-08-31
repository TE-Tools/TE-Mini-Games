-- Eine Rangliste über ALLE Spiele zusammen, sortiert nach aufaddierten XP.
--
-- Thomas am 31.08.2026: "ich möchte die Rangliste über alle spiele die addiert
-- XP haben!" -- leaderboard_xp_total (Migration 008) gruppiert je Spiel, hier
-- zählt dagegen alles zusammen, was ein Spieler jemals an XP geholt hat, egal
-- in welchem Spiel.
--
-- Gleiche Privatsphäre-Regel wie bei den anderen Ranglisten-Views: nur
-- Username und aggregierte Zahlen, keine Nutzer-ID, keine einzelne Runde.
create or replace view public.leaderboard_overall as
select
  p.username,
  sum(r.xp)::integer as total_xp,
  sum(r.score)::integer as total_score,
  count(*)::integer as play_count,
  count(distinct r.game_id)::integer as game_count,
  max(r.created_at) as last_played_at
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
group by p.username;

comment on view public.leaderboard_overall is
  'Aufaddierte XP und Punkte je Spieler über alle Spiele zusammen -- die spielübergreifende Gesamtrangliste.';

grant select on public.leaderboard_overall to anon, authenticated;
