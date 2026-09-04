# Finde den Imposter – Stand

**Stand:** 02.09.2026

## Ablauf

Gespielt wird entweder **am einen Gerät** (es wird herumgereicht) oder
**online**: jeder auf dem eigenen Handy, zusammengehalten von einem
fünfstelligen Code. Der Ablauf ist in beiden Fällen derselbe.

1. **Geheimnisse** – jeder sieht sein Wort. Die Imposter sehen stattdessen
   „IMPOSTER“ und darunter das, was der Modus ihnen zugesteht (siehe unten).
2. **Reden** – ein einziger Bildschirm, kein Weiterklicken pro Person: Er
   nennt, **wer anfängt** (zufällig gezogen), und sagt „jetzt redet
   miteinander“. Wie viele Wortrunden die Gruppe dreht, klärt sie selbst.
3. **Imposter erraten** – eine Liste aller Namen. Am einen Gerät tippt die
   Runde gemeinsam auf einen, online stimmt jeder ab und es zählt die
   Mehrheit (bei Gleichstand wird niemand angeklagt).
4. **Letzte Chance** – war es wirklich ein Imposter, darf genau der noch
   das geheime Wort raten und die Runde damit drehen.

Danach: nächste Runde mit neuem Wort und neu verteilten Rollen, so oft man
mag.

## Die Modi

| Modus | Der Imposter sieht … | Besonderheit | Ab |
|-------|----------------------|--------------|----|
| **Klassisch** | ein Hilfswort aus derselben Kategorie | – | 3 |
| **Doppel-Imposter** | ein Hilfswort | zwei Imposter, die nichts voneinander wissen | 6 |
| **Nur Kategorie** | nur „Tiere“ o. ä. | kein Hilfswort | 3 |
| **Leer** | gar nichts | die Kategorie bleibt **für alle** verborgen | 3 |
| **Tempo** | ein Hilfswort | nach 90 Sekunden wird automatisch getippt | 3 |
| **Chaos** | wechselt | jede Runde eine andere Sonderregel, angesagt | 3 |
| **Duell** | ein Hilfswort | zwei Teams, in jedem genau ein Imposter | 6 |

**Warum „Leer“ die Kategorie versteckt:** Stünde sie in der Kopfzeile, wäre
der Modus haargenau „Nur Kategorie“ – der Imposter bekäme dasselbe, nur
woanders hingeschrieben. Den Unschuldigen nimmt das nichts: Wer das Wort
kennt, kennt die Kategorie sowieso.

**Chaos** zieht jede Runde eine der Regeln *Ganz normal*, *Blindflug*,
*Nur Kategorie*, *Doppelt* (ab 6) oder *Die Uhr läuft* und sagt sie allen an.
Geheim wäre sie sinnlos – der Reiz liegt darin, dass sie wechselt.

**Duell** gibt es seit dem 04.09.2026 auch online (Migration 015). Jedes
Team bekommt dort seine eigene Abstimmung: Man kann nur auf Leute aus den
eigenen Reihen tippen, und ausgewertet wird erst, wenn beide Teams fertig
sind. Bei Gleichstand klagt das betroffene Team niemanden an – der Imposter
dieses Teams kommt durch, das andere Team spielt trotzdem zu Ende. Werden
beide erwischt, kommen sie nacheinander zur letzten Chance; getroffen hat
die Runde, wenn mindestens einer das Wort doch noch nennt. Geprüft in
`imposter_duell_test.sql` mit ganzen Runden.

## Wortschatz und eigene Kategorien

- **1000 Wörter** in 20 Kategorien, 50 je Kategorie
  (`src/games/finde-den-imposter/data/words.ts`).
- **Eigene Kategorien** legt man in der App an – Name plus Wortliste, ab 5
  Wörtern. Sie liegen nur auf diesem Gerät (localStorage) und lassen sich
  **exportieren** (Zwischenablage oder `.json`-Datei) und auf einem anderen
  Handy wieder **importieren**. Gleichnamige Listen werden dabei
  aktualisiert statt verdoppelt.
- Online gehen eigene Kategorien **nicht**: Dort zieht der Server das Wort,
  und der kennt nur den eingebauten Wortschatz. Schickte der Browser die
  Wörter mit, kennte der Gastgeber das Wort auch als Imposter.

