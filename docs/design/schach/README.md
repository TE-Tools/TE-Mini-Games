# Schach

Thomas am 19.11.2026: „Bitte neues Spiel Schach gegen PC leicht mittel schwer
oder gegen andere mit Tisch öffnen wie bei den anderen Spielen."

Am 21.11.2026: „Bitte das Schachbrett moderner machen auch die Züge moderner
und der Wechsel von Turm mit König den Sonderzug mit vorsehen. ebenfalls
leicht etwas leichter machen für Anfänger. bitte sehr modernes Design beim
Schachbrett und zügen mit guter enginen." -- und: „ab mittel und schwer soll
es den zurück button nicht mehr geben"

## Wo was steht

| Datei                                       | Inhalt                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `src/games/schach/stellung.ts`              | Brett (0x88), Zugerzeugung, Ziehen und Zurücknehmen, FEN                 |
| `src/games/schach/partie.ts`                | Partie als Zugfolge, Notation, alle Arten von Partieende                 |
| `src/games/schach/ki.ts`                    | Der Computer: Suche und Bewertung                                        |
| `src/games/schach/buch.ts`                  | Eröffnungsbuch für mittel und schwer                                     |
| `src/games/schach/config.ts`                | Stufen, Figurenwerte, Punkte -- alle Stellwerte, nur dort                |
| `src/games/schach/rechner.ts`               | Den Computer im Worker fragen, ohne Worker im Faden der Seite            |
| `src/games/schach/online.ts`                | Das Zugbuch nachspielen                                                  |
| `src/games/schach/wertung.ts`               | Was eine Partie an Punkten und XP bringt                                 |
| `src/pages/play/SchachPage.tsx`             | Gegen den Computer; hält Zustand, entscheidet nichts                     |
| `src/pages/play/SchachOnline.tsx`           | Online-Tisch                                                             |
| `src/pages/play/schach/`                    | Brett, Figuren (`Figur.tsx`), Zugliste, Umwandlungswahl, Buchung         |
| `scripts/schach-turnier.mjs`                | Computer gegen eine frühere Fassung aus git, viele Partien               |
| `supabase/migrations/031_schach_online.sql` | Zugbuch online, mit Prüfung in `pruefung/031_schach_online.pruefung.sql` |

## Regeln

Vollständig: Rochade (mit allen Rechteverlusten, auch wenn ein Turm
geschlagen wird), en passant, Umwandlung in jede Figur, Matt, Patt,
50-Züge-Regel, dreifache Wiederholung, zu wenig Material.

Die Rochade geht auf zwei Wegen: König aufs Zielfeld (e1–g1), oder König
antippen und dann den eigenen Turm (e1–h1). Den zweiten Weg nehmen viele
zuerst -- „König und Turm tauschen" ist, wie man den Sonderzug beschreibt.
Ist die Rochade möglich, ist der Turm nach dem Antippen des Königs grün
umrandet, und ein Hinweis unter dem Brett sagt, was zu tun ist
(`zuegeAuf`/`zielFelder` in `partie.ts`).

Die 50-Züge-Regel und die Wiederholung greifen von selbst. Am Brett muss man
sie beanspruchen; in einer App gibt es niemanden, der dafür die Uhr anhält.

Geprüft ist die Zugerzeugung mit **Perft** an sechs Standardstellungen
(Grundstellung, „Kiwipete" mit Rochaden und Fesselungen, en passant ins
Schach, Unterverwandlungen, Schlagen mit Umwandlung, ein Mittelspiel) gegen die bekannten Knotenzahlen. Ein Fehler in der
Zugerzeugung zeigt sich dort fast immer als falsche Zahl.

## Der Computer

Drei Stufen, die sich nicht im Wissen unterscheiden, sondern darin, wie weit
er vorausschaut und wie sehr er sich verschätzen darf (Werte in `config.ts`):

| Stufe  | Tiefe                | Ruhesuche | Verschätzen | Zufallszug | Buch | Zug zurück |
| ------ | -------------------- | --------- | ----------- | ---------- | ---- | ---------- |
| Leicht | 1 Halbzug            | nein      | ±160        | 35 %       | nein | ja         |
| Mittel | 2 Halbzüge           | ja        | ±25         | –          | ja   | nein       |
| Schwer | so tief 1,2 s reicht | ja        | –           | –          | ja   | nein       |

**Die Suche** (seit 21.11.2026): Negamax mit Alpha-Beta als
Hauptvariantensuche, iterative Vertiefung, Verwandlungstabelle über eine
Zobrist-Kennung (`stellung.ts` führt sie beim Ziehen nach), Nullzug,
späte Zugreduktion für ruhige Züge, Killer- und Verlaufstabelle für die
Zugreihenfolge, Schach-Verlängerung, Ruhesuche mit Delta-Schnitt, und
Wiederholungen innerhalb der Suche über die Kennungen der Partie.

**Die Bewertung:** Material und Feldtabellen, Mittel- und Endspiel nach
Figurenzahl gemischt, dazu Doppel-, Einzel- und Freibauern, Läuferpaar,
Türme auf offenen Linien, Bauernschild vor dem König und im gewonnenen
Endspiel die Mattführung (König an den Rand treiben).

**Das Eröffnungsbuch** (`buch.ts`): 35 kurze Hauptvarianten. Mittel und
schwer spielen daraus, solange die Stellung darin vorkommt, und wählen
zwischen den Fortsetzungen per Startwert -- so beginnt nicht jede Partie
gleich. Leicht spielt ohne Buch.

