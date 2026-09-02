# Finde den Imposter – Stand

**Stand:** 02.09.2026

## Ablauf am Tisch

Ein Gerät, alle sitzen zusammen:

1. **Geheimnisse** – das Gerät wird herumgereicht, jeder sieht sein Wort.
   Die Imposter sehen stattdessen „IMPOSTER“ und darunter **ein einzelnes
   Hilfswort** aus derselben Kategorie. Das Hilfswort wechselt jede Runde,
   damit sich die Runden unterscheiden.
2. **Reihum** – das Gerät zeigt nur, wer dran ist („spielt“), die anderen
   warten. Gesprochen wird laut in die Runde, es wird **nichts getippt**.
3. **Reden** – wenn alle dran waren, diskutiert die Gruppe frei.
4. **Imposter raten** – eine Liste aller Namen; die Runde tippt gemeinsam
   auf einen.
5. **Letzte Chance** – war es wirklich ein Imposter, darf genau der noch
   das geheime Wort raten und die Runde damit drehen.

Danach: nächste Runde mit neuem Wort und neu verteilten Rollen, so oft man
mag.

## Bewusst nicht drin

- **Kein Punktesystem, keine Rangliste** (02.09.2026, Thomas' Vorgabe). Wer
  gewonnen hat, sieht man am Tisch. Das Spiel speichert deshalb auch kein
  Ergebnis, vergibt keine XP und taucht in keiner Rangliste auf.
- Keine getippten Hinweise mehr – der frühere Handoff-Stand ließ jeden sein
  Hinweiswort eintippen, das ist durch das Sprechen in der Runde ersetzt.
- Keine feste Rundenzahl – man spielt, solange Lust besteht.

## Umgesetzt

- [x] Engine ohne UI-Bezug (`src/games/finde-den-imposter/engine.ts`)
- [x] Modi **Klassisch** und **Doppel-Imposter**
- [x] 20 Kategorien, 355 deutsche Wörter
- [x] Ein zufälliges Hilfswort je Runde
- [x] Reihum-Phase, gemeinsame Anklage, letzte Chance
- [x] Route `/play/finde-den-imposter`, Home-Button, Registry-Eintrag
- [x] Tests: `tests/finde-den-imposter.test.ts`

## Noch offen

- **Online-Mehrspieler** – bisher nur am einen Gerät. Wie das ablaufen soll,
  ist noch nicht festgelegt.
- Fünf weitere Modi (Leer, Duell, Nur Kategorie, Tempo, Chaos) – in
  `modes.ts` angelegt, aber als `available: false` markiert und im Menü
  nicht wählbar.
- Wortschatz von 355 auf ~1000
- Eigene Kategorien samt Import/Export