## Bewusst nicht drin

- **Kein Punktesystem, keine Rangliste** (02.09.2026, Thomas' Vorgabe). Wer
  gewonnen hat, sieht man am Tisch. Das Spiel speichert deshalb auch kein
  Ergebnis, vergibt keine XP und taucht in keiner Rangliste auf.
- Keine getippten Hinweise – der frühere Handoff-Stand ließ jeden sein
  Hinweiswort eintippen, das ist durch das Reden in der Runde ersetzt.
- **Kein Reihum-Weiterklicken** – dazwischen gab es einen Bildschirm pro
  Person („Gesagt – weiter“). Der ist raus: nach den Geheimnissen kommt
  direkt der eine Bildschirm mit dem Startspieler.
- Keine feste Rundenzahl – man spielt, solange Lust besteht.

## Umgesetzt

- [x] Engine ohne UI-Bezug (`src/games/finde-den-imposter/engine.ts`)
- [x] Alle sieben Modi
- [x] 20 Kategorien, 1000 deutsche Wörter
- [x] Ein zufälliges Hilfswort je Runde
- [x] Zufälliger Startspieler, freies Gespräch, gemeinsame Anklage, letzte
      Chance (im Duell nacheinander für beide Erwischten)
- [x] Eigene Kategorien mit Import/Export
      (`src/games/finde-den-imposter/customCategories.ts`)
- [x] Route `/play/finde-den-imposter`, Home-Button, Registry-Eintrag
- [x] **Online-Mehrspieler**: Migrationen `011`, `011b`, `012`, Service
      `src/services/imposterOnline.ts`, Oberfläche
      `src/pages/play/FindeDenImposterOnline.tsx`
- [x] Tests: `tests/finde-den-imposter.test.ts`,
      `tests/imposter-eigene-kategorien.test.ts`,
      `tests/imposter-wortschatz.test.ts` sowie
      `supabase/tests/imposter_online_test.sql` und
      `supabase/tests/imposter_modes_test.sql`

## Wie das Online-Spiel sicher bleibt

Alle `fdi_`-Tabellen sind für Clients gesperrt (`revoke all`), jeder Zugriff
läuft über `security definer`-Funktionen – dasselbe Muster wie bei der
Schützenrunde (Migration 007). Entscheidend ist:

- **Der Server zieht das geheime Wort**, nicht der Browser des Gastgebers.
  Sonst könnte ein Gastgeber, der selbst Imposter ist, einfach nachsehen.
- **Der Server entscheidet auch, was ein Imposter zu sehen bekommt.**
  `fdi_get_state()` gibt das Hilfswort nur heraus, wenn der Modus es
  vorsieht, und im Modus „Leer“ auch die Kategorie nicht.
- Wer Imposter war, steht erst im Ergebnis drin.
- Realtime hängt an einem reinen Zähler (`fdi_state.version`) – das einzige,
  was Mitglieder direkt lesen dürfen.

Die beiden SQL-Tests spielen ganze Runden durch und prüfen genau das nach,
u. a. „Imposter sieht das geheime Wort NICHT“, „Imposter bekommt KEIN
Hilfswort“ (Leer, Nur Kategorie) und „Kategorie bleibt während der Runde
verborgen“ (Leer).

## Eigene Kategorien online

Seit dem 04.09.2026 lassen sich eigene Wortlisten für Online-Runden auf den
Server legen (`fdi_save_custom_category`). Was das schützt und was nicht,
ohne Beschönigung: Der Gastgeber kennt die Liste – er hat sie getippt –,
erfährt aber nicht, welches Wort gezogen wurde. Das ist dieselbe Zusage wie
bei den fertigen Kategorien, deren 50 Wörter ohnehin jeder nachlesen könnte.
Wer mit fünf Wörtern spielt, hat es als Gastgeber bei der letzten Chance
leichter; die Oberfläche sagt das, statt eine Regel daraus zu machen, die es
am einen Gerät nicht gibt. Fremde Listen bleiben unerreichbar – lesen,
bespielen und löschen darf sie nur, wem sie gehören.

## Noch offen

Nichts mehr aus dem ursprünglichen Zettel.