**Gemessen** mit `scripts/schach-turnier.mjs` (je Eröffnung beide Farben,
Buch aus):

- Schwer, neue gegen alte Fassung, 100 ms je Zug: 200 Partien,
  +130 =52 −18, 78 % -- rund **+220 Elo**. Die Suche allein brachte etwa
  +90, die Bewertung den Rest.
- Leicht, neue gegen alte Fassung: 200 Partien, +16 =78 −106, 27,5 % --
  rund **170 Elo schwächer**, also spürbar leichter. Mit den alten
  Stellwerten hätte die bessere Bewertung Leicht sogar etwas stärker
  gemacht (55 %).

Was die Tests von jeder Stufe verlangen (`tests/schach-rechner.test.ts`):

- Jede Stufe setzt ein Matt in einem Zug, und jede nimmt eine hängende Dame
  (Leicht meistens).
- Leicht nimmt eine gedeckte Figur mit der Dame (so verliert man am Anfang
  auch gegen Menschen), Mittel nicht.
- Mittel rechnet einen Schlagabtausch zu Ende, Schwer findet ein Matt in zwei.
- Schwer setzt mit König und Dame gegen König in höchstens 20 Zügen matt.
- Steht er schlechter (Mittel und Schwer), rettet er sich in die dreifache Wiederholung.
- Mittel und Schwer eröffnen aus dem Buch, jede Buchzeile ist legal.

Zufall nur über einen mitgegebenen Startwert: derselbe Startwert, derselbe
Zug. Die Tabelle wird bei jeder Frage geleert, damit das so bleibt. Der
Computer rechnet in einem Web Worker, damit das Brett nicht einfriert;
fehlt der Worker, rechnet die Seite selbst.

**Zug zurück** gibt es nur gegen Leicht -- dort ist es eine Lernhilfe. Ab
Mittel zählt der Zug, den man gemacht hat (`zuruecknehmen` in `config.ts`).

## Online: ein Zugbuch, keine Regel auf dem Server

Wie bei Schützenopoly, nicht wie bei den Kartenspielen: Beim Schach ist
nichts verdeckt und nichts zufällig. Der Server führt nur das Zugbuch --
wer sitzt, wer Weiß hat, wer am Zug ist, die Aktionen der Reihe nach. Einen
Zug anhängen darf nur, wer laut Server dran ist, und der Zug muss die Form
`e2e4` oder `e7e8q` haben. Ob er nach den Regeln geht, prüft jeder Mitspieler
selbst, indem er das Buch durch dieselbe Engine spielt.

Ein Zug, den es nicht geben kann, verliert die Partie -- bei beiden
Mitspielern, weil beide dasselbe Buch durch dieselbe Engine spielen. Der
Sieger meldet das Ende dann auch dem Server, sonst ließe der keine Revanche zu.

Die Farben werden bei der ersten Partie ausgelost und bei jeder Revanche
getauscht. Wer mitten in der Partie über den Zurück-Knopf aufsteht, gibt
auf (nach Rückfrage) -- sonst wartete das Gegenüber auf einen Zug, der nie
kommt.

## Darstellung

**Figuren** sind eigene Vektorgrafiken (`Figur.tsx`): flache Formen aus
Kreisen, Bögen und Kanten auf einem gemeinsamen Sockel, gezeichnet auf
100 × 100. Keine fremde Figurengarnitur und kein Zeichensatz -- bis
21.11.2026 waren es Schriftzeichen (♞), und wie die aussehen, entschied das
Handy. Die Grafik sieht überall gleich aus und braucht keine Datei.

**Brett:** kühles Blaugrau statt Holz, abgerundet, mit weichem Schatten.
Markierungen liegen als halbdurchsichtige Schicht über dem Feld (letzter
Zug und Auswahl in Türkis, Ziele als Punkt, Schlagziele als Ring, der Turm
einer Rochade grün, Schach als roter Schein).

**Ziehen:** Antippen (Figur, dann Ziel) oder mit dem Finger schieben; die
Figur hängt dann etwas über dem Finger, damit man sie sieht. Ein
hereinkommender Zug -- vom Computer, vom Gegenüber, oder ein angetippter
eigener -- gleitet vom Start- aufs Zielfeld, bei der Rochade der Turm mit.
Ein mit dem Finger gezogener Zug gleitet nicht, und Zurücknehmen auch
nicht. Wer „weniger Bewegung" eingestellt hat, sieht keine Animation.

**Zugliste:** die Notation mit kleinen Figuren statt Buchstaben
([Springer]f3 statt Sf3 oder Nf3) -- so braucht sie keine Übersetzung. Der
jüngste Zug ist hervorgehoben. Über und unter dem Brett stehen die Spieler;
wer am Zug ist, leuchtet, daneben die geschlagenen Figuren und der
Materialvorsprung (+3).

## Wer daran weiterarbeitet

- Regeln gehören nach `src/games/schach/`, Stellwerte nach `config.ts`. Die
  Seiten zeigen an, was `zielFelder()` hergibt, und entscheiden nichts.
- In die Migration kommt keine Regel. Das Zugbuch funktioniert gerade
  deshalb, weil der Server nichts vom Schach weiß.
- Wer an der Zugerzeugung etwas ändert, lässt Perft laufen; wer an
  `ziehe`/`nimmZurueck` etwas ändert, auch den Test der Zobrist-Kennung.
- Wer am Computer etwas ändert, misst, statt zu schätzen:
  `node scripts/schach-turnier.mjs main 200 100` -- die Tests prüfen
  Verhalten, nicht Stärke.
