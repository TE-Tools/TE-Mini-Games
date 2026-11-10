# Play Console – was wo ausgefüllt wird

Eine Liste zum Abarbeiten. Links steht, wo in der Play Console es steht;
rechts, was dort hineingehört. Alles, was aus dem Projekt kommt, ist
nachgeprüft und nicht geschätzt.

Die Menüführung der Play Console ändert sich regelmäßig. Die Namen hier
entsprechen dem Stand November 2026; wenn eine Bezeichnung abweicht, ist
der Inhalt trotzdem derselbe.

**Reihenfolge beachten.** Google verlangt _Datenschutzerklärung_,
_Anzeigen_ und _App-Zugriff_, bevor _Zielgruppe und Inhalte_ freigegeben
wird. Wer von oben nach unten arbeitet, läuft nicht in gesperrte Felder.

---

## 0. Vorher: das Paket bauen

Das muss nicht auf deinem Rechner passieren. Unter _Actions_ im Projekt
liegen zwei Abläufe: **Android-Schlüssel erzeugen** (einmalig) und
**Android-Paket bauen** (jedes Mal). Ergebnis ist eine Datei
`app-release.aab`, signiert mit deinem eigenen Schlüssel. Seit 07.11.2026
ist die App eine Capacitor-App (wegen AdMob, siehe
[`docs/werbung.md`](../werbung.md)); Paketname und Schlüssel sind dieselben.
Vor dem Bau die Variable `ADMOB_APP_ID` setzen, sonst enthält das Paket
Googles Test-App-ID und zeigt nur Testvideos.

- [ ] AAB gebaut
- [ ] Ein **Testkonto in der App angelegt** (E-Mail + Passwort), das du
      Google gleich nennen kannst. Nimm nicht dein eigenes Konto.

---

## 1. App erstellen

> Play Console → **Alle Apps** → **App erstellen**

| Feld                           | Wert                          |
| ------------------------------ | ----------------------------- |
| App-Name                       | `TE-Mini Games`               |
| Standardsprache                | Deutsch (Deutschland) – de-DE |
| App oder Spiel                 | **Spiel**                     |
| Kostenlos oder kostenpflichtig | **Kostenlos**                 |

⚠️ _Kostenlos_ lässt sich später **nicht** mehr in _kostenpflichtig_
ändern. Umgekehrt schon.

Beide Erklärungen am Ende ankreuzen (Programmrichtlinien, US-Exportgesetze).

- [ ] App angelegt

---

## 2. App-Inhalte

> Linkes Menü → **Richtlinie** → **App-Inhalte**

### 2.1 Datenschutzerklärung

```
https://te-mini-games.pages.dev/datenschutz
```

Ohne Anmeldung erreichbar – am 1.11.2026 im Browser ohne Sitzung geprüft.

- [ ] eingetragen

### 2.2 App-Zugriff

Hier **nicht** „Alle Funktionen sind ohne besondere Zugangsdaten
verfügbar" wählen. Das stimmt nicht: Die Online-Partien brauchen ein
Konto, und ein Prüfer, der davorsteht, lehnt ab.

Also **„Alle oder einige Funktionen sind eingeschränkt"** und eine
Anleitung anlegen:

| Feld                | Wert                      |
| ------------------- | ------------------------- |
| Name der Anleitung  | `Online-Partien`          |
| Nutzername / E-Mail | _deine Testkonto-Adresse_ |
| Passwort            | _Passwort des Testkontos_ |
| Weitere Anweisungen | siehe unten               |

Text für „Weitere Anweisungen":

```
Beim ersten Start erscheint die Anmeldung. Für alle Einzel- und
Gruppenspiele genügt der Knopf "Als Gast spielen" – dafür ist kein Konto
nötig.

Nur die Online-Partien (Kniffel, Texas Hold'em, Mau-Mau, Letzte Karte,
Schützenopoly, Schützenrunde, Finde den Imposter, Wer bin ich?,
Stadt-Land-Fluss) brauchen ein Konto. Dafür bitte mit den oben genannten
Zugangsdaten anmelden.

Die Löschung des Kontos ist in der App unter Profil → Konto & Anmeldung →
Konto löschen erreichbar und zusätzlich unter
https://te-mini-games.pages.dev/konto-loeschen
```

- [ ] eingetragen

### 2.3 Anzeigen

**Ja**, die App enthält Werbung -- seit 07.11.2026 entschieden: nur
freiwillige Belohnungsvideos über **Google AdMob**, siehe
[`docs/werbung.md`](../werbung.md).

