# Dame

Thomas am 26.11.2026: Dame als neues Brettspiel, gegen den Computer, zu zweit
an einem Gerät und „online-fähig usw. wie sonst auch". Englisch: _Checkers_.

Gebaut nach dem Muster von Schach (`docs/design/schach/`): eigenes Modul,
Computer im Worker, Online als Zugbuch ohne Regel auf dem Server.

## Wo was steht

| Datei                                       | Inhalt                                                               |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `src/games/dame/brett.ts`                   | Brett, Stellung, Zugerzeugung (Schlagfolgen), Schreibweise, Perft    |
| `src/games/dame/partie.ts`                  | Partie mit Regeln und Zugfolge, alle Arten von Partieende            |
| `src/games/dame/config.ts`                  | Hausregeln, Remis-Grenzen, Stufen, Bewertung, Punkte -- nur dort     |
| `src/games/dame/ki.ts`                      | Der Computer: Alphabeta mit Ruhesuche über Schlagfolgen              |
| `src/games/dame/rechner.ts`, `ki.worker.ts` | Den Computer im Worker fragen, ohne Worker im Faden der Seite        |
| `src/games/dame/online.ts`                  | Das Zugbuch nachspielen                                              |
| `src/games/dame/wertung.ts`                 | Was eine Partie an Punkten und XP bringt                             |
| `src/pages/play/DamePage.tsx`               | Menü, gegen den Computer, zu zweit; hält Zustand, entscheidet nichts |
| `src/pages/play/DameOnline.tsx`             | Online-Tisch                                                         |
| `src/pages/play/dame/`                      | Brett, Steine (`Stein.tsx`), Antippen (`auswahl.ts`), Tafel, Buchung |
| `src/services/dameOnline.ts`                | Aufrufe an den Server                                                |
| `supabase/migrations/033_dame_online.sql`   | Zugbuch online, Prüfung in `pruefung/033_dame_online.pruefung.sql`   |

## Regeln (deutsche Dame, Voreinstellung)

- 8 × 8, gespielt auf den dunklen Feldern (a1 ist dunkel), je 12 Steine auf den
  drei vorderen Reihen. **Weiß beginnt** und steht unten (Reihen 1–3).
- Steine ziehen ein Feld diagonal vorwärts.
- **Schlagzwang.** Steine schlagen vorwärts und rückwärts. Ein Mehrfachsprung
  ist Pflicht, bis nichts mehr zu schlagen ist. Unter verschiedenen
  Schlagfolgen ist die Wahl frei (kein Mehrheitsschlag).
- Ein Stein, der auf der letzten Reihe **stehen bleibt**, wird Dame. Springt
  er im Schlag nur über die letzte Reihe hinweg und schlägt rückwärts weiter,
  bleibt er Stein.
- Die **Dame fliegt**: Sie zieht und schlägt beliebig weit diagonal und landet
  hinter dem geschlagenen Stein auf einem beliebigen freien Feld -- kann sie
  von einem dieser Felder aus weiterschlagen, muss sie eines davon nehmen
  (sonst ließe sich der Pflicht-Mehrfachsprung umgehen).
- Geschlagene Steine werden erst nach dem ganzen Zug entfernt: Sie versperren
  bis dahin den Weg und dürfen nicht zweimal übersprungen werden.
- **Ende:** Wer nicht ziehen kann (keine Steine mehr oder alle festgesetzt),
  verliert. **Remis:** dreimal dieselbe Stellung mit derselben Seite am Zug;
  25 Züge je Seite (50 Halbzüge) ohne Schlagen und ohne Steinzug; Remis
  vereinbart (online angeboten und angenommen, zu zweit gemeinsam). Aufgeben
  geht immer. Beide Remisregeln greifen von selbst.

Ein Zug ist die ganze Schlagfolge auf einmal und wird so geschrieben:
`c3-d4` (ziehen), `c3xe5xc7` (zweimal schlagen) -- Startfeld und jedes
Landefeld. Das ist eindeutig und braucht keine Übersetzung.

## Hausregeln

Alle vier stehen als Daten in `DameRegeln` (`config.ts`); der Zuggenerator
liest sie, statt Spielarten zu kennen. Im Menü unter „Hausregeln" einzeln
umzulegen, die Wahl bleibt im Gerät (`te-dame-regeln`).

| Regel                      | Voreinstellung | Aus / an                                          |
| -------------------------- | -------------- | ------------------------------------------------- |
| `schlagzwang`              | an             | aus: Schlagen erlaubt, aber frei                  |
| `fliegendeDame`            | an             | aus: Dame zieht und schlägt nur ein Feld          |
| `steinSchlaegtRueckwaerts` | an             | aus: Steine schlagen nur vorwärts                 |
| `mehrheitsschlag`          | aus            | an: die Folge mit den meisten Steinen ist Pflicht |

Eine laufende Partie trägt ihre Regeln im Zustand mit (`Partie.regeln`), auch
im Gerätespeicher und online am Tisch. Wer die Voreinstellung ändert, ändert
keine laufende Partie. Regeln aus unsicherer Quelle liest `regelnAus()`:
Fehlendes bekommt die Voreinstellung, nichts bricht ab.

