# Rückwärts

Ein Partyspiel für ein Gerät. Jemand spricht heimlich ein Wort ein. Die
nächste Person hört es **rückwärts** und spricht nach, was sie hört. Diese
Nachahmung läuft wieder rückwärts – war sie gut, steht das Wort damit wieder
richtig herum –, und die übrigen raten, was es war.

Es ist das einzige Spiel der App, das ein Mikrofon braucht. Deshalb steht
hier weniger über Regeln als über Aufnahmen.

## Ablauf

| Phase          | Wer                | Was zu hören ist             |
| -------------- | ------------------ | ---------------------------- |
| `einsprechen`  | Sprecher, heimlich | nichts                       |
| `nachsprechen` | Nachsprecher       | das Wort **rückwärts**       |
| `raten`        | alle übrigen       | die Nachahmung **rückwärts** |
| `aufloesung`   | alle               | alle vier Fassungen          |
| `ende`         | –                  | nichts                       |

Die Rollen rücken jede Runde einen Platz weiter. Zu zweit rät, wer
nachgesprochen hat; ab drei raten alle, die weder eingesprochen noch
nachgesprochen haben. Ob richtig geraten wurde, sagt die Runde selbst
(Ja/Nein) – das Spiel versteht keine Wörter und soll es auch nicht.

Die Spalte „Was zu hören ist" ist die eigentliche Regel und steht in
`hoerbar()`. Die Seite zeigt die Knöpfe, die sie von dort bekommt;
`klangFuer()` gibt eine Fassung nur heraus, wenn sie in der Phase erlaubt
ist. Wer nachspricht, kommt an das Wort richtig herum nicht heran.

## Aufbau

```
src/games/rueckwaerts/
  config.ts      alle Stellwerte
  engine.ts      Regeln, Stutzen, Umdrehen, Löschen – ohne Browser
  ton.ts         Mikrofon und Lautsprecher – der einzige Teil mit Browser
src/pages/play/RueckwaertsPage.tsx
```

## Aufnahmen: was zugesagt ist und wie es eingehalten wird

Im Spiel und in der Datenschutzerklärung steht: _Die Aufnahmen bleiben auf
diesem Gerät, werden nirgends gespeichert und nach jeder Runde gelöscht._

**Kein MediaRecorder.** Der naheliegende Weg wäre, mit `MediaRecorder` eine
Datei aufzunehmen und sie zum Umdrehen wieder zu dekodieren. Die Datei
liegt dann in einem `Blob`, und wo der Browser einen Blob ablegt,
entscheidet er selbst – das kann die Festplatte sein. Stattdessen greift
`ton.ts` die rohen Ausschläge ab (AudioWorklet, ersatzweise
ScriptProcessor). Sie liegen in `Float32Array`s, die dem Spiel gehören.

**Überschreiben, nicht nur loslassen.** Jede Kopie einer Aufnahme wird mit
Nullen gefüllt, sobald sie nicht mehr gebraucht wird:

| Kopie                                      | wird überschrieben                                       |
| ------------------------------------------ | -------------------------------------------------------- |
| die Stücke aus dem Tonfaden                | beim Stopp, sobald sie zusammengesetzt sind              |
| die Rohfassung (mit Stille drumherum)      | gleich nach dem Stutzen                                  |
| Wort und Nachahmung, je vor- und rückwärts | nächste Runde, neu einsprechen, beenden, Seite verlassen |
| der Lautsprecherpuffer                     | wenn die Wiedergabe endet oder angehalten wird           |

**Das Mikrofon ist mit dem Stopp frei**, nicht erst beim Verlassen der
Seite: Die Spuren des Stroms werden beendet, die Anzeige im Browser
erlischt.

Was ein Browser intern noch puffert, liegt außerhalb dessen, was eine
Webseite sehen oder löschen kann. Zugesagt ist deshalb „nicht gespeichert,
nicht übertragen, überschrieben" – nicht „forensisch unauffindbar".

## Stutzen

Wer „Aufnahme starten" tippt, spricht nicht im selben Augenblick, und wer
fertig ist, tippt nicht sofort auf Stopp. Ohne Stutzen begänne die
Rückwärtsfassung mit der Stille, die am Ende der Aufnahme hing.

