import { describe, it, expect } from 'vitest'
import {
  MATCH_SIZE,
  MAX_MATCH_SIZE,
  EVENT_SHOTS,
  DEFAULT_TIMERS,
  clampTimers,
  saboteurCount,
  createMatch,
  resolveNight,
  startVote,
  resolveVote,
  nextRound,
  matchOutcome,
  alivePlayers,
  humanPlayer,
  playerById,
  checkWinner,
  checkResultFor,
  roleDeck,
  factionOf,
  ZUEGE,
  zugCount,
  zugPointsFor,
  type MatchState,
  type RoleId,
} from '@/games/schuetzenrunde'

/** Build a match in which the human holds a given role. */
function matchWithHumanRole(role: RoleId, prefix = 'role', tries = 200): MatchState | null {
  for (let i = 0; i < tries; i++) {
    const size = role === 'zeugwart' || role === 'schriftfuehrer' ? 12 : 16
    const candidate = createMatch('Du', `${prefix}-${i}`, size)
    if (humanPlayer(candidate).role === role) return candidate
  }
  return null
}

/** Play a whole match to the end, so the rules cannot deadlock. */
function playOut(state: MatchState): MatchState {
  let current = state
  let guard = 0
  while (!current.winner && guard < 30) {
    const nightTarget = alivePlayers(current).find((p) => !p.isHuman)
    current = resolveNight(current, { targetId: nightTarget?.id })
    if (current.winner) break
    current = startVote(current)
    const voteTarget = alivePlayers(current).find((p) => !p.isHuman)
    current = resolveVote(current, voteTarget?.id ?? null)
    if (current.winner) break
    current = nextRound(current)
    guard++
  }
  return current
}

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
    expect(m.shotsLeft).toBe(1)
    expect(m.event).toBe(false)
  })

  it('is deterministic for the same seed', () => {
    const a = createMatch('Du', 'same')
    const b = createMatch('Du', 'same')
    expect(a.players.map((p) => p.role)).toEqual(b.players.map((p) => p.role))
    const c = createMatch('Du', 'other')
    expect(a.players.map((p) => p.role)).not.toEqual(c.players.map((p) => p.role))
  })
})

