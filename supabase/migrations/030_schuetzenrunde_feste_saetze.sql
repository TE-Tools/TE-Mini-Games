-- Schützenrunde online: feste Sätze statt freiem Chat (07.11.2026).
--
-- Ein freier Chat zwischen Fremden verlangt im Play Store Melden,
-- Blockieren und Moderation. Seit diesem Stand wählt man am Tag einen von
-- festen Sätzen (src/pages/play/schuetzenrunde/festeSaetze.ts) -- und der
-- Server nimmt auch nur diese an. Sonst könnte ein selbstgebauter Client
-- weiter frei schreiben.
--
-- Die Sätze sind die deutschen aus src/i18n/texte/de.ts
-- (schuetzenrunde.aussagen); %s steht für den Namen eines Mitspielers.
-- tests/schuetzenrunde-feste-saetze.test.ts prüft, dass beide gleich sind.
-- Wer dort einen Satz ändert, ändert ihn hier mit.
--
-- Mehrfach ausführbar (create or replace). Ändert keine Tabelle.

create or replace function public.sr_say(p_match uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.sr_matches;
  p public.sr_players;
  v_text text := trim(coalesce(p_text, ''));
  v_erlaubt boolean := false;
  ohne_namen text[] := array[
    'Ich war die ganze Nacht am Schießstand, ehrlich.',
    'Ihr rennt in die falsche Richtung – ich gehöre zur Bruderschaft.',
    'Wenn ihr mich rauswerft, habt ihr morgen den Salat.',
    'Ich bin seit dreißig Jahren im Zug, das könnt ihr nachlesen.',
    'Ich bin unschuldig.',
    'Ich weiß es noch nicht.',
    'Da stimme ich zu.',
    'Das glaube ich nicht.',
    'Lasst uns abstimmen.',
    'Nicht so schnell – wir sollten nichts überstürzen.'
  ];
  mit_namen text[] := array[
    'Ich traue %s nicht.',
    '%s hat sich gestern merkwürdig verhalten.',
    'Schaut euch %s an – zu ruhig für meinen Geschmack.',
    'Für mich sieht %s nach Sabotage aus.',
    'Ich habe %s heute Nacht draußen gehört.',
    '%s redet viel und sagt nichts.',
    'Ich vertraue %s.',
    '%s ist sauber, da bin ich sicher.'
  ];
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  select * into m from public.sr_matches where id = p_match;
  select * into p from public.sr_players where match_id = p_match and user_id = auth.uid();
  if p.seat is null then raise exception 'Du spielst hier nicht mit'; end if;
  if not p.alive then raise exception 'Ausgeschiedene reden nicht mehr mit'; end if;
  if length(v_text) = 0 then return; end if;

  v_erlaubt := v_text = any (ohne_namen)
    or exists (
      select 1
      from unnest(mit_namen) as vorlage,
           public.sr_players andere
      where andere.match_id = p_match
        and andere.seat <> p.seat
        and replace(vorlage, '%s', andere.name) = v_text
    );
  if not v_erlaubt then
    raise exception 'Am Tag gibt es nur die festen Sätze.';
  end if;

  insert into public.sr_messages (match_id, round, seat, name, is_bot, text)
  values (p_match, m.round, p.seat, p.name, false, v_text);
end;
$$;

grant execute on function public.sr_say(uuid, text) to authenticated;
