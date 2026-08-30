-- Level map goes to 500 (docs/design/level-map-500/) and milestone bonuses
-- raise the XP a single result can carry. The old insert check capped level at
-- 100 and XP at 200, which silently rejected every synced result above that.
drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and xp >= 0 and xp <= 20000
    and level >= 1 and level <= 500
  );

-- The profile row is created by the on_auth_user_created trigger, but sign-up
-- and the sync also upsert it from the client – an upsert needs INSERT rights.
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);
