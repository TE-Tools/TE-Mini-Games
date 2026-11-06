# Zweisprachig: Deutsch und Englisch

Die App ist auf Deutsch geschrieben und bleibt es. **Deutsch ist die
Ausgangssprache, Englisch die Übersetzung.** Wer eine Zeichenkette ändert,
ändert sie in `src/i18n/texte/de.ts` -- und TypeScript verlangt dann dieselbe
Stelle in `en.ts`. Ein vergessener Text ist dadurch ein roter Build, kein
stiller Rückfall ins Deutsche.

Diese Datei ist die Übergabe für alle, die daran weiterarbeiten.

---

## Aufbau

| Datei                         | Was drin steht                                             |
| ----------------------------- | ---------------------------------------------------------- |
| `src/i18n/texte/de.ts`        | Alle deutschen Texte. Hier wird geschrieben.               |
| `src/i18n/texte/en.ts`        | Die englische Fassung, `: Texte` getippt.                  |
| `src/i18n/sprache.ts`         | Typen, Kontext, `useSprache()`, `useText()`, `spielName()` |
| `src/i18n/SprachProvider.tsx` | Hält die Wahl, schreibt `<html lang>`                      |
| `src/i18n/SprachKnopf.tsx`    | Der Umschalter im Kopf der Startseite                      |

Der Provider steht bewusst in einer eigenen Datei: Liegt er neben den Hooks,
verwirft Fast Refresh bei jeder Textänderung den Zustand der Seite.

## So fügt man einen Text hinzu

1. Eintrag in `de.ts` an der passenden Stelle (nach Seite gruppiert).
2. `npm run typecheck` -- der Build zeigt genau die fehlende Stelle in `en.ts`.
   **Nicht** `npx tsc --noEmit -p .`: Die oberste tsconfig hat `"files": []`
   und nur Verweise, der Aufruf prüft also gar nichts und ist trotzdem grün.
3. Dort übersetzen.
4. In der Komponente `const { t } = useSprache()` und `{t.bereich.schluessel}`.

Texte mit eingesetzten Werten sind Funktionen, keine zusammengeklebten
Zeichenketten:

```ts
nochBisLevel: (fehlend: number, level: number) => `Noch ${fehlend} XP bis Level ${level}`
```

So steht die Wortstellung in jeder Sprache für sich. Englisch dreht sie
regelmäßig um; mit `'Noch ' + n + ' XP bis '` ginge das nicht.

### Lange Texte: zwei Fassungen statt Schnipsel

Die Rechtsseiten (Impressum, Datenschutz, Konto löschen) bestehen aus Absätzen
mit Fettdruck und Links mitten im Satz. In Wörterbuch-Schnipsel zerlegt, liest
sie niemand mehr gegen. Dort steht der Text deshalb zweimal in der Seite, als
`TextDe` und `TextEn`, und eine `Record<Sprache, …>` wählt aus. TypeScript
erzwingt damit auch hier beide Fassungen. Nur Titel, Stand und Zurück kommen
aus dem Wörterbuch. Wer einen Absatz ändert, ändert beide. Die englische
Datenschutzerklärung sagt oben, dass bei Abweichungen die deutsche gilt.

---

## Vier Fallen, jede davon ist hier schon zugeschnappt

### 1. Der Name im Zustand

Wird ein übersetzter Name beim Laden in `useState` geschrieben, behält er beim
Sprachwechsel die alte Sprache. **Die Kennung merken, den Namen beim Rendern
nachschlagen.** Betraf „Zuletzt gespielt" und die Abzeichen.

```tsx
// falsch
setZeilen(r.map((e) => ({ id: e.id, spiel: t.spiele[e.gameId] })))
// richtig
setZeilen(r.map((e) => ({ id: e.id, gameId: e.gameId })))
// ... und im JSX: {spielName(t, z.gameId, gameLabel(z.gameId))}
```

### 2. Die halb übersetzte Stelle

Beim Spenden-Fuß war der Absatz übersetzt, der Knopf darunter nicht -- auf
Englisch stand dort ein deutscher Link. Das sieht man auf dem eigenen Gerät
nie. **Nach jeder Datei prüfen, ob wirklich nichts übrig ist:**

```bash
grep -oE ">[^<>{}]*[a-zäöüß]{4,}[^<>{}]*<|'[^']*[äöüßÄÖÜ][^']*'" DATEI
```

