-- Let a player delete their own data.
--
-- The original policies only covered select/insert/update, so nothing could be
-- removed – not even by the owner. That blocks the "Fortschritt zurücksetzen"
-- button in the app (and any data-deletion request).
drop policy if exists game_results_delete_own on public.game_results;
create policy game_results_delete_own on public.game_results
  for delete using (auth.uid() = user_id);

drop policy if exists personal_records_delete_own on public.personal_records;
create policy personal_records_delete_own on public.personal_records
  for delete using (auth.uid() = user_id);

drop policy if exists game_progress_delete_own on public.game_progress;
create policy game_progress_delete_own on public.game_progress
  for delete using (auth.uid() = user_id);

drop policy if exists user_achievements_delete_own on public.user_achievements;
create policy user_achievements_delete_own on public.user_achievements
  for delete using (auth.uid() = user_id);

drop policy if exists daily_results_delete_own on public.daily_results;
create policy daily_results_delete_own on public.daily_results
  for delete using (auth.uid() = user_id);
