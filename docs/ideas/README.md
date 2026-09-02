# TE-Mini Games – Ideen / Backlog

Neue Mini-Game-Ideen werden hier abgelegt. Implementiert wird erst, wenn explizit beauftragt.

| Idee | Status | Ordner |
|------|--------|--------|
| **Schützenrunde** | **v4 implementiert** (lokal vs. Bots **und** Online-Multiplayer, serverautoritativ) | [schuetzenrunde/](./schuetzenrunde/) |
| **Finde den Imposter** | **MVP „Klassisch“ integriert** (lokal Pass-and-Play) — weitere Modi offen | [finde-den-imposter/](./finde-den-imposter/) |

## Schützenrunde (Kurz)

- Multiplayer Social-Deduction mit Schützen-/Vereinsthema
- 8–16 Spieler, regelbasierte Bots (keine externe KI)
- Tag/Nacht, Rollen, Abstimmung, Züge/Clans, Events (Schützenkönig)
- Serverautoritativ, kostenlos / kein Pay-to-win

Details und Originalspezifikation: `schuetzenrunde/START_HERE.md` und `schuetzenrunde/00_ORIGINAL_SPEZIFIKATION.txt`.

## Finde den Imposter (Kurz)

- Partyspiel am **einen** Gerät oder **online** mit eigenen Handys, 3–12
  Mitspielende
- Alle bekommen ein geheimes Wort — die Imposter nur ein einzelnes Hilfswort
- Danach nennt ein Bildschirm nur, wer zufällig anfängt; geredet wird frei,
  wie viele Wortrunden man dreht, klärt die Gruppe selbst
- Gemeinsam tippt die Runde auf einen Namen; war es ein Imposter, bekommt er
  die **letzte Chance**, das Wort zu erraten
- **Ohne Punkte und ohne Rangliste** — wer gewonnen hat, sieht man am Tisch

**Alle sieben Modi sind spielbar** (Klassisch, Doppel-Imposter, Nur
Kategorie, Leer, Tempo, Chaos, Duell), am einen Gerät und – bis auf Duell –
auch online. Der Wortschatz umfasst 1000 Wörter in 20 Kategorien, dazu
kommen eigene Kategorien mit Import/Export. Offen ist nur noch Duell online.
Details: `finde-den-imposter/STATUS.md`.