### 3. `t` wird verdeckt

`totals.map((t) => ...)` und `setTipps((t) => t + 1)` verdecken die
Übersetzungsvariable. In der Rangliste lief es nur zufällig richtig. **Keinen
Schleifen- oder Rückrufparameter `t` nennen.**

### 4. Gekürzte Texte

Beim Verschieben ins Wörterbuch gingen zwei Sätze des Löschtexts verloren,
darunter die Warnung, dass es sich nicht rückgängig machen lässt. Ein Test
fing es. **Danach alle verschobenen Stellen gegen das Wörterbuch halten**, zum
Beispiel so: aus dem Diff alle entfernten deutschen Textstellen ziehen und
prüfen, ob jede im Wörterbuch wieder auftaucht.

---

## Tests

**jsdom meldet `en-US`.** Die App wählt dort also Englisch. Jeder Test, der
deutschen Text prüft, muss die Sprache ausdrücklich setzen -- sonst hängt sein
Ergebnis an der Testumgebung:

```ts
beforeEach(() => {
  localStorage.setItem('te-sprache', 'de')
})
```

Tests, die eine übersetzte Komponente **unmittelbar** rendern (nicht über
`<App />`), brauchen den Provider:

```tsx
render(
  <SprachProvider>
    <MemoryRouter>{seite}</MemoryRouter>
  </SprachProvider>,
)
```

Kürzer geht es mit `tests/aufDeutsch.tsx`: Es setzt die Sprache und den
Provider in einem. Wer einen Baustein ohne Router rendert, ersetzt nur den
Import:

```ts
import { renderAufDeutsch as render } from './aufDeutsch'
```

`tests/sprache.test.tsx` prüft, was TypeScript nicht sieht: ob eine Textfunktion
in der Übersetzung zur festen Zeichenkette wurde, ob jemand die deutsche
Fassung kopiert hat, ob ein Text leer blieb. Alle drei Fälle sind
gegengeprüft -- sie fallen.

---

## Was bewusst **nicht** übersetzt wird

- **Die Wortlisten werden nicht übersetzt, sondern je Sprache geschrieben.**
  Ein englischer Spieler braucht englische Wörter, keine übersetzten
  deutschen. Darum gibt es eigene Listen (siehe „Wortlisten je Sprache“
  unten), nicht Einträge im Wörterbuch.
- **Die 22 Grundstücke von Schützenopoly.** Sie stehen für echte deutsche
  Schützenfeste und heißen in jeder Sprache gleich. Siehe
  `docs/design/schuetzenopoly/grundstuecke.md`.
- **Eigennamen** wie Emberwake, Trapbound, Squishy Dumplings, Kniffel,
  Mau-Mau, Texas Hold'em, Sudoku.

---

## Stand

**Die Oberfläche ist vollständig zweisprachig (Teil 8, 6.11.2026).** Jede
Seite, jedes Spiel solo und online, die Rechtsseiten, Emberwake und der
Startbildschirm in `index.html`. Was noch deutsch ist, ist Inhalt -- Liste
unten.

| Teil | Inhalt                                                                  |
| ---- | ----------------------------------------------------------------------- |
| 1–3  | Startseite, Abzeichen, Anmeldung, Profil, Rangliste, Daily, Familie,    |
|      | Levelkarte, Die perfekte Sekunde                                        |
| 4    | Sudoku samt der siebzehn Lösungstechniken                               |
| 5    | Impressum, Datenschutzerklärung, Konto löschen                          |
| 6    | Kniffel solo und online, Bienen-Flow, Squishy Dumplings, Trapbound      |
| 7    | Schützenopoly mit Tischmodus und online, Mau-Mau, Letzte Karte, Texas   |
|      | Hold'em, die Liste offener Räume                                        |
| 8    | Schützenrunde, Finde den Imposter samt Kategorie-Editor, Wer bin ich?,  |
|      | Stadt-Land-Fluss (alle solo und online), Scharade, Wortbombe, Wer würde |
|      | eher, Was fehlt?, Kopfrechnen, Reihenfolge, Offene Spiele, 404,         |
|      | Installieren-Knopf, Emberwake, Startbildschirm; dazu Reste aus Teil 1–3 |
|      | (Startseiten-Tafeln, Ranglisten-Zeilen, Platzhalter, Zahlenformate)     |

