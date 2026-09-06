# Schützenopoly – Architektur, Datenmodell und Balancing

Das große Schützenfest-Brettspiel. Dieses Dokument hält die Entscheidungen
fest, die später schwer zu ändern sind – und die Gründe dafür, weil ein
Grund, den niemand mehr kennt, in einem halben Jahr wie Willkür aussieht.

Die geprüfte Liste der 22 Veranstaltungen steht in
[`grundstuecke.md`](./grundstuecke.md).

## 1. Technologie: Teil dieser App, nicht ein eigenes Projekt

Schützenopoly ist ein Spielmodul dieser PWA – React 19, TypeScript,
Vite, Dexie –, kein eigenes Unity- oder Flutter-Projekt.

Der Grund ist das Ziel: Android. Diese App wird über eine Trusted Web
Activity ausgeliefert (`twa-manifest.json`, `docs/app-store.md`); der Weg
in den Play Store steht also schon. Ein zweites Projekt daneben bedeutete
eine zweite Auslieferung, ein zweites Profil, ein zweites Levelsystem und
zwei getrennte Spielesammlungen – für ein Spiel, das ohnehin in die
bestehende Sammlung gehört.

Damit gilt automatisch, was Regel 1 in `AGENTS.md` verlangt: Das Spiel
liegt unter `src/games/schuetzenopoly/`, und außer der Registrierung
(Registry, Route, Kachel) musste an keinem anderen Spiel etwas geändert
werden.

Was daraus für spätere Plattformen folgt: iOS, Tablet und Web brauchen
keine Portierung, sondern nur ein Layout, das mitwächst. Das Brett ist
deshalb ein quadratisches Raster in relativen Einheiten und keine feste
Pixelgröße.

## 2. Architektur

```
src/games/schuetzenopoly/
  config.ts         Alle Balancingwerte. Sonst rechnet nichts mit festen Zahlen.
  grundstuecke.ts   Die 22 Veranstaltungen und ihre acht Gruppen.
  brett.ts          Die 40 Felder und ihre Reihenfolge.
  karten.ts         Ereignis- und Vereinskarten (nur Beschreibung der Wirkung).
  rollen.ts         Neun Rollen mit je einem kleinen Vorteil.
  figuren.ts        Acht Spielfiguren (rein kosmetisch).
  zustand.ts        Der Spielzustand: serialisierbar, mit eigenem Zufallszähler.
  gebuehren.ts      Preise, Gebühren, Gruppenbonus, Vermögen.
  bank.ts           Zahlungen, Zwangsverkauf, Insolvenz.
  karteneffekte.ts  Karten ziehen und anwenden.
  engine.ts         Der Zugablauf.
  handel.ts         Handelsangebote prüfen, ausführen, bewerten.
  ki.ts             Die drei KI-Stufen.
  minispiele.ts     Regeln und Wertung der drei Minispiele.
  speichern.ts      Laufende Partie sichern und fortsetzen.
  definition.ts     Eintrag im Spielekatalog, XP-Berechnung.

src/pages/play/
  SchuetzenopolyPage.tsx        Die Seite: Zustand halten, Engine rufen, animieren.
  schuetzenopoly/Brett.tsx      Das 11×11-Raster.
  schuetzenopoly/brettPositionen.ts  Wo welches Feld im Raster liegt.
  schuetzenopoly/Minispiele.tsx Die drei Schießstände.
  schuetzenopoly/FeldKarte.tsx  Die Feldkarte mit Gebührenstaffel und Fakt.
  schuetzenopoly/HandelDialog.tsx
  schuetzenopoly/Aktionen.tsx   Bauen und Kartenauswahl.
  schuetzenopoly/Spielaufbau.tsx

src/services/sound.ts           Kurze Tonsignale, im Browser erzeugt.
```

**Die Trennlinie:** In `src/pages/` steht keine Regel. Was ein Kauf kostet,
wer wie viel zahlt und wann die Partie endet, steht ausschließlich in
`src/games/schuetzenopoly/`. Die Seite entscheidet nur, wann sie welche
Funktion ruft und wie lange sie dabei animiert. Deshalb ließen sich 145
Regeltests schreiben, ohne eine einzige Komponente zu rendern.

