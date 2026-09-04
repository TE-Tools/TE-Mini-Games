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

## Brauchst du wirklich alles?

Nein. Am einen Gerät laufen **alle** Spiele ohne eine Zeile hiervon — die
Stücke schalten nur das Spielen von getrennten Handys aus frei, und Stück 12
die Levelanzeige. Nimm, was ihr wirklich spielt:

| Ziel | Nötig | Grösse |
|------|-------|--------|
| Auf der Karte und in der Rangliste sehen, wo andere stehen | **12** | 2 KB |
| „Stadt-Land-Fluss" online | **08 + 09** | 15 KB |
| „Finde den Imposter" online (Klassisch, Doppel) | **01–05** | 46 KB |
| … dazu die Modi Leer, Nur Kategorie, Tempo, Chaos | **+ 06** | 9 KB |
| … dazu Duell online und eigene Wortlisten | **+ 10 + 11** | 20 KB |
| „Wer bin ich?" online | **01–05 + 07** | 60 KB |

Alles zusammen sind es 106 KB.

**Warum „Wer bin ich?" die Imposter-Stücke braucht:** Es holt Kategorien und
Wörter aus denselben Tabellen (`fdi_categories`, `fdi_words`) — den Wortschatz
gibt es absichtlich nur einmal, statt ihn zweimal zu pflegen. Ohne 01–05
bricht Stück 07 mit `relation "public.fdi_categories" does not exist` ab.

Diese Zusammenstellungen sind einzeln nachgeprüft: jede auf einer Datenbank im
Stand 010 eingespielt, danach liefen die SQL-Tests des jeweiligen Spiels durch.

## Warum hier keine Kommentare stehen

Die Erklärungen, warum etwas so gebaut ist, machen gut ein Drittel der Zeichen
aus. Sie gehören ins Repository, nicht in ein Fenster, das man einmal
abschickt — in den Ursprungsdateien eine Ebene höher stehen sie vollständig.

## Nicht von Hand ändern

Erzeugt mit `node scripts/build-teile.mjs`. `tests/teile.test.ts` schlägt fehl,
sobald die Stücke nicht mehr zu den Migrationen passen.
