-- 32_027_imposter_hilfswoerter_teil1von20.sql
-- Aus 027_imposter_hilfswoerter.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

create table if not exists public.fdi_helper (
  category_id text not null,
  word text not null,
  helper text not null,
  primary key (category_id, word, helper)
);

alter table public.fdi_helper enable row level security;
revoke all on public.fdi_helper from public, anon, authenticated;

delete from public.fdi_helper;
