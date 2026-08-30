-- Globale Rangliste nach Gesamt-XP statt bestem Einzelergebnis.
--
-- Anlass (30.08.2026): Thomas sah in der globalen Rangliste weiterhin "892"
-- stehen, obwohl er gerade ein neues Level mit XP und Punkten gespielt
-- hatte -- das war korrekt (leaderboard_top zeigt das beste Einzelergebnis,
-- ein niedrigeres neues Ergebnis verdrängt den Rekord nicht), aber nicht,
-- was er wollte: "es soll einfach alle gesammelten XP zusammen gerechnet
-- werden". Diese View summiert deshalb wirklich jede gespeicherte Runde,
-- statt nur die beste zu behalten -- spiegelt lokal getLocalTotalsByGame()
-- (siehe src/services/leaderboard.ts).
--
-- Ersetzt leaderboard_top nicht (bleibt für einen künftigen "beste Runde"-
-- Vergleich nützlich), ergänzt sie um eine zweite, nach Gesamt-XP sortierte
-- View. Gleiche Privatsphäre-Regel wie dort: nur Username, Spiel und
-- aggregierte Zahlen verlassen die Datenbank, keine Nutzer-ID, keine
-- einzelne Runde.
create or replace view public.leaderboard_xp_total as
select
  p.username,
  r.game_id,
  sum(r.xp)::integer as total_xp,
  sum(r.score)::integer as total_score,
  count(*)::integer as play_count,
  max(r.created_at) as last_played_at
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
group by p.username, r.game_id;

comment on view public.leaderboard_xp_total is
  'Aufsummierte XP und Punkte je Spieler und Spiel, über alle jemals gespielten Runden -- für die globale XP-Rangliste.';

grant select on public.leaderboard_xp_total to anon, authenticated;
