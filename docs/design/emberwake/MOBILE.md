# MOBILE & PWA — EMBERWAKE

Stand: 2026-09-11 · Version 0.0.1 (Planung)

---

## 1. Es ist eine PWA, keine native App

Das Spiel wird über eine URL aufgerufen. Der Browser bietet
„Zum Startbildschirm hinzufügen" an. Danach:

- eigenes Icon im App-Drawer
- Start im Vollbild ohne Adressleiste (`display: fullscreen`)
- funktioniert offline (Service Worker)
- Updates kommen automatisch beim nächsten Start

Kein Play Store, kein App Store, kein Review, kein Entwicklerkonto,
keine Gebühren.

---

## 2. Was auf welcher Plattform funktioniert

Ehrliche Bestandsaufnahme — das sind die realen Grenzen einer PWA:

| Funktion                     | Android (Chrome)           | iOS (Safari)                    |
| ---------------------------- | -------------------------- | ------------------------------- |
| Installation als App         | ✅ mit Installationsdialog | ✅ manuell über „Teilen"        |
| Vollbild ohne Browser-Leiste | ✅                         | ✅ (nur nach Installation)      |
| WebGL2                       | ✅                         | ✅                              |
| Offline (Service Worker)     | ✅                         | ✅                              |
| IndexedDB                    | ✅                         | ✅                              |
| Web Audio                    | ✅                         | ✅ (erst nach erster Berührung) |
| **Vibration / Haptik**       | ✅                         | ❌ **nicht unterstützt**        |
| **Querformat sperren**       | ✅                         | ❌ **nicht unterstützt**        |
| Bildschirm wachhalten        | ✅                         | ✅ (Safari 16.4+)               |
| Speicher dauerhaft           | ✅ meist gewährt           | ⚠️ eingeschränkt                |

### Umgang mit den iOS-Lücken

- **Keine Haptik:** Jede Vibration bekommt zusätzlich ein visuelles und
  akustisches Gegenstück (Bildschirmruck, Aufblitzen, Klang). Auf iOS
  fehlt damit nur eine von drei Rückmeldungen, nicht die Information.
- **Keine Orientierungssperre:** Das Spiel funktioniert in **beiden**
  Ausrichtungen. Das UI-Layout ist dafür ausgelegt, nicht nur skaliert.
  Ein dezenter Hinweis empfiehlt Querformat, erzwingt es aber nicht.
- **Speicherräumung:** Siehe SAVE_SYSTEM.md — localStorage-Spiegel,
  `navigator.storage.persist()`, manueller Export.

---

## 3. Steuerungskonzept (§31)

```
┌──────────────────────────────────────────────────────┐
│ ❤❤❤   [████░░ Kern 62%]        Ziel: 30 Holz    ⏸  │
│                                            ┌──────┐  │
│                                            │ Mini │  │
│                                            │ karte│  │
│                                            └──────┘  │
│                                                      │
│                  (Spielfeld / Kamera-Ziehbereich)    │
│                                                      │
│                                                      │
│      ╭───╮                            ╭────────╮     │
│     ╭┤ ● ├╮                           │ SAMMELN│     │
│     ╰┴───┴╯                           ╰────────╯     │
│    Joystick                       ╭───╮    ╭───╮     │
│  [██████░░ Ballast 71%]           │⚔ │    │🏃│     │
└──────────────────────────────────────────────────────┘
```

### Linker Daumen — Bewegung

**Dynamischer Joystick:** Er erscheint dort, wo der Daumen die linke
Bildschirmhälfte berührt, nicht an einer festen Stelle. Das ist der
entscheidende Unterschied zwischen einer Steuerung, die funktioniert,
und einer, die nervt — der Spieler muss nicht hinsehen, um zu treffen.

### Rechter Daumen — Handlung

- **Große kontextabhängige Haupttaste** (72 dp): Sammeln, Bauen,
  Aufheben, Sprechen. Beschriftung und Symbol wechseln mit dem Kontext.
- **Angriff** (64 dp) — nur sichtbar, wenn ein Gegner in Reichweite ist
- **Sprint** (56 dp) — Umschalter, kein Halten

### Kamera

Folgt automatisch. Ziehen in der rechten Bildschirmhälfte (außerhalb der
Tasten) dreht die Kamera. Zwei Finger zoomen. Kein Pflicht-Kamerasteuern:
**Das Spiel muss ohne eine einzige Kameraeingabe vollständig spielbar sein.**