Auch dann „Ja“ antworten, wenn die Werbung beim Einreichen noch nicht
eingeschaltet ist (AdMob-IDs noch nicht eingetragen): Die Angabe gilt für die
App, wie sie geplant ist, und Google zeigt sie im Store als „Enthält
Werbung“. Nachträglich von „Nein“ auf „Ja“ zu wechseln, während die Werbung
schon läuft, ist der Fall, den Google ahndet.

- [ ] beantwortet

### 2.3a Werbe-ID

> **Richtlinie** → **App-Inhalte** → **Werbe-ID**

**Ja**, die App verwendet die Werbe-ID. Das AdMob-SDK trägt die
Berechtigung `com.google.android.gms.permission.AD_ID` selbst ein. Zweck:
**Werbung oder Marketing** (dazu, falls angeboten, **Betrugsprävention**).
Ohne diese Erklärung lehnt Google Uploads ab, sobald die Berechtigung im
Paket steckt.

- [ ] beantwortet

### 2.4 Inhaltsbewertung (IARC-Fragebogen)

E-Mail-Adresse angeben, Kategorie **Spiel**, dann:

| Frage                               | Antwort |
| ----------------------------------- | ------- |
| Gewalt                              | Nein    |
| Sexualität / Nacktheit              | Nein    |
| Anstößige Sprache                   | Nein    |
| Drogen, Alkohol, Tabak              | Nein    |
| **Glücksspiel-Simulation**          | **Ja**  |
| Echtes Geld einsetzen oder gewinnen | Nein    |
| Spielgeld kaufbar                   | Nein    |
| Nutzer können interagieren          | Ja      |
| Standort weitergeben                | Nein    |
| Persönliche Daten an Dritte         | Nein    |
| Digitale Käufe                      | Nein    |

**Warum „Ja" bei Glücksspiel-Simulation:** Texas Hold'em ist Poker. Dass
mit Spielgeld gespielt wird, ändert die Antwort nicht – es ändert die
Folgefragen, und die fallen alle zugunsten der App aus. Ergebnis ist in
der Regel eine Einstufung ab 12 oder 16 Jahren. Das ist normal.

Wer hier „Nein" ankreuzt und es fällt später auf, verliert den Eintrag.

Bei „Nutzer können interagieren" im Freitext ergänzen: _„In den
Online-Partien sehen Mitspieler den selbst gewählten Benutzernamen. Einen
freien Chat gibt es nicht: In der Schützenrunde wählt man am Tag einen von
festen Sätzen, und der Server nimmt nur diese an."_

Das stimmt erst seit Migration `030_schuetzenrunde_feste_saetze.sql`
(07.11.2026) -- vorher hatte die Schützenrunde online einen freien Chat.
Ist 030 nicht eingespielt, nimmt der Server weiter jeden Text an, auch wenn
die App nur noch feste Sätze anbietet.

- [ ] Fragebogen abgeschickt

### 2.5 Zielgruppe und Inhalte

| Feld                       | Wert                           |
| -------------------------- | ------------------------------ |
| Altersgruppen              | **13–15, 16–17, 18 und älter** |
| Spricht die App Kinder an? | Nein                           |

⚠️ Keine Altersgruppe unter 13 ankreuzen. Sonst fällt die App unter das
Programm _Familien_, und das bringt deutlich strengere Auflagen mit sich –
die Glücksspiel-Simulation passt ohnehin nicht dazu.

- [ ] beantwortet

### 2.6 Datensicherheit

Der am genauesten geprüfte Abschnitt. Die Angaben:

| Frage                                           | Antwort                       |
| ----------------------------------------------- | ----------------------------- |
| Werden Daten erhoben oder geteilt?              | **Erhoben: ja. Geteilt: ja.** |
| Werden Daten bei der Übertragung verschlüsselt? | **Ja** (HTTPS)                |
| Können Nutzer die Löschung verlangen?           | **Ja**                        |

Datentypen – nur diese drei ankreuzen:

| Datentyp                                             | Erhoben | Geteilt | Pflicht? | Zweck                               |
| ---------------------------------------------------- | ------- | ------- | -------- | ----------------------------------- |
| **E-Mail-Adresse**                                   | ja      | nein    | optional | App-Funktionalität, Kontoverwaltung |
| **Nutzer-IDs** (Benutzername)                        | ja      | nein    | optional | App-Funktionalität                  |
| **App-Interaktionen** (Spielstände, Punkte, Erfolge) | ja      | nein    | optional | App-Funktionalität                  |

Jeweils **optional**, weil ohne Konto nichts davon das Gerät verlässt.

