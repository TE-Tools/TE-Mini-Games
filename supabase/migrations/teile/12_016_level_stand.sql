-- 12_016_level_stand.sql
-- Aus 016_level_stand.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

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
