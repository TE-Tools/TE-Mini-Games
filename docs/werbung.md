# Werbung einschalten

**Stand:** 07.11.2026

Die App zeigt Werbung nur als **freiwilliges Belohnungsvideo**: Ein Spiel
bietet an („Video ansehen: +15 Sekunden“), der Spieler entscheidet. Die
Regeln dazu stehen oben in [`src/services/werbung.ts`](../src/services/werbung.ts)
– vor allem: **Werbung kauft Hilfe oder Aussehen, nie Punkte.** Eine Runde
mit Hilfe schreibt keinen Rekord und gibt höchstens einen Stern.

**Zwei Wege, ein Baustein** (seit 07.11.2026):

| Wo          | Wer liefert die Videos | Eingeschaltet über                                               |
| ----------- | ---------------------- | ---------------------------------------------------------------- |
| Android-App | **Google AdMob**       | `VITE_ADMOB_BELOHNUNG` (Cloudflare) + `ADMOB_APP_ID` (GitHub)    |
| Browser/PWA | Google AdSense         | `VITE_ADSENSE_CLIENT` (Cloudflare) -- braucht eine eigene Domain |

Entschieden ist AdMob: Dafür braucht es keine eigene Domain. Die Play-App
ist deshalb eine Capacitor-App statt einer Trusted Web Activity
([`capacitor.config.ts`](../capacitor.config.ts)) -- sie lädt weiter die
Seite aus dem Netz, Änderungen sind sofort in der App. Im Browser bleibt
Werbung aus, solange niemand AdSense einschaltet.

Im Code ist alles fertig. Ohne die Angaben unten sieht und lädt niemand
etwas von Google.

---

## Was nur du machen kannst (AdMob)

### 1. App in AdMob anlegen

<https://admob.google.com> → **Apps** → **App hinzufügen** → Android →
„Ist die App in einem Store veröffentlicht?“ → solange nicht: **Nein**,
Name `TE-Mini Games`. Danach steht dort die **App-ID**
(`ca-app-pub-9622372327277679~…`, mit Tilde).

### 2. Anzeigenblock „Prämie“ (Belohnung)

In der App → **Anzeigenblöcke** → **Anzeigenblock hinzufügen** →
**Prämie** (Rewarded). Name z. B. `Belohnung`. Prämie: Menge `1`, Artikel
`Hilfe` (die App wertet das selbst, die Zahl ist egal). Danach steht dort
die **Anzeigenblock-ID** (`ca-app-pub-9622372327277679/…`, mit
Schrägstrich).

### 3. Einwilligungsfenster (EU)

AdMob → **Datenschutz und Mitteilungen** → **DSGVO** → Mitteilung
erstellen, für die App veröffentlichen. Die App zeigt es vor dem ersten
Video von selbst; der Widerruf liegt in der App unter **Datenschutz →
Einstellungen für Werbung öffnen**.

### 4. Die beiden IDs eintragen

- **App-ID** → GitHub → **Settings → Secrets and variables → Actions →
  Variables** → `ADMOB_APP_ID`. Sie steckt im Android-Paket; danach das
  Paket neu bauen (Actions → „Android-Paket bauen“).
- **Anzeigenblock-ID** → Cloudflare → **Workers & Pages → te-mini-games →
  Einstellungen → Variablen und Geheimnisse** → `VITE_ADMOB_BELOHNUNG`,
  dann neu bauen lassen. Die App lädt die Seite, also gilt das ohne
  Store-Update.

Beide IDs sind nicht geheim.

**Erst testen:** zusätzlich in Cloudflare `VITE_WERBUNG_TEST` = `on` --
dann kommen Googles Testvideos, auch schon ohne eigene IDs. Vor dem
echten Start wieder entfernen. **Nie auf echte eigene Videos tippen** --
AdMob sperrt Konten für Klicks auf die eigene Werbung.

### 5. app-ads.txt

Die Seite liefert `https://te-mini-games.pages.dev/app-ads.txt` mit deiner
Zeile aus. AdMob sucht sie auf der **Entwickler-Website aus dem
Play-Eintrag** -- dort `https://te-mini-games.pages.dev` angeben. Ob AdMob
eine Unteradresse auf `pages.dev` als bestätigt anerkennt, zeigt erst die
Prüfung in AdMob („app-ads.txt“). Werbung kommt auch ohne Bestätigung,
nur mit weniger Nachfrage.

### 6. Google-Anmeldung in der App

Google lässt seine Anmeldung in der App-Ansicht nicht zu; die App öffnet
sie deshalb im Browser und springt danach zurück. Dafür einmal in
Supabase → **Authentication → URL Configuration → Redirect URLs**
eintragen:

```
de.tetools.minigames://auth
```

Ohne den Eintrag scheitert nur die Anmeldung mit Google in der App;
E-Mail und Passwort gehen immer.

### 7. Play Console

In [`store/play-console-todo.md`](store/play-console-todo.md): **Anzeigen:
Ja**, die Datensicherheit und neu die **Erklärung zur Werbe-ID**.

### 8. Steuer

Werbeeinnahmen sind Umsatz von TE-Digital und zählen zur
Kleinunternehmer-Grenze. Wie die Zahlungen von Google Ireland zu verbuchen
sind, klärst du am besten einmal mit einem Steuerberater.

---

## Falls doch AdSense im Browser

Bleibt vorbereitet: AdSense-Konto mit eigener Domain, „H5 Games Ads“
beantragen, Einwilligungsfenster in AdSense, dann `VITE_ADSENSE_CLIENT`
(`ca-pub-9622372327277679`) in Cloudflare. `ads.txt` liegt schon da.

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
