# Die App in den Store bringen

**Stand:** 31.10.2026

Die App ist eine PWA. Auf dem Handy lässt sie sich schon heute über „App
installieren" auf den Startbildschirm legen – sie sieht dann aus wie eine
App, läuft offline und hat einen eigenen Startbildschirm. Für die **Stores**
braucht es zusätzlich eine Hülle.

Was im Repo vorbereitet ist, steht unten. Was nur du machen kannst –
Konten, Schlüssel, Einreichung – steht bei jedem Schritt dabei.

## Was schon fertig ist

| Punkt                                                             | Wo                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Manifest mit Name, Symbolen, Farben                               | `vite.config.ts` (`VitePWA` → `manifest`)                        |
| Symbole 192/512 px, dazu maskierbar                               | `public/icons/`                                                  |
| Startbildschirm der Seite (sofort sichtbar, noch ohne JavaScript) | `index.html` (`#splash`)                                         |
| 12 Startbilder für iOS                                            | `public/splash/`, erzeugt von `scripts/build-splash-screens.mjs` |
| Digital Asset Links (Vorlage)                                     | `public/.well-known/assetlinks.json`                             |
| Bubblewrap-Konfiguration                                          | `twa-manifest.json`                                              |
| JSON-Typ für die Asset-Links                                      | `public/_headers`                                                |
| Konto löschen in der App und als öffentliche Seite                | `/auth` (ganz unten) und `/konto-loeschen`                       |

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

3. Den Fingerabdruck des eigenen Schlüssels ausgeben lassen:

   ```bash
   keytool -list -v -keystore android.keystore -alias te-mini-games
   ```

   Die Zeile `SHA256:` kopieren (die Doppelpunkte bleiben drin).

