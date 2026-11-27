# Käsekästchen (englisch „Dots and Boxes")

Thomas am 26.11.2026: Käsekästchen als neue Kachel, gegen den Computer, zu
mehreren an einem Gerät und „online-fähig usw. wie sonst auch".

Vorlage war Schach (`docs/design/schach/`): gleiche Aufteilung in Modul,
Seite, Online-Seite, Dienst und Migration, gleiches Zugbuch-Prinzip.

## Wo was steht

| Datei                                                 | Inhalt                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/games/kaesekaestchen/raster.ts`                  | Geometrie: Punkte, Linien, Kästchen, Nummerierung der Linien                 |
| `src/games/kaesekaestchen/partie.ts`                  | Die Regeln: ziehen, schließen, Extrazug, Ende, Sieger                        |
| `src/games/kaesekaestchen/ki.ts`                      | Der Computer in drei Stufen, rein und mit injizierbarem Zufall               |
| `src/games/kaesekaestchen/rechner.ts`, `ki.worker.ts` | Den Computer im Worker fragen, ohne Worker im Faden der Seite                |
| `src/games/kaesekaestchen/config.ts`                  | Größen, Stufen, Punkte, Denkzeit -- alle Stellwerte, nur dort                |
| `src/games/kaesekaestchen/online.ts`                  | Das Zugbuch nachspielen, falsche Angaben erkennen                            |
| `src/games/kaesekaestchen/wertung.ts`                 | Ausgang, Punkte, XP                                                          |
| `src/pages/play/KaesekaestchenPage.tsx`               | Menü, gegen den Computer, am Gerät; hält Zustand, entscheidet nichts         |
| `src/pages/play/KaesekaestchenOnline.tsx`             | Online-Blatt                                                                 |
| `src/pages/play/kaesekaestchen/`                      | Blatt, Spielerleiste, Farben, Kopf, Buchung                                  |
| `src/services/kaesekaestchenOnline.ts`                | Die Aufrufe an Supabase                                                      |
| `supabase/migrations/032_kaesekaestchen_online.sql`   | Zugbuch online, Prüfung in `pruefung/032_kaesekaestchen_online.pruefung.sql` |

## Regeln

Ein Raster aus Punkten. Wer dran ist, zieht eine freie Linie zwischen zwei
benachbarten Punkten. Schließt sie die vierte Seite eines Kästchens (oder
zweier), gehören sie ihm -- in seiner Farbe mit seiner Initiale -- und er
**muss noch einmal ziehen**. Sonst ist der Nächste dran. Vorbei ist es, wenn
alle Kästchen vergeben sind; die meisten gewinnen, Gleichstand ist möglich.

Größen (Kästchen, nicht Punkte) in `config.ts`: klein 3 × 3, mittel 4 × 4
(Voreinstellung), groß 5 × 5, riesig 6 × 6. Die Engine nimmt 2 bis 8 je
Seite, 2 bis 4 Spieler.

**Die Nummern der Linien stehen online im Zugbuch** (`raster.ts`): erst alle
waagrechten Zeile für Zeile, dann alle senkrechten. Wer die Reihenfolge
ändert, macht jedes laufende Online-Blatt unlesbar.

## Der Computer

Gegen einen Menschen, allein oder zu mehreren: Man spielt gegen einen, zwei
oder drei Computer (`GEGNER` in `config.ts`), alle in derselben Stufe; der
Mensch sitzt auf Platz 0. Er ist rein: gleicher Auftrag,
gleicher Zufall, gleiche Linie. In Tests bekommt er den Zufall von außen
(`waehleLinie(auftrag, zufall)`), sonst einen aus dem Startwert der Partie.

Begriffe: **sicher** ist eine Linie, die keinem Kästchen die dritte Seite
gibt. Eine **Kette** sind Kästchen mit je zwei Seiten, die über ihre freien
Seiten zusammenhängen; ein **Ring** läuft in sich zurück. Wer eine Linie in
einer Kette zieht, schenkt sie dem anderen.

| Stufe  | Nimmt freie Kästchen     | Meidet die dritte Seite | Muss er hergeben … | Ketten zählen, Doppelkreuz |
| ------ | ------------------------ | ----------------------- | ------------------ | -------------------------- |
| Leicht | in 60 %                  | in 35 %                 | irgendeine Linie   | nein                       |
| Mittel | immer                    | immer, solange es geht  | die kürzeste Kette | nein                       |
| Schwer | immer (oder Doppelkreuz) | immer                   | nach Rechnung      | ja                         |

**Schwer** rechnet in drei Lagen:

1. **Es liegt etwas zum Nehmen da.** Er frisst -- die kürzere Seite zuerst,
   damit am Ende eine Kette mit einem Ende übrig bleibt. Bleiben danach keine
   sicheren Linien und lohnt es sich (Wert des Rests > 2, beim Ring > 4),
   lässt er die letzten zwei Kästchen (beim Ring vier) liegen: das
   **Doppelkreuz**. Der andere muss sie nehmen und danach die nächste Kette
   öffnen.
2. **Es gibt sichere Linien.** Sind es höchstens `suchGrenze` (14), rechnet
   er alle Reihenfolgen durch (Negamax mit Merktabelle über die Menge der
   gezogenen sicheren Linien): Wer keine sichere Linie mehr hat, muss öffnen
   und bekommt den negativen Endspielwert. So steuert er darauf hin, dass der
   andere die erste Kette öffnen muss (die „Kettenregel"). Bei mehr sicheren
   Linien zieht er eine beliebige -- so früh entscheidet sich noch nichts.
3. **Er muss etwas öffnen.** Er wählt die Linie, nach der der andere am
   wenigsten herausholt -- mit dem Doppelkreuz gerechnet. Gleich gut nach der
   Rechnung? Dann die, die sofort weniger hergibt.

Der **Endspielwert** (`wert` in `ki.ts`) ist die bekannte Rechnung für ein
Endspiel aus unabhängigen Ketten und Ringen: Der Öffnende wählt die
Komponente, die ihn am wenigsten kostet; der andere nimmt alles und muss
selbst öffnen, oder behält per Doppelkreuz die Kontrolle (Kette: zwei
Kästchen Preis, Ring: vier). Eine Zweierkette öffnet man in der Mitte, dann
gibt es kein Doppelkreuz. Knoten zwischen Ketten (Kästchen mit drei oder vier
freien Seiten) zählt er nicht mit -- dort schätzt er.

Gemessen (`tests/kaesekaestchen-rechner.test.ts`, 4 × 4, je 12 Partien):
schwer gewinnt gegen leicht mindestens 11, gegen mittel mehr als die Hälfte.
Eine ganze 6 × 6-Partie schwer gegen schwer läuft in Vitest in Millisekunden;
der Worker ist für alte Handys da.

**Zu mehreren** bekommt er `spielerZahl` im Auftrag. Die Kettenrechnung gilt
nur zu zweit: Wer die Kontrolle behält, hängt dort an der Reihe der Züge, und
zu dritt schenkt ein Doppelkreuz die Kette nicht dem Gegner, sondern dem
Übernächsten. Ab drei Spielern spielt die schwere Stufe deshalb wie die
mittlere -- nimmt alles, gibt keine dritte Seite her, opfert das Wenigste.
Das Menü sagt das, sobald mehr als ein Computer gewählt ist.

## Online

Migration `032_kaesekaestchen_online.sql`, Tabellen `kaestchen_*`, Muster wie
Schach (031): Sitz 1–4, Raumcode, öffentlich unter „Offene Spiele",
Lebenszeichen, nach 20 Minuten ohne Lebenszeichen weg, Revanche.

Der Server führt **nur ein Zugbuch**: wer am Blatt sitzt, die Sitze beim
Start als Zugreihenfolge (`sitze`), wer anfängt (`beginner`, beim ersten
Start ausgelost, danach reihum), wer laut Buch am Zug ist, und die Linien.
**Es steht dort keine Spielregel, und es kommt auch keine hinein.**

### Wer ist als Nächstes dran?

Beim Schach wechselt der Zug immer, der Server kann ihn selbst weiterreichen.
Hier zieht noch einmal, wer ein Kästchen schließt -- das zu wissen, hieße die
Regel kennen. Drei Wege lagen nahe:

1. **Die Regel in SQL** (wie bei den Kartenspielen): Dann stünde sie zweimal
   da und bräuchte ein Prüfskript wie `pruefe-sql-regeln.mjs`. Bei den Karten
   ist das nötig, weil die Hände verdeckt sind. Hier ist nichts verdeckt.
2. **Der Server prüft gar nicht, wer dran ist**, die Clients ignorieren
   falsche Einträge: Dann könnte jeder das Buch mit Einträgen füllen, und eine
   Linie außer der Reihe käme bis ins Buch.
3. **Der Ziehende meldet den nächsten Sitz mit** -- gewählt.

Der Ziehende schickt `{ art: 'linie', linie, weiter }`. Der Server prüft nur,
was ohne Regel geht: Der Absender ist laut Buch am Zug; die Linie liegt auf
dem Blatt und steht noch nicht im Buch (eindeutiger Index); `weiter` ist ein
Sitz aus `sitze`. Dann bekommt `weiter` den Zug. Was im Buch landet, baut der
Server selbst aus den geprüften Werten -- Zusätze fallen weg.

Ob `weiter` stimmt, prüft jeder Mitspieler beim Nachspielen
(`online.ts`, `wendeAn`). Stimmt es nicht -- oder ist die Linie schon gezogen
--, endet die Partie an dieser Stelle, und der Absender hat verloren; der
falsche Eintrag selbst zählt nicht. Das ist dasselbe wie beim Schach der
unmögliche Zug: Alle spielen dasselbe Buch durch dieselbe Engine und kommen
zum selben Schluss. Wer schummelt, gewinnt damit nichts, er beendet nur die
Partie. Wer nicht schuld ist, schließt sie danach auch beim Server (eine
Aufgabe, die die Engine nach dem Ende nicht mehr beachtet) -- sonst ließe der
keine Revanche zu.

**Aufgeben** beendet die Partie für alle: Wer aufgibt, verliert; unter den
übrigen entscheiden die Kästchen (zu zweit gewinnt also, wer bleibt). Wer
mitten in der Partie das Blatt verlässt, gibt vorher auf. Den Ausgang meldet
der Client mit (`p_ende`), wenn seine Linie das letzte Kästchen schließt.

Solange die Migration nicht eingespielt ist, kommt aus jedem Aufruf die
Meldung „Die Online-Runden sind auf dem Server noch nicht eingerichtet …"
(`onlineFehler.ts`); die Seite zeigt sie an und bricht nicht. Ohne
Supabase-Verbindung fehlt die Online-Karte im Menü ganz (wie bei Schach).

Die Prüfung `pruefung/032_kaesekaestchen_online.pruefung.sql` läuft gegen ein
echtes Postgres (siehe Kopf der Datei). Beim Schreiben am 26.11.2026 stand
keins zur Verfügung -- sie ist noch nicht gelaufen.

## Wertung und XP

`config.ts`, `PUNKTE`: Sieg gegen leicht 60, mittel 120, schwer 240, online
150; mal Größenfaktor (klein 0,75, mittel 1, groß 1,25, riesig 1,5).
Gleichstand ist die Hälfte, eine Niederlage 10. XP = Punkte / 4. Gegen
mehrere Computer gibt es je weiterem ein Viertel mehr (`PUNKTE.mehrGegner`):
Jeder von ihnen nimmt, was man liegen lässt. Im Ergebnis steht `gegnerZahl`.

## Unterbrochene Partie

Gegen den Computer und am Gerät liegt eine laufende Partie im Gerät
(`te-kaesekaestchen-partie`): Modus, Blatt, Namen, Beginner, Startwert und die
Linien in Zugreihenfolge -- nie das Blatt selbst. Beim Laden spielt die Engine
die Linien nach; was sich nicht nachspielen lässt oder schon vorbei ist, gilt
nicht als Spielstand. Im Menü steht dann „Weiterspielen" ganz oben. Gespeichert
wird ab der ersten Linie, gelöscht mit dem Ende oder dem Aufgeben. Online gibt
es das nicht: Dort ist das Zugbuch auf dem Server der Spielstand.

Gebucht wird gegen den Computer und online über `processAfterResult`
(`kaesekaestchen/partieBuchen.ts`), damit XP, Serie, Tagesaufgaben und
Abzeichen laufen wie überall. Im Ergebnis steht `ausgang` -- daran erkennt
die Bilanz im Spielmenü den Sieg. Zu mehreren am Gerät wird nichts gebucht
(wessen Ergebnis wäre es?); die Seite meldet die beendete Partie mit
`meldePartyRunde`, das hält die Serie und zählt für die Tagesaufgaben.
In den Tagesaufgaben steht Käsekästchen mit zwei Runden.

## Aussehen

Kachel und Spielmenü in Fuchsia (`#a21caf`), sonst im Raster nicht vergeben.
Das Blatt ist hell wie Karopapier. Jede Linie ist ein eigener Knopf mit großer
Trefferfläche; gezogene Linien tragen die Farbe dessen, der sie gezogen hat,
die jüngste leuchtet kurz, ein frisch geschlossenes Kästchen springt auf --
beides schweigt bei `prefers-reduced-motion`. Töne über `spiele()`: `tick`
für eine Linie, `muenze` für ein Kästchen, `erfolg`/`niederlage` am Ende.
Kein Markenname, keine Nachbildung eines Handelsprodukts: Käsekästchen ist
ein Schulhofspiel, das Heldenbild ist ein eigener Entwurf (Karopapier, Stift).
