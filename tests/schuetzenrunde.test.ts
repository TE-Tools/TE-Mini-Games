import { describe, it, expect } from 'vitest'
import {
  MATCH_SIZE,
  MAX_MATCH_SIZE,
  saboteurCount,
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

describe('Schützenrunde – round sizes', () => {
  it('scales the deck from 8 to 16 players', () => {
    for (const size of [8, 10, 11, 12, 14, 16]) {
      const deck = roleDeck(size)
      expect(deck).toHaveLength(size)
      expect(deck.filter((r) => factionOf(r) === 'saboteure')).toHaveLength(saboteurCount(size))
      expect(deck).toContain('schiessmeister')
      expect(deck).toContain('schuetze')
      expect(deck).toContain('brudermeister')
    }
    expect(saboteurCount(8)).toBe(2)
    expect(saboteurCount(11)).toBe(2)
    expect(saboteurCount(12)).toBe(3)
  })

  it('creates a match with the requested size and clamps the rest', () => {
    expect(createMatch('Du', 'size-a', 12).players).toHaveLength(12)
    expect(createMatch('Du', 'size-b', 16).players).toHaveLength(MAX_MATCH_SIZE)
    expect(createMatch('Du', 'size-c', 99).players).toHaveLength(MAX_MATCH_SIZE)
    expect(createMatch('Du', 'size-d', 2).players).toHaveLength(MATCH_SIZE)
    // Every player has a distinct name.
    const names = createMatch('Du', 'size-e', 16).players.map((p) => p.name)
    expect(new Set(names).size).toBe(16)
  })
})

describe('Schützenrunde – discussion and votes', () => {
  it('the bots talk during the day and never the human', () => {
    const after = resolveNight(createMatch('Du', 'talk-seed'))
    if (after.phase === 'over') return
    expect(after.statements.length).toBeGreaterThan(0)
    expect(after.statements.length).toBeLessThanOrEqual(4)
    for (const st of after.statements) {
      expect(st.round).toBe(after.round)
      expect(st.speaker).not.toBe('Du')
      expect(st.text.length).toBeGreaterThan(5)
    }
  })

  it('records who voted for whom', () => {
    const day = resolveNight(createMatch('Du', 'votes-seed'))
    const target = alivePlayers(day).find((p) => !p.isHuman)!
    const after = resolveVote(day, target.id)
    expect(after.lastVotes.length).toBeGreaterThan(0)
    for (const v of after.lastVotes) {
      expect(v.voter).not.toBe(v.target)
    }
    // The talk of the finished day is cleared again.
    expect(after.statements).toHaveLength(0)
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
