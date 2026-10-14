/**
 * Die Handbewertung -- der Kern, an dem alles hängt.
 *
 * Wenn hier etwas falsch ist, merkt es niemand sofort: Es verliert nur
 * ab und zu der Falsche, und das sieht aus wie Pech. Deshalb stehen hier
 * die Fälle, die selbstgebaute Wertungen üblicherweise verschlucken --
 * das Rad, zwei Drillinge, der Kicker, und die Straße, die über das Ass
 * hinweg nicht existiert.
 */
import { describe, it, expect } from 'vitest'
import { gemischtesDeck, kartenAus } from '@/games/texas-holdem/karten'
import { createRng } from '@/games/rng'
import {
  HandKlasse,
  besteHand,
  handText,
  handTextMit,
  vergleicheHand,
} from '@/games/texas-holdem/wertung'

const hand = (text: string) => besteHand(kartenAus(text))
const klasse = (text: string) => hand(text).klasse
/** Welche fünf Karten gelten -- als Kurztext, zum Nachlesen im Fehlerfall. */
const gilt = (text: string) =>
  hand(text)
    .karten.map((k) => `${k.wert}${k.farbe[0]}`)
    .join(' ')

describe('Was für eine Hand ist das?', () => {
  it('erkennt den Royal Flush', () => {
    expect(klasse('As Ks Qs Js Ts 2h 3d')).toBe(HandKlasse.StraightFlush)
    expect(handText(hand('As Ks Qs Js Ts 2h 3d'))).toBe('Royal Flush')
  })

  it('erkennt das Rad als Straße -- auch in Farbe', () => {
    // A-2-3-4-5: Das Ass zählt als Eins, und die Straße endet bei der Fünf.
    const rad = hand('Ah 2h 3h 4h 5h Kd Qc')
    expect(rad.klasse).toBe(HandKlasse.StraightFlush)
    expect(rad.werte[0]).toBe(5)
    expect(handText(rad)).toBe('Straight Flush bis Fünf')
    expect(hand('Ah 2c 3h 4h 5s Kd Qc').klasse).toBe(HandKlasse.Strasse)
  })

  it('kennt keine Straße über das Ass hinweg', () => {
    // K-A-2-3-4 ist nichts. Wer das zulässt, baut Straßen, die es nicht gibt.
    expect(klasse('Kd Ah 2c 3h 4s 9d 8c')).toBe(HandKlasse.HoheKarte)
  })

  it('macht aus zwei Drillingen ein Full House', () => {
    const h = hand('9s 9h 9d 4s 4h 4d Kc')
    expect(h.klasse).toBe(HandKlasse.FullHouse)
    // Der höhere Drilling zählt voll, vom niedrigeren zwei Karten.
    expect(h.werte).toEqual([9, 4])
    expect(handText(h)).toBe('Full House, Neunen über Vieren')
  })

  it('nimmt beim Flush die fünf höchsten der Farbe', () => {
    const h = hand('As Qs 9s 7s 4s 2s Kh')
    expect(h.klasse).toBe(HandKlasse.Flush)
    expect(h.werte).toEqual([14, 12, 9, 7, 4])
    // Die Zwei in Pik gehört nicht dazu, der König in Herz schon gar nicht.
    expect(gilt('As Qs 9s 7s 4s 2s Kh')).toBe('14p 12p 9p 7p 4p')
  })

  it('erkennt Vierling mit Kicker, Drilling, zwei Paare, Paar', () => {
    expect(hand('7s 7h 7d 7c Ks 2h 3d').werte).toEqual([7, 13])
    expect(klasse('7s 7h 7d Ks 2h 3d 9c')).toBe(HandKlasse.Drilling)
    expect(hand('Qs Qh 7d 7c Ks 2h 3d').werte).toEqual([12, 7, 13])
    expect(handText(hand('Qs Qh 7d 7c Ks 2h 3d'))).toBe('Zwei Paare, Damen und Siebenen')
    expect(klasse('Qs Qh 7d 5c Ks 2h 3d')).toBe(HandKlasse.Paar)
  })

  it('nimmt bei drei Paaren die beiden höchsten', () => {
    // Sieben Karten können drei Paare enthalten -- gezählt werden zwei,
    // und das dritte Paar liefert nicht einmal den Kicker.
    const h = hand('Ks Kh 9d 9c 4s 4h Ad')
    expect(h.werte).toEqual([13, 9, 14])
  })
})

