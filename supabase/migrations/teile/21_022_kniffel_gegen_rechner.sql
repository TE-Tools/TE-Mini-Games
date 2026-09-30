-- 21_022_kniffel_gegen_rechner.sql
-- Aus 022_kniffel_gegen_rechner.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

alter table public.kniffel_ergebnisse
  add column if not exists gegen_computer boolean not null default false;

alter table public.kniffel_ergebnisse
  add column if not exists ki_stufe text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'kniffel_ergebnisse_ki_stufe_check'
  ) then
    alter table public.kniffel_ergebnisse
      add constraint kniffel_ergebnisse_ki_stufe_check
      check (ki_stufe is null or ki_stufe in ('leicht', 'normal', 'schwer'));
  end if;
end $$;

create index if not exists kniffel_ergebnisse_quelle_idx
  on public.kniffel_ergebnisse (gegen_computer);

create or replace function public.kniffel_melde_solo(
  p_partie uuid,
  p_punkte integer,
  p_bester_gegner integer,
  p_mitspieler integer,
  p_stufe text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  solo_je_tag constant integer := 50;
  v_user uuid := auth.uid();
  v_name text;
  v_heute integer;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  if p_partie is null then return false; end if;

  if coalesce(p_mitspieler, 0) < 2 or p_mitspieler > 6 then return false; end if;

  if p_punkte is null or p_punkte < 0 or p_punkte > 2000 then return false; end if;
  if p_bester_gegner is null or p_bester_gegner < 0 or p_bester_gegner > 2000 then
    return false;
  end if;

  select count(*) into v_heute
    from public.kniffel_ergebnisse
   where user_id = v_user
     and gegen_computer
     and beendet_at > now() - interval '1 day';
  if v_heute >= solo_je_tag then return false; end if;

  select nullif(btrim(coalesce(pr.username, '')), '') into v_name
    from public.profiles pr where pr.id = v_user;

  insert into public.kniffel_ergebnisse
    (match_id, code, user_id, name, punkte, gewonnen, mitspieler, gegen_computer, ki_stufe)
  values (
    p_partie,
    'SOLO',
    v_user,
    coalesce(v_name, 'Spieler'),
    p_punkte,
    p_punkte >= p_bester_gegner,
    p_mitspieler,
    true,
    case when p_stufe in ('leicht', 'normal', 'schwer') then p_stufe else null end
  )
  on conflict (match_id, user_id) do nothing;

  return found;
end;
$$;

grant execute on function public.kniffel_melde_solo(uuid, integer, integer, integer, text)
  to authenticated;

create or replace view public.kniffel_bestenliste as
select
  pr.username,
  count(*) filter (where e.gewonnen)::integer as siege,
  count(*)::integer as partien,
  coalesce(max(e.punkte) filter (where e.gewonnen), 0)::integer as bester_sieg,
  max(e.punkte)::integer as bestes_spiel,
  round(avg(e.punkte))::integer as schnitt,
  max(e.beendet_at) as zuletzt,
  count(*) filter (where e.gewonnen and not e.gegen_computer)::integer as siege_online,
  count(*) filter (where not e.gegen_computer)::integer as partien_online,
  coalesce(max(e.punkte) filter (where e.gewonnen and not e.gegen_computer), 0)::integer
    as bester_sieg_online
from public.kniffel_ergebnisse e
join public.profiles pr on pr.id = e.user_id
where pr.username is not null
group by pr.username;

comment on view public.kniffel_bestenliste is
  'Kniffel-Bestenliste je Spieler: Siege, Partien, bester Sieg -- einmal über alles, einmal nur online.';

grant select on public.kniffel_bestenliste to anon, authenticated;

drop function if exists public.kniffel_meine_partien(integer);

create or replace function public.kniffel_meine_partien(p_limit integer default 10)
returns table (
  code text,
  punkte integer,
  gewonnen boolean,
  mitspieler integer,
  gegen_computer boolean,
  ki_stufe text,
  beendet_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.code, e.punkte, e.gewonnen, e.mitspieler, e.gegen_computer, e.ki_stufe, e.beendet_at
  from public.kniffel_ergebnisse e
  where e.user_id = auth.uid()
  order by e.beendet_at desc
  limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.kniffel_meine_partien(integer) to authenticated;
