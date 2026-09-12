# GAME DESIGN — EMBERWAKE

Stand: 2026-09-11 · Version 0.0.1 (Planung)

> **Arbeitstitel „EMBERWAKE".** Vor Veröffentlichung ist eine Marken- und
> App-Namensprüfung nötig. Deutscher Untertitel-Vorschlag: _Der letzte Funke_.

---

## 1. Einzeiler

Du trägst die letzte Glut durch eine erloschene Welt. Jeder Schritt, den du
dich vom Lager entfernst, macht dein Lager dunkler.

---

## 2. Die eigene Identität

Das Spiel ist **keine Variante von „sammle Holz, überlebe die Nacht"**.
Drei Dinge trennen es von allem, was es kopieren könnte:

### 2.1 Kernmechanik: Lichtschuld

Im Zentrum des Lagers steht der **Kern** — ein Splitter des letzten Lichts.
Der Kern ist gleichzeitig drei Dinge:

1. **Deine Nachtverteidigung.** Sein Lichtradius hält die Stillen zurück.
2. **Deine Energiequelle.** Werkbank, Schmiede und Heilstelle arbeiten mit ihm.
3. **Dein Laternen-Treibstoff.** Deine Laterne ist mit ihm verbunden.

Und hier liegt der Kniff: **Deine Laterne zieht fortlaufend Energie aus dem Kern,
und zwar stärker, je weiter du vom Lager entfernt bist.**

```
Kern-Verbrauch pro Sekunde = basis + (distanz_zum_lager / reichweite)² × faktor
```

Der quadratische Anstieg ist Absicht. Nahe am Lager ist Erkunden fast gratis.
Weit draußen wird jede Sekunde teuer. Der Spieler spürt das an der Kern-Anzeige,
die sichtbar schneller sinkt, je weiter er geht.

**Das bedeutet: Jede Expedition kostet buchstäblich die Sicherheit deiner Nacht.**
Wer gierig ist, kommt mit vollem Rucksack in ein Lager zurück, das die Nacht
nicht mehr übersteht.

Warum das gut ist:

- **Ein einziger Wert** erzeugt die gesamte Risiko-Spannung. Der Spieler muss
  nicht fünf Balken im Auge behalten.
- **Kein nerviges Feuer-Nachlegen (§10).** Der Kern ist keine Pflicht im
  Minutentakt, sondern ein strategisches Budget für die ganze Runde.
- **Kein künstlicher Hungerbalken.** Nahrung existiert, aber als Werkzeug
  (heilt, erhöht Traglast), nicht als Bestrafungsuhr.
- Sie lässt sich über 10 Welten **umdrehen und variieren**, statt nur zu skalieren.

### 2.2 Zweite Mechanik: Ballast

Das Inventar ist **nicht in Slots begrenzt, sondern in Gewicht — und Gewicht
bestimmt deine Laufgeschwindigkeit.**

```
tempo = basistempo × (1 − (gewicht / traglast) × 0,55)
```

Voll beladen bist du deutlich langsamer. Langsamer heißt: längerer Rückweg.
Längerer Rückweg heißt: mehr Kern-Verbrauch. Und die Nacht kommt trotzdem.

Ein Artefakt wiegt viel. Zwanzig Holz wiegen viel. Du kannst nicht beides
mitnehmen. **Das ist die Entscheidung aus §13 — aber sie hat Konsequenzen im
Gameplay, nicht nur im Menü.**

Ein Spieler kann Ballast jederzeit fallen lassen (halber Wert geht verloren) —
das ist die Notbremse, die Panik in eine Entscheidung verwandelt.

### 2.3 Die Gegner sind eine Erklärung, keine Kulisse

Die **Stillen** waren einmal Träger wie du. Ihre Glut ist erloschen. Deshalb
weichen sie vor Licht zurück — sie erinnern sich. Deshalb greifen manche
den Kern an statt dich — sie wollen ihn. Deshalb ist einer von ihnen ein
**Irrlicht**, das vorgibt, eine Lichtquelle zu sein — es ahmt nach, was es
verloren hat.