**Dazu wegen der Werbung (Google AdMob):** Das AdMob-SDK erhebt Daten
selbst und nutzt sie auch für eigene Zwecke -- das zählt bei Google als
„geteilt“. Google nennt für seine Werbedienste in der Regel diese Angaben;
**vor dem Absenden mit Googles aktueller Hilfeseite zu den
Datensicherheitsangaben für Werbung abgleichen**, die Liste ändert sich:

| Datentyp                                  | Erhoben | Geteilt | Pflicht? | Zweck                               |
| ----------------------------------------- | ------- | ------- | -------- | ----------------------------------- |
| **Ungefährer Standort** (aus IP-Adresse)  | ja      | ja      | optional | Werbung, Betrugsvermeidung          |
| **Geräte- oder andere IDs**               | ja      | ja      | optional | Werbung, Analyse, Betrugsvermeidung |
| **App-Interaktionen** (Werbung angesehen) | ja      | ja      | optional | Werbung, Analyse                    |
| **Diagnosedaten**                         | ja      | ja      | optional | Werbung, Analyse, Betrugsvermeidung |

**Optional**, weil Werbung nur geladen wird, wenn ein Spiel ein Video anbietet,
und niemand eines ansehen muss.

Nicht ankreuzen: genauer Standort, Kontakte, Fotos, Dateien, Kalender,
Finanzdaten, Gesundheitsdaten.

**Auch nicht ankreuzen: Audio / Sprachaufnahmen** -- obwohl die App seit dem
Spiel „Rückwärts" (10.11.2026) die Berechtigung `RECORD_AUDIO` hat. Google
fragt nach Daten, die das Gerät **verlassen**. Die Aufnahmen dort tun das
nicht: Sie liegen im Arbeitsspeicher, werden weder gespeichert noch
übertragen und nach jeder Runde überschrieben
(`docs/design/rueckwaerts/README.md`). Das ist in Googles Sinn „nicht
erhoben". Fragt die Play Console beim Upload, wozu die App das Mikrofon
braucht: _Für ein Partyspiel, in dem ein eingesprochenes Wort rückwärts
abgespielt wird; die Aufnahme bleibt auf dem Gerät._ Wer daran je etwas
ändert -- Aufnahmen speichern, teilen, hochladen --, muss hier „Audio"
ankreuzen und die Datenschutzerklärung umschreiben.

- [ ] Formular abgeschickt

### 2.7 Löschung von Kontodaten

```
https://te-mini-games.pages.dev/konto-loeschen
```

Angeben: Nutzer können **Konto und Daten löschen** (nicht nur die Daten).

Beides steht: der Weg in der App und diese Adresse ohne Anmeldung –
beides am 1.11.2026 geprüft, und die Serverfunktion `konto_loeschen`
antwortet im Projekt.

- [ ] eingetragen

### 2.8 Die restlichen Fragen

| Frage                | Antwort |
| -------------------- | ------- |
| Regierungs-App       | Nein    |
| Finanzprodukte       | Nein    |
| Gesundheits-App      | Nein    |
| Nachrichten-/SMS-App | Nein    |

- [ ] beantwortet

---

## 3. Haupt-Store-Eintrag

> **Wachstum** → **Store-Präsenz** → **Haupt-Store-Eintrag**

Alle Texte stehen fertig in [`eintrag.md`](eintrag.md) – von dort kopieren,
die Zeichenzahlen sind nachgerechnet.

| Feld                                  | Woher                                   |
| ------------------------------------- | --------------------------------------- |
| App-Name (max. 30)                    | `TE-Mini Games`                         |
| Kurzbeschreibung (max. 80)            | `eintrag.md`, 72 Zeichen                |
| Vollständige Beschreibung (max. 4000) | `eintrag.md`, 2437 Zeichen              |
| App-Symbol 512 × 512                  | `docs/store/app-symbol-512x512.png`     |
| Funktionsbild 1024 × 500              | `docs/store/funktionsbild-1024x500.png` |
| Telefon-Screenshots                   | `docs/store/telefon-*.png` (acht Stück) |

Das Symbol liegt bewusst **nicht** `public/icons/icon-512.png` bei: Google
verlangt ein 32-Bit-PNG mit Alphakanal, und das dort hat keinen. Die Datei
in `docs/store/` ist dasselbe Bild als RGBA.

- [ ] Texte eingefügt
- [ ] Symbol hochgeladen
- [ ] Funktionsbild hochgeladen
- [ ] mindestens zwei Screenshots hochgeladen (es dürfen bis zu acht sein)

### 3a. Englische Übersetzung

