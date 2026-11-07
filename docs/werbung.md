# Werbung einschalten

**Stand:** 07.11.2026

Die App zeigt Werbung nur als **freiwilliges Belohnungsvideo**: Ein Spiel
bietet an („Video ansehen: +15 Sekunden“), der Spieler entscheidet. Die
Regeln dazu stehen oben in [`src/services/werbung.ts`](../src/services/werbung.ts)
– vor allem: **Werbung kauft Hilfe oder Aussehen, nie Punkte.** Eine Runde
mit Hilfe schreibt keinen Rekord und gibt höchstens einen Stern.

Im Code ist alles fertig. Eingeschaltet wird Werbung erst, wenn beim Bauen
die Publisher-Kennung gesetzt ist – bis dahin sieht und lädt niemand
etwas von Google.

---

## Was nur du machen kannst

### 1. Eine eigene Domain (vor dem Play-Start)

AdSense prüft die Website, auf der die Werbung läuft, und verlangt dort eine
`ads.txt` im Stammverzeichnis. Unter `te-mini-games.pages.dev` gehört dir
nur die Unterseite, nicht `pages.dev` – nach allem, was bekannt ist, nimmt
AdSense solche Unterdomains geteilter Plattformen in der Regel nicht an.
Sicher sagt es erst der Antrag.

Darum: eine Domain kaufen (z. B. `te-mini-games.de`, rund 10 € im Jahr) und
in Cloudflare unter **Workers & Pages → te-mini-games → Benutzerdefinierte
Domains** anbinden.

**Vor dem Play-Start**, weil das Android-Paket fest auf die Adresse zeigt
(`twa-manifest.json`, `public/.well-known/assetlinks.json`). Wechselt sie
danach, braucht es ein neues Paket und ein Store-Update. Den Umzug im Code
übernimmt Claude, sobald der Name feststeht.

### 2. AdSense-Konto

<https://adsense.google.com> → mit deinem Google-Konto anmelden → Website
(die neue Domain) angeben, Adresse und Bankverbindung eintragen, die
Steuerangaben ausfüllen. Google prüft die Seite; das dauert Tage bis
Wochen.

Danach steht oben rechts unter **Konto → Kontoinformationen** die
**Publisher-ID** (`pub-…`). Für die App wird daraus `ca-pub-…`.

### 3. Spiele-Werbung beantragen (H5 Games Ads)

Belohnungsvideos in Web-Spielen laufen über Googles **Ad Placement API**
(„H5 Games Ads“). Dafür gibt es einen eigenen Antrag über die Hilfeseite von
AdSense (Suchbegriff „H5 Games Ads“). Ohne Freigabe kommen keine Videos – die
App zeigt dann einfach keine Angebote.

### 4. Einwilligungsfenster (EU)

In AdSense unter **Datenschutz und Mitteilungen → Europäische Vorschriften**
eine Mitteilung erstellen und für die Domain veröffentlichen. Google
verlangt für Werbung in der EU ein zertifiziertes Einwilligungsfenster; das
von Google selbst ist kostenlos und wird von der App automatisch mitgeladen.
Den Widerruf erreicht man in der App über **Datenschutz → Einstellungen für
Werbung öffnen**.

### 5. Einschalten

Cloudflare → **Workers & Pages → te-mini-games → Einstellungen → Variablen
und Geheimnisse** → für **Production**:

| Variable              | Wert                       |
| --------------------- | -------------------------- |
| `VITE_ADSENSE_CLIENT` | `ca-pub-…` (deine Kennung) |

Dann einmal neu bauen lassen (oder etwas pushen). Ab dann:

- gibt es `https://<deine-domain>/ads.txt` (wird beim Bauen erzeugt),
- bieten die Spiele Videos an, sobald Google welche hat,
- zeigen Datenschutzerklärung und Startseite die Texte mit Werbung.

**Vor der Freigabe testen:** zusätzlich `VITE_WERBUNG_TEST` = `on` setzen –
dann liefert Google Testvideos, die nichts abrechnen. Vor dem echten Start
wieder entfernen.

### 6. Play Console

In der Checkliste [`store/play-console-todo.md`](store/play-console-todo.md)
stehen die Antworten mit Werbung: **Anzeigen: Ja** und die geänderte
Datensicherheit.

### 7. Steuer

Werbeeinnahmen sind Umsatz von TE-Digital und zählen zur
Kleinunternehmer-Grenze. Wie die Zahlungen von Google Ireland zu verbuchen
sind, klärst du am besten einmal mit einem Steuerberater.

---

## Wo die Spiele Videos anbieten

Der Name in der letzten Spalte ist die Platzierung, unter der die Stelle in
den AdSense-Berichten erscheint.

### Hilfen -- höchstens einmal je Versuch

Gewertet wird eine Runde mit Hilfe immer gleich, zentral in
`saveGameResult` (`src/games/hilfe.ts`): 0 Punkte, 0 XP, höchstens ein
Stern, kein Rekord. Das nächste Level wird trotzdem frei.

| Spiel                | Wann                                                                         | Was es gibt                                          | Platzierung               |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------- |
| Squishy Dumplings    | „Zeit um!“                                                                   | +15 Sekunden, gleiches Brett                         | `squishy-zeit`            |
| Bienen-Flow          | „Die Kolonie steht“                                                          | einen Platz freiräumen                               | `bienen-platz`            |
| Sudoku               | Gitter voll, aber falsch (wenn Fehler nicht angezeigt werden)                | falsche Ziffern entfernen                            | `sudoku-hilfe`            |
| Trapbound            | ab 10 Toden im selben Versuch                                                | Level überspringen (ohne Sterne, Bestzeit, Kristall) | `trapbound-ueberspringen` |
| Emberwake            | Todesbildschirm, einmal je Lauf                                              | wiederbeleben im Lager                               | `emberwake-wiederbeleben` |
| Die perfekte Sekunde | Fehlschuss, der schon gemachte Treffer kosten würde (Torlevel, ab Level 241) | noch ein Versuch, Treffer bleiben                    | `sekunde-versuch`         |
| Reihenfolge          | nach einem falschen Tipp                                                     | Folge noch einmal ansehen, ab dem Fehler weiter      | `reihenfolge-chance`      |
| Kopfrechnen          | Runde nicht geschafft                                                        | falsche Aufgaben durch neue ersetzen, Uhr läuft neu  | `kopfrechnen-chance`      |
| Was fehlt?           | vor der Antwort                                                              | alle Dinge noch einmal sehen                         | `wasfehlt-chance`         |

### Sonderitems -- dauerhaft, nur Aussehen

| Wo                           | Was                                             | Platzierung             |
| ---------------------------- | ----------------------------------------------- | ----------------------- |
| Squishy Dumplings, Sammlung  | Sternschnuppen-Bao                              | `squishy-sonderknoedel` |
| Trapbound, Sammlung          | Figur „Glut“ mit Leuchtspur                     | `trapbound-farbe`       |
| Profil                       | sechs Gesichter (🐲 🦉 🐙 🤖 👽 🦖)             | `gesicht-freischalten`  |
| Kniffel                      | Würfel Gold, Holz, Nacht, Kirsche               | `kniffel-wuerfel`       |
| Mau-Mau, Letzte Karte, Texas | Rückseiten Wald, Bordeaux, Kupfer, Sternennacht | `karten-ruecken`        |

Freigeschaltetes liegt auf dem Gerät und bleibt auch ohne Netz. Online sieht
nur man selbst sein Design.

### Ohne Werbung

Partyspiele und alle Online-Partien. Die Liste offener Räume, die Rangliste
und die Rechtsseiten auch.