**Namen aus dem Spielmodul: Kennung behalten, beim Rendern nachschlagen.** So
sind die Motive von Bienen-Flow, die Sammelknödel von Squishy, die
Kniffel-Felder, die Rollen von Schützenrunde und die Gegenstände von
Emberwake gemacht. Das Modul liefert weiter den deutschen Namen als Kennung
(er steckt in Caches und Tests), die Seite schlägt ihn im Wörterbuch nach und
fällt sonst auf ihn zurück:

```ts
const motiv = (b.motive as Record<string, string | undefined>)[cfg.motiv] ?? cfg.motiv
```

**Protokolle aus der Engine** bleiben deutsch -- Tests, Logs und der Server
lesen sie. Für die Anzeige gibt es zwei Wege:

- **Meldung als Daten** (Kniffel, Schützenopoly): Die Engine führt neben
  dem deutschen Text eine strukturierte Meldung (`KniffelZustand.meldung`,
  `LogEintrag.meldung` mit 36 Arten). Bei Schützenopoly verlangt `mitLog`
  sie, eine neue Protokollzeile ohne Meldung ist also ein roter Build. Die
  Übersetzung steht in `pages/play/schuetzenopoly/texte.ts`. Alte
  Spielstände ohne Meldung zeigen den deutschen Text.
- **Zeile erkennen**: Wo der Server (SQL) das Protokoll schreibt oder die
  Engine deutsche Sätze wirft, liest ein Helfer jede deutsche Zeile beim
  Rendern und baut sie aus dem Wörterbuch neu. Eine Zeile, die kein Muster
  kennt, bleibt deutsch statt leer. **Wer in der Engine oder im SQL einen
  solchen Satz ändert oder neu einführt, ergänzt das Muster im Helfer** --
  die Tests spielen Partien durch und prüfen, dass auf Englisch kein
  deutsches Wort übrig bleibt:

  | Helfer                                | liest                                 |
  | ------------------------------------- | ------------------------------------- |
  | `pages/play/maumau/kartenText.ts`     | Mau-Mau-Engine, Migration 023         |
  | `pages/play/texas/texasText.ts`       | Texas-Engine, Migration 024           |
  | `pages/play/schuetzenrunde/srText.ts` | Schützenrunde-Engine, Migration 007   |
  | `pages/play/imposter/imposterText.ts` | Fehler aus Imposter-Engine und Editor |
  | `pages/play/partyFehler.ts`           | Startfehler der Partyspiele           |
  | `games/emberwake/ui/texte.ts`         | Gründe, Todesursachen, Hinweise       |

An den Regeln ändert beides nichts.

**Kein „Du“ an den Server.** Wer online keinen eigenen Namen hat, heißt für
die anderen `t.allgemein.spielerOhneName` (Spieler/Player) -- „Du“ oder
„You“ hieße bei allen anderen sie selbst.

**Emberwake** ist kein React. Es liest seine Texte einmal beim Start aus
`WOERTERBUECHER[sprache].emberwake` (`games/emberwake/ui/texte.ts`); ein
Sprachwechsel greift beim nächsten Öffnen. Die deutschen Namen stehen dort
zweimal, in `data/` und im Wörterbuch -- `tests/emberwake-texte.test.ts`
fällt, wenn sie auseinanderlaufen.

**Der Startbildschirm** in `index.html` steht vor React da. Ein kleines
Inline-Skript wählt die Sprache nach derselben Regel wie `src/i18n/sprache.ts`
und tauscht den Spruch. Ändert sich die Regel, ändert sie sich dort mit.

### Wortlisten je Sprache

Seit dem 6.11.2026 haben alle Partyspiele englische Inhalte -- geschrieben
für englische Spieler, nicht übersetzt (Thanksgiving statt Schützenfest).

| Spiel                            | Deutsch                            | Englisch                               |
| -------------------------------- | ---------------------------------- | -------------------------------------- |
| Imposter, Wer bin ich?, Scharade | `finde-den-imposter/data/words.ts` | `data/words.en.ts` (Kategorien `en-…`) |
| Imposter-Hilfswörter             | `data/helperClusters.ts`           | `data/helperClusters.en.ts`            |
| Wortbombe                        | `wortbombe/silben.ts`              | `wortbombe/silben.en.ts`               |
| Wer würde eher                   | `wer-wuerde-eher/fragen.ts`        | `wer-wuerde-eher/fragen.en.ts`         |