## 3. Datenmodell

Der gesamte Zustand einer Partie steckt in einem einzigen serialisierbaren
Objekt (`SpielZustand`). Kein verstecktes Wissen in Closures, keine Klassen
mit Innenleben, jede Funktion nimmt einen Zustand und gibt einen neuen
zurück.

| Struktur | Was sie hält |
|---|---|
| `SpielZustand` | Phase, Spieler, Besitz, Würfel, Runde, Kartenstapel, Protokoll, Zufallszähler |
| `Spieler` | Name, Mensch/KI, Rolle, Figur, Taler, Position, Strafbank, Handkarten, Einmal-Zähler, Statistik |
| `Besitz` | Feld-ID, Position, Besitzer, Ausbaustufe, Schutzfrist |
| `GrundstueckDaten` | Stadt, Veranstaltung, Art, Gruppe, Preis, Grundgebühr, geprüfte Aussage |
| `GruppeDaten` | Name, Farbe, Baukosten, Premium-Kennzeichen |
| `BrettFeld` | Position, Typ, Name, Symbol, Feld-ID, kaufbar |
| `Karte` | Stapel, Titel, Text, `KartenWirkung` |
| `RollenDaten` | Name, Beschreibung, `RollenBonus` |
| `Handelsangebot` | Wer, an wen, welche Felder, welche Taler auf beiden Seiten |
| `MinispielDaten` | Name, Anleitung, Punktschwellen für Bronze/Silber/Gold |

**Der Zufall gehört in den Zustand.** `seed` plus `rngZaehler` ergeben jeden
Wurf reproduzierbar. Das hat drei Folgen, die alle wichtig sind: Ein
geladener Spielstand würfelt genau so weiter, wie er es ohne Unterbrechung
getan hätte. Tests fallen nicht gelegentlich durch. Und später kann ein
Server dieselbe Engine fahren, ohne dass der Client den Zufall kennt.

Eine Nebenfolge, die eine bewusste Entscheidung ist: Die KI zieht ihre
kleinen Launen (kauft sie dieses Feld oder nicht?) aus einem abgeleiteten
Wert, der den Zähler *nicht* weiterdreht. Sonst würfelte eine Partie anders,
nur weil ein Rechner zwischendurch überlegt hat.

## 4. Das Spielbrett

40 Felder: 22 Grundstücke, 4 Sonderfelder, 2 Verbandsfelder, 4 Ecken,
3 Ereignis-, 3 Vereinskarten- und 2 Minispielfelder.

| Pos | Feld | Pos | Feld | Pos | Feld | Pos | Feld |
|-----|------|-----|------|-----|------|-----|------|
| 0 | 🏠 **START** | 10 | 🚧 **Strafbank** | 20 | 🎉 **Freies Fest** | 30 | ⛔ **Zur Strafbank** |
| 1 | Kevelaer | 11 | Sassenberg | 21 | Cloppenburg | 31 | M.gladbach |
| 2 | 📜 Ereignis | 12 | 🎯 Schießsportverband | 22 | 🤝 Vereinskarte | 32 | München |
| 3 | Grevenbroich | 13 | Recklinghausen | 23 | Vechta | 33 | 📜 Ereignis |
| 4 | Krefeld | 14 | Werl | 24 | Lohne | 34 | Düsseldorf |
| 5 | 🎪 Festzug | 15 | 🥁 Schützenumzug | 25 | 🎺 Musikzug | 35 | 👑 Königsfahrt |
| 6 | Attendorn | 16 | Soest | 26 | Celle | 36 | 🤝 Vereinskarte |
| 7 | 🤝 Vereinskarte | 17 | 📜 Ereignis | 27 | Wolfsburg | 37 | **Neuss** |
| 8 | Iserlohn | 18 | Paderborn | 28 | 🏆 Deutscher Schützenbund | 38 | 🎯 Schießstand |
| 9 | Olpe | 19 | 🎯 Schießstand | 29 | Peine | 39 | **Hannover** |