4. **Wichtig, und hier geht es am häufigsten schief:** Google signiert die
   App im Store in aller Regel selbst neu (_Play App Signing_, bei neuen
   Apps der Standard). Dein Schlüssel ist dann nur der **Upload**-Schlüssel
   – die App, die auf dem Telefon landet, trägt **Googles** Signatur. In
   `assetlinks.json` muss deshalb Googles Fingerabdruck stehen, nicht nur
   deiner.

   Zu finden ist er in der Play Console unter
   **Test und Veröffentlichung → App-Integrität → App-Signaturschlüssel**
   als `SHA-256-Zertifikat-Fingerabdruck`. Er existiert erst, wenn du das
   erste Mal ein Bundle hochgeladen hast.

   Trag **beide** in `public/.well-known/assetlinks.json` ein – Googles für
   die Fassung aus dem Store, deinen für die, die du selbst aufs Telefon
   schiebst:

   ```json
   "sha256_cert_fingerprints": [
     "AB:CD:…  (Play App Signing, aus der Play Console)",
     "12:34:…  (dein Upload-Schlüssel, aus keytool)"
   ]
   ```

   Danach die Seite neu ausrollen. Prüfen lässt sich das mit dem
   [Digital Asset Links Tester](https://developers.google.com/digital-asset-links/tools/generator).

   **Stimmt der Fingerabdruck nicht, zeigt die App eine Adressleiste** –
   Android traut der Hülle sonst nicht. Sie funktioniert, sieht aber aus
   wie ein Browser mit deiner Seite darin.

5. `bubblewrap build` erzeugt eine `.aab`-Datei. Die lädst du in der Play
   Console hoch (App anlegen → Produktion → Neues Release).

   Zwei Dinge, die dabei aufhalten – beide hier ausprobiert:

   - **Das Passwort für den Schlüsselspeicher wird abgefragt**, und zwar
     mehrfach. Wer das Skript ohne Eingabe laufen lässt, hängt in einer
     Endlosschleife („Minimum length is 6"). Ohne Rückfragen geht es mit
     Umgebungsvariablen:

     ```bash
     BUBBLEWRAP_KEYSTORE_PASSWORD=… BUBBLEWRAP_KEY_PASSWORD=… bubblewrap build
     ```

   - **Beim ersten Lauf lädt Bubblewrap ein eigenes JDK und das
     Android-SDK** – zusammen rund 1,4 GB nach `~/.bubblewrap`. Das dauert
     und braucht eine Verbindung, die nicht gedrosselt wird: Hinter einem
     geteilten Proxy bricht Gradle gern mit `429 Too Many Requests` von
     `repo1.maven.org` ab. Dann einfach noch einmal starten; was schon
     geladen ist, bleibt liegen.

### Der einfachere Weg: bauen lassen

Das Paket muss nicht auf dem eigenen Rechner entstehen. Im Projekt liegen
zwei Abläufe unter _Actions_:

1. **Android-Schlüssel erzeugen** -- einmalig. Vorher zwei Geheimnisse
   anlegen (_Settings → Secrets and variables → Actions_):
   `ANDROID_KEYSTORE_PASSWORD` und `ANDROID_KEY_PASSWORD`, je mindestens
   sechs Zeichen. Der Ablauf legt den Schlüssel an und stellt ihn als
   Artefakt bereit. Herunterladen, **sicher aufbewahren** (ohne ihn gibt es
   keine Updates mehr), den Inhalt von `android.keystore.base64` als
   drittes Geheimnis `ANDROID_KEYSTORE_BASE64` hinterlegen, dann das
   Artefakt löschen.
2. **Android-Paket bauen** -- jedes Mal. Erzeugt `app-release-bundle.aab`
   für den Store und `app-release-signed.apk` zum Ausprobieren, beide mit
   dem eigenen Schlüssel signiert. Versionsname und Versionsnummer lassen
   sich beim Start angeben; die Nummer muss bei jedem Upload zu Play
   größer sein als zuvor.

Die Zusammenfassung des Laufs nennt den SHA-256 des Schlüssels -- genau
den, der in `assetlinks.json` gehört.

Beim Bau selbst sind zwei Dinge aufgefallen, die ohne einen echten
Durchlauf unsichtbar bleiben: `jcenter()` in Bubblewraps Vorlage ist seit
2021 abgeschaltet und leitet auf `repo1.maven.org` um (beide Abläufe
nehmen deshalb den Google-Spiegel von Maven Central), und der
Versionsname heißt in `twa-manifest.json` `appVersion` -- unter
`appVersionName` liest Bubblewrap ihn nicht und baut ein Paket mit leerer
Version.

6. Google will außerdem: Kurzbeschreibung, ausführliche Beschreibung, ein
   Symbol (512 × 512, hast du), ein Feature-Grafikbild (1024 × 500),
   mindestens zwei Screenshots je Geräteklasse, eine
   **Datenschutzerklärung als URL** und die Angaben zur Datensicherheit.

   **Das liegt fertig in `docs/store/`**: die Texte zum Kopieren samt
   Zeichengrenzen in `docs/store/eintrag.md`, das Funktionsbild und acht
   Bildschirmfotos als PNG. Die Bilder sind keine Montagen, sondern aus
   dem echten Build fotografiert -- `node scripts/build-store-assets.mjs`
   startet die gebaute App, klickt sich in die Spiele hinein und schießt
   sie neu. Nach jeder sichtbaren Änderung einmal laufen lassen, sonst
   wirbt der Eintrag mit einer App, die es so nicht mehr gibt.

   Zur Datensicherheit: Die App speichert Spielstände lokal (IndexedDB) und
   – nur bei angemeldeten Nutzern – in Supabase. Erhoben werden
   E-Mail-Adresse und Benutzername; Werbung und Tracking gibt es nicht.
   Beim Formular ankreuzen: Daten können gelöscht werden, und zwar vom
   Nutzer selbst (`/konto-loeschen`).

7. **Konto-Löschung angeben.** Google verlangt für Apps, in denen man
   ein Konto anlegen kann, beides: einen Löschweg in der App und eine
   Adresse, die man ohne die App erreicht. Beides gibt es – in der Play
   Console einzutragen ist
   `https://te-mini-games.pages.dev/konto-loeschen`.

**Wie lange das dauert:** Die erste Prüfung durch Google dauert
erfahrungsgemäß einige Tage.

**Der eigentliche Zeitfaktor ist ein anderer:** Neue _private_
Entwicklerkonten müssen vor der ersten Veröffentlichung einen
geschlossenen Test fahren – **zwölf Tester, vierzehn Tage am Stück**. Das
ist keine Technik, das ist Kalender. Bei einem Konto, das als
Organisation angelegt ist, entfällt es. Prüfen lässt sich das in der Play
Console beim Anlegen der App; steht dort ein Hinweis auf „Geschlossener
Test erforderlich", gilt es für dich.

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