describe('Schützenrunde – round sizes and offices', () => {
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

  it('hands out more offices the bigger the round gets', () => {
    expect(roleDeck(8)).not.toContain('zeugwart')
    expect(roleDeck(10)).toContain('zeugwart')
    expect(roleDeck(12)).toContain('schriftfuehrer')
    expect(roleDeck(14)).toContain('oberst')
    expect(roleDeck(16)).toContain('stellvertreter')
    // The saboteurs get their own specialists in the larger rounds.
    expect(roleDeck(10)).toContain('falschspieler')
    expect(roleDeck(14)).toContain('geruechtemacher')
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

describe('Schützenrunde – Züge', () => {
  it('puts everybody into a Zug and the human into the chosen one', () => {
    const wanted = ZUEGE[2]!.id
    const m = createMatch('Du', 'zug-seed', 12, { zugId: wanted })
    expect(humanPlayer(m).zugId).toBe(wanted)
    const used = new Set(m.players.map((p) => p.zugId))
    expect(used.size).toBeGreaterThan(1)
    for (const p of m.players) {
      expect(ZUEGE.slice(0, zugCount(12)).some((z) => z.id === p.zugId)).toBe(true)
    }
  })

  it('scores a win higher than mere survival', () => {
    expect(zugPointsFor(true, true, false)).toBeGreaterThan(zugPointsFor(false, true, false))
    expect(zugPointsFor(true, true, true)).toBeGreaterThan(zugPointsFor(true, true, false))
    expect(zugPointsFor(false, false, false)).toBe(0)
  })
})

describe('Schützenrunde – timers', () => {
  it('uses the values from the specification by default', () => {
    expect(DEFAULT_TIMERS).toEqual({ night: 45, day: 90, vote: 30, result: 8 })
    expect(createMatch('Du', 'timer-a').timers).toEqual(DEFAULT_TIMERS)
  })

  it('keeps configured timers inside the allowed range', () => {
    expect(clampTimers({ night: 60 }).night).toBe(60)
    expect(clampTimers({ night: 5 }).night).toBe(20)
    expect(clampTimers({ day: 999 }).day).toBe(180)
    expect(clampTimers({ vote: Number.NaN }).vote).toBe(DEFAULT_TIMERS.vote)
    expect(createMatch('Du', 'timer-b', 8, { timers: { result: 99 } }).timers.result).toBe(20)
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

  it('goes from the discussion to a separate vote phase', () => {
    const day = resolveNight(createMatch('Du', 'phase-seed'))
    if (day.phase === 'over') return
    expect(day.phase).toBe('day')
    const vote = startVote(day)
    expect(vote.phase).toBe('vote')
    expect(resolveVote(vote, null).phase === 'result' || resolveVote(vote, null).phase === 'over')
      .toBe(true)
  })

  it('records who voted for whom', () => {
    const day = resolveNight(createMatch('Du', 'votes-seed'))
    const target = alivePlayers(day).find((p) => !p.isHuman)!
    const after = resolveVote(startVote(day), target.id)
    expect(after.lastVotes.length).toBeGreaterThan(0)
    for (const v of after.lastVotes) {
      expect(v.voter).not.toBe(v.target)
      expect(v.voterId).not.toBe(v.targetId)
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
    const m = matchWithHumanRole('schiessmeister', 'check')
    expect(m).not.toBeNull()
    const target = m!.players.find((p) => !p.isHuman)!
    const after = resolveNight(m!, { targetId: target.id })
    expect(after.notes.length).toBeGreaterThanOrEqual(1)
    expect(after.notes[0]).toContain(target.name)
  })

  it('the Schütze may only fire as often as they have shots', () => {
    const m = matchWithHumanRole('schuetze', 'shot')
    expect(m).not.toBeNull()
    const target = m!.players.find((p) => !p.isHuman && p.alive)!
    const after = resolveNight(m!, { targetId: target.id, useShot: true })
    expect(after.shotsLeft).toBe(0)
    expect(after.players.find((p) => p.id === target.id)?.alive).toBe(false)
  })

  it('the Zeugwart keeps the saboteurs away from the guarded member', () => {
    const m = matchWithHumanRole('zeugwart', 'guard')
    expect(m).not.toBeNull()
    // Guarding a saboteur changes nothing, so this run shows the real victim.
    const saboteur = m!.players.find((p) => factionOf(p.role) === 'saboteure')!
    const open = resolveNight(m!, { targetId: saboteur.id })
    const victimId = open.lastEliminated[0]
    expect(victimId).toBeDefined()

    const guarded = resolveNight(m!, { targetId: victimId! })
    expect(playerById(guarded, victimId!)?.alive).toBe(true)
    expect(guarded.log.join(' ')).toContain('Zeughaus')
    expect(guarded.protectedId).toBe(victimId)
  })

  it('the Schriftführer gets a protocol note every night', () => {
    const m = matchWithHumanRole('schriftfuehrer', 'protocol')
    expect(m).not.toBeNull()
    const after = resolveNight(m!)
    expect(after.notes.length).toBe(1)
    expect(after.notes[0]).toMatch(/Saboteur|gehören/)
  })

  it('a vote removes at most one player and never a dead one', () => {
    const m = startVote(resolveNight(createMatch('Du', 'vote-seed')))
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

describe('Schützenrunde – lies and gossip', () => {
  it('the Falschspieler looks like a member of the Bruderschaft', () => {
    const m = createMatch('Du', 'liar-seed', 12)
    const liar = m.players.find((p) => p.role === 'falschspieler')
    if (!liar) return
    expect(factionOf(liar.role)).toBe('saboteure')
    expect(checkResultFor(m, liar)).toBe('bruderschaft')
  })

  it('a member in the gossip is read as a saboteur', () => {
    const m = createMatch('Du', 'gossip-seed', 14)
    const honest = m.players.find((p) => factionOf(p.role) === 'bruderschaft')!
    expect(checkResultFor(m, honest)).toBe('bruderschaft')
    const framed: MatchState = { ...m, framedIds: [honest.id] }
    expect(checkResultFor(framed, honest)).toBe('saboteure')
  })

  it('the human Gerüchtemacher spends the rumour only once', () => {
    const m = matchWithHumanRole('geruechtemacher', 'rumour')
    expect(m).not.toBeNull()
    const victim = m!.players.find((p) => factionOf(p.role) === 'bruderschaft')!
    const after = resolveNight(m!, { targetId: victim.id, spreadRumour: true })
    expect(after.rumourUsed).toBe(true)
    expect(after.framedIds).toContain(victim.id)
    const again = resolveNight(nextRound(after), { targetId: victim.id, spreadRumour: true })
    expect(again.framedIds.filter((id) => id === victim.id)).toHaveLength(1)
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
      const state = playOut(createMatch('Du', seed))
      expect(state.winner).not.toBeNull()
      expect(state.phase).toBe('over')
    }
  })

  it('a full 16-player match with all offices also ends', () => {
    for (const seed of ['big-1', 'big-2', 'big-3']) {
      const state = playOut(createMatch('Du', seed, 16))
      expect(state.winner).not.toBeNull()
      expect(state.phase).toBe('over')
    }
  })
})

describe('Schützenrunde – Schützenfest', () => {
  it('gives the Schütze three shots', () => {
    const m = createMatch('Du', 'event-seed', 12, { event: true })
    expect(m.event).toBe(true)
    expect(m.shotsLeft).toBe(EVENT_SHOTS)
    expect(m.log.join(' ')).toContain('Schützenfest')
  })

  it('crowns the best saboteur hunter and nobody else', () => {
    let crowned = 0
    for (const seed of ['fest-1', 'fest-2', 'fest-3', 'fest-4', 'fest-5', 'fest-6']) {
      const state = playOut(createMatch('Du', seed, 12, { event: true }))
      if (state.kingId == null) continue
      crowned++
      const king = playerById(state, state.kingId)!
      expect(factionOf(king.role)).toBe('bruderschaft')
      const best = Math.max(...Object.values(state.correctVotes))
      expect(state.correctVotes[king.id]).toBe(best)
      expect(state.log.join(' ')).toContain('Vogelschießen')
    }
    expect(crowned).toBeGreaterThan(0)
  })

  it('never crowns anybody in a normal round', () => {
    for (const seed of ['plain-1', 'plain-2', 'plain-3']) {
      expect(playOut(createMatch('Du', seed, 12)).kingId).toBeNull()
    }
  })
})

describe('Schützenrunde – scoring', () => {
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

  it('pays the crown on top and never goes over 1000', () => {
    const m = createMatch('Du', 'score-king')
    const human = humanPlayer(m)
    const won: MatchState = { ...m, winner: factionOf(human.role), phase: 'over' }
    const asKing: MatchState = { ...won, kingId: human.id }
    expect(matchOutcome(asKing).king).toBe(true)
    expect(matchOutcome(asKing).score).toBeGreaterThan(matchOutcome(won).score)
    expect(matchOutcome(asKing).score).toBeLessThanOrEqual(1000)
    expect(matchOutcome(asKing).xp).toBeGreaterThan(matchOutcome(won).xp)
  })
})