Das Gegnerverhalten _ist_ die Geschichte. Keine Textwände nötig (§7).

---

## 3. Geschichte

**Kurzfassung, die der Spieler nie am Stück zu lesen bekommt:**

Die Welt wurde nicht zerstört. Sie ist _ausgegangen_.

Es gab den **Herd** — die Quelle, aus der jedes Licht kam. Träger brachten
Gluten von dort in die Welt hinaus. Dann erlosch der Herd, und mit ihm über
Jahre hinweg jede Glut. Wer keine mehr hatte, wurde zu einem der Stillen.

Du bist ein Träger mit einer der letzten Gluten. Dein Ziel: den Weg zurück
zum Herd finden und ihn wieder entzünden.

**Die Wendung (Welt 5):** Der Herd ging nicht aus. Er wurde gelöscht. Von
jemandem, der glaubte, das Licht sei das Problem gewesen.

**Das Finale (Welt 10):** Um den Herd zu entzünden, musst du deinen eigenen
Kern hergeben. Du gewinnst, indem du schwächer wirst.

**Erzählweise (§7):** Kurze Fundstücke (2–3 Sätze), Dialogfetzen von
Verirrten, Umgebungserzählung, veränderte Gegnernamen. Nie mehr als
vier Zeilen Text am Stück. Der Spieler kann jeden Text wegtippen.

---

## 4. Gameplay-Loop

```
   LAGER                        EXPEDITION                    NACHT
┌──────────┐               ┌──────────────────┐         ┌─────────────┐
│ Kern     │   Aufbruch    │ Sammeln          │  Rückkehr│ Wellen      │
│ auffüllen│ ─────────────▶│ Entdecken        │────────▶│ Verteidigen │
│ Bauen    │               │ Risiko abwägen   │         │ Ereignis    │
│ Craften  │◀──────────────│ „Noch ein Baum?" │         │ Überleben   │
│ Ausrüsten│   Belohnung   └──────────────────┘         └─────────────┘
└──────────┘                                                   │
      ▲                                                        │
      └────────────────── Sterne · Freischaltung ◀─────────────┘
```

Eine Runde (= ein Level) dauert **5–15 Minuten** (§83) und umfasst
typischerweise 1–3 Tag/Nacht-Zyklen.

---

## 5. Der Moment, auf den alles hinarbeitet

Jedes Level soll mindestens einmal diese Situation erzeugen:

> Kern bei 22 %. Du bist am weitesten Punkt der Karte. Vor dir liegt ein
> Artefakt. Dein Rucksack ist bei 80 %. Es dämmert.
>
> Nimmst du es mit?

Wenn ein Level diesen Moment nicht erzeugt, ist es ein schlechtes Level.
Das ist das Prüfkriterium in LEVEL_DESIGN.md.

---

## 6. Ressourcen (§11)

Jede Ressource hat genau eine klare Rolle. Keine Füllmaterialien.

| Ressource        | Gewicht | Rolle                                        |
| ---------------- | ------- | -------------------------------------------- |
| **Zunderholz**   | 1,0     | Kern auffüllen, Basisbau                     |
| **Kernstein**    | 2,5     | Bauen, Befestigung, Türme                    |
| **Altmetall**    | 2,0     | Werkzeuge, Waffen, Ausrüstung                |
| **Harz**         | 0,5     | Fackeln, Brandschaden, Klebstoff             |
| **Nahrung**      | 0,8     | Heilung, temporär +Traglast                  |
| **Heilmoos**     | 0,4     | Verbände, Gegengift                          |
| **Glutkristall** | 1,5     | Hochwertige Kern-Ladung, Upgrades ab Stufe 3 |
| **Artefakt**     | 6,0     | Einzigartig. Schaltet Baupläne/Story frei    |

Das hohe Gewicht des Artefakts ist der ganze Punkt (§2.2).

---

## 7. Die Basis (§8/§9)

Kein Freibau-Editor. Feste Bauplätze rund um den Kern — das hält die
Steuerung auf dem Handy einfach und macht Verteidigung lesbar.

