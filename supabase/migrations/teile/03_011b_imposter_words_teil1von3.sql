-- 03_011b_imposter_words_teil1von3.sql
-- Aus 011b_imposter_words.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

insert into public.fdi_categories (id, label) values
  ('tiere', 'Tiere'),
  ('essen', 'Essen & Trinken'),
  ('berufe', 'Berufe'),
  ('sport', 'Sport'),
  ('reisen', 'Reisen & Orte'),
  ('technik', 'Technik'),
  ('filme', 'Filme & Serien'),
  ('musik', 'Musik'),
  ('schule', 'Schule & Lernen'),
  ('haus', 'Haus & Wohnen'),
  ('natur', 'Natur & Wetter'),
  ('koerper', 'Körper & Gesundheit'),
  ('kleidung', 'Kleidung'),
  ('fahrzeuge', 'Fahrzeuge'),
  ('spiele', 'Spiele & Hobbys'),
  ('feiertage', 'Feiertage & Feste'),
  ('gefuehle', 'Gefühle'),
  ('stadt', 'Stadt & Alltag'),
  ('maerchen', 'Märchen & Fantasie'),
  ('beruehmt', 'Berühmte Personen')
on conflict (id) do update set label = excluded.label;
