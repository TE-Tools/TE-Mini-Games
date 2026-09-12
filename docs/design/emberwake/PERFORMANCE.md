# PERFORMANCE — EMBERWAKE

Stand: 2026-09-11 · Version 0.0.1 (Planung)

---

## 1. Zielwerte (§34/§77)

| Gerät                                       | Ziel   | Untergrenze |
| ------------------------------------------- | ------ | ----------- |
| Android-Einstiegsgerät (4 GB RAM, alte GPU) | 30 FPS | 24 FPS      |
| Android-Mittelklasse                        | 60 FPS | 45 FPS      |
| iPhone (aktuell)                            | 60 FPS | 60 FPS      |

**Flüssiges Spiel schlägt Grafikqualität. Immer.** Sinkt die Bildrate,
wird Optik reduziert — niemals Spielinhalt. Gegner verschwinden nicht,
weil das Gerät schwach ist.

Weitere Ziele: Startzeit unter 15 s im Mobilfunknetz, Bundle unter 900 KB
gzip, Arbeitsspeicher unter 250 MB, Level-Ladezeit unter 2 s (§84).

---

## 2. Budgets pro Frame

| Posten                                      | Budget bei 60 FPS |
| ------------------------------------------- | ----------------- |
| Gesamtes Frame                              | 16,6 ms           |
| Simulation (30 Hz, also jedes zweite Frame) | < 4 ms            |
| KI                                          | < 3 ms            |
| Kollision                                   | < 1,5 ms          |
| Rendering (CPU-Seite)                       | < 4 ms            |
| UI-Aktualisierung                           | < 1 ms            |
| Reserve                                     | Rest              |

| Szenen-Posten      | Obergrenze               |
| ------------------ | ------------------------ |
| Draw Calls         | 150                      |
| Sichtbare Dreiecke | 60.000                   |
| Echte Lichtquellen | 4 (davon 1 mit Schatten) |
| Aktive Partikel    | 200                      |
| Aktive Entities    | 120                      |
| Texturspeicher     | ~0 (Vertex-Farben!)      |

---

## 3. Die wichtigsten Maßnahmen

### 3.1 Keine Texturen

Modelle nutzen Vertex-Farben. Kein Textur-Download, kein Textur-Speicher,
keine Textur-Wechsel. Das allein eliminiert die häufigste Draw-Call-Ursache
auf Mobilgeräten und hält das Bundle klein (§35).

### 3.2 Instanzierung

Bäume, Felsen, Gras, Ressourcenknoten laufen über `InstancedMesh`:
**ein Draw Call für 500 Bäume** statt 500 Draw Calls. Ohne diese Technik
wäre eine Waldszene auf dem Handy nicht machbar.

### 3.3 Sichtweite als Gestaltungsmittel

Die Sichtweite ist pro Level ein Gameplay-Wert (§43) — nicht nur eine
Optimierung. Nebel verdeckt den Rand des geladenen Bereichs _und_
erzeugt Spannung. Technische Notwendigkeit und Design fallen zusammen.

### 3.4 Detailstufen (LOD)

Drei Stufen pro Modelltyp, umgeschaltet nach Distanz. Jenseits der
Nebelgrenze wird nichts gezeichnet.

### 3.5 Objekt-Pooling

Partikel, Projektile, Schadenszahlen, Gegner und Ressourcenknoten werden
**nie** zur Laufzeit erzeugt oder verworfen — sie werden aus Pools geholt
und zurückgegeben. Das verhindert Mikroruckler durch die Garbage Collection,
die auf Mobilgeräten besonders deutlich spürbar sind.

**Regel: Keine Objekt-Allokation im Simulationstakt.** Vektoren und Matrizen
werden aus Scratch-Objekten wiederverwendet.

### 3.6 Gestaffelte Aktualisierung

Nicht alles muss jeden Frame laufen:

| System              | Takt                       |
| ------------------- | -------------------------- |
| Bewegung, Kollision | 30 Hz                      |
| KI-Verhaltensbaum   | 1–10 Hz je nach Nähe       |
| Flow Field          | 2 Hz, über Frames verteilt |
| HUD-Zahlen          | 10 Hz                      |
| Minikarte           | 4 Hz                       |
| Speichern           | max. 1 Hz                  |

