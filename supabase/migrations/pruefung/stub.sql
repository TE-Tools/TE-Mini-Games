-- Was Supabase mitbringt, zum Nachbauen in einem leeren Postgres.
--
-- Die Prüfdateien in diesem Ordner brauchen das Schema `auth`, die Rollen
-- anon/authenticated und eine auth.uid(), die sich umschalten lässt. Die
-- älteren Prüfungen (019-022) tragen das jeweils selbst bei sich; seit
-- den Kartenspielen braucht es auch scripts/pruefe-sql-regeln.mjs, und
-- dreimal dasselbe abzuschreiben ist dreimal die Gelegenheit, es
-- verschieden zu tun.

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);

-- In Supabase liest auth.uid() den angemeldeten Benutzer aus dem Token.
-- Hier tut es eine Sitzungsvariable: So kann eine Prüfung zwischen den
-- Konten hin- und herschalten.
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;

-- Das hier ist nicht Beiwerk, sondern der Punkt: In Supabase darf
-- `authenticated` das Schema `public` benutzen. Ohne diese Zeile ist der
-- Nachbau STRENGER als die Wirklichkeit -- jede Prüfung, ob ein Fremder an
-- eine Funktion herankommt, wäre dann still erfolgreich, weil er schon am
-- Schema scheitert. Postgres gibt `execute` auf neue Funktionen
-- standardmäßig an PUBLIC; genau das muss prüfbar sein.
grant usage on schema public to anon, authenticated;
