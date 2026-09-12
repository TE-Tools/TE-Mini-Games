# LEVEL DESIGN — EMBERWAKE

Stand: 2026-09-11 · Version 0.0.1 (Planung)

---

## 1. Grundprinzip: Level sind Daten, kein Code (§43)

Ein Level ist ein typisiertes Objekt in `src/data/levels/`. Es enthält **keine
Logik**. Ein neues Level anzulegen heißt: Datei schreiben, in den Index
eintragen, Validator laufen lassen. Die Kernsysteme werden dabei nie angefasst.

### Schema (Entwurf)

```ts
export interface LevelDef {
  id: number // 1..100
  worldId: number // 1..10
  name: string
  seed: number // deterministische Erzeugung

  /** Interne Bewertung 1–10 (§82) */
  difficulty: number
  /** Erwartete Spieldauer in Sekunden (§83) */
  targetDuration: number

  terrain: {
    size: number // Kantenlänge in Metern
    generator:
      | 'forest'
      | 'mire'
      | 'ruins'
      | 'ridge'
      | 'frost'
      | 'chasm'
      | 'mine'
      | 'blight'
      | 'shifting'
      | 'hearth'
    elevation: number // Höhenvariation
    landmarks?: LandmarkDef[] // handplatzierte Elemente
  }

  camp: { x: number; z: number; unlockedBuildings: BuildingId[] }

  ember: {
    startCharge: number // 0..1
    capacity: number
    drainBase: number // pro Sekunde am Lager
    drainDistanceFactor: number // quadratischer Fernanteil
    regenPerWood: number
  }

  cycle: {
    dayDuration: number
    nightDuration: number
    cycles: number // wie viele Nächte
    startPhase: 'day' | 'dusk' | 'night'
  }

  resources: ResourceSpawnTable // Typ → Anzahl, Cluster, Zonen
  enemies: EnemySpawnTable // Typ → Welle, Anzahl, Zeitpunkt
  npcs?: NpcSpawnDef[]
  weather?: WeatherDef
  visibility: { dayRange: number; nightRange: number; fogDensity: number }

  nightEvents: WeightedTable<NightEventId> // §23
  objectives: {
    primary: ObjectiveDef // ⭐
    secondary: ObjectiveDef // ⭐⭐
  }
  secrets: SecretDef[] // ⭐⭐⭐ (§26)
  checkpoints: CheckpointDef[] // §16

  rewards: {
    resources: Partial<Record<ResourceId, number>>
    unlocks?: UnlockId[]
    firstClearBonus?: UnlockId[]
  }

  /** Kurze Story-Fundstücke, max. 4 Zeilen (§7) */
  lore?: LoreFragment[]
}
```

---

## 2. Prüfkriterium für jedes Level

Ein Level wird erst freigegeben, wenn es die folgenden Fragen besteht:

