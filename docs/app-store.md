# Die App in den Store bringen

**Stand:** 02.09.2026

Die App ist eine PWA. Auf dem Handy lässt sie sich schon heute über „App
installieren" auf den Startbildschirm legen – sie sieht dann aus wie eine
App, läuft offline und hat einen eigenen Startbildschirm. Für die **Stores**
braucht es zusätzlich eine Hülle.

Was im Repo vorbereitet ist, steht unten. Was nur du machen kannst –
Konten, Schlüssel, Einreichung – steht bei jedem Schritt dabei.

## Was schon fertig ist

| Punkt | Wo |
|---|---|
| Manifest mit Name, Symbolen, Farben | `vite.config.ts` (`VitePWA` → `manifest`) |
| Symbole 192/512 px, dazu maskierbar | `public/icons/` |
| Startbildschirm der Seite (sofort sichtbar, noch ohne JavaScript) | `index.html` (`#splash`) |
| 12 Startbilder für iOS | `public/splash/`, erzeugt von `scripts/build-splash-screens.mjs` |
| Digital Asset Links (Vorlage) | `public/.well-known/assetlinks.json` |
| Bubblewrap-Konfiguration | `twa-manifest.json` |
| JSON-Typ für die Asset-Links | `public/_headers` |

Die Startbilder werden **nicht** in den Offline-Vorrat gelegt
(`globIgnores: ['splash/**']`): Sie sind zusammen rund 3 MB und werden nur
beim Start aus dem normalen Browser-Cache geladen.

## Google Play (der realistische Weg)

Android kann eine PWA als **Trusted Web Activity** verpacken. Die App im
Store ist dann eine dünne Hülle, die deine echte Seite anzeigt – ohne
Adressleiste, ohne Browser-Rahmen. Jede Änderung an der Seite ist sofort
in der App, ohne Update im Store.

**Was du brauchst**

- Ein Google-Play-Entwicklerkonto: **einmalig 25 US-Dollar**
- Node.js auf dem Rechner (hast du) und einmalig ein Java-SDK — Bubblewrap
  lädt sich das Nötige selbst herunter und fragt dabei nach

**Schritte**

1. Bubblewrap installieren und das Projekt erzeugen:

   ```bash
   npm install -g @bubblewrap/cli
   bubblewrap init --manifest https://te-mini-games.pages.dev/manifest.webmanifest
   ```

   Die Fragen sind mit `twa-manifest.json` in diesem Repo schon beantwortet –
   du kannst die Datei ins Bubblewrap-Verzeichnis kopieren und `bubblewrap
   build` direkt aufrufen.

2. Beim ersten Lauf legt Bubblewrap einen **Signierschlüssel** an
   (`android.keystore`). **Diesen Schlüssel gut aufheben und niemals ins
   Repo legen.** Geht er verloren, kannst du die App im Store nie wieder
   aktualisieren – Google lässt kein zweites Zertifikat für dieselbe App zu.

3. Den Fingerabdruck des Schlüssels ausgeben lassen:

   ```bash
   keytool -list -v -keystore android.keystore -alias te-mini-games
   ```

   Die Zeile `SHA256:` kopieren (die Doppelpunkte bleiben drin).

4. Den Fingerabdruck in `public/.well-known/assetlinks.json` eintragen –
   dort steht bisher nur ein Platzhalter – und die Seite neu ausrollen.
   Prüfen lässt sich das danach mit dem
   [Digital Asset Links Tester](https://developers.google.com/digital-asset-links/tools/generator).

   **Ohne diesen Schritt zeigt die App eine Adressleiste** – Android traut
   der Hülle sonst nicht.

5. `bubblewrap build` erzeugt eine `.aab`-Datei. Die lädst du in der Play
   Console hoch (App anlegen → Produktion → Neues Release).

6. Google will außerdem: Kurzbeschreibung, ausführliche Beschreibung, ein
   Symbol (512 × 512, hast du), ein Feature-Grafikbild (1024 × 500),
   mindestens zwei Screenshots je Geräteklasse, eine
   **Datenschutzerklärung als URL** und die Angaben zur Datensicherheit.

   Zur Datensicherheit: Die App speichert Spielstände lokal (IndexedDB) und
   – nur bei angemeldeten Nutzern – in Supabase. Erhoben werden
   E-Mail-Adresse und Benutzername; Werbung und Tracking gibt es nicht.

**Wie lange das dauert:** Die erste Prüfung durch Google dauert
erfahrungsgemäß einige Tage.

## Apple App Store (ehrlich gesagt: mühsam)

Für iOS gibt es keinen zu Bubblewrap gleichwertigen Weg.

- Es braucht einen **Mac mit Xcode** und ein Apple-Entwicklerkonto
  (**99 US-Dollar im Jahr**, nicht einmalig).
- Eine PWA lässt sich in eine WKWebView packen (z. B. mit
  [PWABuilder](https://www.pwabuilder.com/)), aber Apple lehnt reine
  Web-Hüllen nach Richtlinie 4.2 („Minimum Functionality") regelmäßig ab.
  Ohne echte native Funktionen ist das ein Glücksspiel.

**Empfehlung:** Auf iOS bleibt „Zum Home-Bildschirm hinzufügen" in Safari
der praktikable Weg. Genau dafür sind die Startbilder in `public/splash/`
da – die installierte App startet dann mit deinem Bild statt mit einer
weißen Fläche und ist von einer Store-App kaum zu unterscheiden.

Wenn die App später wirklich in den App Store soll, ist der ehrliche Weg
eine echte native Hülle mit mindestens einer nativen Funktion
(z. B. Mitteilungen) – das ist ein eigenes Projekt.

## Startbilder neu bauen

Nach Änderungen an Farben oder Namen:

```bash
node scripts/build-splash-screens.mjs
```

Das Skript rendert die Bilder mit dem Chromium, der ohnehin für die Tests da
ist, und legt sie in `public/splash/` ab. Die dazugehörigen `<link>`-Zeilen
für `index.html` schreibt es gleich mit in
`public/splash/index-html-snippet.txt`.
