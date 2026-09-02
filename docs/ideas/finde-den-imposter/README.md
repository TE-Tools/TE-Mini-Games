# Finde den Imposter

**Status: MVP „Klassisch" integriert (02.09.2026)** — siehe [STATUS.md](./STATUS.md)

Die vollständige Spezifikation kam am 01.09.2026 von Thomas (geheimes Wort,
Hinweise, Abstimmung, letzte Chance, eigene Kategorien, ~1000 Wörter, 7 Modi).
Umgesetzt und live ist davon der **Klassisch-Modus** samt Doppel-Imposter.

- Menü-Button 😈 und Route `/play/finde-den-imposter` sind verdrahtet
- **Ohne Punkte und ohne Rangliste** – das Spiel speichert bewusst kein
  Ergebnis (02.09.2026, Thomas' Vorgabe)
- Engine ist UI-unabhängig (`src/games/finde-den-imposter/engine.ts`) und
  durch Tests abgedeckt (`tests/finde-den-imposter.test.ts`)

**Was aus der Spezifikation noch fehlt, steht vollständig in STATUS.md** —
kurz: fünf weitere Modi, Wortschatz von ~300 auf 1000, eigene Kategorien
samt Import/Export, Online-Mehrspieler.
