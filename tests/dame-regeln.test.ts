/**
 * Dame: Zugerzeugung, Hausregeln, Ende.
 *
 * Die Zählung aus der Grundstellung (Perft) prüft die Zugerzeugung im
 * Ganzen. Für die englische Spielart (Steine schlagen nur vorwärts, Damen
 * ziehen ein Feld, Schlagzwang, freie Wahl) sind die Zahlen veröffentlicht
 * und vielfach nachgerechnet; mit den passenden Hausregeln muss die Engine
 * sie treffen. Für die deutsche Dame gibt es keine verlässliche Tabelle --
 * dort prüfen wir, was sich ohne Tabelle sagen lässt.
 */
import { describe, it, expect } from 'vitest'
import {
  STANDARD_REGELN,
  REMIS,
  alsText,
  ausText,
  beende,
  erlaubteZuege,
  feldAus,
  grundstellung,
  kurz,
  naechsteFelder,
  neuePartie,
  partieAus,
  perft,
  regelnAus,
  schlagpflichtig,
  stellungAus,
  ziehe,
  zieheIn,
  zuegeVon,
  type DameRegeln,
  type Stellung,
} from '@/games/dame'

const ENGLISCH: DameRegeln = {
  schlagzwang: true,
  mehrheitsschlag: false,
  fliegendeDame: false,
  steinSchlaegtRueckwaerts: false,
}

const texte = (s: Stellung, r: DameRegeln = STANDARD_REGELN) => erlaubteZuege(s, r).map(kurz).sort()

describe('Grundstellung', () => {
  it('zwölf Steine je Seite auf den dunklen Feldern, Weiß beginnt', () => {
    const s = grundstellung()
    expect(s.brett.filter((f) => f === 1)).toHaveLength(12)
    expect(s.brett.filter((f) => f === -1)).toHaveLength(12)
    expect(s.brett[feldAus('a1')]).toBe(1)
    expect(s.brett[feldAus('b1')]).toBe(0)
    expect(s.brett[feldAus('h8')]).toBe(-1)
    expect(s.amZug).toBe('w')
    expect(texte(s)).toEqual(['a3-b4', 'c3-b4', 'c3-d4', 'e3-d4', 'e3-f4', 'g3-f4', 'g3-h4'])
  })

  it('trifft die veröffentlichten Zählungen der englischen Spielart', () => {
    const s = grundstellung()
    expect([1, 2, 3, 4, 5, 6].map((t) => perft(s, ENGLISCH, t))).toEqual([
      7, 49, 302, 1469, 7361, 36768,
    ])
  })

  it('deutsche Dame: am Anfang dieselben Zahlen, später nie weniger', () => {
    const s = grundstellung()
    const deutsch = [1, 2, 3, 4, 5, 6].map((t) => perft(s, STANDARD_REGELN, t))
    // Solange keine Dame entsteht und kein Stein rückwärts schlagen kann, ist alles gleich.
    expect(deutsch.slice(0, 4)).toEqual([7, 49, 302, 1469])
    // Ohne Schlagzwang gibt es in jeder Lage mindestens so viele Züge.
    const frei = { ...STANDARD_REGELN, schlagzwang: false }
    expect(perft(s, frei, 4)).toBeGreaterThanOrEqual(deutsch[3]!)
    // Eine Stellung hin und zurück als Text bleibt dieselbe.
    expect(alsText(ausText(alsText(s)))).toBe(alsText(s))
  })
})

