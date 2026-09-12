# KI-KONZEPT — EMBERWAKE

Stand: 2026-09-11 · Version 0.0.1 (Planung)

---

## 1. Leitsatz

> Der Spieler muss jederzeit beantworten können: **„Warum ist das gerade
> passiert?"** (§19)

Eine KI, die clever wirkt, aber unverständlich handelt, ist schlechter als
eine simple KI, deren Absicht man lesen kann. Jede Entscheidung dieses
Dokuments ordnet sich diesem Satz unter.

Praktische Konsequenz: **Jeder Gegner signalisiert seinen Zustand sichtbar** —
Haltung, Bewegungstempo, ein Geräusch, ein Leuchten. Der Spieler soll
„der hat mich bemerkt" sehen können, ohne die Debug-Anzeige zu brauchen.

---

## 2. Aufbau

Drei Ebenen, bewusst getrennt:

```
┌─────────────────────────────────────────────┐
│ Director        Wer spawnt wann und wo?     │  global, pro Level
├─────────────────────────────────────────────┤
│ BehaviorTree    Was will dieser Gegner?     │  pro Entity, 4–10 Hz
├─────────────────────────────────────────────┤
│ Steering        Wie bewegt er sich dorthin? │  pro Entity, 30 Hz
│ + FlowField                                 │
└─────────────────────────────────────────────┘
```

Diese Trennung ist auch eine Performance-Entscheidung: Der teure Teil
(Baum-Auswertung) läuft selten, der billige Teil (Bewegung) läuft oft.

---

## 3. Wahrnehmung — und warum sie auf Licht basiert

`ai/Perception.ts` bewertet für jeden Gegner:

```ts
interface Perception {
  lightExposure: number // 0..1 — wie hell steht ER gerade?
  targetLight: number // 0..1 — wie hell ist sein Ziel?
  distanceToPlayer: number
  distanceToCamp: number
  hasLineOfSight: boolean
  noiseLevel: number // Sprint, Fällen, Kampf erzeugen Lärm
}
```

**`lightExposure` ist der wichtigste Wert im gesamten KI-System.** Er verbindet
die Kernmechanik direkt mit dem Gegnerverhalten:

- Sinkt der Kern, schrumpft der Lichtradius → mehr Fläche mit niedriger
  Beleuchtung → Gegner rücken näher heran
- Der Spieler sieht das kommen und kann handeln
- Es braucht keinen versteckten Schwierigkeitsregler — **die Bedrohung steigt
  aus einer Zahl, die der Spieler selbst kontrolliert**

Das ist der Grund, warum die KI fair wirken kann, obwohl sie härter wird.

---

## 4. Verhaltensbäume, datengetrieben

Bäume stehen als Daten in `src/data/enemies.ts`, nicht als Code. Ein neuer
Gegner braucht keine neue Klasse.

```ts
behavior: {
  root: 'selector',
  children: [
    { when: 'lightExposure > 0.7', do: 'flee_to_shadow' },
    { when: 'distanceToPlayer < 3',  do: 'attack' },
    { when: 'hasLineOfSight',        do: 'chase' },
    { do: 'wander' }
  ]
}
```

**Auswertungsfrequenz nach Wichtigkeit** (Performance, §34):

| Situation                    | Takt                                          |
| ---------------------------- | --------------------------------------------- |
| Im Kampf oder nah am Spieler | 10 Hz                                         |
| Sichtbar, mittlere Distanz   | 5 Hz                                          |
| Außer Sicht                  | 1 Hz                                          |
| Weit entfernt                | Ausgesetzt, nur grobe Positionsfortschreibung |

---

## 5. Wegfindung: Flow Field statt A\*

Klassisches A\* pro Gegner skaliert auf dem Handy schlecht. Stattdessen:

Ein Gitter über die Karte (2 m Zellen) trägt pro Ziel — Lager, Spieler,
Wachturm — ein **Strömungsfeld**: jede Zelle kennt die Richtung zum Ziel.
Hundert Gegner lesen dasselbe Feld. Kosten: einmal berechnen statt
hundertmal suchen.

- Feld zum **Lager**: einmal pro Level berechnet (Lager bewegt sich nicht)
- Feld zum **Spieler**: alle 500 ms neu, nur im Umkreis von 40 m
- Ausweichen untereinander: lokales Steering, kein Pathfinding

Nebeneffekt: Wenn der Spieler einen Weg blockiert, „fließen" die Gegner
sichtbar außen herum — das wirkt intelligent und ist praktisch gratis.

---

## 6. Die acht Verhaltensmuster (§18)

