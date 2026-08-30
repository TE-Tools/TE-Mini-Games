-- Public leaderboard: best result per player and game, identified by the
-- self-chosen username only.
--
-- The view intentionally runs with the rights of its owner (security definer,
-- the Postgres default for views) so it can read across users – the per-row
-- policies on game_results only ever expose your own rows. Nothing but the
-- username, the game and the score leaves the database: no user id, no e-mail,
-- no profile data. Players without a username never show up.
create or replace view public.leaderboard_top as
select distinct on (p.username, r.game_id)
  p.username,
  r.game_id,
  r.score,
  r.level,
  r.created_at
from public.game_results r
join public.profiles p on p.id = r.user_id
where p.username is not null
order by p.username, r.game_id, r.score desc, r.level desc, r.created_at asc;

comment on view public.leaderboard_top is
  'Best result per player and game for the public leaderboard – username, game, score, level only.';

grant select on public.leaderboard_top to anon, authenticated;