Die Gruppen liegen bewusst nicht am Stück: Zwischen dem ersten und letzten
Feld jeder Gruppe liegt immer mindestens ein fremdes Feld. Ein Test prüft
das, damit es beim Umbauen des Bretts nicht verlorengeht.

Die beiden teuersten Felder, Neuss (37) und Hannover (39), liegen im letzten
Viertel. Wer sie hält, hat den Abschnitt vor START in der Hand – genau
dort, wo die Mitspieler mit voller Kasse vorbeikommen.

**Namensdisziplin.** Die Ausbaustufen heißen Festzelt, Schützenhalle,
Königshaus, Schützenzentrum. Genau diese Wörter dürfen kein Sonderfeld
benennen – sonst hieße dasselbe Wort im Spiel zwei verschiedene Dinge. Die
Sonderfelder heißen deshalb Festzug, Schützenumzug, Musikzug und
Königsfahrt. Auch das prüft ein Test.

## 5. Balancing

Alles steht in `config.ts`. Nichts anderes rechnet mit eingetippten Zahlen.

| Größe | Wert |
|---|---|
| Startkapital | 10.000 🪙 |
| START-Bonus | 2.000 🪙 |
| Freies Fest | +500 🪙 |
| Strafbank freikaufen | 750 🪙 |
| Grundstückspreise | 400 – 3.500 🪙 |
| Grundgebühr | rund 7 % des Preises |
| Ausbaufaktor je Stufe | ×1, ×5, ×13, ×28, ×45 |
| Gruppenbonus | ×1,5 (Königsklasse ×2) |
| Sonderfelder | 250 / 500 / 1.000 / 2.000 🪙 |
| Verbandsfelder | Würfelsumme ×4, mit beiden ×10 |
| Minispiel | Bronze 500, Silber 1.500, Gold 3.000 🪙 |
| Rundenlimit | 20 (einstellbar 5–60) |

**Die Formel, die man vorlesen können soll:**
`Gebühr = Grundgebühr × Ausbaufaktor × Gruppenfaktor`

**Woher der Ausbaufaktor kommt.** Aus je 200 durchsimulierten KI-Partien
pro Variante. Mit flacheren Werten (×1/×4/×10/×22/×35) ging in 25 Partien
kaum eine Insolvenz durch – das Spiel lief nur noch auf Punkte hinaus.
Deutlich steilere Werte (×1/×6/×16/×34/×55) machten es beliebig: Wer zuerst
hoch baute, gewann fast immer. Die gewählte Kurve liegt dazwischen.

**Zwei Regeln, die nicht offensichtlich sind, aber viel tragen:**

*Bauen nur mit kompletter Gruppe, und gleichmäßig.* Ohne diese Regeln
gewinnt, wer zufällig früh auf dem teuersten Feld stand. Mit ihnen wird
Sammeln und Handeln zur eigentlichen Aufgabe.

*Vermögen zählt Besitz zum vollen Preis.* Daraus folgt etwas, das erst beim
Simulieren auffiel: Taler in Grundstücke umzuwandeln kostet nichts – es
bringt sogar, weil Besitz Gebühren einträgt. Eine große Barreserve ist also
kein vorsichtiges Spiel, sondern ein schlechtes. Die KI-Stufen sind darauf
gebaut (siehe unten).

## 6. Die KI

**Grundregel: kein Cheaten.** Die KI liest denselben Zustand, den ein Mensch
am Tisch sieht – Brett, Besitz, Kassenstände, die aufgedeckte Karte. Sie
liest nie den Kartenstapel, nie den nächsten Wurf, nie den Zufallszähler.
Auch im Minispiel bekommt sie deshalb nur eine gewürfelte Leistung, keinen
garantierten Treffer.

Die drei Stufen unterscheiden sich nicht darin, was sie dürfen, sondern
darin, wie weit sie denken:

- **Leicht** kauft nach Gefühl (etwa vier von fünf Gelegenheiten), hält stur
  1.500 🪙 zurück, baut nur bei üppiger Kasse und handelt gar nicht.
- **Normal** bewertet Grundstücke danach, ob sie eine Gruppe voranbringen,
  hält eine mittlere Reserve und handelt, wenn es sich klar lohnt.