describe('Wer gewinnt?', () => {
  const besser = (a: string, b: string) => vergleicheHand(hand(a), hand(b))

  it('stellt die Reihenfolge der Klassen richtig', () => {
    expect(besser('2s 3s 4s 5s 7s Kd Qc', '6h 6d 6c Ks Qd 2h 3c')).toBeGreaterThan(0) // Flush > Drilling
    expect(besser('9h 8d 7c 6s 5h 2d 3c', '2s 3s 4s 9s Ks Qd 7h')).toBeLessThan(0) // Straße < Flush
    expect(besser('5s 5h 5d 5c 2h 3d 4c', '6s 6h 6d Ks Kh 2c 3d')).toBeGreaterThan(0) // Vierling > Full House
  })

  it('entscheidet bei gleicher Klasse über den Kicker', () => {
    // Beide haben ein Paar Asse auf dem Tisch; der König entscheidet.
    expect(besser('Ah Ad Ks 9h 4c 3d 2s', 'Ah Ad Qs 9h 4c 3d 2s')).toBeGreaterThan(0)
  })

  it('teilt den Pot, wenn beide dasselbe halten', () => {
    // Das Brett spielt: Beide Spieler nutzen dieselben fünf Karten.
    const brett = 'As Ks Qs Js Ts'
    expect(vergleicheHand(hand(`${brett} 2h 3d`), hand(`${brett} 7c 8d`))).toBe(0)
  })

  it('bewertet auch zwei Karten, bevor der Flop liegt', () => {
    // Vor dem Flop gibt es keine fünf Karten -- die Wertung muss trotzdem
    // antworten, sonst kann die KI nicht entscheiden.
    expect(klasse('As Ah')).toBe(HandKlasse.Paar)
    expect(klasse('As Kh')).toBe(HandKlasse.HoheKarte)
  })
})

describe('Der kurze Weg gibt dasselbe wie der lange', () => {
  it('findet aus sieben Karten dieselbe Hand wie das Durchprobieren aller 21', () => {
    /*
     * `besteHand` sucht nicht alle Kombinationen durch, sondern zählt und
     * gruppiert -- schneller, aber eben auch der Ort, an dem ein Sonderfall
     * untergeht. Also wird dagegen gerechnet: bei fünf Karten gibt es
     * nichts auszuwählen, da ist die Antwort unstrittig. Zweitausend
     * zufällige Blätter müssen übereinstimmen.
     */
    const rng = createRng('wertung-gegenprobe')
    for (let runde = 0; runde < 2000; runde++) {
      const sieben = gemischtesDeck(rng).slice(0, 7)
      const kurz = besteHand(sieben)

      let lang = null as ReturnType<typeof besteHand> | null
      for (let a = 0; a < 7; a++) {
        for (let b = a + 1; b < 7; b++) {
          const fuenf = sieben.filter((_, i) => i !== a && i !== b)
          const wert = besteHand(fuenf)
          if (!lang || vergleicheHand(wert, lang) > 0) lang = wert
        }
      }

      expect({ klasse: kurz.klasse, werte: kurz.werte }).toEqual({
        klasse: lang!.klasse,
        werte: lang!.werte,
      })
      // Und die angezeigten Karten müssen zur Hand gehören.
      expect(kurz.karten).toHaveLength(5)
      for (const k of kurz.karten) expect(sieben).toContain(k)
    }
  })
})

describe('Wie die Hand angesagt wird', () => {
  it('nennt sie für sich und nach „mit" in der richtigen Form', () => {
    /*
     * Im Deutschen ändert sich die Form: Es heisst „Zwei Paare", aber
     * „mit zwei Paaren". Am Tisch stand deshalb „Du gewinnst 40 mit Zwei
     * Paare, Siebenen und Sechsen" -- im Browser sofort zu lesen, in
     * keinem Test.
     */
    const zweiPaare = hand('Qs Qh 7d 7c Ks 2h 3d')
    expect(handText(zweiPaare)).toBe('Zwei Paare, Damen und Siebenen')
    expect(handTextMit(zweiPaare)).toBe('zwei Paaren, Damen und Siebenen')

    expect(handTextMit(hand('As Ks Qs Js Ts 2h 3d'))).toBe('einem Royal Flush')
    expect(handTextMit(hand('7s 7h 7d 7c Ks 2h 3d'))).toBe('einem Vierling Siebenen')
    expect(handTextMit(hand('9s 9h 9d 4s 4h 4d Kc'))).toBe('einem Full House, Neunen über Vieren')
    expect(handTextMit(hand('9h 8d 7c 6s 5h 2d 3c'))).toBe('einer Straße bis Neun')
    expect(handTextMit(hand('Qs Qh 2d 5c Ks 9h 3d'))).toBe('einem Paar Damen')
  })
})