| Gebäude         | Stufen | Nutzen                                         |
| --------------- | ------ | ---------------------------------------------- |
| **Kernstelle**  | 1–5    | Lichtradius, Kern-Kapazität, Regeneration      |
| **Werkbank**    | 1–5    | Werkzeuge und Rezepte (§9)                     |
| **Speicher**    | 1–4    | Lagerkapazität, schützt Vorräte vor Plünderern |
| **Kochstelle**  | 1–3    | Nahrung veredeln, Traglast-Boni                |
| **Wachturm**    | 1–4    | Automatische Verteidigung, verbraucht Kern     |
| **Schmiede**    | 1–4    | Waffen und Rüstung                             |
| **Heilstelle**  | 1–3    | Heilung zwischen Nächten, NPC-Rettung          |
| **Signalmast**  | 1–3    | Zieht Verirrte an, zeigt Ereignisse früher an  |
| **Schlafplatz** | 1–3    | Nacht verkürzen (mit Risikoaufschlag)          |
| **Destille**    | 1–3    | Kristalle verarbeiten, Endgame-Rezepte         |

Gebäude werden nach und nach freigeschaltet, nicht alle ab Level 1.

**Wichtig:** Basisfortschritt ist **weltweit persistent**, nicht pro Level.
Das Lager wächst über die Kampagne mit. Level geben Ressourcen und
Freischaltungen, keinen Neustart bei null.

---

## 8. Leben und Tod (§14/§15/§16)

- Start: **3 Leben.** Maximum: **5.**
- Leben zurückgewinnen: Achievements, seltene Fundstücke, bestimmte
  Level-Abschlüsse mit 3 Sternen. Nicht farmbar.
- **Bei Tod:**
  - Basisfortschritt und Freischaltungen bleiben **vollständig** erhalten
  - Bereits ins Lager gebrachte Ressourcen bleiben erhalten
  - Getragene Ressourcen: 50 % gehen verloren
  - Ausrüstung bleibt, verliert aber Zustand
  - Ein Leben weniger
  - Neustart ab letztem Checkpoint, Ladezeit unter 2 Sekunden (§84)
- **Bei 0 Leben:** Kein Löschen des Spielstands. Die aktuelle Welt wird auf
  den Weltanfang zurückgesetzt, Leben werden auf 3 gesetzt. Man verliert
  Zeit, nie den Fortschritt.
- Der Todesbildschirm nennt **immer die konkrete Ursache**
  („Der Kern erlosch um 03:12" / „Ein Nachtmahr traf dich im Dunkeln"),
  nie nur „Du bist gestorben". Verstehen ist die Voraussetzung für „Nochmal".

---

## 9. Gegner — Die Stillen (§18)

Alle acht geforderten Verhaltensmuster sind je einem Gegnertyp zugeordnet:

| Name           | Muster (§18)          | Verhalten                                                                    |
| -------------- | --------------------- | ---------------------------------------------------------------------------- |
| **Schleicher** | A — direkter Angriff  | Langsam, greift an, was ihm am nächsten ist. Der Lehrgegner                  |
| **Hetzer**     | B — verfolgt          | Schnell, gibt die Verfolgung nicht auf. Nur Licht stoppt ihn                 |
| **Brecher**    | C — greift Basis an   | Ignoriert den Spieler vollständig. Rennt zum Kern                            |
| **Zersetzer**  | D — greift Anlagen an | Zielt auf Wachtürme und Befestigungen                                        |
| **Scheue**     | E — meidet Licht      | Wartet in Schattenzonen, schlägt zu, wenn das Licht flackert                 |
| **Nachtmahr**  | F — nur nachts        | Starker Nacht-Gegner. Verschwindet bei Morgengrauen                          |
| **Irrlicht**   | G — lockt in Falle    | Imitiert eine Lichtquelle oder einen Ressourcenknoten                        |
| **Plünderer**  | H — greift Lager an   | Stiehlt aus dem Speicher und flieht. Tötest du ihn, bekommst du alles zurück |

