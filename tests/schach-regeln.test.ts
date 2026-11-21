/**
 * Schach – die Regeln, ohne Brett und ohne Browser.
 *
 * Der Zuggenerator wird an den bekannten Perft-Zahlen gemessen: Wie viele
 * Zugfolgen gibt es von einer Stellung aus bis zur Tiefe n? Die Zahlen
 * sind seit Jahrzehnten veröffentlicht und von vielen Programmen
 * nachgerechnet. Schon eine falsche Rochade, ein vergessenes en passant
 * oder eine fehlende Unterverwandlung verschiebt sie -- deshalb sind es
 * Stellungen, in denen genau das vorkommt.
 */
import { describe, it, expect } from 'vitest'
import {
  START_FEN,
  Stellung,
  beende,
  findeZug,
  geschlagen,
  neuePartie,
  partieAus,
  perft,
  zieheIn,
  zieleVon,
  zielFelder,
  zuegeAuf,
  feldAus,
  feldName,
  uci,
  type Partie,
} from '@/games/schach'
import { ZUG_KURZ, ZUG_LANG } from '@/games/schach/stellung'

/** Quelle der Zahlen: die Perft-Sammlung des Chess Programming Wiki. */
const PERFT: [string, string, number[]][] = [
  ['Grundstellung', START_FEN, [20, 400, 8902, 197281]],
  [
    'Kiwipete (Rochaden, en passant, Fesselungen)',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    [48, 2039, 97862],
  ],
  [
    'Endspiel mit en passant ins Schach',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    [14, 191, 2812, 43238],
  ],
  [
    'Unterverwandlungen',
    'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    [6, 264, 9467],
  ],
  [
    'Schlagen mit Umwandlung',
    'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    [44, 1486, 62379],
  ],
  [
    'Mittelspiel',
    'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    [46, 2079, 89890],
  ],
]

/** Spielt Züge in Kurzform und besteht darauf, dass jeder erlaubt ist. */
function spiele(zuege: string, fen = START_FEN): Partie {
  let p = neuePartie(fen)
  for (const z of zuege.split(/\s+/).filter(Boolean)) {
    const weiter = zieheIn(p, z)
    if (!weiter) throw new Error(`Zug ${z} geht nicht in ${p.stellung.fen()}`)
    p = weiter
  }
  return p
}

