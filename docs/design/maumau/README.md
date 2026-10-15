# Mau-Mau und Letzte Karte — verbindliche Spezifikation

Stand: 14.10.2026. Anlass: „maumau noch zusätzlich erstellen und uno bzw
uno extrem" (Thomas).

## Zwei Kacheln, eine Engine

| Kachel           | Blatt                  | Spielarten   |
| ---------------- | ---------------------- | ------------ |
| **Mau-Mau**      | französisch, 32 Karten | klassisch    |
| **Letzte Karte** | bunt, 108 Karten       | Bunt, Extrem |

Der Ablauf ist in beiden Fällen derselbe, deshalb liegt er einmal in
`src/games/maumau/engine.ts`. Was die Spielarten unterscheidet, steht in
`regeln.ts` als **Daten** — Handkartenzahl, Stapeln von Strafkarten,
Ziehen bis es passt, wandernde Hände. Eine vierte Spielart ist dort ein
Eintrag, kein Sonderfall im Ablauf.

## Zum Namen

Mau-Mau ist ein altes Gesellschaftsspiel ohne Besitzer. Das bunte Blatt
mit Aktionskarten gehört zur selben Familie (Crazy Eights); **Regeln
eines Kartenspiels sind nicht geschützt, ein Markenname schon.** Deshalb
heisst die zweite Kachel „Letzte Karte", hat eigene Karten, eigene
Farben und einen eigenen Ruf — und übernimmt von keinem Handelsprodukt
Namen, Gestaltung oder Texte. Das ist dieselbe Linie wie bei Trapbound
und Emberwake: die Idee ja, das Produkt nein.

## Die Regeln, auf die sich der Tisch einigt

**Mau-Mau (klassisch), 5 Karten auf die Hand:**

| Karte | Wirkung                         |
| ----- | ------------------------------- |
| 7     | der Nächste zieht zwei          |
| 8     | der Nächste setzt aus           |
| 9     | die Richtung dreht              |
| Bube  | Farbe wünschen, passt auf alles |

**Bunt, 7 Karten:** Farbe oder Aufdruck muss passen; dazu Aussetzen,
Richtungswechsel, +2 je Farbe sowie schwarze Wunsch- und +4-Karten.

**Extrem:** wie Bunt, aber

- Strafkarten lassen sich weiterreichen (+2 auf +2, +4 auf alles),
- es wird gezogen, bis eine Karte passt — **höchstens vier**,
- die Null schiebt alle Hände einen Platz weiter.

Die Vier ist dabei bewusst nicht konterbar durch eine Zwei: Sonst wäre
die teuerste Karte des Spiels die schwächste.

## „Mau" ist keine Zierde

Wer seine **vorletzte** Karte legt, ohne vorher Mau zu sagen, zieht
zwei. Angesagt wird **vor** dem Legen (Knopf am Tischrand) — sonst wäre
es keine Regel, sondern eine Falle. Beim bunten Blatt heisst der Ruf
„Letzte Karte!".

„Leicht" vergisst es in etwa jedem dritten Fall, „Normal" nie. Das ist
der einzige Unterschied, bei dem der Rechner schlechter spielt als er
könnte — und er ist Absicht: Am Küchentisch passiert genau das.

## Die drei Stellen, an denen es klemmt

1. **Der Stapel geht aus.** Dann wird die Ablage bis auf die oberste
   Karte neu gemischt. Ohne das steht die Partie still — und zwar erst
   nach zwanzig Minuten Spielzeit.
2. **Niemand kann.** Zieht reihum jeder, ohne legen zu können, und ist
   auch der Stapel leer, endet die Runde. Sonst dreht sich der Tisch
   endlos.
3. **Zu zweit wirkt der Richtungswechsel wie Aussetzen.** Sonst legt der
   Gegner, dreht zurück und ist sofort wieder dran.

## Wertung

```
Sieg:      100 + Punkte, die die anderen noch auf der Hand haben
sonst:     mindestens 10, sonst 60 − eigene Handpunkte
```

So wird am Küchentisch gezählt: Wer gewinnt, bekommt, was die anderen
liegen lassen. Die zehn für die gespielte Runde sind Absicht — eine
glatte Null nimmt dem Abend den Rest.

## Was geprüft wird

- `tests/maumau.test.ts` — 36 komplette Runden in allen drei Spielarten
  werden gespielt und nach jedem Zug geprüft: Karten entstehen und
  verschwinden nicht, niemand legt etwas Unerlaubtes, jede Runde endet.
  Dazu von Hand: Farbe auf Farbe, der Bube, das Stapeln im Extremspiel,
  die Mau-Strafe und das Neumischen.
- `tests/maumau-seite.test.tsx` — die Seite zeigt nur an, was erlaubt
  ist, und teilt die richtige Zahl Karten aus.
