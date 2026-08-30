-- Row Level Security policies
alter table public.profiles enable row level security;
alter table public.game_progress enable row level security;
alter table public.game_results enable row level security;
alter table public.personal_records enable row level security;
alter table public.user_achievements enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.daily_results enable row level security;
alter table public.achievements enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

drop policy if exists game_progress_select_own on public.game_progress;
create policy game_progress_select_own on public.game_progress
  for select using (auth.uid() = user_id);
drop policy if exists game_progress_insert_own on public.game_progress;
create policy game_progress_insert_own on public.game_progress
  for insert with check (auth.uid() = user_id);
drop policy if exists game_progress_update_own on public.game_progress;
create policy game_progress_update_own on public.game_progress
  for update using (auth.uid() = user_id);

drop policy if exists game_results_select_own on public.game_results;
create policy game_results_select_own on public.game_results
  for select using (auth.uid() = user_id);
drop policy if exists game_results_insert_own on public.game_results;
create policy game_results_insert_own on public.game_results
  for insert with check (
    auth.uid() = user_id
    and score >= 0 and score <= 1000
    and xp >= 0 and xp <= 200
    and level >= 1 and level <= 100
  );

drop policy if exists personal_records_select_own on public.personal_records;
create policy personal_records_select_own on public.personal_records
  for select using (auth.uid() = user_id);
drop policy if exists personal_records_insert_own on public.personal_records;
create policy personal_records_insert_own on public.personal_records
  for insert with check (auth.uid() = user_id and best_score >= 0 and best_score <= 1000);
drop policy if exists personal_records_update_own on public.personal_records;
create policy personal_records_update_own on public.personal_records
  for update using (auth.uid() = user_id);

drop policy if exists achievements_select_all on public.achievements;
create policy achievements_select_all on public.achievements
  for select to authenticated using (true);

drop policy if exists user_achievements_select_own on public.user_achievements;
create policy user_achievements_select_own on public.user_achievements
  for select using (auth.uid() = user_id);
drop policy if exists user_achievements_insert_own on public.user_achievements;
create policy user_achievements_insert_own on public.user_achievements
  for insert with check (auth.uid() = user_id);

drop policy if exists daily_challenges_select_auth on public.daily_challenges;
create policy daily_challenges_select_auth on public.daily_challenges
  for select to authenticated using (true);

drop policy if exists daily_results_select_own on public.daily_results;
create policy daily_results_select_own on public.daily_results
  for select using (auth.uid() = user_id);
drop policy if exists daily_results_insert_own on public.daily_results;
create policy daily_results_insert_own on public.daily_results
  for insert with check (auth.uid() = user_id and score >= 0 and score <= 1000);
