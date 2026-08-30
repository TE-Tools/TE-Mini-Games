# Status: Schützenrunde

- **Stand:** **v4 implementiert** – lokale Runde **und** echtes Multiplayer
- **Implementierung:** `src/games/schuetzenrunde/` (Regeln offline),
  `supabase/migrations/007_schuetzenrunde_multiplayer.sql` (Regeln online),
  `src/services/schuetzenrundeOnline.ts`, Seite `/play/schuetzenrunde`
- **Offen:** Seasons und Zugranglisten über die Cloud
- **Quelle:** ZIP `TE_MiniGames_Schuetzenrunde_Entwicklungsgrundlage`
- **Datum Aufnahme:** 2026-08-29

## Kurzbeschreibung

Multiplayer-Social-Deduction mit Schützen-/Vereinsthema für TE MiniGames:

- 8–16 Spieler, regelbasierte Bots (**keine** externe KI)
- Tag/Nacht, Rollen, Abstimmung, Züge/Clans
- Events (Schützenkönig/-königin, Vogelschießen)
- Serverautoritativ, kostenlos / kein Pay-to-win

## Ablage

| Datei | Inhalt |
|-------|--------|
| `START_HERE.md` | Einstieg |
| `MANIFEST.json` | Constraints & Metadaten |
| `EXTRACTED_BLOCK_01.md` | Übersicht, Ziele, Regeln |
| `00_ORIGINAL_SPEZIFIKATION.txt` | Volltext-Spezifikation (wenn vorhanden) |
| `EXTRACTED_BLOCK_02.md` … `20` | Detailblöcke aus der Spez |

Vollständiger ZIP-Inhalt liegt auch im Projekt unter `docs/ideas/schuetzenrunde/` (lokal/Artifacts).

## v3 – was drin ist

**Runde**

- **8 bis 16 Teilnehmer** wählbar: du + regelbasierte Bots (keine externe KI, offline)
- 2 Saboteure, ab 12 Mitgliedern 3
- Ablauf wie in der Spezifikation: **Nacht → Tag (Diskussion) → Abstimmung →
  Ergebnis → nächste Nacht**
- **Timer je Phase**, abschaltbar: Nacht 45 s, Tag 90 s, Abstimmung 30 s,
  Ergebnis 8 s (`DEFAULT_TIMERS`), pro Lobby in Grenzen verstellbar
  (`clampTimers`, `TIMER_LIMITS`). Läuft die Zeit ab, passiert genau das, was
  der Knopf auch tun würde.

**Rollen** – je größer die Runde, desto mehr Ämter

| Amt | ab Runde | Wirkung |
|-----|----------|---------|
| Schießmeister | 8 | prüft nachts eine Person |
| Schütze | 8 | ein freier Schuss (drei beim Schützenfest) |
| Brudermeister | 8 | Doppelstimme |
| Zeugwart | 10 | schützt nachts eine Person, nie zweimal dieselbe hintereinander |
| Schriftführer | 12 | erfährt nachts über zwei Mitglieder, ob eines davon Saboteur ist |
| Oberst | 14 | übersteht den ersten Anschlag |
| Stellv. Brudermeister | 16 | erbt die Doppelstimme, wenn der Brudermeister raus ist |
| Hornist / Kassierer / Musikbeauftragter | – | einfache Mitglieder |

Saboteure: **Saboteur**, **Intrigant**, ab 10 der **Falschspieler** (wird beim
Prüfen als Bruderschaft angezeigt), ab 14 der **Gerüchtemacher** (bringt einmal
pro Partie ein Mitglied ins Gerede – Prüfungen schlagen dann fälschlich an).

**Diskussion und Abstimmung**

- Am Tag reden bis zu vier Mitspieler: Verdächtigungen folgen dem
  Verdachtszähler, Saboteure lenken auf Unschuldige, wer selbst unter Druck
  steht verteidigt sich. Jede Verdächtigung verschiebt den Verdacht.
- Nach der Abstimmung sieht man, **wer für wen gestimmt hat**

**Züge**

- Vier Züge (Jäger-, Grenadier-, Fahnen-, Hornistenzug), drei davon in kleinen
  Runden. Du wählst deinen Zug in der Lobby, die anderen werden verteilt.
- Zugpunkte pro Partie: Sieg 3, Überleben 1, Königswürde 2. Die **Zug-Bilanz**
  auf dem Startbildschirm summiert die gespeicherten Ergebnisse – ohne
  zusätzliche Tabelle.

**Schützenfest / Vogelschießen (Event)**

- Der Schütze hat **drei Schuss**
- Am Ende wird gekrönt: Wer die meisten Stimmen gegen echte Saboteure abgegeben
  hat, trägt die **Königswürde** (+100 Punkte, +40 XP)
- Die vollen 1000 Punkte gibt es nur so: gewinnen (800) + überleben (100) +
  Königswürde (100)

**Plattform**

- Punkte, XP, Rangliste und Cloud-Sync laufen über die normale Spielregistrierung

## v4 – Multiplayer

Echte Mitspieler über Supabase, **serverautoritativ**: Die Regeln liegen als
`security definer`-Funktionen in Postgres, nicht im Browser.

- **Vorraum mit Code:** Runde eröffnen, Code weitergeben, beitreten. Freie
  Plätze übernehmen beim Start die regelbasierten Mitspieler – ihr müsst also
  nicht zu acht sein.
- **Geheimhaltung:** Die Tabellen sind für Clients gesperrt. Gelesen wird nur
  über `sr_get_state()`, und die gibt fremde Rollen erst nach dem Ausscheiden
  oder am Ende der Runde heraus. Nachtaktionen sieht niemand außer dem Server.
- **Uhr:** Die Phasenzeiten prüft Postgres mit `now()`. Jeder Client darf
  `sr_tick()` anstoßen; entschieden wird in der Datenbank.
- **Tagesgespräch:** echter Chat, in den auch die Bots ihre Verdächtigungen
  schreiben.
- **Aktualisierung:** Supabase Realtime auf `sr_state` und `sr_messages`, mit
  Nachfassen alle drei Sekunden als Rückfallebene.
- Ergebnisse laufen in dieselbe Ablage wie offline – XP, Punkte, Rangliste,
  Zugpunkte.

Getestet mit `supabase/tests/schuetzenrunde.test.sql`: 54 komplette Runden über
alle Größen, dazu Geheimhaltung, Uhr und Beitritt.

## Nächster Schritt (erst wenn beauftragt)

1. Seasons und Zugranglisten über die Cloud statt nur lokal
2. Zuschauermodus und Wiederbeitritt nach Verbindungsabbruch komfortabler
3. Weitere Ämter aus der Spezifikation