- **Schwer** bemisst die Reserve an der höchsten Gebühr, die auf dem Brett
  gerade drohen kann, und lässt sie gegen Spielende fast auf null sinken.
  Sie kauft breit, baut aggressiv, blockiert den stärksten Gegner und gibt
  kein Feld her, das einem anderen die Gruppe schließen würde.

Gemessen über 200 Partien mit je einem Gegner jeder Stufe (Zufall wäre 66,7):

| Stufe | Siege von 200 |
|---|---|
| Leicht | 47 |
| Normal | 76 |
| Schwer | 77 |

Eine echte, aber nicht erdrückende Rangfolge. Genau das war das Ziel: Die
schwere KI soll ein Gegner sein, kein Hindernis.

## 7. Entscheidungen, die Folgen haben

**Zwangsverkauf statt Zwangsverkauf-Dialog.** Wer nicht zahlen kann,
verkauft automatisch: erst Gebäude, dann Grundstücke, immer das Kleinste
zuerst. Ein Dialog mitten in einer Zahlung würde jede Partie zerreißen, und
die KI müsste ihn ebenfalls bedienen. Wer selbst verkaufen will, tut das am
Zugende. Vorher wird gerechnet: Reicht auch der letzte Notverkauf nicht,
geht der Besitz gleich an den Gläubiger, statt vorher an die Bank
verschleudert zu werden.

**Keine Versteigerung.** Lehnt jemand ab, bleibt das Feld frei. Eine
Versteigerung wäre auf dem Handy ein eigener Dialog für alle Mitspieler.
Vorgesehen für V2.

**Kein Handel mit bebauten Grundstücken.** Sonst müsste geregelt werden, was
beim Besitzerwechsel mit den Gebäuden passiert – eine Regel, die sich
niemand merkt.

**Lokaler Mehrspieler zuerst.** V1 unterstützt 2–4 Spieler an einem Gerät,
Menschen und Rechner gemischt. Online-Mehrspieler ist bewusst nicht in V1:
Ein server-autoritatives Brettspiel dieser Größe ist ein eigenes Vorhaben,
und das Konzept erlaubt ausdrücklich, zuerst eine saubere lokale
Architektur zu bauen. Die Vorarbeit dafür ist geleistet – der Zustand ist
serialisierbar, der Zufall reproduzierbar, jede Aktion eine reine Funktion.
Ein Server kann dieselbe Engine fahren und Zustände verteilen, ohne dass
eine Regel neu geschrieben werden muss.

**Ton wird erzeugt, nicht geladen.** `src/services/sound.ts` synthetisiert
kurze Töne über die Web Audio API. Keine Audiodateien: Die müssten
lizenziert, geladen und offline vorgehalten werden. Erzeugte Töne kosten
nichts, funktionieren ohne Netz und lassen sich nicht falsch lizenzieren.
Festzeltmusik gibt es in V1 deshalb nicht – die käme nur mit einer Lizenz.

**Kein Levelkarten-Aufsatz.** Die Solospiele dieser Sammlung haben 500
Level. Eine Partie Schützenopoly ist eine Partie; die Schwierigkeit wählt
man über die KI-Stufe. `maxLevel` bleibt deshalb 1, statt die Levelmechanik
künstlich darüberzulegen.

## 8. Was V1 nicht enthält

Bewusst ausgelassen, wie im Konzept festgelegt: Battle Pass, Premium, Live
Events, Saison-System, öffentliche Ranglisten, Vereinsverwaltung,
Echtgeld-Wirtschaft, Lootboxen, Pay-to-win, Werbung.

Die Architektur steht dem nicht im Weg – zentral konfigurierbare Werte,
getrennte Module, ein serialisierbarer Zustand –, aber nichts davon
belastet V1.

## 9. Für später vorgemerkt

- Online-Mehrspieler mit Lobby und Spielcode (die Engine ist vorbereitet)
- Versteigerung abgelehnter Grundstücke
- 5–6 Spieler (die Engine kennt die Grenze nur an einer Stelle)
- Mehr Minispiele und Karten
- Hypothek als Alternative zum Verkauf
