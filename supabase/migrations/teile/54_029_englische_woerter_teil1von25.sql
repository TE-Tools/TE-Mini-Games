-- 54_029_englische_woerter_teil1von25.sql
-- Aus 029_englische_woerter.sql. Nacheinander einfuegen, Reihenfolge der Dateinamen.
-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --
-- die Begruendungen stehen in der Ursprungsdatei.

insert into public.fdi_categories (id, label) values
  ('en-tiere', 'Animals'),
  ('en-essen', 'Food & Drink'),
  ('en-berufe', 'Jobs'),
  ('en-sport', 'Sports'),
  ('en-reisen', 'Travel & Places'),
  ('en-technik', 'Technology'),
  ('en-filme', 'Films & TV'),
  ('en-musik', 'Music'),
  ('en-schule', 'School'),
  ('en-haus', 'Home'),
  ('en-natur', 'Nature & Weather'),
  ('en-koerper', 'Body & Health'),
  ('en-kleidung', 'Clothes'),
  ('en-fahrzeuge', 'Vehicles'),
  ('en-spiele', 'Games & Hobbies'),
  ('en-feiertage', 'Holidays & Celebrations'),
  ('en-gefuehle', 'Feelings'),
  ('en-stadt', 'Town & City'),
  ('en-maerchen', 'Fairy Tales & Fantasy'),
  ('en-beruehmt', 'Famous People')
on conflict (id) do update set label = excluded.label;
