# Status: Schützenrunde

- **Stand:** nur Idee / Spezifikation im Repo
- **Implementierung:** noch **nicht** gestartet (explizit zurückgestellt)
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

## Nächster Schritt (erst wenn beauftragt)

1. Bestehende TE-Mini-Games-Architektur analysieren
2. Game-Modul-Plan unter `src/games/`
3. Multiplayer/Realtime separat konzipieren
4. **Kein** Code für Schützenrunde ohne expliziten Auftrag
