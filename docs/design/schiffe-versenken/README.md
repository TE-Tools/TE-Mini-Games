# Schiffe versenken

**Status:** umgesetzt (gegen den Computer, zu zweit an einem Gerät, online)
**Anlass:** Thomas, 27.11.2026 – „schiffe versenken wirklich ob ein rakete rüber
ins andere feld fliegt und dann entweder eine wasserfontäne hochgeht oder man
eine explosion sieht."

Englischer Name: **Sea Battle**. Nicht „Battleship" – das ist ein Markenname.
Schiffsnamen sind Gattungen (Träger, Kreuzer, Fregatte, Korvette, Schnellboot),
die Zeichnungen eigene Entwürfe; nichts ist einem Handelsprodukt nachgebaut.

## Wo was steht

| Was                                    | Datei                                                    |
| -------------------------------------- | -------------------------------------------------------- |
| Stellwerte, Flotte, Hausregeln, Punkte | `src/games/schiffe-versenken/config.ts`                  |
| Aufstellung prüfen, Zufallsflotte      | `src/games/schiffe-versenken/flotte.ts`                  |
| Partie, Schuss, Sicht                  | `src/games/schiffe-versenken/partie.ts`                  |
| Computer                               | `src/games/schiffe-versenken/ki.ts`                      |
| Server: Flotten halten, Schüsse werten | `supabase/migrations/035_schiffe_versenken_online.sql`   |
| Prüfung der Migration (Rechte, Ablauf) | `supabase/migrations/pruefung/035_…pruefung.sql`         |
| TS gegen SQL                           | `scripts/pruefe-schiffe-sql.mjs`                         |
| Seite, Online-Tisch                    | `src/pages/play/SchiffeVersenken{Page,Online}.tsx`       |
| Meer, Schiffe, Aufstellen, Spielfeld   | `src/pages/play/schiffe/`                                |
| Rakete, Fontäne, Explosion             | `src/pages/play/schiffe/effekte.ts`, `useSchussFolge.ts` |

## Regeln

- Zwei Meere zu 10 × 10. Ein Feld ist `y * 10 + x` (A1 = 0, J10 = 99) – in
  TypeScript und SQL gleich.
- Die Flotte ist Daten (`FLOTTE`): ein Fünfer (Träger), ein Vierer (Kreuzer),
  zwei Dreier (Fregatte, Korvette), ein Zweier (Schnellboot) – 17 Felder. Das
  ist die Verteilung vom Karopapier; mit Abstandsregel bleibt immer Platz.
- Abwechselnd ein Schuss. Ergebnis: **Wasser**, **Treffer** oder **versenkt**
  (jedes Feld des Schiffs getroffen). Bei „versenkt" wird gesagt, welches
  Schiff es war – bei einem bloßen Treffer nicht.
- Wer die ganze fremde Flotte versenkt, gewinnt. Aufgeben geht jederzeit.
- Eine Partie ist ein unveränderlicher Wert; `schiesse` gibt eine neue Partie
  zurück oder `null` (aus, außerhalb, schon beschossen).

### Hausregeln (als Daten, einzeln umschaltbar, die Partie trägt sie mit)

| Schlüssel            | Voreinstellung | Bedeutung                                        |
| -------------------- | -------------- | ------------------------------------------------ |
| `nichtBeruehren`     | an             | Schiffe berühren sich nicht, auch nicht über Eck |
| `nochmalNachTreffer` | aus            | Wer trifft, schießt gleich noch einmal           |

Beim Aufstellen prüft die Engine (`platzFehler`, `flottenFehler`) in fester
Reihenfolge: `flotte` → `ausserhalb` → `ueberlappt` → `beruehrt`. Die
Oberfläche zeigt nur an, was die Engine sagt. Sie beginnt immer mit einer
gültigen Zufallsflotte und nimmt nur gültige Änderungen an; „Fertig" geht
deshalb immer.

## Computer

Er bekommt nur, was ein Mensch an seiner Stelle sähe (`sichtFuer`): seine
Schüsse mit Ergebnis und die versenkten Schiffe. Zufall kommt von außen.

- **leicht:** meist zufällig; nach einem Treffer nur in 45 % der Fälle daneben.
- **mittel:** jagt (Nachbarn, dann die Linie entlang), sucht im
  Schachbrettmuster nach dem kleinsten übrigen Schiff, lässt den Wassergürtel
  um versenkte Schiffe aus.
- **schwer:** Wahrscheinlichkeitskarte über alle Lagen, die die übrigen
  Schiffe noch haben können; offene Treffer gewichten mit `TREFFER_GEWICHT`
  je Treffer.

Gemessen (60 Zufallsflotten, Standardregeln, Schüsse bis alles versenkt):
leicht ≈ 72, mittel ≈ 45, schwer ≈ 39. `tests/schiffe-rechner.test.ts` hält
die Reihenfolge fest. Eine ganze Partie „schwer" rechnet in Millisekunden –
kein Worker nötig.

## Online: der Server hält die Flotten

Bei Schach und Dame führt der Server nur ein Zugbuch, und jeder spielt es
nach. Hier ginge das nicht: Um das Ergebnis eines Schusses selbst
auszurechnen, müsste jeder Client beide Flotten kennen – verdeckt wäre nur
die Anzeige. Deshalb folgt Schiffe versenken den Kartenspielen
(`docs/design/kartenspiele-online/`):