describe('Zuggenerator (Perft)', () => {
  for (const [name, fen, zahlen] of PERFT) {
    it(`${name}: ${zahlen.join(' / ')}`, () => {
      const s = Stellung.ausFen(fen)
      expect(zahlen.map((_, i) => perft(s, i + 1))).toEqual(zahlen)
      // Nach dem Durchrechnen steht alles wieder, wie es war.
      expect(s.fen()).toBe(Stellung.ausFen(fen).fen())
    })
  }

  it('liest und schreibt FEN verlustfrei', () => {
    for (const [, fen] of PERFT) expect(Stellung.ausFen(fen).fen()).toBe(fen)
  })

  it('weist kaputte Stellungen ab', () => {
    expect(() => Stellung.ausFen('8/8/8 w - - 0 1')).toThrow()
    expect(() => Stellung.ausFen('9/8/8/8/8/8/8/8 w - - 0 1')).toThrow()
    expect(() =>
      Stellung.ausFen('rnbqkbnx/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).toThrow()
  })
})

describe('Partie: Züge und Notation', () => {
  it('notiert Bauern, Figuren, Schlagen, Rochade und Schach', () => {
    const p = spiele('e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1 f7f6 d2d4 e5d4 f3d4 c6c5 d1h5')
    expect(p.notation).toEqual([
      'e4',
      'e5',
      'Nf3',
      'Nc6',
      'Bb5',
      'a6',
      'Bxc6',
      'dxc6',
      'O-O',
      'f6',
      'd4',
      'exd4',
      'Nxd4',
      'c5',
      'Qh5+',
    ])
  })

  it('unterscheidet zwei Figuren, die dasselbe Feld erreichen', () => {
    // Zwei Springer auf b1 und f3 können beide nach d2.
    const p = spiele('b1d2', '4k3/8/8/8/8/5N2/8/RN2K3 w - - 0 1')
    expect(p.notation).toEqual(['Nbd2'])
    // Zwei Türme auf derselben Linie: nach der Reihe unterschieden.
    const t = spiele('a1a3', '7k/8/8/R7/8/8/8/R3K3 w - - 0 1')
    expect(t.notation).toEqual(['R1a3'])
  })

  it('notiert lange Rochade, en passant und Umwandlung mit Matt', () => {
    expect(spiele('e1c1', 'r3k3/8/8/8/8/8/8/R3K3 w Qq - 0 1').notation).toEqual(['O-O-O'])
    const ep = spiele('e2e4 a7a6 e4e5 d7d5 e5d6')
    expect(ep.notation.at(-1)).toBe('exd6')
    expect(ep.stellung.brett[feldAus('d5')]).toBe(0)
    // Schlagen und Umwandeln in einem -- und Grundreihenmatt: g7 und h7 versperren die Flucht.
    expect(spiele('b7a8q', 'r6k/1P4pp/8/8/8/8/8/6K1 w - - 0 1').notation).toEqual(['bxa8=Q#'])
    const matt = spiele('a7a8q', '7k/P5pp/8/8/8/8/8/6K1 w - - 0 1')
    expect(matt.notation).toEqual(['a8=Q#'])
  })

  it('lässt nur erlaubte Züge zu', () => {
    const p = neuePartie()
    expect(zieheIn(p, 'e2e5')).toBeNull()
    expect(zieheIn(p, 'e7e5')).toBeNull()
    expect(zieheIn(p, 'xx')).toBeNull()
    // Gefesselt: Der Springer auf c3 darf nicht ziehen.
    const fessel = neuePartie('4k3/8/8/b7/8/2N5/8/4K3 w - - 0 1')
    expect(zieleVon(fessel, feldAus('c3'))).toEqual([])
  })

  it('nimmt das Rochaderecht, wenn der Turm zieht oder geschlagen wird', () => {
    // Turm h1 zieht weg und kommt zurück: kurze Rochade ist trotzdem vorbei.
    // Schwarz vertreibt sich die Zeit mit dem Springer; König und Türme bleiben stehen.
    const p = spiele('h1h2 b8c6 h2h1 c6b8', 'rn2k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(p.stellung.fen().split(' ')[2]).toBe('Qkq')
    expect(zieheIn(p, 'e1g1')).toBeNull()
    expect(zieheIn(p, 'e1c1')).not.toBeNull()
    // Der Turm auf h8 wird geschlagen: Schwarz verliert die kurze Rochade.
    const g = spiele('h1h8', 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(g.stellung.fen().split(' ')[2]).toBe('Qq')
    // Der König zieht: beide Rechte weg, auch nach der Rückkehr.
    const k = spiele('e1f1 b8c6 f1e1 c6b8', 'rn2k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    expect(k.stellung.fen().split(' ')[2]).toBe('kq')
  })

  it('verlangt bei der Umwandlung eine Figur', () => {
    const s = Stellung.ausFen('8/P6k/8/8/8/8/8/6K1 w - - 0 1')
    expect(findeZug(s, 'a7a8')).toBeNull()
    expect(findeZug(s, 'a7a8n')).not.toBeNull()
  })

  it('zählt die geschlagenen Figuren', () => {
    const p = spiele('e2e4 d7d5 e4d5 d8d5 b1c3 d5e5')
    // Mit Vorzeichen, wie auf dem Brett: Weiß positiv, Schwarz negativ.
    expect(geschlagen(p)).toEqual({ w: [1], b: [-1] })
  })
})

describe('Partie: Ende', () => {
  it('Narrenmatt', () => {
    const p = spiele('f2f3 e7e5 g2g4 d8h4')
    expect(p.ende).toEqual({ art: 'matt', sieger: 'b' })
    expect(p.notation.at(-1)).toBe('Qh4#')
    expect(zieheIn(p, 'a2a3')).toBeNull()
  })

  it('Patt', () => {
    const p = spiele('f1f7', '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1')
    expect(p.ende).toEqual({ art: 'patt', sieger: null })
  })

  it('dreimal dieselbe Stellung', () => {
    const p = spiele('g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8')
    expect(p.ende).toEqual({ art: 'wiederholung', sieger: null })
    // Zweimal ist noch keine Wiederholung.
    expect(spiele('g1f3 g8f6 f3g1 f6g8').ende).toBeNull()
  })

  it('50 Züge ohne Bauernzug und ohne Schlagen', () => {
    expect(spiele('a1a2', '4k3/8/8/8/8/8/8/R3K3 w - - 99 80').ende).toEqual({
      art: 'fuenfzig-zuege',
      sieger: null,
    })
    expect(spiele('a1a2', '4k3/8/8/8/8/8/8/R3K3 w - - 98 80').ende).toBeNull()
  })

  it('zu wenig Material', () => {
    expect(neuePartie('4k3/8/8/8/8/8/8/4K3 w - - 0 1').ende?.art).toBe('material')
    expect(neuePartie('4k3/8/8/8/8/8/8/2N1K3 w - - 0 1').ende?.art).toBe('material')
    // Läufer auf Feldern derselben Farbe: Matt geht nicht mehr.
    expect(neuePartie('2b1k3/8/8/8/8/8/8/3BK3 w - - 0 1').ende?.art).toBe('material')
    // Verschiedenfarbig geht es (theoretisch) noch.
    expect(neuePartie('3bk3/8/8/8/8/8/8/3BK3 w - - 0 1').ende).toBeNull()
    expect(neuePartie('4k3/8/8/8/8/8/P7/4K3 w - - 0 1').ende).toBeNull()
  })

  it('Aufgabe und vereinbartes Remis beenden die Partie, Züge danach gehen nicht', () => {
    const p = beende(neuePartie(), { art: 'aufgabe', sieger: 'b' })
    expect(p.ende?.sieger).toBe('b')
    expect(zieheIn(p, 'e2e4')).toBeNull()
    // Ein zweites Ende überschreibt das erste nicht.
    expect(beende(p, { art: 'remis-vereinbart', sieger: null }).ende?.art).toBe('aufgabe')
  })

  it('spielt eine Zugliste nach und hält beim ersten unmöglichen Zug an', () => {
    expect(partieAus(['e2e4', 'e7e5', 'e1e3', 'g1f3']).zuege).toEqual(['e2e4', 'e7e5'])
  })
})

describe('Zobrist-Kennung', () => {
  it('bleibt beim Ziehen und Zurücknehmen gleich der frisch berechneten', () => {
    // Alle Sonderzüge kommen in Kiwipete vor: Rochade, en passant, Umwandlung, Schlagen.
    const s = Stellung.ausFen(
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    )
    let fehler = 0
    const pruefe = (tiefe: number) => {
      const frisch = s.kopie()
      frisch.berechneHash()
      if (frisch.hashA !== s.hashA || frisch.hashB !== s.hashB) fehler++
      if (tiefe === 0) return
      for (const z of s.legaleZuege()) {
        const vorher = [s.hashA, s.hashB]
        s.ziehe(z)
        pruefe(tiefe - 1)
        s.nimmZurueck()
        if (s.hashA !== vorher[0] || s.hashB !== vorher[1]) fehler++
      }
    }
    pruefe(3)
    expect(fehler).toBe(0)
  })

  it('ist für dieselbe Stellung auf verschiedenen Wegen gleich, für andere verschieden', () => {
    const a = Stellung.ausFen(START_FEN)
    const b = Stellung.ausFen(START_FEN)
    for (const k of ['g1f3', 'g8f6', 'b1c3']) a.ziehe(findeZug(a, k)!)
    for (const k of ['b1c3', 'g8f6', 'g1f3']) b.ziehe(findeZug(b, k)!)
    expect([a.hashA, a.hashB]).toEqual([b.hashA, b.hashB])
    b.ziehe(findeZug(b, 'b8c6')!)
    expect(b.hashA).not.toBe(a.hashA)
  })

  it('der Nullzug wechselt nur die Seite und lässt sich zurücknehmen', () => {
    const s = Stellung.ausFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1')
    const vorher = [s.hashA, s.hashB, s.fen()]
    s.zieheNull()
    const frisch = s.kopie()
    frisch.berechneHash()
    expect([s.hashA, s.seite, s.ep]).toEqual([frisch.hashA, -1, -1])
    s.nimmZurueck()
    expect([s.hashA, s.hashB, s.fen()]).toEqual(vorher)
  })
})

describe('Rochade antippen', () => {
  // Weiß kann kurz und lang rochieren.
  const fen = 'r3k2r/pppqbppp/2np1n2/4p3/2B1P1b1/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1'

  it('König auf g1 oder König auf den Turm h1 -- beides ist die kurze Rochade', () => {
    const p = neuePartie(fen)
    const e1 = feldAus('e1')
    expect(zuegeAuf(p, e1, feldAus('g1')).map((z) => z.art)).toEqual([ZUG_KURZ])
    expect(zuegeAuf(p, e1, feldAus('h1')).map((z) => z.art)).toEqual([ZUG_KURZ])
    expect(zuegeAuf(p, e1, feldAus('a1')).map((z) => z.art)).toEqual([ZUG_LANG])
    expect(zuegeAuf(p, e1, feldAus('c1')).map((z) => z.art)).toEqual([ZUG_LANG])
    // Nach der Rochade stehen König und Turm richtig.
    const nachher = zieheIn(p, uci(zuegeAuf(p, e1, feldAus('h1'))[0]!))!
    expect(nachher.stellung.fen().split(' ')[0]!.split('/')[7]).toBe('R4RK1')
  })

  it('zeigt die Türme als Ziel, solange die Rochade erlaubt ist', () => {
    const felder = (p: Partie) =>
      zielFelder(p, feldAus('e1'))
        .filter((f) => f.rochade)
        .map((f) => feldName(f.feld))
        .sort()
    expect(felder(neuePartie(fen))).toEqual(['a1', 'c1', 'g1', 'h1'])
    // Der Turm h1 zieht weg und zurück: Das kurze Rochaderecht ist verloren.
    const ohneKurz = zieheIn(zieheIn(neuePartie(fen), 'h1g1')!, 'a7a6')!
    const zurueck = zieheIn(zieheIn(ohneKurz, 'g1h1')!, 'a6a5')!
    expect(felder(zurueck)).toEqual(['a1', 'c1'])
    // Ein fremder Turm oder ein Turm ohne Rochaderecht ist kein Ziel des Königs.
    expect(zuegeAuf(zurueck, feldAus('e1'), feldAus('h1'))).toEqual([])
  })
})