| Gegner         | Kernlogik                                                        | Lesbares Signal                            |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| **Schleicher** | Nächstes Ziel angreifen                                          | Langsam, gleichmäßig, brummt               |
| **Hetzer**     | Spieler verfolgen, bis `lightExposure > 0,8`                     | Beschleunigt hörbar bei Sichtkontakt       |
| **Brecher**    | Flow Field zum Lager, ignoriert Spieler                          | Schaut nie zum Spieler. Schwer und laut    |
| **Zersetzer**  | Nächstes Gebäude suchen, bevorzugt Türme                         | Kreist erst, dann Angriff                  |
| **Scheue**     | Zelle mit minimaler Helligkeit suchen, warten                    | Sichtbar nur als Bewegung im Dunkel        |
| **Nachtmahr**  | Nur in Nachtphase aktiv, löst sich bei Morgen auf                | Eigenes Klangmotiv beim Erscheinen         |
| **Irrlicht**   | Tarnt sich als Lichtquelle oder Ressource. Enttarnt sich bei 6 m | Flackert unregelmäßig — der Hinweis ist da |
| **Plünderer**  | Zum Speicher, greifen, zum Kartenrand fliehen                    | Leuchtende Beutespur beim Fliehen          |

**Fairness-Absicherung Irrlicht:** Es flackert anders als echte Lichtquellen.
Ein aufmerksamer Spieler kann es _immer_ erkennen. Eine Falle, die man nicht
erkennen kann, wäre unfair (§24).

---

## 7. Adaptive Schwierigkeit — der Director (§19)

Der Director beobachtet den Spieler und passt an. **Er darf nur Dinge
verändern, die der Spieler bemerken und erklären kann.**

Beobachtete Größen:

- Bevorzugte Anmarschrichtung (wo stehen die Türme?)
- Durchschnittlicher Kern-Stand
- Kampf- vs. Ausweichverhalten
- Verluste in den letzten Nächten

Erlaubte Anpassungen:

| Anpassung                                                | Erklärbar für den Spieler?             |
| -------------------------------------------------------- | -------------------------------------- |
| Welle kommt aus einer anderen Richtung                   | Ja — er sieht sie kommen               |
| Zersetzer-Anteil steigt, wenn viele Türme stehen         | Ja — „sie gehen jetzt auf meine Türme" |
| Mehr Scheue, wenn der Kern oft schwach ist               | Ja — „im Dunkeln lauert mehr"          |
| Angriffswelle wird 20 % später ausgelöst nach zwei Toden | Ja — spürbar als Atempause             |

**Verboten:**

- Gegnerwerte im laufenden Level ändern
- Spawns in Rücken oder Sichtschatten des Spielers
- Gegner, die den Spieler „wissend" abfangen, ohne ihn wahrgenommen zu haben
- Unsichtbare Trefferwahrscheinlichkeits-Korrekturen

**Sicherheitsnetz nach unten:** Nach zwei Toden im selben Level erscheint
ein sichtbarer Glutvorrat nahe dem Lager. Das ist eine _offene_ Hilfe,
keine heimliche Erleichterung. Der Spieler soll sich nicht betrogen fühlen,
wenn er es schafft.

---

## 8. Freundliche KI — Verirrte (§20)

Deutlich einfacher gehalten:

```
Zustände: FOLGEN → ARBEITEN → FLIEHEN → VERLETZT
```

- **Folgen:** Bleibt in 4 m Abstand, bleibt im Lichtradius, panikt im Dunkeln
- **Arbeiten:** Im Lager je nach Typ (sammeln, wachen, bauen, heilen)
- **Fliehen:** Bei Gefahr zum nächsten hellen Punkt
- **Verletzt:** Bewegungsunfähig, ruft um Hilfe, stirbt nach 60 s ohne Hilfe

NPCs sind bewusst **nicht kampfstark**. Sie sollen Sorge auslösen, nicht
das Spiel für den Spieler erledigen.

---

## 9. Begleiter — Funken (§30)

Kein Verhaltensbaum nötig. Ein Funke folgt per Feder-Bewegung und feuert
einen passiven Effekt. Bewusst simpel gehalten: Ein Begleiter, der taktisch
mitspielt, würde von der Kernmechanik ablenken.

---

## 10. KI-Spieler / Bots (§41)

**Nicht in Version 0.x.** Die Architektur macht sie aber trivial nachrüstbar:
Ein Bot ist eine Entity mit einem Verhaltensbaum, die dieselben
Spielersysteme benutzt (Inventar, Ballast, Kern). Weil die Simulation
deterministisch und headless lauffähig ist, funktioniert das ohne Sonderfall —
`tools/balance-sim.ts` benutzt genau diesen Mechanismus bereits für das
Balancing. Der Balancing-Bot **ist** der Prototyp des KI-Spielers.

---

## 11. Rechenbudget (§34)

| Posten                     | Budget pro Frame                        |
| -------------------------- | --------------------------------------- |
| Gesamtes KI-Update         | < 3 ms                                  |
| Gleichzeitig aktive Gegner | ≤ 40 (Sichtbereich), ≤ 80 (gesamt)      |
| Flow-Field-Neuberechnung   | < 2 ms, amortisiert über mehrere Frames |
| Sichtlinienprüfungen       | max. 8 pro Frame, verteilt              |

Übersteigt die KI ihr Budget, wird die Auswertungsfrequenz entfernter
Gegner automatisch gesenkt — nie ihre Anzahl. Gegner sollen nicht
verschwinden, weil das Gerät schwach ist.
