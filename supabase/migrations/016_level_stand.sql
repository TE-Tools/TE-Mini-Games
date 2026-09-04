-- Wo andere Spieler stehen: auf der Levelkarte und in der Rangliste.
--
-- Thomas am 04.09.2026: "die perfekte Sekunde kann man bei den Leveln Karte
-- sehen wo andere Spieler stehen das waere schoen. und auch in der Rangliste
-- das Level auf dem die stehen".
--
-- Gleiche Privatsphaere-Regel wie bei allen Ranglisten-Views: Sichtbar ist
-- nur, wer sich einen Benutzernamen gegeben hat -- genau damit meldet man
-- sich fuer die Rangliste an. Wer keinen hat, taucht nirgends auf. Nach
-- draussen gehen Benutzername, Spiel und eine Levelzahl, sonst nichts: keine
-- Nutzer-ID, keine einzelne Runde, kein Zeitpunkt.
--
-- WOHER DIE LEVELZAHL KOMMT. Zwei Quellen, es zaehlt die groessere:
--
--   game_progress.highest_level  der gemeldete Stand -- genau, aber erst seit
--                                dem 04.09.2026 ueberhaupt hochgeladen
--                                (bis dahin wurde er nie mitgeschickt).
--   max(game_results.level)      das hoechste je gespielte Level. Liegt seit
--                                jeher vor und traegt die Karte auch fuer
--                                alle, die seit der Reparatur noch nicht
--                                gespielt haben.
--
-- Ohne die zweite Quelle waere die Karte auf Monate hin leer, obwohl die
-- Daten da sind. Ohne die erste bliebe sie eine Spur hinter dem echten Stand
-- zurueck. Zusammen stimmt sie ab sofort.
--
-- ZWEI VIEWS, SONST NICHTS. Anfangs aenderte diese Migration zusaetzlich die
-- bestehenden Ranglisten-Views, damit die Seite die Levelzahl gleich
-- mitgeliefert bekommt. Das war ein Fehler: Die App fragte danach, bevor die
-- Aenderung eingespielt war -- und eine fehlende Spalte laesst PostgREST die
-- ganze Abfrage abweisen, nicht nur die eine Spalte. Ergebnis war eine leere
-- Rangliste statt einer ohne Level (04.09.2026, von Thomas gemeldet).
--
-- Jetzt kommen die Levelzahlen aus eigenen, zusaetzlichen Views. Wer sie noch
-- nicht hat, sieht die Rangliste wie vorher; wer sie hat, sieht die Level
-- dazu. Nichts Bestehendes wird angefasst.
--
-- Gefahrlos mehrfach ausfuehrbar.

create or replace view public.level_stand as
with quellen as (
  select r.user_id, r.game_id, max(r.level) as level
    from public.game_results r
   group by r.user_id, r.game_id
  union all
  select g.user_id, g.game_id, g.highest_level
    from public.game_progress g
)
select
  p.username,
  q.game_id,
  max(q.level)::integer as level
from quellen q
join public.profiles p on p.id = q.user_id
where p.username is not null
group by p.username, q.game_id;

comment on view public.level_stand is
  'Hoechstes erreichtes Level je Spieler und Spiel -- fuer die Levelkarte und die Rangliste. Nur Spieler mit Benutzernamen.';

grant select on public.level_stand to anon, authenticated;


-- Das Spielerlevel je Spieler -- fuer die Gesamtrangliste, wo es kein
-- Spiel-Level gibt. Bewusst eine eigene View statt einer Spalte in
-- level_stand: dort steht eine Zeile je Spiel, das Spielerlevel gaebe es
-- dann vervielfacht.
create or replace view public.spieler_stand as
select p.username, p.player_level::integer as player_level
  from public.profiles p
 where p.username is not null;

comment on view public.spieler_stand is
  'Spielerlevel je Spieler -- fuer die Gesamtrangliste. Nur Spieler mit Benutzernamen.';

grant select on public.spieler_stand to anon, authenticated;
