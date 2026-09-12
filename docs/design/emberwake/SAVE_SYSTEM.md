# SPEICHERSYSTEM — EMBERWAKE

Stand: 2026-09-11 · Version 0.0.1 (Planung)

---

## 1. Anforderung

Der Spielstand darf **niemals** verloren gehen oder beschädigt werden —
auch nicht, wenn die App mitten im Schreiben abgeschossen wird, das Gerät
in den Ruhezustand geht oder der Browser Speicher freigibt (§38/§59/§60).

Bei einer PWA ist das anspruchsvoller als bei einer nativen App, weil der
Browser den Speicher unter Umständen selbst räumt. Deshalb dieses Konzept.

---

## 2. Speicherorte

| Ebene   | Technik            | Inhalt                                           |
| ------- | ------------------ | ------------------------------------------------ |
| Primär  | **IndexedDB**      | Vollständiger Spielstand, Versionen, Laufzustand |
| Spiegel | **localStorage**   | Kleiner Notfall-Auszug (Level, Leben, Sterne)    |
| Export  | **Datei-Download** | Manuelles Backup durch den Spieler               |

Der localStorage-Spiegel ist die Versicherung: Selbst wenn IndexedDB
verloren geht, bleibt der grobe Fortschritt erhalten und der Spieler
verliert höchstens ein Level, nicht die Kampagne.

`navigator.storage.persist()` wird beim ersten Start angefragt. Das bittet
den Browser, den Speicher nicht automatisch zu räumen. Auf Android wird
das nach etwas Nutzung meist gewährt.

---

## 3. Zwei getrennte Bereiche

```
profile   Dauerhafter Fortschritt. Überlebt alles.
run       Laufender Level-Versuch. Wird beim Abschluss verworfen.
```

**`profile`** — Freigeschaltete Welten und Level, Sterne, Leben,
Basisgebäude und deren Stufen, Lagerressourcen, Ausrüstung, Funken,
gerettete Verirrte, Achievements, gefundene Geheimnisse, kosmetische
Freischaltungen, Einstellungen, Statistiken.

**`run`** — Level-ID, Seed, Zeitpunkt im Zyklus, Spielerposition,
Kern-Stand, getragenes Inventar, Gesundheit, Zustand der Gegner,
erreichte Checkpoints, Zielfortschritt.

Die Trennung erlaubt das Wichtigste aus §60: Wird die App mitten im Level
beendet, kann der Spieler **genau dort weitermachen** — und ein Absturz
während eines Levels kann den Kampagnenfortschritt nicht beschädigen.

---

## 4. Schreiben ohne Beschädigungsrisiko

Ein abgebrochener Schreibvorgang ist die häufigste Ursache für zerstörte
Spielstände. Gegenmaßnahme: **Doppelpuffer mit Zeigerumschaltung.**

```
1. Prüfsumme über die Daten bilden
2. In den gerade NICHT aktiven Slot schreiben  (slotA oder slotB)
3. Zurücklesen und Prüfsumme verifizieren
4. Erst danach den Zeiger "aktiv" umlegen      ← einzige kritische Operation
```

Schritt 4 ist ein einzelner kleiner Schreibvorgang. Bricht irgendetwas
davor ab, bleibt der alte, gültige Stand unangetastet. Es gibt kein
Zeitfenster, in dem beide Slots ungültig sind.

Beim Laden: aktiven Slot prüfen → bei Fehler den anderen Slot prüfen →
bei Fehler localStorage-Spiegel → bei Fehler Neustart mit klarer Meldung.

---

## 5. Versionierung und Migration

```ts
interface SaveEnvelope {
  version: number // Schema-Version
  checksum: string
  savedAt: number
  gameVersion: string
  data: ProfileData
}
```

`save/migrations.ts` enthält eine Kette von Migrationsfunktionen
(`1→2`, `2→3`, …). Beim Laden wird ein älterer Stand schrittweise
hochmigriert. **Ein Spielstand darf durch ein Update niemals unlesbar
werden** — das wird durch Tests mit archivierten Alt-Ständen abgesichert.

Unbekannte Felder aus einer _neueren_ Version werden beim Laden erhalten,
nicht verworfen — sonst zerstört ein Downgrade den Stand.

---

## 6. Wann gespeichert wird

| Auslöser                       | Umfang                    |
| ------------------------------ | ------------------------- |
| Level abgeschlossen            | profile                   |
| Nacht überstanden              | profile + run             |
| Checkpoint erreicht            | run                       |
| Basis verändert (Bau/Upgrade)  | profile                   |
| Achievement / Geheimnis        | profile                   |
| Leben verändert                | profile                   |
| `visibilitychange` → verborgen | profile + run, **sofort** |
| `pagehide`                     | profile + run, **sofort** |
| Alle 30 s im Spiel             | run                       |

Die beiden Lifecycle-Ereignisse sind die wichtigsten (§60): Auf Mobilgeräten
wird eine App oft ohne weitere Vorwarnung eingefroren und später
verworfen. `visibilitychange` ist die letzte zuverlässige Gelegenheit zum
Schreiben. `beforeunload` ist auf Mobilgeräten **nicht** verlässlich und
wird nicht als einzige Absicherung verwendet.

Schreibvorgänge werden zusammengefasst (maximal einer pro Sekunde), damit
sie keine Ruckler verursachen.

---

## 7. Import und Export

Weil eine PWA keinen Store-Backup-Mechanismus hat, bekommt der Spieler
in den Einstellungen:

- **Spielstand exportieren** → lädt eine `.ewsave`-Datei herunter (JSON)
- **Spielstand importieren** → Datei auswählen, Validierung, Bestätigung

Das ist gleichzeitig der Weg, den Spielstand auf ein anderes Gerät zu
bringen, solange es keine Cloud-Speicherung gibt (§61).

---

## 8. Fehlerbehandlung (§59)

| Fehler                                  | Reaktion                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| IndexedDB nicht verfügbar (Privatmodus) | Auf localStorage ausweichen, Hinweis anzeigen                         |
| Kontingent überschritten                | Alte Laufzustände löschen, erneut versuchen, sonst warnen             |
| Beide Slots beschädigt                  | localStorage-Spiegel anbieten, sonst Neustart mit Erklärung           |
| Schema aus der Zukunft                  | Laden verweigern, Aktualisierung empfehlen, Stand nicht überschreiben |
| Migration schlägt fehl                  | Original behalten, Fehler protokollieren, Nutzer informieren          |

**Grundsatz: Im Zweifel niemals überschreiben.** Ein Spiel, das den
Spielstand nicht laden kann, ist ärgerlich. Ein Spiel, das ihn beim
Versuch zerstört, ist unverzeihlich.

---

## 9. Tests (§46)

- Schreiben mitten im Vorgang abbrechen → alter Stand bleibt gültig
- Jeden Slot einzeln beschädigen → Wiederherstellung greift
- Alte Schema-Versionen laden → Migration prüfen
- Kontingent künstlich erschöpfen → sauberer Fehlerpfad
- Sichtbarkeitswechsel während eines Levels → Fortsetzung exakt an der Stelle
- Export/Import Rundlauf → byte-gleiches Ergebnis
