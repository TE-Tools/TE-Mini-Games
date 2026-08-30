import { describe, it, expect } from 'vitest'
import {
  MATCH_SIZE,
  createMatch,
  resolveNight,
  resolveVote,
  nextRound,
  matchOutcome,
  alivePlayers,
  humanPlayer,
  checkWinner,
  roleDeck,
  factionOf,
  type MatchState,
} from '@/games/schuetzenrunde'

describe('Schützenrunde – setup', () => {
  it('deals 8 roles with exactly 2 saboteurs', () => {
    const deck = roleDeck(MATCH_SIZE)
    expect(deck).toHaveLength(8)
    expect(deck.filter((r) => factionOf(r) === 'saboteure')).toHaveLength(2)
    expect(deck).toContain('schiessmeister')
    expect(deck).toContain('schuetze')
    expect(deck).toContain('brudermeister')
  })

  it('creates a match with the human first and everyone alive', () => {
    const m = createMatch('Thomas', 'seed-1')
    expect(m.players).toHaveLength(MATCH_SIZE)
    expect(m.players.filter((p) => p.isHuman)).toHaveLength(1)
    expect(humanPlayer(m).name).toBe('Thomas')
    expect(alivePlayers(m)).toHaveLength(MATCH_SIZE)
    expect(m.phase).toBe('night')
    expect(m.round).toBe(1)
    expect(m.winner).toBeNull()
  })

  it('is deterministic for the same seed', () => {
    const a = createMatch('Du', 'same')
    const b = createMatch('Du', 'same')
    expect(a.players.map((p) => p.role)).toEqual(b.players.map((p) => p.role))
    const c = createMatch('Du', 'other')
    expect(a.players.map((p) => p.role)).not.toEqual(c.players.map((p) => p.role))
  })
})

describe('Schützenrunde – night and day', () => {
  it('the night removes at least one player and moves to day', () => {
    const m = createMatch('Du', 'night-seed')
    const target = m.players.find((p) => !p.isHuman && p.alive)!
    const after = resolveNight(m, { targetId: target.id })
    expect(after.phase === 'day' || after.phase === 'over').toBe(true)
    expect(alivePlayers(after).length).toBeLessThan(MATCH_SIZE)
    expect(after.log.length).toBeGreaterThan(m.log.length)
  })

  it('the Schießmeister learns the faction of the checked player', () => {
    // Find a seed where the human is the Schießmeister.
    let m: MatchState | null = null
    for (let i = 0; i < 60 && !m; i++) {
      const candidate = createMatch('Du', `check-${i}`)
      if (humanPlayer(candidate).role === 'schiessmeister') m = candidate
    }
    expect(m).not.toBeNull()
    const target = m!.players.find((p) => !p.isHuman)!
    const after = resolveNight(m!, { targetId: target.id })
    expect(after.notes.length).toBe(1)
    expect(after.notes[0]).toContain(target.name)
  })

  it('the Schütze may only fire once', () => {
    let m: MatchState | null = null
    for (let i = 0; i < 80 && !m; i++) {
      const candidate = createMatch('Du', `shot-${i}`)
      if (humanPlayer(candidate).role === 'schuetze') m = candidate
    }
    expect(m).not.toBeNull()
    const target = m!.players.find((p) => !p.isHuman && p.alive)!
    const after = resolveNight(m!, { targetId: target.id, useShot: true })
    expect(after.shotAvailable).toBe(false)
    expect(after.players.find((p) => p.id === target.id)?.alive).toBe(false)
  })

  it('a vote removes at most one player and never a dead one', () => {
    const m = resolveNight(createMatch('Du', 'vote-seed'))
    const before = alivePlayers(m).length
    const target = alivePlayers(m).find((p) => !p.isHuman)!
    const after = resolveVote(m, target.id)
    expect(alivePlayers(after).length).toBeGreaterThanOrEqual(before - 1)
    expect(after.phase === 'result' || after.phase === 'over').toBe(true)
    for (const p of after.players) {
      if (!p.alive) expect(alivePlayers(after).some((a) => a.id === p.id)).toBe(false)
    }
  })
})

describe('Schützenrunde – win conditions', () => {
  it('the brotherhood wins once no saboteur is left', () => {
    const m = createMatch('Du', 'win-a')
    const state: MatchState = {
      ...m,
      players: m.players.map((p) => ({
        ...p,
        alive: factionOf(p.role) !== 'saboteure',
      })),
    }
    expect(checkWinner(state)).toBe('bruderschaft')
  })

  it('the saboteurs win once they are not outnumbered', () => {
    const m = createMatch('Du', 'win-b')
    const sab = m.players.filter((p) => factionOf(p.role) === 'saboteure')
    const oneBrother = m.players.find((p) => factionOf(p.role) === 'bruderschaft')!
    const keep = new Set([...sab.map((p) => p.id), oneBrother.id])
    const state: MatchState = {
      ...m,
      players: m.players.map((p) => ({ ...p, alive: keep.has(p.id) })),
    }
    expect(checkWinner(state)).toBe('saboteure')
  })

  it('a full match always ends with a winner', () => {
    for (const seed of ['m1', 'm2', 'm3', 'm4', 'm5']) {
      let state = createMatch('Du', seed)
      let guard = 0
      while (!state.winner && guard < 20) {
        const nightTarget = alivePlayers(state).find((p) => !p.isHuman)
        state = resolveNight(state, { targetId: nightTarget?.id })
        if (state.winner) break
        const voteTarget = alivePlayers(state).find((p) => !p.isHuman)
        state = resolveVote(state, voteTarget?.id ?? null)
        if (state.winner) break
        state = nextRound(state)
        guard++
      }
      expect(state.winner).not.toBeNull()
      expect(state.phase).toBe('over')
    }
  })

  it('scores a win higher than a loss', () => {
    const m = createMatch('Du', 'score')
    const human = humanPlayer(m)
    const won: MatchState = { ...m, winner: factionOf(human.role), phase: 'over' }
    const lost: MatchState = {
      ...m,
      winner: factionOf(human.role) === 'saboteure' ? 'bruderschaft' : 'saboteure',
      phase: 'over',
    }
    expect(matchOutcome(won).score).toBeGreaterThan(matchOutcome(lost).score)
    expect(matchOutcome(won).xp).toBeGreaterThan(matchOutcome(lost).xp)
    expect(matchOutcome(won).won).toBe(true)
  })
})