Gemessen wird in Fenstern von 20 ms. Laut ist ein Fenster ab 12 % des
lautesten – so passt sich die Schwelle an laute und leise Sprecher an.
Stimme beginnt und endet, wo **drei laute Fenster aufeinander folgen**. Ein
einzelnes reicht nicht: Der Fingertipp auf den Knopf ist lauter als manches
Wort, aber nach einem Fenster vorbei. (Die erste Fassung nahm ein Fenster;
ein Test mit einem Tipp vor dem Wort hat gezeigt, dass dann die ganze
Stille seit dem Tipp hängen bleibt.) Davor und dahinter bleiben 120 ms
Rand, weil ein „t" am Wortende nach einer Pause kommt und selbst kürzer ist
als drei Fenster.

Zurückgewiesen wird eine Aufnahme, wenn nichts zu hören war (`zu-leise`)
oder weniger als eine Viertelsekunde Stimme darin steckt (`zu-kurz`). Die
Engine gibt den Grund als Kennung zurück; der Satz dazu steht im
Wörterbuch.

## Wie es geprüft ist

**Regeln und Seite** in `tests/rueckwaerts.test.ts` und
`tests/rueckwaerts-page.test.tsx` – die Seite mit einer nachgestellten
Tonanlage, die sich merkt, welche Zahlenreihen sie bekommen hat. So lässt
sich prüfen, dass nach einer Runde, nach dem Beenden und nach dem Verlassen
der Seite alle leer sind. Zwölf eingebaute Fehler (das Original zu früh
hörbar, eine Kopie nicht überschrieben, ein Fenster statt einer Kopie …)
sind dagegen gelaufen; jeder fällt auf.

**Mikrofon und Lautsprecher** lassen sich in jsdom nicht prüfen. Sie sind
im echten Chromium nachgemessen (10.11.2026), mit einer Tondatei als
Mikrofon:

```
chromium --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
         --use-file-for-fake-audio-capture=wort.wav
```

Die Datei enthält 0,5 s Stille, einen Ton, der eine Sekunde lang von tief
nach hoch steigt, und wieder Stille. Ein Skript, das vor dem Laden der
Seite `AudioBufferSourceNode.prototype.start` und `getUserMedia` einhüllt,
hält fest, was wirklich abgespielt wird und was mit dem Mikrofon geschieht:

| Geprüft                                                                | Ergebnis                   |
| ---------------------------------------------------------------------- | -------------------------- |
| Aufnahme von 2,3 s wird auf das Wort gestutzt                          | 1,22 s                     |
| was der Nachsprecher hört, fällt (vorn 656, hinten 431 Nulldurchgänge) | ja                         |
| es ist Wert für Wert das Original von hinten nach vorn                 | ja                         |
| Mikrofonspur nach jedem Stopp                                          | `ended`                    |
| Lautsprecherpuffer nach der Runde                                      | nur Nullen                 |
| dasselbe ohne AudioWorklet (Ersatzweg)                                 | ja                         |
| Mikrofon verweigert                                                    | Meldung, Knopf wieder frei |

**Nicht geprüft**, weil hier nicht verfügbar: Safari auf dem iPhone und die
Android-App auf einem echten Gerät. Für Safari ist vorgesorgt (der
Tonkontext entsteht noch im Klick, bevor auf das Mikrofon gewartet wird);
für die App siehe unten.

## Android-App

Die Webansicht darf das Mikrofon nur öffnen, wenn `RECORD_AUDIO` und
`MODIFY_AUDIO_SETTINGS` im Manifest stehen – Capacitor fragt genau diese
beiden ab, sobald die Seite `getUserMedia` ruft. Sie stehen seit dem
10.11.2026 in `android/app/src/main/AndroidManifest.xml`. **Ein Paket, das
davor gebaut wurde, zeigt das Spiel, kann aber nicht aufnehmen** und meldet
„verweigert". Im Browser und als installierte Web-App geht es sofort.

## Was das Spiel bewusst nicht kann

- **Online spielen.** Dazu müssten Aufnahmen das Gerät verlassen.
- **Aufnahmen behalten oder teilen.** Dasselbe.
- **Wörter erkennen.** Ob geraten wurde, sagt die Runde.
