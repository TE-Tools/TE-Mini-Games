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

**Extrem:** wie Bunt, aber alle Hausregeln an — siehe unten.

## Hausregeln einzeln

Anlass (15.10.2026, Thomas): „man kann entscheiden, ob 2 auf plus 2
geht, 4 auf plus 4 geht, schwarze Karte auf schwarze Karte geht ... das
als Auswahlmöglichkeit."

Die Spielart ist nur noch die **Voreinstellung**; jede Regel lässt sich
davor einzeln umlegen. Deshalb steht das Kontern nicht als ein Schalter
im Code, sondern als fünf (`Konter` in `regeln.ts`):

| Schalter            | Bedeutung                                         |
| ------------------- | ------------------------------------------------- |
| `zweiAufZwei`       | +2 auf +2 (beim französischen Blatt: **7 auf 7**) |
| `vierAufVier`       | +4 auf +4                                         |
| `zweiAufVier`       | +2 auf +4                                         |
| `vierAufZwei`       | +4 auf +2                                         |
| `schwarzAufSchwarz` | die Wunschkarte kontert                           |

Dazu zwei weitere: _Ziehen, bis es passt_ (höchstens vier Karten) und
_Null tauscht die Hände_.

**Schwarz auf Schwarz** verdient eine eigene Zeile: Die Wunschkarte
zieht selbst nichts. Wer mit ihr kontert, zieht also nicht — aber der
Nächste steht vor derselben Zahl. Die Strafe wird weitergereicht, nicht
erhöht und nicht aufgelöst. Würde sie dabei verfallen, wäre die
Wunschkarte ein Freifahrtschein.

Ob „+2 auf +4" eine gute Regel ist, entscheidet nicht der Code: Sie
macht die teuerste Karte des Spiels kontersicher — oder eben nicht. Das
ist genau die Art Streit, die an den Tisch gehört und nicht in die
Engine, deshalb steht sie als Schalter da.

Eine laufende Partie trägt ihre Regeln **im Zustand** mit
(`MauZustand.regeln`), nicht als Verweis auf eine Tabelle: Sonst hinge
sie daran, wie der nächste Tisch sie stellt.

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

## Tisch, Fächer, Flug

Anlass (15.10.2026, Thomas): „Bitte die Karten rund wie auf einer Hand
halten bei einem selber damit man besser sieht und bei Gegner mit
kleiner Animation beim Legen der Karten. Auch besseren Tisch und
moderneres Design."

**Der Tisch** ist aussen Holz, innen Filz, und die Mitspieler sitzen mit
daran — ihr Blatt liegt gefächert auf dem Filz, wer dran ist, bekommt
einen goldenen Ring. Kein weisser Kasten mehr über einem grünen Streifen.

**Die eigene Hand ist ein Fächer** (`Handfaecher.tsx`). Vorher lag sie in
einer Reihe, die waagerecht scrollte: Bei acht Karten war die Hälfte
ausserhalb des Bildes. Im Fächer steht von jeder Karte die Ecke frei —
und genau dafür ist die Ecke da. Schritt und Winkel ergeben sich aus der
Kartenzahl, nicht aus einer Tabelle: je mehr Karten, desto enger und
flacher. Nachgemessen bis zwanzig.

**Die Karten** sind gezeichnet wie Spielkarten: Eckzeichen oben links,
dasselbe auf dem Kopf unten rechts, in der Mitte das grosse Zeichen. Das
bunte Blatt trägt die Farbe als Fläche mit weissem Rand und hellem Oval —
so sehen diese Karten aus, und auf einem Telefon erkennt man eine Fläche
schneller als ein Zeichen.

**Die gelegte Karte kommt geflogen**, und zwar von dem Platz, der sie
gelegt hat. Dafür führt die Engine `letzterLeger` mit; ohne diese Angabe
müsste die Anzeige aus dem Protokolltext raten. Ausgelöst wird die
Bewegung ohne Zustand und ohne Timer: Der Schlüssel des Elements ist die
Kartenkennung, also entsteht es neu, sobald eine andere Karte oben liegt
— und was neu entsteht, spielt seine Animation. Im Browser nachgemessen:
nach dem eigenen Zug `--von-y: 150px` (von unten), nach dem linken
Mitspieler `--von-x: -46px, --von-y: -120px`.

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

## Online

Mau-Mau und Letzte Karte lassen sich auch gegen andere Menschen spielen:
Tisch aufmachen, Code weitergeben oder über „Offene Spiele" beitreten – bis
zu vier am Tisch. Beide Kacheln teilen sich dabei Tabellen und Funktionen
(eine Engine), aber nicht die Lobby-Liste: Ein Tisch für „Letzte Karte"
steht nicht in der Mau-Mau-Liste, dort liegt ein anderes Blatt.

Online mischt der Server und prüft jeden Zug (Migration
`023_kartenspiele_online.sql`). Das ist nicht Vorsicht, sondern die
Bedingung dafür, dass verdeckte Karten verdeckt sind – die Begründung und
was daraus folgt steht in
[`../kartenspiele-online/README.md`](../kartenspiele-online/README.md).

Die Hausregeln sind online dieselben wie am Küchentisch und werden im
Warteraum gesetzt. Ändern darf sie der Gastgeber; bei den anderen stehen
die Schalter da, sind aber gesperrt – so sieht jeder vor dem Start, woran
er ist, statt es im ersten Zug zu merken.