> **Haupt-Store-Eintrag** → **Übersetzungen verwalten** → **Übersetzungen
> hinzufügen** → **Englisch (Vereinigte Staaten) – en-US**

Die App ist zweisprachig, also auch der Eintrag. Texte in
[`eintrag-en.md`](eintrag-en.md) (Kurzbeschreibung 70 Zeichen, Beschreibung
2373), Bilder in `docs/store/en/` -- dort ist die App auf Englisch zu sehen.
Ohne englische Bilder zeigt Google die deutschen; das geht, wirkt aber
halbfertig.

Nicht „Übersetzen lassen“ anklicken: Google übersetzt dann maschinell und
verlangt Geld dafür.

- [ ] en-US angelegt, Texte eingefügt
- [ ] englisches Funktionsbild und Screenshots hochgeladen

---

## 4. Store-Einstellungen

> **Wachstum** → **Store-Präsenz** → **Store-Einstellungen**

| Feld           | Wert                                               |
| -------------- | -------------------------------------------------- |
| App-Kategorie  | Spiele → **Gelegenheitsspiele**                    |
| Tags           | Denkspiele, Partyspiele, Kartenspiele, Brettspiele |
| E-Mail-Adresse | `te-alltagshelfer@outlook.de`                      |
| Website        | `https://te-mini-games.pages.dev`                  |

- [ ] eingetragen

---

## 5. Länder und Preis

> **Monetarisierung** → **Preise** und **Vertrieb**

Preis: kostenlos (steht schon aus Schritt 1).
Länder: mindestens Deutschland, Österreich, Schweiz – die App ist auf
Deutsch. Weltweit geht auch, der Eintrag erscheint dann überall auf
Deutsch.

- [ ] ausgewählt

---

## 6. Geschlossener Test

Gilt für **private** Entwicklerkonten, die nach dem 13. November 2023
angelegt wurden. Firmenkonten sind ausgenommen. Verlangt werden
**12 Tester, die 14 Tage ununterbrochen angemeldet sind**, bevor der
Produktionszugang beantragt werden kann. Ein interner Test zählt nicht.

Das ist der längste Posten auf dieser Liste – zuerst anstoßen, der Rest
lässt sich währenddessen erledigen.

> **Testen und veröffentlichen** → **Tests** → **Geschlossener Test**

- [ ] Test angelegt, AAB hochgeladen
- [ ] 12 Tester eingeladen und angemeldet
- [ ] 14 Tage abgewartet

---

## 7. Nach dem ersten Upload: die Fingerabdrücke

> **Entfällt seit der Capacitor-App (07.11.2026).** Die Fingerabdrücke in
> `assetlinks.json` brauchte nur die Trusted Web Activity, damit sie ohne
> Adressleiste lief. Die Capacitor-App hat keine. Die Datei bleibt liegen
> und stört nicht. Der Rest dieses Abschnitts gilt nur, falls die App je
> wieder eine TWA wird.

1. > **Testen und veröffentlichen** → **Einrichtung** → **App-Integrität**
   > → **App-Signaturschlüssel**

   Den **SHA-256-Fingerabdruck** kopieren.

2. Den eigenen Upload-Schlüssel auslesen:

   ```bash
   keytool -list -v -keystore android.keystore -alias android | grep SHA256
   ```

3. Beide in `public/.well-known/assetlinks.json` eintragen – dort stehen
   zwei Platzhalter, die ersetzt werden wollen.

4. Pushen, Cloudflare bauen lassen, dann prüfen:

   ```bash
   curl -s https://te-mini-games.pages.dev/.well-known/assetlinks.json
   ```

- [ ] Google-Fingerabdruck eingetragen
- [ ] eigener Fingerabdruck eingetragen
- [ ] live erreichbar

---

## 8. Produktion

> **Testen und veröffentlichen** → **Produktion** → **Neuen Release erstellen**

- [ ] AAB hochgeladen
- [ ] Versionshinweise geschrieben
- [ ] zur Überprüfung eingereicht

Die Prüfung dauert bei einer ersten App meist einige Tage.

---

## Was schon erledigt ist

Nichts davon musst du noch anfassen:

- Datenschutzerklärung, Impressum und Löschseite sind **ohne Anmeldung**
  erreichbar (am 1.11.2026 mit einem Browser ohne Sitzung geprüft)
- Serverseitiges Löschen (`konto_loeschen`) ist eingespielt und antwortet
- Alle Bilder und Texte liegen in `docs/store/`
- `twa-manifest.json` passt zur App (Farben, Paketname, Version)
- Die PWA erfüllt die Anforderungen an eine Trusted Web Activity
