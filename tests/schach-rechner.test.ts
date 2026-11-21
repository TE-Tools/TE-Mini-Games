/**
 * Schach – der Computergegner.
 *
 * Geprüft wird, was jede Stufe können muss, und was die Stufen
 * unterscheidet. Mit festem Startwert, damit ein Ergebnis kein Zufall ist.
 */
import { describe, it, expect } from 'vitest'
import {
  Stellung,
  bewerte,
  BUCH_ZEILEN,
  neuePartie,
  partieAus,
  waehleZug,
  zieheIn,
  type Partie,
  type SchachStufe,
} from '@/games/schach'

const STUFEN: SchachStufe[] = ['leicht', 'mittel', 'schwer']

function zug(fen: string, stufe: SchachStufe, seed = 1, verlauf?: string[]) {
  const p = neuePartie(fen)
  return waehleZug({ fen, verlauf: verlauf ?? p.verlauf, stufe, seed })
}

describe('Computergegner', () => {
  it('jede Stufe setzt matt, wenn es in einem Zug geht', () => {
    // Grundreihenmatt mit dem Turm.
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
    for (const stufe of STUFEN) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8])
        expect([stufe, seed, zug(fen, stufe, seed)]).toEqual([stufe, seed, 'a1a8'])
    }
  })

  it('jede Stufe schlägt eine Dame, die einfach so herumsteht', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/3Q4/8/PPP1PPPP/RNB1KBNR b KQkq - 0 3'
    // Die schwere Stufe rechnet ohne Zufall; zwei Startwerte reichen.
    const versuche = { leicht: 10, mittel: 10, schwer: 2 }
    for (const stufe of STUFEN) {
      let geschlagen = 0
      for (let seed = 1; seed <= versuche[stufe]; seed++) {
        if (['c6d4', 'e5d4'].includes(zug(fen, stufe, seed)!)) geschlagen++
      }
      // Die leichte zieht ab und zu irgendetwas -- aber meistens schlägt auch sie.
      const mindestens = stufe === 'leicht' ? 6 : versuche[stufe]
      expect([stufe, geschlagen >= mindestens]).toEqual([stufe, true])
    }
  }, 30000)

  it('schwer findet ein Matt in zwei Zügen', () => {
    // Nach 5...Lxd1?? : 6.Lxf7+ Ke7 7.Sd5#
    const fen = 'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6'
    expect(zug(fen, 'schwer')).toBe('c4f7')
  }, 20000)

  it('mittel stellt keine Figur ein, leicht schon mal', () => {
    // Weiß kann mit der Dame den gedeckten Bauern e5 nehmen -- und verliert sie an d6.
    const fen = 'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR w KQkq - 0 3'
    const leicht = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => zug(fen, 'leicht', seed))
    const mittel = [1, 2, 3, 4, 5].map((seed) => zug(fen, 'mittel', seed))
    // Die leichte sieht das Zurückschlagen nicht und nimmt (meist) mit der Dame.
    expect(leicht.filter((z) => z === 'f3f7').length).toBeGreaterThanOrEqual(1)
    expect(mittel.some((z) => z === 'f3f7')).toBe(false)
  })

  it('mittel rechnet Schlagabtausche zu Ende', () => {
    // Sxd5 Sxd5 Lxd5: Weiß gewinnt einen Bauern -- aber erst im dritten
    // Halbzug. Wer nach zwei Halbzügen aufhört, sieht nur den verlorenen
    // Springer und lässt den Bauern stehen. (Der König steht auf h8 und
    // nicht auf g8: Sonst gäbe Lxd5 Schach, und die Schachverlängerung
    // rechnete den Abtausch auch ohne Ruhesuche zu Ende -- so war es in
    // der ersten Fassung dieses Tests, und er prüfte nichts.)
    const fen = '7k/8/5n2/3p4/8/2N5/6B1/6K1 w - - 0 1'
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(['c3d5', 'g2d5']).toContain(zug(fen, 'mittel', seed))
    }
  })

  it('schwer setzt mit Dame und König gegen König matt', () => {
    let p: Partie = neuePartie('8/8/8/4k3/8/8/8/K6Q w - - 0 1')
    for (let n = 0; n < 60 && !p.ende; n++) {
      p = zieheIn(
        p,
        waehleZug({ fen: p.stellung.fen(), verlauf: p.verlauf, stufe: 'schwer', seed: n })!,
      )!
    }
    expect(p.ende).toEqual({ art: 'matt', sieger: 'w' })
    // Gemessen: neun weiße Züge. Mehr als zwanzig hieße, er schiebt nur herum.
    expect(Math.ceil(p.zuege.length / 2)).toBeLessThanOrEqual(20)
  }, 60000)

  it('rettet sich in der Not in die Stellungswiederholung', () => {
    // Schwarz hat gegen Dame und Turm nur einen Springer. Sg8-h6 ist für
    // sich ein schlechter Zug -- der Turm nimmt den Springer. Aber die
    // Stellung danach gab es schon zweimal: Der Zug macht die Partie remis.
    const fen = '4k1n1/8/8/8/8/8/8/Q2K3R b - - 0 1'
    const nachher = zieheIn(neuePartie(fen), 'g8h6')!.verlauf.at(-1)!
    const verlauf = [nachher, 'irgendwas', nachher, neuePartie(fen).verlauf[0]!]
    for (const stufe of ['mittel', 'schwer'] as const) {
      expect([stufe, zug(fen, stufe, 1, verlauf)]).toEqual([stufe, 'g8h6'])
      // Ohne die Vorgeschichte ist es der Zug, den er nie spielen würde.
      expect([stufe, zug(fen, stufe, 1)]).not.toEqual([stufe, 'g8h6'])
    }
  }, 20000)

  it('rückt im gewonnenen Endspiel mit dem eigenen König nach', () => {
    // Zwei Stellungen, die sich nur darin unterscheiden, wie nah der weiße
    // König dem schwarzen ist. Beide weißen Felder sind in der Feldtabelle
    // gleich viel wert (d5 und e4: 40) -- den Unterschied macht allein die
    // Mattführung. (Die erste Fassung verglich König am Rand gegen König in
    // der Mitte; das entschied schon die Feldtabelle, und der Test merkte
    // nicht, wenn die Mattführung fehlte.)
    const nah = bewerte(Stellung.ausFen('k7/8/8/3K4/8/8/7Q/8 w - - 0 1'))
    const fern = bewerte(Stellung.ausFen('k7/8/8/8/4K3/8/7Q/8 w - - 0 1'))
    expect(nah).toBeGreaterThan(fern)
  })

  it('ist mit demselben Startwert gleich und mit anderen verschieden', () => {
    const fen = neuePartie().stellung.fen()
    expect(zug(fen, 'leicht', 7)).toBe(zug(fen, 'leicht', 7))
    const verschieden = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => zug(fen, 'leicht', s)))
    expect(verschieden.size).toBeGreaterThan(1)
  })

  it('liefert nichts, wenn es keinen Zug gibt', () => {
    expect(zug('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 'schwer')).toBeNull()
  })

  it('bleibt in der Bedenkzeit', () => {
    const fen = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R2QKB1R w KQ - 0 8'
    const t = performance.now()
    zug(fen, 'schwer')
    // 1,2 s Bedenkzeit; Spielraum für einen langsamen Prüfrechner.
    expect(performance.now() - t).toBeLessThan(3000)
  }, 10000)
})

