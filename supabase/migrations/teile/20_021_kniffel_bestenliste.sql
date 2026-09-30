-- 20_021_kniffel_bestenliste.sql
-- Aus 021_kniffel_bestenliste.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.kniffel_ergebnisse (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  code text not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  punkte integer not null check (punkte >= 0 and punkte <= 2000),
  gewonnen boolean not null,
  mitspieler integer not null check (mitspieler >= 1),
  beendet_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create index if not exists kniffel_ergebnisse_user_idx on public.kniffel_ergebnisse (user_id);
create index if not exists kniffel_ergebnisse_zeit_idx on public.kniffel_ergebnisse (beendet_at);

alter table public.kniffel_ergebnisse enable row level security;
revoke all on public.kniffel_ergebnisse from anon, authenticated;

create or replace function public.kniffel_archiviere()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_best integer;
  v_anzahl integer;
begin
  if new.phase <> 'ende' or old.phase is not distinct from 'ende' then
    return new;
  end if;

  select count(*), max(public.kniffel_gesamt(block))
    into v_anzahl, v_best
    from public.kniffel_players where match_id = new.id;

  if v_anzahl is null or v_anzahl = 0 then
    return new;
  end if;

  insert into public.kniffel_ergebnisse
    (match_id, code, user_id, name, punkte, gewonnen, mitspieler)
  select
    new.id,
    new.code,
    p.user_id,
    p.name,
    public.kniffel_gesamt(p.block),
    public.kniffel_gesamt(p.block) = v_best,
    v_anzahl
  from public.kniffel_players p
  where p.match_id = new.id and p.user_id is not null
  on conflict (match_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists kniffel_ende_archiv on public.kniffel_matches;
create trigger kniffel_ende_archiv
  after update of phase on public.kniffel_matches
  for each row
  execute function public.kniffel_archiviere();

create or replace view public.kniffel_bestenliste as
select
  pr.username,
  count(*) filter (where e.gewonnen)::integer as siege,
  count(*)::integer as partien,
  coalesce(max(e.punkte) filter (where e.gewonnen), 0)::integer as bester_sieg,
  max(e.punkte)::integer as bestes_spiel,
  round(avg(e.punkte))::integer as schnitt,
  max(e.beendet_at) as zuletzt
from public.kniffel_ergebnisse e
join public.profiles pr on pr.id = e.user_id
where pr.username is not null
group by pr.username;

comment on view public.kniffel_bestenliste is
  'Kniffel-Bestenliste je Spieler: Siege, Partien, bester Sieg, bestes Spiel, Schnitt.';

grant select on public.kniffel_bestenliste to anon, authenticated;

create or replace function public.kniffel_meine_partien(p_limit integer default 10)
returns table (code text, punkte integer, gewonnen boolean, mitspieler integer, beendet_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.code, e.punkte, e.gewonnen, e.mitspieler, e.beendet_at
  from public.kniffel_ergebnisse e
  where e.user_id = auth.uid()
  order by e.beendet_at desc
  limit greatest(1, least(50, coalesce(p_limit, 10)));
$$;

grant execute on function public.kniffel_meine_partien(integer) to authenticated;
