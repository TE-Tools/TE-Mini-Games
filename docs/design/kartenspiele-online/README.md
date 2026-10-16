# Kartenspiele online – wer mischt, wer prüft

**Status:** umgesetzt (Mau-Mau, Letzte Karte, Texas Hold'em)
**Anlass:** Thomas, 16.10.2026 – „die 3 neuen Kartenspiele mit online funktion
machen das man andere Spieler einladen kann lobby spiele aufmachen und ander
joinen können wie in den anderen Spielen auch selbe logik"

Dieses Dokument legt **eine** Frage fest, und zwar bevor die erste Zeile SQL
entsteht: Was weiß der Server von einer Kartenpartie? Alles andere – Lobby,
Code, Beitreten, öffentliche Räume – ist bei allen Online-Spielen dieses
Projekts dasselbe und steht in `src/services/raeume.ts`.

## Die Lage: zwei Vorbilder, die sich widersprechen

Im Repository stehen zwei Servermodelle, und beide sind bewusst so gebaut:

|               | Kniffel (Migration 017)                   | Schützenopoly (Migration 019)            |
| ------------- | ----------------------------------------- | ---------------------------------------- |
| Server        | würfelt und rechnet die Punkte            | führt ein Zugbuch, sonst nichts          |
| Regeln in SQL | ja, zweite Fassung                        | **keine**, und es kommt keine hinein     |
| Begründung    | „beim Kniffel _ist_ der Würfel das Spiel" | Würfel sind öffentlich, Züge nachprüfbar |

Die Trennlinie ist nicht „einfach" gegen „aufwendig", sondern: **Gibt es im
Spiel etwas, das ein Mitspieler nicht sehen darf?**

Bei Schützenopoly gibt es das nicht. Jeder Wurf, jeder Kauf, jede Miete steht
offen auf dem Brett; ein Client, der lügt, widerspricht dem, was die anderen
gerade gesehen haben. Darum genügt das Zugbuch, und die Regeln dürfen
ausschließlich in TypeScript stehen.

## Die Entscheidung: Kartenspiele folgen Kniffel

Bei einem Kartenspiel ist das Blatt das Spiel. Zwei Dinge sind nicht
nachprüfbar, wenn der Client sie tut:

1. **Das Mischen.** Wer die Reihenfolge des Stapels kennt, kennt jede fremde
   Hand und jede Karte, die kommt. Ein Startwert, aus dem alle Clients
   dieselbe Mischung rechnen – der Weg von Schützenopoly –, ist hier genau
   das Falscheste: Dann _muss_ jeder Client alle Hände kennen, um die Partie
   nachzuspielen. Verdeckt wäre nur die Anzeige, nicht die Information.
2. **Die eigene Hand.** „Ich lege Herz Ass" ist ohne fremde Nachprüfung eine
   Behauptung über eine Karte, die niemand gesehen hat.

Also gilt für alle drei Spiele:

- **Der Server mischt** (`random()` in Postgres) und hält Stapel und Hände.
- **Der Server prüft jeden Zug**: Bin ich am Zug? Habe ich diese Karte? Darf
  sie jetzt liegen? Setzrunde: Darf ich so viel setzen?
- **`*_get_state` gibt jedem nur, was er sehen darf**: die eigene Hand
  vollständig, von den anderen nur die Anzahl. Verdeckte Karten verlassen den
  Server nicht – sie werden nicht „ausgegraut mitgeschickt".
- Die Tabellen sind gesperrt (`revoke all`), Zugriff nur über
  `security definer`-Funktionen. Wie 007/011/013/014/017/019.

Der Preis ist derselbe wie bei Kniffel und wird hier genauso in Kauf
genommen: **Die Regeln stehen zweimal da.** Wer eine Regel ändert, ändert
beide Seiten.

| Spiel                  | TypeScript                                   | SQL                                               |
| ---------------------- | -------------------------------------------- | ------------------------------------------------- |
| Mau-Mau / Letzte Karte | `src/games/maumau/{regeln,engine}.ts`        | `supabase/migrations/023_kartenspiele_online.sql` |
| Texas Hold'em          | `src/games/texas-holdem/{wertung,engine}.ts` | `supabase/migrations/024_texas_online.sql`        |

## Wie die doppelte Fassung zusammengehalten wird

Zwei Fassungen derselben Regel laufen auseinander – nicht wenn man sie
schreibt, sondern beim dritten Mal, wenn man eine ändert. Dagegen hilft keine
Sorgfalt, nur eine Messung. Deshalb ist die SQL-Fassung so gebaut, dass sie
sich **gegen die TypeScript-Fassung rechnen** lässt:

- Der ganze Partiezustand ist **ein jsonb-Blob** in derselben Form wie der
  TypeScript-Zustand (`mm_zustand`, `th_zustand`).
- Die Regelfunktionen sind **reine Funktionen** darauf: Zustand hinein,
  Zustand heraus, keine Tabelle angefasst. Die RPCs laden, rufen die reine
  Funktion, schreiben zurück.
- Damit kann ein Test denselben Zustand und denselben Zug durch beide
  Fassungen schicken und die Ergebnisse vergleichen. Genau das tun
  `supabase/migrations/pruefung/023_kartenspiele_online.pruefung.sql` und
  `scripts/pruefe-sql-regeln.mjs`: letzteres erzeugt tausende Lagen, holt die
  Antwort aus Postgres und hält sie gegen `passt()` bzw. `besteHand()`.

Ein Unterschied ist damit kein Lesefehler mehr, sondern ein roter Test.

## Was bewusst _nicht_ auf dem Server liegt

- **Die KI.** Online spielen Menschen gegeneinander; die Gegner-KI bleibt im
  Solospiel und damit in TypeScript. Kein `ki.ts` in SQL.
- **Darstellung, Animationen, Texte.** Der Server schickt Zustand, keine
  Sätze über „Du". Das Protokoll steht in neutralen Namen – wer es liest,
  entscheidet die Seite.
- **Balancing.** Blinds, Handkartenzahl, Startchips kommen beim Eröffnen aus
  der TypeScript-`config.ts` mit und stehen dann im Partiezustand. Der Server
  prüft nur Grenzen (nichts Unsinniges), er bestimmt keine Werte.

## Räume: unverändert übernommen

Nichts davon ist neu erfunden:

- Code aus 32 Zeichen ohne I/O/0/1, `*_new_code()`
- `*_heartbeat`, `*_cleanup` (20 Minuten ohne Lebenszeichen), `*_set_public`,
  `*_public_matches`, `*_my_matches` wie Migration 018
- `*_state(match_id, version)` als einzige lesbare Tabelle, damit
  `postgres_changes` etwas hat, worauf es horchen kann
- Client: `raumFunktionen(praefix, client)`, `RAUM_PARAM`, `istRaumWeg`,
  Sicherheitsabruf alle 4 Sekunden, Lebenszeichen alle 60
- Öffentliche Räume erscheinen von selbst auf `/offene-spiele`

Eine Besonderheit: Mau-Mau und Letzte Karte sind **zwei Kacheln mit einer
Engine**. Sie teilen sich darum auch die Tabellen; welche Kachel einen Raum
geöffnet hat, steht als `spiel` in der Zeile, und `mm_public_matches(p_spiel)`
gibt jeder Kachel nur ihre eigenen Räume. Zwei Tabellensätze für dieselbe
Engine wären zwei Stellen, an denen dieselbe Regel verrutscht.