describe('Eröffnungsbuch', () => {
  it('jede Buchzeile lässt sich Zug für Zug spielen', () => {
    for (const zeile of BUCH_ZEILEN) {
      const zuege = zeile.split(' ')
      expect([zeile, partieAus(zuege).zuege.length]).toEqual([zeile, zuege.length])
    }
  })

  it('mittel und schwer eröffnen aus dem Buch und wählen per Startwert, leicht nicht', () => {
    const fen = neuePartie().stellung.fen()
    const ersteZuege = new Set(BUCH_ZEILEN.map((z) => z.split(' ')[0]))
    const schwer = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => zug(fen, 'schwer', seed)))
    for (const z of schwer) expect(ersteZuege.has(z!)).toBe(true)
    expect(schwer.size).toBeGreaterThan(1)
    expect(ersteZuege.has(zug(fen, 'mittel', 3)!)).toBe(true)
    // Auf einen Buchzug des Menschen antwortet er aus dem Buch.
    const nachE4 = partieAus(['e2e4'])
    const antwort = waehleZug({
      fen: nachE4.stellung.fen(),
      verlauf: nachE4.verlauf,
      stufe: 'schwer',
      seed: 1,
    })
    expect(['e7e5', 'c7c5', 'e7e6', 'c7c6', 'd7d5', 'g8f6', 'd7d6']).toContain(antwort)
  })
})