### Regeln, die eingehalten werden

- Kein Bedienelement unter 48 dp (§31)
- Alles Wichtige in Daumenreichweite, nichts in der Bildschirmmitte oben
- `env(safe-area-inset-*)` für Notches und Gestenleisten
- `touch-action: none`, kein Doppeltipp-Zoom, kein versehentliches Scrollen
- Berührungen mit mehr als 12 mm Fläche (Handballen) werden ignoriert
- **Alles ist einhändig grundsätzlich bedienbar** — beidhändig nur komfortabler

---

## 4. Bildschirmgrößen

| Klasse | Auflösung  | Anpassung                               |
| ------ | ---------- | --------------------------------------- |
| Klein  | 360 × 640  | Minimalen HUD, Minikarte nur auf Tippen |
| Mittel | 390 × 844  | Standard                                |
| Groß   | 430 × 932  | Größere Sicherheitsabstände             |
| Tablet | 820 × 1180 | HUD an die Ränder, Spielfeld größer     |

Getestet wird verbindlich gegen **360 × 640** (§46). Was dort funktioniert,
funktioniert überall.

---

## 5. App-Lebenszyklus (§60)

| Ereignis                       | Reaktion                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `visibilitychange` → verborgen | Sofort speichern, Simulation anhalten, Audio stummschalten, Renderschleife stoppen |
| `visibilitychange` → sichtbar  | Pausenmenü zeigen (nie blind weiterlaufen lassen), Audio-Kontext fortsetzen        |
| `pagehide`                     | Sofort speichern (letzte verlässliche Gelegenheit)                                 |
| `webglcontextlost`             | Renderschleife stoppen, Verlust abfangen                                           |
| `webglcontextrestored`         | Grafikressourcen neu erstellen, Spielzustand ist unberührt                         |
| Anruf / Sperrbildschirm        | Wie „verborgen"                                                                    |
| Rückkehr nach langer Pause     | Verstrichene Zeit wird **nicht** simuliert. Pause bedeutet Pause                   |

Der letzte Punkt ist wichtig: Ein Spiel, das während eines Anrufs
weiterläuft und den Spieler tot zurücklässt, verliert den Spieler.

---

## 6. Haptik (§37)

| Ereignis            | Muster      |
| ------------------- | ----------- |
| Ressource gesammelt | 10 ms       |
| Treffer gelandet    | 20 ms       |
| Schaden erhalten    | 40 ms       |
| Kern unter 20 %     | 30-50-30 ms |
| Tod                 | 200 ms      |

In den Einstellungen abschaltbar. Standardmäßig an, wo unterstützt.

---

## 7. Offline und Updates

Service Worker (Workbox über `vite-plugin-pwa`):

- **Precache:** App-Shell, JS, CSS, Icons — alles, was zum Spielen nötig ist
- **Audio:** Cache-first mit Nachladen. Das Spiel startet auch ohne Ton
- **Strategie:** Der Service Worker lädt eine neue Version im Hintergrund,
  aktiviert sie aber **nie mitten im Spiel**. Nach dem Levelende erscheint
  ein dezenter Hinweis „Neue Version verfügbar — neu starten?"

Ein Update, das eine laufende Runde abbricht, wäre ein Fehler.

---

## 8. Erster Start

1. Titelbild mit einer einzigen großen Taste „Spielen"
   (die erste Berührung schaltet Web Audio frei — technisch notwendig,
   für den Spieler unsichtbar)
2. Vollbild anfordern, Querformat vorschlagen
3. `navigator.storage.persist()` anfragen
4. Geräteklasse ermitteln, Qualitätsstufe setzen (siehe PERFORMANCE.md)
5. Direkt in Level 1 — **kein Konto, keine Anmeldung, keine Abfrage**

Ziel: **unter 15 Sekunden** von der URL bis zur ersten Spielerbewegung.

---

## 9. Testmatrix (§46)

| Gerät / Umgebung                    | Ziel                     |
| ----------------------------------- | ------------------------ |
| Android-Mittelklasse, Chrome        | 60 FPS                   |
| Android-Einstiegsgerät (4 GB RAM)   | ≥ 30 FPS                 |
| iPhone, Safari, installiert         | 60 FPS                   |
| 360 × 640                           | Vollständig bedienbar    |
| Hochformat und Querformat           | Beides spielbar          |
| Flugmodus nach erstem Start         | Voll spielbar            |
| Während des Spiels Anruf simulieren | Kein Fortschrittsverlust |
