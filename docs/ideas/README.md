# TE-Mini Games – Ideen / Backlog

Neue Mini-Game-Ideen werden hier abgelegt. Implementiert wird erst, wenn explizit beauftragt.

| Idee | Status | Ordner |
|------|--------|--------|
| **Schützenrunde** | **v4 implementiert** (lokal vs. Bots **und** Online-Multiplayer, serverautoritativ) | [schuetzenrunde/](./schuetzenrunde/) |
| **Finde den Imposter** | **fertig** — alle sieben Modi lokal und online, eigene Wortlisten auch online | [finde-den-imposter/](./finde-den-imposter/) |

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


## Woher weitere Spielideen kommen (02.09.2026)

Angeschaut haben wir die App **Splash – Party Spiele** (Cranberry Apps) im
Play Store, weil sie dasselbe Feld bespielt. Ihre Modi im Vergleich:

| Splash | Bei uns |
|---|---|
| Imposter | ✅ Finde den Imposter – 7 Modi, online, eigene Kategorien |
| Werewolves | ✅ Schützenrunde – Rollen, Tag/Nacht, Bots, online |
| Who Am I | ✅ Wer bin ich? – am Gerät und online |
| Charades | ✅ Scharade |
| Bomb Party | ✅ Wortbombe |
| Who's Most Likely To / Would You Rather | ✅ Wer würde eher? (beide Sorten in einem Spiel) |
| Truth or Dare | offen – der Aufwand steckt im Textschreiben, nicht im Code |
| 100 Questions / How Well Do We Know Each Other | offen |
| Taboom (Tabu) | offen – braucht fünf Tabuwörter je Begriff, echte Schreibarbeit |
| Who's the Liar / Fake or Fact | **bewusst nicht** – zu nah am Imposter bzw. laufende Faktenpflege |
| Bet Buddy, Chooser | **bewusst nicht** – kein eigenes Spiel |

Was Splash gar nicht hat und wir schon: Levelkarte 1–500, XP, Streaks,
Abzeichen und Ranglisten. Die Partyspiele sind bei uns bewusst ohne Wertung
(siehe `finde-den-imposter/STATUS.md`), die Einzelspiele dafür mit.

## Bewusst nicht gebaut

- **Reihenfolge merken und Kopfrechnen im Familien-Modus** (entschieden am
  04.09.2026). Der Familien-Modus deckt zwei der vier Solo-Spiele ab. Das
  sieht bei einer Durchsicht nach einer Lücke aus, ist aber keine: Beide
  Spiele sind als Spiel gegen sich selbst gedacht. Für gemeinsam am Tisch
  gibt es die Partyspiele.