describe('Schlagen', () => {
  it('Schlagzwang: Wer schlagen kann, muss -- und der Stein ist hervorgehoben', () => {
    const s = stellungAus({ w: ['c3', 'g3'], b: ['d4'] })
    expect(texte(s)).toEqual(['c3xe5'])
    const p = neuePartie(STANDARD_REGELN, s)
    expect(schlagpflichtig(p)).toEqual([feldAus('c3')])
  })

  it('Schlagzwang als Hausregel aus: Schlagen ist frei, stille Züge gehen auch', () => {
    const s = stellungAus({ w: ['c3', 'g3'], b: ['d4'] })
    const frei = { ...STANDARD_REGELN, schlagzwang: false }
    expect(texte(s, frei)).toEqual(['c3-b4', 'c3xe5', 'g3-f4', 'g3-h4'])
    expect(schlagpflichtig(neuePartie(frei, s))).toEqual([])
  })

  it('Steine schlagen auch rückwärts -- als Hausregel abschaltbar', () => {
    const s = stellungAus({ w: ['e5'], b: ['d4', 'h8'] })
    expect(texte(s)).toEqual(['e5xc3'])
    const nurVor = { ...STANDARD_REGELN, steinSchlaegtRueckwaerts: false }
    expect(texte(s, nurVor)).toEqual(['e5-d6', 'e5-f6'])
  })

  it('Mehrfachsprung ist Pflicht bis zum Ende, mit freier Wahl der Folge', () => {
    // Von a1 aus: über b2 nach c3, dann über d4 nach e5 oder über b4 nach a5.
    const s = stellungAus({ w: ['a1'], b: ['b2', 'd4', 'b4', 'h8'] })
    expect(texte(s)).toEqual(['a1xc3xa5', 'a1xc3xe5'])
  })

  it('Mehrheitsschlag als Hausregel: nur die längste Folge', () => {
    // Links ein Stein (c3xa5), rechts zwei hintereinander (g3xe5xc7).
    const s = stellungAus({ w: ['c3', 'g3'], b: ['b4', 'f4', 'd6', 'h8'] })
    expect(texte(s)).toEqual(['c3xa5', 'g3xe5xc7'])
    expect(texte(s, { ...STANDARD_REGELN, mehrheitsschlag: true })).toEqual(['g3xe5xc7'])
  })

  it('ein Stein wird nicht zweimal übersprungen, und geschlagene bleiben bis zum Ende stehen', () => {
    // Die Dame auf a3 schlägt einmal im Kreis: b4, d6, f6, f4, d2 -- und landet auf c1.
    const s = stellungAus({ w: ['Da3'], b: ['b4', 'd6', 'f6', 'f4', 'd2'] })
    const zuege = erlaubteZuege(s, STANDARD_REGELN)
    for (const z of zuege) {
      expect(new Set(z.geschlagen).size).toBe(z.geschlagen.length)
    }
    expect(zuege.map(kurz)).toEqual(['a3xc5xe7xg5xe3xc1'])
    // Am Ende sind alle fünf weg.
    const nach = ziehe(s, zuege[0]!)
    expect(nach.brett.filter((f) => f < 0)).toHaveLength(0)
    expect(nach.brett[feldAus('c1')]).toBe(2)
  })

  it('fliegende Dame: zieht und schlägt beliebig weit, landet hinter dem Opfer', () => {
    const s = stellungAus({ w: ['Da1'], b: ['e5', 'a7'] })
    const z = texte(s)
    // Schlagen ist Pflicht: über e5 auf f6, g7 oder h8.
    expect(z).toEqual(['a1xf6', 'a1xg7', 'a1xh8'])
    // Ohne Opfer gleitet sie die ganze Diagonale entlang.
    const leer = stellungAus({ w: ['Da1'], b: ['h2'] })
    expect(texte(leer)).toEqual(['a1-b2', 'a1-c3', 'a1-d4', 'a1-e5', 'a1-f6', 'a1-g7', 'a1-h8'])
  })

  it('fliegende Dame muss dort landen, von wo sie weiterschlagen kann', () => {
    // Über c3 hinweg auf d4 bis h8: Nur von e5 aus geht es weiter (über f4).
    const s = stellungAus({ w: ['Da1'], b: ['c3', 'f4'] })
    expect(texte(s)).toEqual(['a1xe5xg3', 'a1xe5xh2'])
  })

  it('Hausregel „Dame zieht ein Feld“', () => {
    const s = stellungAus({ w: ['Da1'], b: ['e5', 'h2'] })
    const kurzeDame = { ...STANDARD_REGELN, fliegendeDame: false }
    expect(texte(s, kurzeDame)).toEqual(['a1-b2'])
    const nah = stellungAus({ w: ['Dd4'], b: ['e5', 'h2'] })
    expect(texte(nah, kurzeDame)).toEqual(['d4xf6'])
  })

  it('ein Stein im Schlag über die letzte Reihe hinweg bleibt Stein; am Ende darauf wird er Dame', () => {
    // f6 über e7 auf d8 (letzte Reihe), dann rückwärts über c7 auf b6.
    const s = stellungAus({ w: ['f6'], b: ['e7', 'c7', 'h2'] })
    const [z] = erlaubteZuege(s, STANDARD_REGELN)
    expect(kurz(z!)).toBe('f6xd8xb6')
    expect(z!.wirdDame).toBe(false)
    const nach = ziehe(s, z!)
    expect(nach.brett[feldAus('b6')]).toBe(1)

    const nurBisOben = stellungAus({ w: ['f6'], b: ['e7', 'h2'] })
    const [u] = erlaubteZuege(nurBisOben, STANDARD_REGELN)
    expect(kurz(u!)).toBe('f6xd8')
    expect(u!.wirdDame).toBe(true)
    expect(ziehe(nurBisOben, u!).brett[feldAus('d8')]).toBe(2)
  })

  it('stiller Zug auf die letzte Reihe macht eine Dame', () => {
    const s = stellungAus({ w: ['a7'], b: ['h2'] })
    const p = neuePartie(STANDARD_REGELN, s)
    const weiter = zieheIn(p, 'a7-b8')!
    expect(weiter.stellung.brett[feldAus('b8')]).toBe(2)
  })
})