## Geprüft

`tests/dame-regeln.test.ts`: Zählung aus der Grundstellung (Perft). Mit den
Hausregeln der englischen Spielart (nur vorwärts schlagen, kurze Dame) trifft
die Engine die veröffentlichten Zahlen 7, 49, 302, 1469, 7361, 36768. Für die
deutsche Dame gibt es keine verlässliche Tabelle; die ersten vier Tiefen sind
gleich (vorher kann weder eine Dame entstehen noch ein Stein rückwärts
schlagen). Dazu Einzelstellungen für Schlagzwang, Mehrfachsprung, freie Wahl,
Mehrheitsschlag, fliegende Dame mit Landepflicht, Kreisschlag ohne
Doppelüberspringen, Umwandlung, alle Hausregeln aus, Ende und Remis.

## Der Computer

Negamax mit Alpha-Beta-Schnitt; am Horizont rechnet die Ruhesuche
Schlagfolgen zu Ende (wer schlagen muss, schlägt, bevor bewertet wird).
Bewertung: Material (Stein 100, fliegende Dame 320, kurze Dame 220),
Vorrücken, Mitte, bewachte Grundreihe, und wer vorn liegt, tauscht gern.

| Stufe  | Tiefe                | Ruhesuche | Verschätzen | Zufallszug | Zug zurück |
| ------ | -------------------- | --------- | ----------- | ---------- | ---------- |
| Leicht | 1 Halbzug            | nein      | ±90         | 30 %       | ja         |
| Mittel | 4 Halbzüge           | ja        | ±12         | –          | nein       |
| Schwer | so tief 1,1 s reicht | ja        | –           | –          | nein       |

Einen Sieg in einem Zug lässt keine Stufe liegen. Zufall nur über den
mitgegebenen Startwert -- prüfbar (`tests/dame-rechner.test.ts`: nimmt den
Gewinn mit, stellt auf Mittel keinen Stein ein, sieht den Schlag „einen geben,
zwei bekommen"; Leicht sieht das Zurückschlagen nicht, mit Absicht).
Ein kurzes Turnier beim Bau (schwer mit nur 40 ms Bedenkzeit): schwer schlug
mittel und leicht, mittel schlug leicht, in jeder Farbe.

## Online

Migration `033_dame_online.sql`, genau wie Schach (031): Der Server führt nur
ein Zugbuch -- wer sitzt, wer Weiß hat (beim ersten Start ausgelost, bei der
Revanche getauscht), wer am Zug ist, die Hausregeln des Tisches und die
Aktionen der Reihe nach. **Es steht dort keine Damregel**, und es kommt auch
keine hinein. Der Server prüft von einem Zug nur die Form
(`^[a-h][1-8](-[a-h][1-8]|(x[a-h][1-8]){1,12})$`), von den Hausregeln nur,
dass sie ein kleines JSON-Objekt sind.

Jeder Mitspieler spielt das Buch mit den Regeln des Tisches durch dieselbe
Engine (`standAus`). Ein Zug, der nach den Regeln nicht geht, kostet den, der
ihn geschickt hat, die Partie -- bei allen gleich; der Gewinner schließt die
Partie dann auch beim Server. Raumcode, öffentliche Räume („Offene Spiele"),
Herzschlag, Remisangebot, Aufgeben, Revanche: wie Schach.

Solange Thomas die Migration nicht eingespielt hat, meldet jeder Aufruf über
`onlineFehler.ts` „noch nicht eingerichtet" -- der Tisch zeigt den Satz, die
anderen Modi laufen ohne Netz. Die Stücke fürs Handy liegen als
`teile/84_…` und `85_…` (Platz für 032 davor; nach dem Zusammenführen
`node scripts/build-teile.mjs` laufen lassen, das zählt neu durch).

## Wertung und XP

`wertung.ts`, Zahlen in `config.ts` (`PUNKTE`): Sieg gegen leicht 80, mittel
160, schwer 320, online 240; Remis die Hälfte; Niederlage 10. Zu zweit an einem
Gerät fest 40 und als Ausgang `zuZweit` (weder Sieg noch Niederlage). XP =
Punkte / 4. Gebucht wird über `processAfterResult` (`dame/partieBuchen.ts`),
damit Serie, Tagesaufgaben („Spiel eine Runde Dame") und Abzeichen laufen.

## Optik

Brett in hellem Ahorn und Nussbaum, Steine als eigene Vektorgrafik mit Rand
und Rillen, die Dame als Doppelstein mit goldener Krone. Ziele als Punkte,
schlagpflichtige Steine mit pulsierendem Ring, halb angetippte Schlagfolgen
zeigen ihre Landefelder und die schon übersprungenen Steine. Züge gleiten,
bei Schlagfolgen Sprung für Sprung, geschlagene Steine verblassen;
`prefers-reduced-motion` schaltet beides ab. Kachelfarbe Nussbaum `#7a4419`.
Kein Markenname, keine Nachbildung eines Handelsprodukts.
