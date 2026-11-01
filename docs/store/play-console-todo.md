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
`app-release-bundle.aab`, signiert mit deinem eigenen Schlüssel. Die
Einzelheiten stehen in [`docs/app-store.md`](../app-store.md).

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
Schützenopoly) brauchen ein Konto. Dafür bitte mit den oben genannten
Zugangsdaten anmelden.

Die Löschung des Kontos ist in der App unter Profil → Konto & Anmeldung →
Konto löschen erreichbar und zusätzlich unter
https://te-mini-games.pages.dev/konto-loeschen
```

- [ ] eingetragen

### 2.3 Anzeigen

**Nein**, die App enthält keine Werbung.

Belegt: keine Werbe- oder Tracking-Bibliothek im Projekt. Die
Abhängigkeiten sind Supabase, Dexie, React, React-Router, Three.js und
Workbox – mehr nicht.

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
freien Chat gibt es nicht."_

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

Der am genauesten geprüfte Abschnitt — und der einzige, den du nicht
Feld für Feld anklicken musst. In `docs/store/data-safety.csv` liegt das
ausgefüllte Formular.

> App-Inhalte → Datensicherheit → **Importieren**

⚠️ Der Import **überschreibt** alles, was dort schon steht.

Was drinsteht, zum Nachlesen:

| Frage                                           | Antwort                         |
| ----------------------------------------------- | ------------------------------- |
| Werden Daten erhoben oder geteilt?              | **Erhoben: ja. Geteilt: nein.** |
| Werden Daten bei der Übertragung verschlüsselt? | **Ja** (HTTPS)                  |
| Können Nutzer die Löschung verlangen?           | **Ja**                          |

Datentypen – nur diese drei ankreuzen:

| Datentyp                                             | Erhoben | Geteilt | Pflicht? | Zweck                               |
| ---------------------------------------------------- | ------- | ------- | -------- | ----------------------------------- |
| **E-Mail-Adresse**                                   | ja      | nein    | optional | App-Funktionalität, Kontoverwaltung |
| **Nutzer-IDs** (Benutzername)                        | ja      | nein    | optional | App-Funktionalität                  |
| **App-Interaktionen** (Spielstände, Punkte, Erfolge) | ja      | nein    | optional | App-Funktionalität                  |

Jeweils **optional**, weil ohne Konto nichts davon das Gerät verlässt.

Nicht ankreuzen: Standort, Kontakte, Fotos, Dateien, Kalender,
Finanzdaten, Gesundheitsdaten, Geräte-IDs für Werbung, Abstürze und
Diagnosedaten.

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
| Vollständige Beschreibung (max. 4000) | `eintrag.md`, 2157 Zeichen              |
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

⚠️ **Südkorea abwählen.** Die dortige Prüfstelle GRAC erkennt die
IARC-Selbsteinstufung für Spiele mit Glücksspiel-Simulation nicht an und
lehnt sie ab – das ist der erwartete Ausgang der ehrlichen Antwort beim
Poker, kein Fehler. Für Korea bräuchte es ein eigenes Verfahren bei GRAC.
Alle anderen Prüfstellen (USK, PEGI, ESRB, ClassInd) sind davon
unberührt.

Und nicht: die Antwort zur Glücksspiel-Simulation nachträglich auf „Nein"
ändern. Eine falsche Angabe im IARC-Fragebogen kostet den ganzen Eintrag.

- [ ] Länder ausgewählt, Südkorea abgewählt

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

Das ist der Schritt, der am leichtesten vergessen wird – und ohne ihn
zeigt die App im Vollbild trotzdem eine Adressleiste.

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
