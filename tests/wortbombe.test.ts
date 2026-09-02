/**
 * Wortbombe: Weitergeben, Explodieren, Leben und wer übrig bleibt.
 */
import { describe, it, expect } from 'vitest'
import {
  createWortbombeMatch,
  passBomb,
  explode,
  nextWortbombeRound,
  activeWortbombePlayer,
  wortbombeSieger,
  ziehSilbe,
  zuendzeitMs,
  SILBEN,
  silbenFuer,
  MIN_SPIELER,
} from '@/games/wortbombe'
import type { WortbombeState } from '@/games/wortbombe'
import { createRng } from '@/games/rng'

const NAMEN = ['Anna', 'Ben', 'Cem']

function start(names = NAMEN, opts: Record<string, unknown> = {}): WortbombeState {
  return createWortbombeMatch({ names, seed: 3, lives: 2, ...opts })
}

describe('Silben', () => {
  it('enthält keine, zu der einem nichts einfällt', () => {
    const texte = SILBEN.map((s) => s.text)
    for (const heikel of ['Q', 'QU', 'X', 'Y', 'YPS']) {
      expect(texte).not.toContain(heikel)
    }
  })

  it('hat von jeder Stufe genug', () => {
    for (const stufe of ['leicht', 'mittel', 'schwer'] as const) {
      expect(silbenFuer([stufe]).length).toBeGreaterThanOrEqual(20)
    }
  })

  it('zieht ohne Auswahl aus leicht und mittel', () => {
    const ohne = silbenFuer([])
    expect(ohne.every((s) => s.stufe !== 'schwer')).toBe(true)
  })

  it('zieht nie dieselbe Silbe zweimal hintereinander', () => {
    for (let i = 0; i < 50; i++) {
      const rng = createRng(`s${i}`)
      expect(ziehSilbe(rng, ['leicht'], 'AU')).not.toBe('AU')
    }
  })

  it('bleibt bei der gewählten Stufe', () => {
    const erlaubt = silbenFuer(['schwer']).map((s) => s.text)
    for (let i = 0; i < 30; i++) {
      expect(erlaubt).toContain(ziehSilbe(createRng(`x${i}`), ['schwer']))
    }
  })
})

describe('Weitergeben', () => {
  it('reicht im Kreis weiter', () => {
    let s = start()
    expect(s.activePlayerIndex).toBe(0)
    s = passBomb(s)
    expect(s.activePlayerIndex).toBe(1)
    s = passBomb(passBomb(s))
    expect(s.activePlayerIndex).toBe(0)
    expect(s.passes).toBe(3)
  })

  it('überspringt, wer schon raus ist', () => {
    let s = start()
    // Ben raus
    s = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, out: true, lives: 0 } : p)) }
    s = passBomb(s)
    expect(s.activePlayerIndex).toBe(2)
  })
})

describe('Explosion', () => {
  it('nimmt dem, der sie hält, ein Leben', () => {
    const s = explode(passBomb(start()))
    expect(s.phase).toBe('boom')
    expect(s.players[1]!.lives).toBe(1)
    expect(s.players[1]!.out).toBe(false)
    expect(s.players[0]!.lives).toBe(2)
  })

  it('wirft raus, wer sein letztes Leben verliert', () => {
    let s = start(NAMEN, { lives: 1 })
    s = explode(s)
    expect(s.players[0]).toMatchObject({ lives: 0, out: true })
  })

  it('lässt nach der Explosion den Nächsten anfangen', () => {
    let s = explode(start())
    s = nextWortbombeRound(s)
    expect(s.phase).toBe('handoff')
    expect(s.activePlayerIndex).toBe(1)
    expect(s.passes).toBe(0)
  })

  it('zieht für die neue Runde eine andere Silbe', () => {
    const s = start()
    const neu = nextWortbombeRound(explode(s))
    expect(neu.silbe).not.toBe(s.silbe)
  })

  it('endet, wenn nur noch einer übrig ist', () => {
    let s = start(['Anna', 'Ben'], { lives: 1 })
    s = explode(s)
    s = nextWortbombeRound(s)
    expect(s.phase).toBe('game_over')
    expect(wortbombeSieger(s)?.name).toBe('Ben')
  })

  it('meldet erst am Ende einen Sieger', () => {
    expect(wortbombeSieger(start())).toBeNull()
  })
})

describe('Zündzeit', () => {
  it('bleibt in den eingestellten Grenzen', () => {
    const s = start(NAMEN, { minSeconds: 8, maxSeconds: 20 })
    for (let i = 0; i < 200; i++) {
      const ms = zuendzeitMs(s, () => i / 200)
      expect(ms).toBeGreaterThanOrEqual(8000)
      expect(ms).toBeLessThanOrEqual(20000)
    }
  })

  it('fängt unsinnige Grenzen ab', () => {
    const s = start(NAMEN, { minSeconds: 1, maxSeconds: 1 })
    expect(s.minSeconds).toBe(5)
    expect(s.maxSeconds).toBeGreaterThan(s.minSeconds)
  })
})

describe('Aufstellung', () => {
  it('braucht mindestens zwei Mitspielende', () => {
    expect(() => start(['Allein'])).toThrow(new RegExp(`Mindestens ${MIN_SPIELER}`))
  })

  it('gibt jedem dieselbe Zahl Leben', () => {
    const s = start(NAMEN, { lives: 4 })
    expect(s.players.every((p) => p.lives === 4)).toBe(true)
    expect(activeWortbombePlayer(s).name).toBe('Anna')
  })
})
