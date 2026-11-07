# Play-Store-Eintrag – fertige Texte

> Englische Fassung: [`eintrag-en.md`](eintrag-en.md), Bilder dazu in
> [`en/`](en/).

Alles, was Google beim Anlegen des Eintrags in ein Feld verlangt. Zum
Kopieren gedacht. Die Zeichengrenzen stehen dabei, weil die Play Console
stumm abschneidet.

Die Bilder liegen daneben in diesem Ordner und werden mit
`npm run build && node scripts/build-store-assets.mjs` neu erzeugt --
nach jeder sichtbaren Änderung, sonst zeigt der Eintrag eine App, die es
so nicht mehr gibt.

---

> **Vorher prüfen:** Die beiden Pflicht-Adressen unten (`/datenschutz`,
> `/konto-loeschen`) müssen erreichbar sein, bevor der Eintrag eingereicht
> wird. `/konto-loeschen` kommt mit dem Zweig `konto-loeschen-und-store`;
> und löschen kann die App erst wirklich, wenn Migration
> `026_konto_loeschen.sql` in Supabase eingespielt ist. Google prüft diese
> Adresse -- eine Seite, die es nicht gibt, kostet eine Ablehnung.

## App-Name (max. 30 Zeichen)

```
TE-Mini Games
```

## Kurzbeschreibung (max. 80 Zeichen)

```
21 kurze Spiele für zwischendurch – allein, zu zweit oder in der Gruppe.
```

(72 Zeichen.)

## Vollständige Beschreibung (max. 4000 Zeichen)

```
Nur noch eine Runde.

TE-Mini Games ist eine Sammlung kurzer Spiele für die Minuten, in denen man
nichts anfangen kann: an der Haltestelle, in der Pause, zu zweit am Tisch
oder zu sechst im Wohnzimmer. Keine Runde dauert länger als ein paar
Minuten, und man kann jederzeit aufhören.

GESCHICK UND REAKTION
• Die perfekte Sekunde – triff die Sekunde auf die Hundertstel genau. 500
  Level durch fünf Welten, vom Urwald bis zum Eispalast.
• Bienen-Flow – schick Farbblöcke los und lass die Bienen ein Bild
  Pixel für Pixel abtragen. Fünf Plätze, dann steht die Kolonie.
• Squishy Dumplings – drei gleiche Knödel in eine Reihe, gegen die Uhr.
• Trapbound – ein Sprungspiel, bei dem der Boden lügt.
• Emberwake – finde Licht in einer dunklen Welt, bevor der Kern ausgeht.

KOPF UND GEDÄCHTNIS
• Sudoku – 150 Rätsel in drei Stufen. Jede Stufe ist eine eigene Strecke.
• Was fehlt? – merken, was eben noch da war.
• Reihenfolge – die Kette wird jedes Mal länger.
• Kopfrechnen – schnelles Rechnen gegen die Uhr.

WÜRFEL, KARTEN UND BRETT
• Kniffel – dreizehn Felder, drei Würfe, Bonus ab 63. Jeder weitere Kniffel
  bringt 100 Punkte dazu.
• Texas Hold'em – Turnier gegen den Rechner oder online gegen andere.
• Mau-Mau und Letzte Karte – zwei Spielarten, jede Hausregel einzeln
  umlegbar.
• Schützenopoly – ein Brettspiel rund ums Schützenfest, mit 22 Festen aus
  ganz Deutschland.

IN DER GRUPPE, EIN GERÄT REICHT
• Finde den Imposter, Wer bin ich?, Stadt Land Fluss, Scharade,
  Wortbombe, Wer würde eher, Schützenrunde – das Handy wandert einmal
  um den Tisch.

ONLINE GEGENEINANDER
Kniffel, Texas Hold'em, Mau-Mau, Letzte Karte, Schützenopoly,
Schützenrunde, Finde den Imposter, Wer bin ich? und Stadt Land Fluss lassen
sich auch online spielen: Tisch aufmachen, Code weitergeben, losspielen.

AUF DEUTSCH UND ENGLISCH
Die App spricht beide Sprachen – mit eigenen englischen Wörtern und Fragen
für die Ratespiele, nicht übersetzten deutschen.

OHNE NETZ
Spielen, Punkte, XP, Abzeichen und der Gruppenmodus laufen ohne Internet.
Online gespielt wird nur, wenn du es willst.

WAS NICHT DRIN IST
Keine Werbung. Keine Käufe im Spiel. Kein Tracking, keine Analyse-Dienste.
Ein Konto ist freiwillig und nur für die Online-Spiele und die Rangliste
nötig; ohne Konto bleibt alles auf deinem Gerät. Das Konto lässt sich in
der App selbst wieder löschen.

Beim Poker wird mit Spielgeld gespielt. Es gibt nichts zu kaufen und nichts
zu gewinnen.
```

---

## Weitere Angaben in der Play Console

**Kategorie:** Spiele → Gelegenheitsspiele (Casual)

**Tags:** Denkspiele, Partyspiele, Kartenspiele, Brettspiele

**Kontakt-E-Mail:** te-alltagshelfer@outlook.de

**Datenschutzerklärung (Pflichtfeld):**
`https://te-mini-games.pages.dev/datenschutz`

**Konto löschen (Pflichtfeld, seit 2024 für Apps mit Konto):**
`https://te-mini-games.pages.dev/konto-loeschen`

### Inhaltsbewertung (IARC-Fragebogen)

Zwei Fragen ehrlich beantworten, sonst fliegt der Eintrag später auf:

- **Glücksspiel-Simulation: ja.** Texas Hold'em ist Poker mit Spielgeld.
  Dazu gehört: kein Einsatz echten Geldes, kein Gewinn echten Geldes,
  keine Kaufmöglichkeit für Spielgeld. Das führt in der Regel zu einer
  Einstufung ab 12 oder 16 Jahren -- das ist normal und kein Fehler.
- **Nutzer können miteinander kommunizieren: ja, eingeschränkt.** In den
  Online-Spielen sehen Mitspieler den selbst gewählten Benutzernamen. Einen
  freien Chat gibt es nicht: In der Schützenrunde wählt man am Tag einen
  von festen Sätzen, und der Server nimmt nur diese an (Migration 030).

### Datensicherheit (Data safety)

- **Erhobene Daten:** E-Mail-Adresse und selbst gewählter Benutzername --
  nur mit Konto. Spielstände, Punkte und Partien werden mit Konto
  gespeichert, um Rangliste und Online-Partien zu ermöglichen.
- **Verschlüsselt übertragen:** ja (HTTPS).
- **Löschung möglich:** ja, in der App unter „Konto löschen", und über die
  oben genannte Adresse.
- **Weitergabe an Dritte:** nein.
- **Daten für Werbung oder Tracking:** nein.

---

## Bilder in diesem Ordner

| Datei                        | Wofür                           | Google verlangt           |
| ---------------------------- | ------------------------------- | ------------------------- |
| `funktionsbild-1024x500.png` | Funktionsbild (feature graphic) | genau 1024 × 500, Pflicht |
| `telefon-*-1080x1920.png`    | Bildschirmfotos Telefon         | mindestens 2, höchstens 8 |

Das App-Symbol (512 × 512) verlangt Google separat; es entsteht beim
TWA-Build aus `public/icons/` und liegt danach im Bubblewrap-Projekt.

Für Tablets und Chromebooks verlangt Google eigene Bildschirmfotos, wenn
die App dort ausgeliefert werden soll. Solange nur Telefone als Zielgerät
angegeben sind, reichen die hier.
