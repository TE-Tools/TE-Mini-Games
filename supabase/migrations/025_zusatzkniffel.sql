-- Zusatzkniffel: jeder weitere Kniffel bringt 100 Punkte.
--
-- ANLASS (19.10.2026, Thomas): „bei kniffel spiel bitte zusatzkniffel
-- einbauen das dann extra 100 Punkte gibt."
--
-- DIE REGEL. Wer schon 50 im Kniffel-Feld geschrieben hat und noch einmal
-- fünf gleiche würfelt, bekommt 100 Punkte dazu -- und trägt den Wurf
-- zusätzlich in ein freies Feld ein (auch als Streichung). Zwei
-- Bedingungen, und beide zählen:
--
--   * fünf gleiche
--   * im Kniffel-Feld stehen schon die 50
--
-- Steht dort eine 0, ist das Feld gestrichen und es gibt nichts: Der Bonus
-- hängt am geschriebenen Kniffel, nicht am Glück. Und wer gerade seinen
-- ERSTEN Kniffel einträgt, bekommt 50 und keinen Bonus -- deshalb wird der
-- Bonus am Block von VOR dem Eintragen geprüft. Nach dem Schreiben geprüft
-- bekäme schon der erste Kniffel 100 dazu.
--
-- Auf welches Feld der Wurf danach geht, ist für den Bonus gleichgültig.
--
-- WO ER STEHT. Als Schlüssel `zusatzkniffel` im Block -- nicht in einer
-- eigenen Spalte. Der Block ist die eine Stelle, aus der die Punktzahl
-- gerechnet wird, und die Bestenliste archiviert beim Partieende genau
-- ihn (Migration 021, über `kniffel_gesamt`). Ein Bonus, der daneben
-- läge, fehlte dort still. `zusatzkniffel` ist dabei kein Feld, das man
-- aussucht: `kniffel_block_voll` zählt weiter nur die dreizehn, sonst
-- wäre die Partie nie zu Ende.
--
-- ZWEI FASSUNGEN. Wie die ganze Kniffel-Wertung steht das hier und in
-- src/games/kniffel/regeln.ts (`gibtZusatzkniffel`, `mitZusatzkniffel`,
-- `gesamtpunkte`). Wer eine Seite ändert, ändert beide --
-- scripts/pruefe-kniffel-sql.mjs rechnet sie gegeneinander nach.
--
-- Diese Migration ersetzt zwei Funktionen aus 017; sonst bleibt alles.

/* ======================= Die Endsumme ============================= */

/**
 * Muss zu gesamtpunkte() in regeln.ts passen:
 * oben + Bonus + unten + Zusatzkniffel.
 */
create or replace function public.kniffel_gesamt(p_block jsonb)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  with oben as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['einser','zweier','dreier','vierer','fuenfer','sechser']) f
    where p_block ? f
  ),
  unten as (
    select coalesce(sum((p_block ->> f)::int), 0) as summe
    from unnest(array['dreierpasch','viererpasch','fullHouse','kleineStrasse',
                      'grosseStrasse','kniffel','chance']) f
    where p_block ? f
  )
  select oben.summe + case when oben.summe >= 63 then 35 else 0 end + unten.summe
         + coalesce((p_block ->> 'zusatzkniffel')::int, 0)
  from oben, unten;
$$;

/* ==================== Fünf gleiche? =============================== */

/**
 * Sind das fünf gleiche Augen?
 *
 * Eigene Funktion, damit die Bedingung einmal dasteht und nicht in
 * `kniffel_eintragen` zwischen den Zeilen steht. Null Würfel oder eine 0
 * darin (vor dem ersten Wurf) sind keine fünf gleichen.
 */