Der Plünderer ist bewusst so gebaut, dass er **Jagdlust statt Frust** erzeugt:
Die Beute ist nicht weg, sie läuft davon.

---

## 10. Begleiter — Funken (§30)

Kleine Lichtwesen, die aus dem Kern schlüpfen. Passive Effekte, nie Kampfkraft.

| Funke       | Effekt                                                    |
| ----------- | --------------------------------------------------------- |
| **Zunder**  | Warnt vor Gegnern außerhalb der Sichtweite                |
| **Späher**  | Markiert Ressourcenknoten im Umkreis auf der Minikarte    |
| **Hüter**   | Hält einen Notlichtradius, wenn der Kern unter 10 % fällt |
| **Sammler** | Trägt 15 % deines Ballasts                                |

Nur **einer** darf mit. Das ist eine Ausrüstungsentscheidung, kein Sammelbonus.

---

## 11. NPCs — Die Verirrten (§20/§21)

Überlebende, die du im Dunkeln findest und ins Lager zurückbringst.
Der Rückweg mit einem Verirrten ist langsamer — auch das kostet Kern.

| Typ              | Beitrag im Lager                             |
| ---------------- | -------------------------------------------- |
| **Sammlerin**    | Bringt zwischen den Leveln passiv Ressourcen |
| **Kämpfer**      | Verteidigt das Lager in der Nacht            |
| **Handwerkerin** | Senkt Baukosten, schaltet Rezepte frei       |
| **Heiler**       | Regeneriert Leben zwischen Leveln            |

Verirrte können in der Nacht **sterben**, aber nur, wenn das Lager
tatsächlich überrannt wird — nie zufällig. Der Verlust ist dauerhaft und
wird namentlich angezeigt. Selten genug, um zu treffen; nie unverschuldet (§21).

---

## 12. Tag und Nacht (§22/§23)

Ein voller Zyklus dauert je nach Level 3–6 Minuten realer Zeit.

| Phase     | Anteil | Charakter                                               |
| --------- | ------ | ------------------------------------------------------- |
| Tag       | 55 %   | Sichtweite hoch, kaum Gegner, Sammeln und Bauen         |
| Dämmerung | 10 %   | Warnsignal. Musik wechselt, Farben kippen ins Kalte     |
| Nacht     | 30 %   | Sichtweite auf Lichtradius reduziert, Wellen greifen an |
| Morgen    | 5 %    | Belohnung, Aufräumen, Erleichterung                     |

**Nachtereignisse** (§23) werden pro Nacht aus einer gewichteten Tabelle
gezogen, die das Level vorgibt: Normale Nacht, Sturm (Licht flackert),
Nebelnacht, Tiefe Dunkelheit, Glutregen (Ressourcen-Bonus), Hilferuf
(NPC in Gefahr), Plünderzug, Stille Nacht (unheimlich ruhig — und dann
kommt alles auf einmal).

**Fairness-Regel (§24):** Ein Zufallsereignis darf niemals tödlich sein,
ohne dass der Spieler mindestens 10 Sekunden vorher ein sichtbares oder
hörbares Warnsignal bekommen hat. Das wird im Code erzwungen, nicht
per Konvention.

---

## 13. Bewertung: Sterne (§27)

| Stern  | Bedingung                                                        |
| ------ | ---------------------------------------------------------------- |
| ⭐     | Level abgeschlossen                                              |
| ⭐⭐   | Zusatzziel erfüllt (level-spezifisch, z. B. Kern nie unter 30 %) |
| ⭐⭐⭐ | Geheimnis der Karte gefunden                                     |

Sterne sind nicht gestaffelt — man kann Stern 3 ohne Stern 2 holen.
Das lädt zum Wiederkommen ein (§52), ohne Perfektionsdruck.

---

## 14. Die 10 Welten (§6)

Jede Welt **verändert oder dreht die Lichtschuld-Mechanik um**, statt nur
Zahlen zu erhöhen (§4).