- **Englische Kategorien sind eigene Kategorien** mit der Kennung `en-…`
  (`en-tiere` ist „Animals“). `categoriesFor(sprache)` liefert die der
  Sprache; die Seiten zeigen nur diese. Darum braucht der Server kein neues
  Feld: Migration `029_englische_woerter.sql` fügt nur Daten hinzu und wird
  wie 011b und 027 aus den TS-Listen erzeugt
  (`node scripts/build-imposter-words-sql.mjs`,
  `node scripts/build-imposter-helfer-sql.mjs`).
- **Online erst, wenn der Server sie kennt:** `src/services/imposterKategorien.ts`
  fragt `fdi_categories` nach `en-`-Kennungen. Solange 029 nicht eingespielt
  ist, bieten die Online-Seiten die deutschen Kategorien an wie zuvor.
- Wer 027 allein noch einmal einspielt, leert `fdi_helper` ganz -- danach 029
  erneut einspielen. `ALL_IN_ONE.sql` hat die richtige Reihenfolge.
- Wortbombe und Wer würde eher tragen `sprache` im Zustand; alte Stände ohne
  das Feld gelten als Deutsch.
- Stadt-Land-Fluss braucht keine Liste: Die Buchstaben passen auch fürs
  Englische, geprüft wird nur der Anfangsbuchstabe.

### Noch deutsch -- alles Inhalt

1. **Fehlermeldungen vom Server** in allen Online-Spielen (`raise exception`
   in den Migrationen, angezeigt über `err.message`) und
   `RAUM_GESCHLOSSEN_TEXT` aus `src/services/raeume.ts`. Dafür braucht es
   Kennungen statt Sätzen im SQL oder eine Zuordnung im Dienst.
2. **Trapbound:** die Namen der Level, Welten und Abschnitte (Hunderte, in
   `src/games/trapbound/`). Der Text „Über das Spiel“ spricht noch von zehn
   Leveln in Welt 1; das ist in beiden Sprachen veraltet -- eine Sache für
   Thomas, keine Übersetzung.
3. **Levelkarte:** Namen, Beschreibungen und Tore der fünf Zeitreise-Zonen
   (`src/progression/zones.ts`) und der Trapbound-Welten
   (`src/games/trapbound/welten.ts`).
4. **Schützenopoly:** die 22 Grundstücke samt Fest und belegter Tatsache
   (`fakt` in `grundstuecke.ts`) und der Deutsche Schützenbund. Die Namen
   bleiben ohnehin; die Tatsachen sind belegt, eine Übersetzung müsste gegen
   `docs/design/schuetzenopoly/grundstuecke.md` geprüft werden.
5. **Außerhalb der App:** Manifest-Beschreibung (`vite.config.ts`), die
   `description` in `index.html`, die iOS-Startbilder
   (`scripts/build-splash-screens.mjs`) und der Store-Eintrag
   (`docs/store/`). Ein englischer Store-Eintrag ist eine eigene Aufgabe in
   der Play Console.
6. **Inhaltlich veraltet** (in beiden Sprachen, nur übersetzt): der
   Imposter-Editor sagt, eigene Listen gingen online nicht -- sie gehen
   inzwischen.

`OeffentlicheRaeume.tsx` liest die Sprache mit `useContext(SprachContext)`
und fällt ohne Provider auf Deutsch zurück, weil mehrere Online-Tests sie
ohne Provider rendern. Haben die einen, kann sie auf `useSprache()`.

Deutsche Reste findet man so (eine Hausnummer -- Kommentare und Code
rutschen mit hinein, Texte in Props wie `titel="…"` nicht):

```bash
grep -nE ">[^<>{}]*[a-zäöüß]{4,}[^<>{}]*<|'[^']*[äöüßÄÖÜ][^']*'" DATEI
grep -rnE "(titel|hinweis|label|title|placeholder|aria-label)=\"[^\"{]*[a-zäöüß]{3,}" src
```

---

## Was nicht in einen Übersetzungs-PR gehört

`prettier --write` über ein ganzes Verzeichnis nimmt unbeteiligte Dateien mit.
Im Projekt sind rund 97 Dateien nicht formatiert; das zu ändern ist richtig,
aber eine eigene Änderung. Lieber gezielt formatieren:

```bash
npx prettier --write src/i18n src/pages/play/MeineSeite.tsx
```
