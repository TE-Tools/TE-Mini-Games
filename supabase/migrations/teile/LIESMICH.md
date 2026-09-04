# Einspielen vom Handy

`ALL_IN_ONE.sql` ist rund 190 KB. Der SQL-Editor von Supabase steigt damit im
Browser eines Telefons aus — die Seite stürzt beim Einfügen ab. Hier liegt
dasselbe in Stücken, von denen keines grösser als 14 KB ist.

## So geht es

Supabase → **SQL Editor** → **New query** → eine Datei einfügen → **Run**.
Dann die nächste. Der Reihe nach, die Nummern im Dateinamen sagen sie an.

Jedes Stück ist für sich mehrfach ausführbar. Wenn du mittendrin abbrichst
oder ein Stück versehentlich zweimal abschickst, passiert nichts Schlimmes —
weitermachen, wo du warst.

## Wenn du nur wenig Zeit hast

`12_016_level_stand.sql` ist 2 KB und braucht **keines** der anderen Stücke.
Danach siehst du auf der Levelkarte, wo die anderen stehen, und in der
Rangliste ihr Level. Die Online-Runden brauchen dagegen 01 bis 11.

## Was wozu gehört

| Stücke | Was danach geht |
|--------|-----------------|
| 01–05  | „Finde den Imposter" online, mit allen 1000 Wörtern |
| 06     | die weiteren Imposter-Modi (Leer, Nur Kategorie, Tempo, Chaos) |
| 07     | „Wer bin ich?" online |
| 08–09  | „Stadt-Land-Fluss" online |
| 10–11  | Imposter: Duell online und eigene Wortlisten |
| 12     | Levelkarte und Rangliste zeigen, wo andere stehen |

## Warum hier keine Kommentare stehen

Die Erklärungen, warum etwas so gebaut ist, machen gut ein Drittel der Zeichen
aus. Sie gehören ins Repository, nicht in ein Fenster, das man einmal
abschickt — in den Ursprungsdateien eine Ebene höher stehen sie vollständig.

## Nicht von Hand ändern

Erzeugt mit `node scripts/build-teile.mjs`. `tests/teile.test.ts` schlägt fehl,
sobald die Stücke nicht mehr zu den Migrationen passen.