describe('Antippen in Schritten', () => {
  it('die nächsten Landefelder einer Folge', () => {
    const s = stellungAus({ w: ['a1'], b: ['b2', 'd4', 'b4', 'h8'] })
    const p = neuePartie(STANDARD_REGELN, s)
    const a1 = feldAus('a1')
    expect(naechsteFelder(p, a1)).toEqual([feldAus('c3')])
    expect(naechsteFelder(p, a1, [feldAus('c3')]).sort()).toEqual(
      [feldAus('e5'), feldAus('a5')].sort(),
    )
    expect(zuegeVon(p, a1, [feldAus('c3'), feldAus('e5')])).toHaveLength(1)
  })
})

describe('Ende und Remis', () => {
  it('wer keine Steine mehr hat, verliert', () => {
    const p = neuePartie(STANDARD_REGELN, stellungAus({ w: ['c3'], b: ['d4'] }, 'w'))
    const weiter = zieheIn(p, 'c3xe5')!
    expect(weiter.ende).toEqual({ art: 'keine-steine', sieger: 'w' })
    expect(weiter.letzter?.opfer).toEqual([-1])
  })

  it('wer festsitzt, verliert', () => {
    // Schwarz auf b8 kann nicht ziehen: a7 und c7 sind besetzt, hinter c7 auch d6.
    const s = stellungAus({ w: ['a7', 'c7', 'd6'], b: ['b8'] }, 'b')
    const p = neuePartie(STANDARD_REGELN, s)
    expect(p.ende).toEqual({ art: 'blockiert', sieger: 'w' })
  })

  it('dreimal dieselbe Stellung ist Remis', () => {
    const p = neuePartie(STANDARD_REGELN, stellungAus({ w: ['Dc1'], b: ['Df8'] }))
    const hin = ['c1-d2', 'f8-g7', 'd2-c1', 'g7-f8']
    let q = p
    for (const z of [...hin, ...hin]) q = zieheIn(q, z)!
    expect(q.ende).toEqual({ art: 'wiederholung', sieger: null })
  })

  it('25 Züge je Seite ohne Schlagen und Steinzug sind Remis', () => {
    // Zwei Damen, schon 46 Halbzüge ohne Fortschritt: Nach vier weiteren ist Schluss.
    const start = { ...stellungAus({ w: ['Dc1'], b: ['Df8'] }), ohneFortschritt: 46 }
    let q = neuePartie(STANDARD_REGELN, start)
    for (const z of ['c1-d2', 'f8-e7', 'd2-c3']) q = zieheIn(q, z)!
    expect(q.ende).toBeNull()
    q = zieheIn(q, 'e7-d8')!
    expect(q.ende).toEqual({ art: 'ohne-fortschritt', sieger: null })
    expect(REMIS.halbzuegeOhneFortschritt).toBe(50)
  })

  it('der Zähler ohne Fortschritt: Steinzug und Schlagen setzen ihn zurück', () => {
    let s = stellungAus({ w: ['Da1', 'c3'], b: ['Dh8', 'f6'] })
    s = ziehe(
      s,
      erlaubteZuege(s, STANDARD_REGELN).find((z) => kurz(z) === 'a1-b2')!,
    )
    expect(s.ohneFortschritt).toBe(1)
    s = ziehe(
      s,
      erlaubteZuege(s, STANDARD_REGELN).find((z) => kurz(z) === 'f6-e5')!,
    )
    expect(s.ohneFortschritt).toBe(0)
    // Mit 50 Halbzügen auf der Uhr endet die Partie von selbst.
    const voll = { ...stellungAus({ w: ['Da1'], b: ['Dh8'] }), ohneFortschritt: 50 }
    expect(neuePartie(STANDARD_REGELN, voll).ende?.art).toBe('ohne-fortschritt')
  })

  it('ein ungültiger Zug wird nicht gespielt; nach dem Ende geht nichts mehr', () => {
    const p = neuePartie()
    expect(zieheIn(p, 'c3-c4')).toBeNull()
    expect(zieheIn(p, 'Unsinn')).toBeNull()
    const aus = beende(p, { art: 'aufgabe', sieger: 'b' })
    expect(zieheIn(aus, 'c3-d4')).toBeNull()
    // Schon beendet bleibt beendet.
    expect(beende(aus, { art: 'remis-vereinbart', sieger: null }).ende?.art).toBe('aufgabe')
  })

  it('partieAus hält beim ersten Zug an, der nicht geht, und trägt die Regeln mit', () => {
    const r = { ...STANDARD_REGELN, fliegendeDame: false }
    const p = partieAus(r, ['c3-d4', 'f6-e5', 'h1-h2', 'd4xf6'])
    expect(p.zuege).toEqual(['c3-d4', 'f6-e5'])
    expect(p.regeln).toEqual(r)
  })

  it('Regeln aus unsicherer Quelle: Fehlendes bekommt die Voreinstellung', () => {
    expect(regelnAus(null)).toEqual(STANDARD_REGELN)
    expect(regelnAus({ schlagzwang: false, fliegendeDame: 'ja' })).toEqual({
      ...STANDARD_REGELN,
      schlagzwang: false,
    })
  })
})
