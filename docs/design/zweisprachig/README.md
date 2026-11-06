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

- **Die Wortlisten** von Stadt-Land-Fluss, Wer bin ich?, Scharade, Wortbombe
  und Finde den Imposter. Ein englischer Spieler braucht englische Wörter,
  keine übersetzten deutschen. Das ist Inhaltsarbeit und gehört in eigene
  Datensätze je Sprache, nicht ins Wörterbuch.
- **Die 22 Grundstücke von Schützenopoly.** Sie stehen für echte deutsche
  Schützenfeste und heißen in jeder Sprache gleich. Siehe
  `docs/design/schuetzenopoly/grundstuecke.md`.
- **Eigennamen** wie Emberwake, Trapbound, Squishy Dumplings, Kniffel,
  Mau-Mau, Texas Hold'em, Sudoku.

---

## Stand

**Fertig und zweisprachig:**

- Startseite vollständig (Kopf, Fortschritt, Reiter, Filter, alle 21 Kacheln,
  Menü, Spenden-Fuß)
- Abzeichen-Seite mit allen 50 Abzeichen samt Beschreibung
- Anmeldung, Profil, Rangliste, Daily Challenge, Familienrunde
- Levelkarte (von mehreren Spielen geteilt)
- Die perfekte Sekunde
- Sudoku vollständig, inklusive der siebzehn Lösungstechniken
- Impressum, Datenschutzerklärung, Konto löschen (Teil 5)
- Kniffel solo und online, Bienen-Flow, Squishy Dumplings, Trapbound (Teil 6)
- Schützenopoly solo, Tischmodus und online; Mau-Mau und Letzte Karte solo
  und online; Texas Hold'em solo und online; die Liste offener Räume
  (`OeffentlicheRaeume.tsx`) für alle Online-Spiele (Teil 7)

**Offen, gemessen am 6.11.2026** -- Zahl der noch deutschen Textstellen je
Datei:

| Datei                                   | Texte |
| --------------------------------------- | ----- |
| `pages/play/SchuetzenrundeOnline.tsx`   | 52    |
| `pages/play/FindeDenImposterOnline.tsx` | 52    |
| `pages/play/FindeDenImposterPage.tsx`   | 51    |
| `pages/play/SchuetzenrundePage.tsx`     | 39    |
| `pages/play/WerBinIchOnline.tsx`        | 37    |
| `pages/play/WerBinIchPage.tsx`          | 33    |
| `pages/play/StadtLandFlussOnline.tsx`   | 33    |
| `pages/play/StadtLandFlussPage.tsx`     | 26    |

Dazu die Spielmodule unter `src/games/` -- dort steckt viel Inhalt, der nach
der Regel oben gar nicht übersetzt wird, und wenig Oberfläche, die es soll.
Vor dem Anfassen trennen.

**Namen aus dem Spielmodul: Kennung behalten, beim Rendern nachschlagen.** So
sind die Motive von Bienen-Flow, die Sammelknödel von Squishy und die
Kniffel-Felder gemacht. Das Modul liefert weiter den deutschen Namen als
Kennung (er steckt in Caches und Tests), die Seite schlägt ihn im Wörterbuch
nach und fällt sonst auf ihn zurück:

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
- **Zeile erkennen** (Mau-Mau, Texas): Online schreibt der Server das
  Protokoll (SQL), und der wird nicht angefasst. Darum liest
  `pages/play/maumau/kartenText.ts` bzw. `pages/play/texas/texasText.ts` jede
  deutsche Zeile beim Rendern und baut sie aus dem Wörterbuch neu. Eine
  Zeile, die kein Muster kennt, bleibt deutsch statt leer. **Wer in
  `engine.ts` oder in Migration 023/024 eine neue Protokollzeile einführt,
  ergänzt dort das Muster** -- die Tests spielen Partien durch und prüfen,
  dass auf Englisch kein deutsches Wort übrig bleibt.

An den Regeln ändert beides nichts.

**Kein „Du“ an den Server.** Wer online keinen eigenen Namen hat, heißt für
die anderen `t.allgemein.spielerOhneName` (Spieler/Player) -- „Du“ oder
„You“ hieße bei allen anderen sie selbst.

**Noch deutsch (Stand Teil 7):**

- Trapbound: die Namen der Level, Welten und Abschnitte. Das sind Hunderte,
  sie stehen in `src/games/trapbound/` und sind Inhalt -- ein eigener Schritt.
  Der Text „Über das Spiel“ spricht außerdem noch von zehn Leveln in Welt 1;
  das ist in beiden Sprachen veraltet und eine Sache für Thomas, keine
  Übersetzung.
- Die Zonen auf der Levelkarte: Namen, Beschreibungen und Tore der fünf
  Zeitreise-Zonen (`src/progression/zones.ts`) und der Trapbound-Welten
  (`src/games/trapbound/welten.ts`). Die festen Texte der Karte selbst
  (gesperrt, aktuell, Tor öffnen ...) sind seit Teil 6 übersetzt.
- Fehlermeldungen vom Server in allen Online-Spielen (`raise exception` in
  den Migrationen, angezeigt über `err.message`) und `RAUM_GESCHLOSSEN_TEXT`
  aus `src/services/raeume.ts`. Dafür braucht es Kennungen statt Sätzen im
  SQL oder eine Zuordnung im Dienst -- ein eigener Schritt.
- Schützenopoly: die 22 Grundstücke samt Fest und belegter Tatsache
  (`fakt` in `grundstuecke.ts`) und der Deutsche Schützenbund. Die Namen
  bleiben ohnehin; die Tatsachen sind belegt, und eine Übersetzung müsste
  gegen `docs/design/schuetzenopoly/grundstuecke.md` geprüft werden.
- `OeffentlicheRaeume.tsx` liest die Sprache mit `useContext(SprachContext)`
  und fällt ohne Provider auf Deutsch zurück, weil mehrere Online-Tests sie
  ohne Provider rendern. Haben die einen, kann sie auf `useSprache()`.

Die Zahl je Datei bekommt man so:

```bash
grep -oE ">[^<>{}]*[a-zäöüß]{4,}[^<>{}]*<|'[^']*[äöüßÄÖÜ][^']*'" DATEI | wc -l
```

Sie ist eine Hausnummer: Kommentare und Code rutschen mit hinein. Vor dem
Übersetzen immer in die Datei schauen.

**Vorgeschlagene Reihenfolge:** Rechtsseiten, Einzelspieler-Spiele,
Schützenopoly und die Kartenspiele sind erledigt. Weiter mit den
Partyspielen (Schützenrunde, Imposter, Wer bin ich?, Stadt-Land-Fluss,
Scharade, Wortbombe, Wer würde eher) samt ihren Online-Varianten -- dort
steckt die Frage nach englischen Wortlisten, siehe oben.

**Noch offen, unabhängig davon:** 28 Stellen formatieren Zahlen und Daten fest
mit `toLocaleString('de-DE')`. Sie gehören auf `toLocaleString(sprache)` aus
`useSprache()`. In der Rangliste und auf der Startseite ist das schon gemacht.

---

## Was nicht in einen Übersetzungs-PR gehört

`prettier --write` über ein ganzes Verzeichnis nimmt unbeteiligte Dateien mit.
Im Projekt sind rund 97 Dateien nicht formatiert; das zu ändern ist richtig,
aber eine eigene Änderung. Lieber gezielt formatieren:

```bash
npx prettier --write src/i18n src/pages/play/MeineSeite.tsx
```
