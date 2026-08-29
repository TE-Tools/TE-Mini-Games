```markdown id="f5jzn6"
# TE MiniGames – Schützenrunde

## Projekt

TE Schützenrunde ist ein kostenloses Multiplayer-Social-Deduction-Spiel innerhalb der Plattform TE MiniGames.

Das Spiel verwendet das allgemeine Spielprinzip:

- mehrere Spieler
- geheime Rollen
- unterschiedliche Fraktionen
- Tag-/Nachtphasen
- geheime Aktionen
- Diskussion
- Abstimmung
- Ausscheiden
- Siegbedingungen
- Punkte
- soziale Gruppen

Das Spiel ist jedoch vollständig als eigenständiges Schützenspiel konzipiert.

Es soll keine bestehende Anwendung kopieren.

---

## Ziel

Das Spiel soll:

1. kostenlos spielbar sein
2. auf Mobilgeräten hervorragend funktionieren
3. 8–16 Spieler unterstützen
4. bei weniger realen Spielern automatisch Bots einsetzen können
5. ohne externe KI funktionieren
6. keine KI-API-Kosten verursachen
7. Schützenvereine und Bruderschaften als Thema verwenden
8. Züge als soziale Gruppen integrieren
9. Schützenfest und Vogelschießen als Event ermöglichen
10. langfristig Seasons, Ranglisten und Belohnungen ermöglichen
11. als Werbeträger für weitere TE-Produkte dienen

---

## WICHTIGSTE TECHNISCHE REGEL

Es darf keinerlei externe generative KI für das Gameplay verwendet werden.

Nicht verwenden:

- OpenAI API
- Claude API
- Gemini API
- Grok API
- lokale LLMs
- Machine Learning
- Training
- Embeddings
- kostenpflichtige KI-Dienste

Bots sind klassische regelbasierte Computerspieler.

---

## Hauptspiel

Normales Match:

8–16 Spieler.

Ein Match besteht aus:

Lobby
→ Rollenverteilung
→ Nacht
→ Tag
→ Diskussion
→ Abstimmung
→ Ergebnis
→ nächste Nacht
→ usw.
→ Sieg
→ Ergebnis
→ Punkte

---

## Besondere Rollen

Unter anderem:

- Brudermeister
- Stellvertretender Brudermeister
- Oberst
- Generaloberst
- Hauptmann
- Vorführer
- Korpsspieß
- Oberleutnant / Zugführer
- Leutnant
- Spieß
- Schütze
- Schriftführer
- Bruderschaftsschriftführer
- Hornist
- Schießmeister
- Musikbeauftragter
- Kassierer
- Zeugwart
- Zugsau
- Zugsau-Stellvertreter
- Intrigant
- Gerüchtemacher
- Saboteur
- Falschspieler

Eventrollen:

- Schützenkönig
- Schützenkönigin

---

## Schütze

Im normalen Spiel:

1 freier Schuss pro Partie.

Im Schützenfest-/Vogelschießen-Event:

bis zu 3 Schüsse gemäß Eventkonfiguration.

---

## Timer

Globale Standardwerte:

Nacht:
45 Sekunden

Tag:
90 Sekunden

Abstimmung:
30 Sekunden

Ergebnis:
8 Sekunden

Diese Werte müssen global konfigurierbar sein.

Zusätzlich darf eine Lobby die Werte innerhalb definierter Grenzen verändern.

Der Server ist für die Zeit verantwortlich.

---

## Züge

Spieler können:

- einen Zug gründen
- einem Zug beitreten
- Zugpunkte sammeln
- Zugranglisten erreichen
- Zugabzeichen erhalten
- gemeinsam Events spielen

---

## Monetarisierung

Das Spiel ist zunächst vollständig kostenlos.

Es gibt kein Pay-to-win.

Werbung bzw. Cross-Promotion darf nur außerhalb kritischer Spielentscheidungen stattfinden.

Beispielsweise:

- Lobby
- Hauptmenü
- Ergebnisbildschirm
- Profil

Mögliche Hinweise:

- Orchester-Orga
- Vereinsleben
- weitere TE MiniGames

---

## Entwicklungsprinzip

Bestehende TE MiniGames dürfen nicht beschädigt werden.

Vor Entwicklung:

1. Repository analysieren
2. bestehende Architektur verstehen
3. bestehende Authentifizierung identifizieren
4. vorhandene Datenbank prüfen
5. vorhandene Realtime-Funktionen prüfen
6. bestehendes Designsystem verwenden
7. vorhandene Komponenten wiederverwenden

Erst danach implementieren.
```