1. **Erzeugt es den Kernmoment?** (GAME_DESIGN.md §5 — „Nimmst du es mit?")
   Wenn nicht: Das Level ist Füllmaterial und wird überarbeitet.
2. **Hat es genau eine neue oder neu kombinierte Idee?** (§5)
3. **Ist es ohne Grind schaffbar?** (§86) — nachgewiesen durch `balance-sim`.
4. **Kann man steckenbleiben?** (§46) — nachgewiesen durch `level-validator`.
5. **Passt es in 5–15 Minuten?** (§83)
6. **Funktioniert es auf einem 360 × 640-Bildschirm?** (§46)

---

## 3. Schwierigkeitskurve (§50/§82)

| Level  | Interne Schwierigkeit | Was der Spieler beherrschen muss       |
| ------ | --------------------- | -------------------------------------- |
| 1–10   | 1–3                   | Grundlagen, erste echte Prüfung bei 10 |
| 11–20  | 3–4                   | Mechaniken sicher anwenden             |
| 21–30  | 4–5                   | Erste Kombinationen                    |
| 31–40  | 5–6                   | Hohe Anforderung                       |
| 41–50  | 6–7                   | Deutlicher Wendepunkt bei 50           |
| 51–60  | 7                     | Fortgeschrittene Mechaniken            |
| 61–70  | 7–8                   | Sehr anspruchsvoll                     |
| 71–80  | 8–9                   | Expertenbereich                        |
| 81–90  | 9                     | Extrem anspruchsvoll                   |
| 91–100 | 9–10                  | Finale                                 |

**Regel:** Schwierigkeit entsteht durch neue Anforderungen, nie durch
aufgeblähte Gegner-Trefferpunkte oder verlängerte Sammelzeiten (§4/§86).

Innerhalb jeder Welt gilt ein Atemrhythmus statt einer geraden Linie:

```
Level  n+1  n+2  n+3  n+4  n+5  n+6  n+7  n+8  n+9  n+10
Grad    ▂    ▃    ▄    ▃    ▅    ▄    ▆    ▅    ▇    █
        neu  üben stei- Luft kom-  Luft hoch Luft Test Finale
                  gern  holen bi          holen
```

Nach jeder Spitze kommt ein leichteres Level. Ohne Entspannung wirkt
Anspannung nicht.

---

## 4. Welt 1 — Der Aschenwald (Level 1–10)

Vollständig ausgearbeitet. Welten 2–10 folgen dem Raster in Abschnitt 5,
werden aber erst detailliert, wenn Welt 1 spielbar und getestet ist (§57/§68).

| #   | Name                   | Hauptmechanik / neue Idee                                                                                                        | Gegner                             | Zusatzziel (⭐⭐)                     | Geheimnis (⭐⭐⭐)                        | Grad |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------- | ----------------------------------------- | ---- |
| 1   | **Erste Glut**         | Tutorial ohne Textwände: Bewegung, Sammeln, Ballast, Kern auffüllen. Keine Nacht, keine Gegner                                   | —                                  | Unter 4 Min. abschließen              | Alte Laterne im hohlen Baum               | 1    |
| 2   | **Die erste Nacht**    | Nacht wird eingeführt. Lichtradius ist sichtbar sicher. Zwei Schleicher, sehr langsam                                            | Schleicher                         | Kern nie unter 50 %                   | Ausgebrannte Lagerstelle mit Notiz        | 1    |
| 3   | **Weiter als gedacht** | **Lichtschuld wird spürbar.** Das beste Holz liegt am Kartenrand. Die Anzeige sinkt sichtbar schneller                           | Schleicher                         | 30 Holz einlagern                     | Blick über den Kamm: Silhouette des Herds | 2    |
| 4   | **Werkbank**           | Erstes Crafting. Axt verdoppelt Sammeltempo — aber Bauen kostet Kern                                                             | Schleicher, Hetzer                 | Axt vor der Nacht fertig              | Bauplan „Verstärkter Rucksack"            | 2    |
| 5   | **Der Hetzer**         | Gegner, der nicht aufgibt. Lehrt: Licht ist Waffe, nicht nur Sicht                                                               | Hetzer                             | Hetzer nur mit Licht abschütteln      | Höhle mit Glutkristall                    | 3    |
| 6   | **Aschesturm**         | Erstes Wetterereignis. Sicht halbiert, Kern verbraucht 40 % mehr. Zeitlich angekündigt                                           | Hetzer, Schleicher                 | Sturm außerhalb des Lagers überstehen | Windgeschützte Senke mit Vorrat           | 3    |
| 7   | **Knappe Glut**        | **Ressourcenknappheit.** Kern startet bei 35 %. Holz ist weit verstreut                                                          | Schleicher, Hetzer                 | Ohne Kern-Notabschaltung durchkommen  | Vergrabenes Ressourcenlager               | 4    |
| 8   | **Der Brecher**        | Gegner ignoriert den Spieler und rennt zum Kern. Lehrt: Das Lager braucht Verteidigung                                           | Brecher, Hetzer                    | Kern nimmt keinen Schaden             | Bauplan „Wachturm"                        | 4    |
| 9   | **Der Verirrte**       | **Erste Entscheidung (§25).** Ein NPC ruft um Hilfe — weit weg, kurz vor der Nacht. Helfen, ignorieren oder Ressourcen verlangen | Brecher, Schleicher                | Verirrten lebend ins Lager bringen    | Seine Geschichte vollständig hören        | 5    |
| 10  | **Die lange Nacht**    | **Welt-Finale.** Kein klassischer Boss: eine Nacht von dreifacher Länge mit drei Wellen. Verteidigen mit dem, was man gebaut hat | Alle bisherigen + erster Nachtmahr | Ohne NPC-Verlust                      | Die Stillen nennen deinen Namen           | 6    |

### Warum Level 1 kein Textkasten-Tutorial ist (§49)

Level 1 lehrt durch Notwendigkeit statt durch Hinweise:

- Der Kern ist sichtbar niedrig → der Spieler will ihn füllen
- Holz liegt in Blickrichtung → er läuft los und lernt den Joystick
- Beim Aufsammeln füllt sich der Ballastbalken → er lernt Gewicht
- Zu schwer beladen läuft er sichtbar langsamer → er lernt die Konsequenz
- Zurück am Kern leuchtet dieser auf → er lernt den Kreislauf

Insgesamt drei eingeblendete Hinweise mit je maximal fünf Wörtern.

---

## 5. Raster für Welten 2–10

Jede Welt folgt derselben Dramaturgie, füllt sie aber mit eigenem Inhalt:

| Position         | Rolle des Levels                                 |
| ---------------- | ------------------------------------------------ |
| Level 1 der Welt | Neue Mechanik gefahrlos einführen                |
| Level 2–3        | Mechanik üben, mit Bekanntem kombinieren         |
| Level 4          | Atempause, Belohnung, neuer Bauplan              |
| Level 5          | Neuer Gegnertyp                                  |
| Level 6          | Neue Mechanik unter Zeitdruck                    |
| Level 7          | Entscheidung mit Konsequenz (§25)                |
| Level 8          | Härtester regulärer Test                         |
| Level 9          | Atempause plus Story-Enthüllung                  |
| Level 10         | Welt-Finale: Ereignis, nicht zwingend Boss (§51) |

**Welt-Finale-Varianten (§51)** — bewusst nicht zehnmal derselbe Boss:
lange Nacht mit Wellen, Flucht mit begrenztem Licht, Verteidigung eines
fremden Lagers, Expedition mit hartem Zeitlimit, Eskorte mehrerer Verirrter,
Sammelziel in feindlichem Gebiet, zwei gleichzeitige Ziele an
gegenüberliegenden Kartenenden.

---

## 6. Level-Generator (§44)

`WorldGen.ts` erzeugt aus `seed` und `generator` deterministisch:
Höhenkarte, Biom-Zonen, Wege, Vegetations- und Felsverteilung,
Ressourcen-Cluster, Spawn-Punkte, Geheimnis-Positionen.

**Hybrid-Ansatz:** Der Generator liefert die Grundlage, `landmarks[]`
überschreibt handplatzierte Elemente. Damit ist beides möglich —
prozedural erzeugte und handgebaute Level (§44).

**Garantien, die der Generator einhalten muss** (per Test geprüft):

- Jeder Ressourcenknoten ist vom Lager aus erreichbar
- Kein Pfad ist schmaler als 2,5 m (sonst blockieren Gegner ihn, §46)
- Mindestens ein Rückweg ist kürzer als `kern_budget × tempo`
- Geheimnisse liegen nie hinter einem Einwegweg

---

## 7. Checkpoints (§16)

Nicht jedes Level hat welche. Regeln:

- Level mit Grad ≤ 4: keine Checkpoints (sie sind kurz genug)
- Grad 5–7: ein Checkpoint beim Übergang zur Nacht
- Grad 8–10: bis zu zwei, aber **nie mitten in einer Welle**
- Ein Checkpoint stellt Position, Kern-Stand und Inventar wieder her —
  **nicht** die Leben

---

## 8. Automatisierte Prüfung (§46)

`tools/level-validator.ts` prüft vor jedem Build alle Level:

| Prüfung                                 | Bricht Build ab |
| --------------------------------------- | --------------- |
| Alle referenzierten IDs existieren      | ja              |
| Ressourcen erreichbar                   | ja              |
| Kern-Budget reicht für Mindestrundgang  | ja              |
| Zusatzziel überhaupt erfüllbar          | ja              |
| Geheimnis erreichbar                    | ja              |
| Keine Pfadblockade möglich              | ja              |
| Schwierigkeitsgrad passt zur Kurve (±1) | Warnung         |
| Spieldauer in Zielbereich               | Warnung         |

`tools/balance-sim.ts` spielt anschließend jedes Level 1000× mit
simulierten Spielern dreier Könnensstufen und meldet Abschlussrate,
Todesrate, Reststand des Kerns und durchschnittliche Dauer (§45).