create or replace function public.kniffel_ist_kniffel(p_wuerfel integer[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(array_length(p_wuerfel, 1), 0) = 5
     and not exists (select 1 from unnest(p_wuerfel) w where w is null or w < 1 or w > 6)
     and (select count(distinct w) from unnest(p_wuerfel) w) = 1;
$$;

/* ====================== Eintragen ================================= */

/**
 * Eintragen und den Zug abgeben. Die Punkte rechnet der Server.
 *
 * Gegenüber 017 neu: der Zusatzkniffel. Er wird am Block von vor dem
 * Eintragen geprüft (siehe Kopf dieser Datei).
 */
create or replace function public.kniffel_eintragen(p_match uuid, p_feld text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_match public.kniffel_matches;
  v_platz integer;
  v_block jsonb;
  v_punkte integer;
  v_zusatz integer := 0;
  v_naechster integer;
  v_anzahl integer;
  v_alle_voll boolean;
begin
  select * into v_match from public.kniffel_matches where id = p_match;
  if v_match.id is null then
    raise exception 'Runde nicht gefunden';
  end if;
  if v_match.phase <> 'spiel' then
    raise exception 'Die Runde läuft gerade nicht.';
  end if;
  if v_match.wurf_nummer = 0 then
    raise exception 'Erst würfeln.';
  end if;

  v_platz := public.kniffel_mein_platz(p_match);
  if v_platz is null or v_platz <> v_match.am_zug then
    raise exception 'Du bist nicht am Zug.';
  end if;

  if p_feld not in ('einser','zweier','dreier','vierer','fuenfer','sechser',
                    'dreierpasch','viererpasch','fullHouse','kleineStrasse',
                    'grosseStrasse','kniffel','chance') then
    raise exception 'Dieses Feld gibt es nicht.';
  end if;

  select block into v_block from public.kniffel_players
  where match_id = p_match and seat = v_platz;

  if v_block ? p_feld then
    raise exception 'Dieses Feld ist schon beschrieben.';
  end if;

  v_punkte := public.kniffel_punkte(p_feld, v_match.wuerfel);

  -- Der Zusatzkniffel: fünf gleiche UND die 50 steht schon. Geprüft am
  -- Block von vor dem Eintragen -- der erste Kniffel bekommt keinen Bonus.
  if public.kniffel_ist_kniffel(v_match.wuerfel)
     and coalesce((v_block ->> 'kniffel')::int, -1) = 50 then
    v_zusatz := 100;
  end if;

  update public.kniffel_players
  set block = v_block
              || jsonb_build_object(p_feld, v_punkte)
              || case when v_zusatz > 0
                      then jsonb_build_object('zusatzkniffel',
                             coalesce((v_block ->> 'zusatzkniffel')::int, 0) + v_zusatz)
                      else '{}'::jsonb end
  where match_id = p_match and seat = v_platz;

  -- Sind alle Blöcke voll, ist die Partie vorbei. `zusatzkniffel` zählt
  -- dabei nicht mit: kniffel_block_voll kennt nur die dreizehn Felder.
  select bool_and(public.kniffel_block_voll(block)) into v_alle_voll
  from public.kniffel_players where match_id = p_match;

  if v_alle_voll then
    update public.kniffel_matches set phase = 'ende' where id = p_match;
    perform public.kniffel_touch(p_match);
    return;
  end if;

  -- Weiter zum Nächsten, der noch ein freies Feld hat.
  select count(*) into v_anzahl from public.kniffel_players where match_id = p_match;
  v_naechster := v_match.am_zug;
  for i in 1..v_anzahl loop
    v_naechster := (v_naechster % v_anzahl) + 1;
    exit when not public.kniffel_block_voll(
      (select block from public.kniffel_players where match_id = p_match and seat = v_naechster)
    );
  end loop;

  update public.kniffel_matches
  set am_zug = v_naechster,
      runde = case when v_naechster <= v_match.am_zug then v_match.runde + 1 else v_match.runde end,
      wuerfel = '{0,0,0,0,0}',
      gehalten = '{false,false,false,false,false}',
      wurf_nummer = 0
  where id = p_match;

  perform public.kniffel_touch(p_match);
end;
$$;

/* =========================== Rechte ============================== */

-- Innerer Helfer: nicht von aussen aufrufbar (Postgres gibt `execute`
-- sonst an PUBLIC). Siehe die Rechte-Abschnitte in 023/024.
revoke all on function public.kniffel_ist_kniffel(integer[]) from public, anon, authenticated;

grant execute on function public.kniffel_eintragen(uuid, text) to authenticated;