### 3.7 Schatten

Genau **eine** schattenwerfende Lichtquelle: der Kern. Schattenkarte
512² auf niedriger, 1024² auf hoher Stufe. Alle anderen Lichter werfen
keine Schatten. Auf der niedrigsten Stufe: ein einfacher Bodenschatten
unter Figuren statt echter Schattenkarte.

---

## 4. Automatische Qualitätsstufen

Beim Start wird die Geräteklasse ermittelt (GPU-Kennung, `deviceMemory`,
`hardwareConcurrency`, kurzer Rendertest über ein paar Frames).

|                      | NIEDRIG             | MITTEL | HOCH  |
| -------------------- | ------------------- | ------ | ----- |
| Pixelverhältnis      | 1,0 (max.)          | 1,5    | 2,0   |
| Schatten             | aus (Bodenschatten) | 512²   | 1024² |
| Sichtweite           | 60 m                | 90 m   | 120 m |
| Partikelbudget       | 60                  | 120    | 200   |
| Grasdichte           | 0                   | 50 %   | 100 % |
| Antialiasing         | aus                 | aus    | FXAA  |
| Bloom                | aus                 | aus    | an    |
| Instanzen-Sichtweite | 50 m                | 80 m   | 110 m |

**Dynamische Anpassung:** Fällt die Bildrate über 3 Sekunden unter den
Zielwert, wird schrittweise heruntergestuft — zuerst Pixelverhältnis,
dann Partikel, dann Schatten, dann Sichtweite. Ein Hinweis informiert den
Spieler einmalig; in den Einstellungen ist die Stufe manuell wählbar.

**Nie automatisch heruntergestuft wird die Sichtweite unter 60 m** —
darunter wäre es ein Spielvorteil oder -nachteil, kein Grafikregler.

---

## 5. Ladezeit und Bundle

- Code-Splitting: Menü und Spiel getrennt geladen
- Three.js-Import selektiv (kein Gesamtpaket)
- Kein Postprocessing-Paket auf niedrigen Stufen laden
- Audio erst nach dem ersten Levelstart nachladen, Spiel startet auch ohne
- Alle Modelle prozedural im Code → keine Modelldateien im Netzwerk
- Dev-Werkzeuge (`src/dev/`) werden im Produktionsbuild vollständig
  entfernt (`import.meta.env.DEV`-Gate, Tree Shaking)

---

## 6. Messung (§45/§77)

`src/dev/DebugOverlay.ts` zeigt im Entwicklungsmodus:

```
FPS 58 (min 41)   Frame 17,2 ms
Sim 3,1  KI 2,4  Kollision 0,9  Render 5,8
Draws 112   Tris 41k   Entities 63 (aktiv 28)
Heap 168 MB   Pools: Partikel 42/200  Gegner 28/80
Kern 61%  Ballast 71%  Phase NACHT 0:47
```

Zusätzlich werden Messwerte in `dev/Telemetry.ts` gesammelt und lokal
gespeichert — das ist die Grundlage für das Balancing (§45), solange es
keine echte Telemetrie von Spielern gibt.

**Regressionsschutz:** Ein automatisierter Performance-Test misst bei
jedem Build ein Referenzlevel headless. Steigt die Frame-Zeit um mehr als
15 % gegenüber dem letzten Stand, schlägt der Build Alarm.

---

## 7. Bekannte Fallstricke bei WebGL auf Mobilgeräten

Diese Punkte sind bereits eingeplant, nicht erst zu entdecken:

- **Kontextverlust** beim Wechsel in den Hintergrund — muss abgefangen
  werden, sonst schwarzer Bildschirm nach Rückkehr (siehe MOBILE.md)
- **`devicePixelRatio` 3,0** auf modernen Handys bedeutet neunfache
  Pixelzahl. Deckelung ist Pflicht, nicht Option
- **Web Audio startet gesperrt** — erst nach einer Nutzerberührung
- **Thermisches Drosseln** nach einigen Minuten: Deshalb greift die
  dynamische Anpassung erst nach 3 Sekunden Unterschreitung, damit sie
  nicht auf kurze Ausreißer reagiert
- **Garbage Collection** ist der Hauptgrund für Mikroruckler — siehe Pooling
