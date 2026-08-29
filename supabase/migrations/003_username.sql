-- Unique public usernames for TE-Mini Games
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Spieler'),
    nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username', ''))), '')
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    username = coalesce(excluded.username, public.profiles.username),
    updated_at = now();
  return new;
end;
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where username is not null
      and lower(username) = lower(trim(p_username))
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;
