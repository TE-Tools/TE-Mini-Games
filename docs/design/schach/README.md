# Schach

Thomas am 19.11.2026: „Bitte neues Spiel Schach gegen PC leicht mittel schwer
oder gegen andere mit Tisch öffnen wie bei den anderen Spielen."

## Wo was steht

| Datei                                       | Inhalt                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `src/games/schach/stellung.ts`              | Brett (0x88), Zugerzeugung, Ziehen und Zurücknehmen, FEN                 |
| `src/games/schach/partie.ts`                | Partie als Zugfolge, Notation, alle Arten von Partieende                 |
| `src/games/schach/ki.ts`                    | Der Computer: Negamax, Alpha-Beta, Ruhesuche, iterative Vertiefung       |
| `src/games/schach/config.ts`                | Stufen, Figurenwerte, Punkte -- alle Stellwerte, nur dort                |
| `src/games/schach/rechner.ts`               | Den Computer im Worker fragen, ohne Worker im Faden der Seite            |
| `src/games/schach/online.ts`                | Das Zugbuch nachspielen                                                  |
| `src/games/schach/wertung.ts`               | Was eine Partie an Punkten und XP bringt                                 |
| `src/pages/play/SchachPage.tsx`             | Gegen den Computer; hält Zustand, entscheidet nichts                     |
| `src/pages/play/SchachOnline.tsx`           | Online-Tisch                                                             |
| `src/pages/play/schach/`                    | Brett, Zugliste, Umwandlungswahl, Buchung                                |
| `supabase/migrations/031_schach_online.sql` | Zugbuch online, mit Prüfung in `pruefung/031_schach_online.pruefung.sql` |

## Regeln

Vollständig: Rochade (mit allen Rechteverlusten, auch wenn ein Turm
geschlagen wird), en passant, Umwandlung in jede Figur, Matt, Patt,
50-Züge-Regel, dreifache Wiederholung, zu wenig Material.

Die 50-Züge-Regel und die Wiederholung greifen von selbst. Am Brett muss man
sie beanspruchen; in einer App gibt es niemanden, der dafür die Uhr anhält.

Geprüft ist die Zugerzeugung mit **Perft** an sechs Standardstellungen
(Grundstellung, „Kiwipete" mit Rochaden und Fesselungen, en passant ins
Schach, Unterverwandlungen, Schlagen mit Umwandlung, ein Mittelspiel) gegen die bekannten Knotenzahlen. Ein Fehler in der
Zugerzeugung zeigt sich dort fast immer als falsche Zahl.

## Der Computer

Drei Stufen, die sich nicht im Wissen unterscheiden, sondern darin, wie weit
er vorausschaut und wie sehr er sich verschätzen darf (Werte in `config.ts`):

| Stufe  | Tiefe             | Ruhesuche | Verschätzen | Zufallszug | gemessen  |
| ------ | ----------------- | --------- | ----------- | ---------- | --------- |
| Leicht | 1 Halbzug         | nein      | ±90         | 20 %       | sofort    |
| Mittel | 2 Halbzüge        | ja        | ±25         | –          | ≤ 17 ms   |
| Schwer | bis 6, 1,2 s Zeit | ja        | –           | –          | 0,5–1,2 s |

Was die Tests von jeder Stufe verlangen (`tests/schach-rechner.test.ts`):

- Jede Stufe setzt ein Matt in einem Zug, und jede nimmt eine hängende Dame.
- Leicht nimmt eine gedeckte Figur mit der Dame (so verliert man am Anfang
  auch gegen Menschen), Mittel nicht.
- Mittel rechnet einen Schlagabtausch zu Ende, Schwer findet ein Matt in zwei.
- Schwer setzt mit König und Dame gegen König in höchstens 20 Zügen matt.
- Steht er schlechter (Mittel und Schwer), rettet er sich in die dreifache Wiederholung.

Zufall nur über einen mitgegebenen Startwert: derselbe Startwert, derselbe
Zug. Der Computer rechnet in einem Web Worker, damit das Brett nicht
einfriert; fehlt der Worker, rechnet die Seite selbst.

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

Die Figuren sind Schriftzeichen (♚ ♛ ♜ ♝ ♞ ♟), keine Bilder: keine Datei,
offline da, in jeder Größe scharf. Für beide Farben dieselben gefüllten
Zeichen, die Farbe kommt aus dem Stil; hinter jedem steht U+FE0E, damit kein
Handy den Bauern als buntes Emoji malt. Die Notation steht mit denselben
Zeichen statt Buchstaben (♞f3 statt Sf3 oder Nf3) und braucht so keine
Übersetzung.

## Wer daran weiterarbeitet

- Regeln gehören nach `src/games/schach/`, Stellwerte nach `config.ts`. Die
  Seiten zeigen an, was `zieleVon()` hergibt, und entscheiden nichts.
- In die Migration kommt keine Regel. Das Zugbuch funktioniert gerade
  deshalb, weil der Server nichts vom Schach weiß.
- Wer an der Zugerzeugung etwas ändert, lässt Perft laufen. Wer am Computer
  etwas ändert, misst, statt zu schätzen -- die Tests prüfen Verhalten,
  nicht Zahlen.
