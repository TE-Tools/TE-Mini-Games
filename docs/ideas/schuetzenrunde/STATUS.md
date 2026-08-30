# Status: Schützenrunde

- **Stand:** **v1 implementiert** (lokale Runde gegen regelbasierte Bots)
- **Implementierung:** `src/games/schuetzenrunde/`, Seite `/play/schuetzenrunde`
- **Offen:** echtes Multiplayer (8–16 reale Spieler, serverautoritativ), Züge/Clans,
  Events (Schützenkönig, Vogelschießen), Seasons – siehe Spezifikation
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

## v1 – was drin ist

- 8 Teilnehmer: du + 7 regelbasierte Bots (keine externe KI, offline)
- 2 Saboteure gegen die Bruderschaft
- Rollen: Brudermeister (Doppelstimme), Schießmeister (prüft nachts eine Person),
  Schütze (ein freier Schuss pro Partie), Hornist, Saboteur, Intrigant
- Ablauf: Nacht → Tag → Abstimmung → Ergebnis → nächste Nacht
- Siegbedingungen, Verlauf/Log, Punkte und XP über die normale Spielregistrierung

## Nächster Schritt (erst wenn beauftragt)

1. Realtime-Multiplayer (Supabase Realtime oder eigener Server), serverautoritative Zeit
2. Lobby für 8–16 reale Spieler, Bots nur zum Auffüllen
3. Züge/Clans, Events (Schützenfest, Vogelschießen), Seasons
4. Weitere Rollen aus der Spezifikation