| #   | Welt                    | Neue Mechanik                                                                                  | Gegner-Neuzugang                 |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | **Der Aschenwald**      | Grundlagen: Lichtschuld, Ballast, Nacht                                                        | Schleicher, Hetzer, Brecher      |
| 2   | **Das Flüstermoor**     | Boden bremst, Nebel senkt Sicht, Nässe löscht Fackeln                                          | Irrlicht, Versinker              |
| 3   | **Die Scherbenhöfe**    | Linsen und Spiegel lenken Licht um — Rätsel _und_ Verteidigung                                 | Zersetzer, Plünderer             |
| 4   | **Die Kammlande**       | Wind: Richtung beeinflusst Lichtreichweite und Tempo                                           | Windfahrer (fliegt), Steinrücken |
| 5   | **Das Stillfeld**       | Kälte: Wärmeradius und Lichtradius trennen sich. Zwei Budgets                                  | Frostmahr · **Story-Wendepunkt** |
| 6   | **Der Schlund**         | Kein Tag mehr. Nur das Licht, das du mitbringst                                                | Scheue, Tiefenlauscher           |
| 7   | **Die Tiefen Stollen**  | **Umkehrung:** Gas entzündet sich an deinem Licht. Licht wird tödlich                          | Grubengänger                     |
| 8   | **Der Verzehrte Grund** | Ressourcen sind verseucht: stark, aber sie vergiften den Kern                                  | Zehrer, Sporenwesen              |
| 9   | **Die Verlorenen Wege** | Der Raum verändert sich. Karten veralten während du sie nutzt                                  | Wandler                          |
| 10  | **Der Herd**            | **Finale:** Du speist deinen Kern in den Herd. Du wirst schwächer, je näher du dem Sieg kommst | Die Löschung                     |

Welt 7 ist die wichtigste Design-Idee der zweiten Spielhälfte: Nach sechs
Welten, in denen Licht Sicherheit bedeutet, wird Licht zur Gefahr. Der
Spieler muss alles verlernen, was ihn bisher am Leben gehalten hat.

---

## 15. Freischaltungen (§29)

Rein kosmetisch, keinerlei Spielvorteil (§54): Trägermäntel, Laternenformen,
Kernfarben, Lagerbanner, Funken-Skins. Verdient durch Achievements und
Sterne — nie gekauft.

---

## 16. Kunststil (§33/§63)

- **Stylized Low Poly, Vertex-Farben, keine Texturen**
- Klare Silhouetten: Ein Gegner muss auf 5 cm Bildschirmhöhe erkennbar sein
- Farbkonzept: Die Welt ist entsättigt (Grau, Blaugrau, Braunasche) —
  **alles Warme ist Licht und damit Sicherheit.** Der Spieler lernt die
  Spielregel über die Farbe, nicht über ein Tutorial.
- Nacht ist nicht schwarz, sondern tiefblau. Schwarz frustriert, Blau spannt.
- Der Kern ist der einzige stark gesättigte Punkt auf dem Bildschirm.

---

## 17. Audio (§36)

Musikschichten statt Musikstücke: Eine Grundschicht läuft durchgehend,
Schichten werden je nach Kern-Stand, Tageszeit und Gefahr ein- und ausgeblendet.
Sinkt der Kern unter 25 %, verschwindet Schritt für Schritt die Melodie —
das Spiel wird leiser statt lauter. Bedrohung durch Abwesenheit.

Prioritätenliste für Version 0.1: Schritte, Sammeln, Treffer, Kern-Warnung,
UI-Klick, Nacht-Einbruch. Musik danach.

---

## 18. Was das Spiel bewusst nicht tut

- Kein Hungerbalken, der im Minutentakt nervt
- Kein Feuer-Nachlegen als Dauerpflicht (§10)
- Kein „Sammle 10.000 Holz" (§86)
- Keine Energie-/Warte-Mechanik
- Keine Werbung, keine Käufe (§54)
- Kein Zwang zu anderen Spielern (§42)
- Kein Freibau-Editor (auf dem Handy unbedienbar)