- `sv_flotte_setzen` prüft die Aufstellung nach den Hausregeln des Tisches.
  Bis beide gemeldet haben, sieht jeder nur, **dass** der andere bereit ist.
- `sv_schiessen` prüft, ob man dran ist, rechnet das Ergebnis (`sv_schuss`)
  und gibt den Schuss samt Ergebnis zurück.
- `sv_get_state` gibt jedem **nur seine Sicht** (`sv_sicht`): eigene Flotte,
  Schüsse beider Seiten mit Ergebnis, von der fremden Flotte nur die
  versenkten Schiffe – alle erst nach dem Ende. Die Tabellen sind gesperrt.
- Wer mitten in der Partie den Tisch verlässt, hat aufgegeben (`sv_leave_match`).

Damit stehen die Regeln zweimal da. Die SQL-Regelfunktionen sind rein
(`immutable`, keine Tabelle) und arbeiten auf einem jsonb-Zustand in derselben
Form wie `Partie`. `scripts/pruefe-schiffe-sql.mjs` vergleicht:
`FLOTTE`/`regelnAus`, `flottenFehler` über tausende gültige und verdorbene
Aufstellungen, ganze Partien Schuss für Schuss samt beider Sichten, und
Aufgeben. **Wer eine Regel ändert, ändert beide Seiten und lässt das Skript
laufen.** (Stand 27.11.2026: geschrieben, aber noch nicht gegen ein echtes
Postgres gelaufen – auf dem Entwicklungsrechner gab es keins. Ebenso die
Prüfdatei.)

Die Rakete fliegt online los, bevor der Server geantwortet hat
(`useSchussFolge().vorab`), und schlägt ein, sobald die Antwort da ist. Kommt
keine, verpufft sie, und der Stand wird neu geladen.

## Die Rakete

`effekte.ts` ist ein kleines Partikelsystem auf einer festen Leinwand über der
ganzen Seite (`requestAnimationFrame`, schläft, wenn nichts zu sehen ist).

- **Abschuss:** Mündungsblitz und Rauch auf einem eigenen Schiff, das noch
  schwimmt; gegnerische Raketen kommen von oben über den Bildschirmrand.
- **Flug:** Bogen (quadratische Bézierkurve, seitlich ausholend), Rumpf mit
  roter Spitze und Flossen, flackernde Flamme mit Glut, Rauchspur, Funken.
- **Wasser:** weiße Säule, die in sich zusammenfällt, Tropfen, die zurück ins
  Meer fallen (nicht darunter durch), Gischt, drei Wellenringe. Danach eine
  Boje mit Kringel.
- **Treffer:** Blitz, Druckring, Feuerball (weiß → gelb → rot), Funken,
  drehende Trümmer, Rauch; das Meer wackelt. Danach brennt das Feld
  (CSS-Flammen und Rauchwölkchen).
- **Versenkt:** größere Explosion, dazu Folgeexplosionen auf jedem Feld des
  Schiffs; das Wrack liegt dunkel und raucht. Einblendung „Kreuzer versenkt!".

Das Ergebnis ist vorher entschieden (Engine oder Server); gezeigt wird es erst
beim Einschlag. Solange eine Rakete fliegt, nimmt das Meer nichts an.
Bei `prefers-reduced-motion`, im Sparmodus (`data-sparsam`) und ohne Leinwand
(jsdom) gibt es keine Rakete: kurze Pause, dann das Ergebnis. Töne:
`abschuss`, `platsch`, `knall`, `versenkt` in `src/services/sound.ts`.

Gegen Ruckeln: weiche Kreise als vorgezeichnete Stempel, höchstens zweifache
Pixeldichte, höchstens 900 Partikel.

## Zu zweit an einem Gerät

Aufstellen Spieler 1 → Übergabe → Aufstellen Spieler 2 → Übergabe → Partie.
Wechselt das Recht zu schießen, erscheint nach gut einer Sekunde der
Übergabebildschirm („Gib das Handy an …"), auf dem kein Schiff zu sehen ist.
Wer übernimmt, sieht danach die Raketen, die inzwischen auf sein Meer
geflogen sind. Das Bild zeigt immer nur die Sicht dessen, der gerade schaut.

## Wertung

`partieBuchen.ts` → `saveGameResult` + `processAfterResult` (gegen den
Computer und online). Sieg: leicht 60, mittel 120, schwer 240, online 200.
Niederlage: 10 + 4 je versenktem Schiff. XP = Punkte / 4. Zu zweit wird
nichts gebucht, die Runde zählt über `meldePartyRunde`. Tagesaufgabe: 1 Runde.

## Offen

- SQL-Gegenprüfung und Prüfdatei einmal gegen ein echtes Postgres laufen lassen
  und das Ergebnis hier und in den Dateiköpfen eintragen.
- `ALL_IN_ONE.sql` und `supabase/migrations/teile/` neu erzeugen (mit 035).
- Ein zweites eigenes Meer zum Umschalten (groß/klein) wäre auf Tablets schön.
- Online-Fehlermeldungen vom Server sind deutsch (wie bei allen Online-Spielen).
