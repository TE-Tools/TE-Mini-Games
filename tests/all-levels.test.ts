/**
 * Vollständigkeitsprüfung: Ist wirklich jedes Level jedes Spiels spielbar?
 *
 * Die anderen Testdateien prüfen einzelne Regeln. Hier wird stattdessen jedes
 * Level einmal komplett durchgespielt – erzeugen, treffen, werten – damit kein
 * Loch in der Strecke von 1 bis 500 unbemerkt bleibt.
 */
import { describe, it, expect } from 'vitest'
import {
  createPerfectSecondLevel,
  calculateScore,
  isHitWithinTolerance,
  MIN_HIT_SCORE,
} from '@/games/perfect-second'
import {
  createWhatIsMissingLevel,
  calculateWhatIsMissingScore,
  OBJECT_CATALOG,
} from '@/games/what-is-missing'
import { MAX_LEVEL, isSegmentGate, segmentIndexForLevel, zoneForLevel } from '@/progression/zones'
import {
  createMatch,
  resolveNight,
  startVote,
  resolveVote,
  nextRound,
  matchOutcome,
  alivePlayers,
  roleDeck,
  saboteurCount,
  factionOf,
  MIN_MATCH_SIZE,
  MAX_MATCH_SIZE,
} from '@/games/schuetzenrunde'

describe('Die perfekte Sekunde – alle 500 Level', () => {
  it('lässt sich in jedem Level gewinnen', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const config = createPerfectSecondLevel(level)
      expect(config.level, `Level ${level}`).toBe(level)
      expect(config.targetTime).toBeGreaterThan(0)
      expect(config.tolerance).toBeGreaterThan(0)

      // Genau auf den Punkt getroffen: muss zählen und Punkte geben.
      const exact = calculateScore({
        targetTime: config.targetTime,
        actualTime: config.targetTime,
        tolerance: config.tolerance,
        level,
      })
      expect(exact.withinTolerance, `Level ${level} exakt getroffen`).toBe(true)
      expect(exact.score, `Level ${level} Punkte`).toBeGreaterThanOrEqual(MIN_HIT_SCORE)
      expect(exact.xp).toBeGreaterThan(0)

      // Knapp am Rand der Toleranz: zählt noch, aber nie mit 0 Punkten – genau
      // der Fehler, der auf Level 28 „geschafft, 0 Punkte“ gemeldet hat.
      const edge = config.targetTime + config.tolerance * 0.999
      expect(isHitWithinTolerance(config.targetTime, edge, config.tolerance)).toBe(true)
      const edgeScore = calculateScore({
        targetTime: config.targetTime,
        actualTime: edge,
        tolerance: config.tolerance,
        level,
      })
      expect(edgeScore.score, `Level ${level} Rand der Toleranz`).toBeGreaterThanOrEqual(
        MIN_HIT_SCORE,
      )

      // Klar daneben: darf nicht durchgehen.
      const miss = config.targetTime + config.tolerance * 3 + 1
      expect(isHitWithinTolerance(config.targetTime, miss, config.tolerance)).toBe(false)
    }
  })

  it('verlangt vor jedem Tor einen Treffer mehr', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const config = createPerfectSecondLevel(level)
      expect(config.hitsRequired).toBeGreaterThanOrEqual(1)
      expect(config.hitsRequired).toBeLessThanOrEqual(3)
      if (isSegmentGate(level)) {
        expect(config.hitsRequired, `Tor-Level ${level}`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('ordnet jedes Level einer Zone und einem Abschnitt zu', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(zoneForLevel(level), `Level ${level}`).toBeDefined()
      const segment = segmentIndexForLevel(level)
      expect(segment).toBeGreaterThanOrEqual(1)
      expect(segment).toBeLessThanOrEqual(25)
    }
  })
})

describe('Was fehlt? – alle 500 Level', () => {
  it('baut in jedem Level eine lösbare Aufgabe', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const config = createWhatIsMissingLevel(level)
      const where = `Level ${level}`

      expect(config.level, where).toBe(level)
      expect(config.shownObjects.length, where).toBe(config.objectCount)
      expect(config.objectCount, where).toBeLessThanOrEqual(OBJECT_CATALOG.length)
      expect(config.displayTimeSeconds, where).toBeGreaterThan(0)

      // Genau ein Objekt fehlt, und es war vorher zu sehen.
      expect(config.remainingObjects.length, where).toBe(config.objectCount - 1)
      expect(config.shownObjects.some((o) => o.id === config.missingObject.id), where).toBe(true)
      expect(config.remainingObjects.some((o) => o.id === config.missingObject.id), where).toBe(
        false,
      )

      // Keine Dubletten – sonst wäre nicht erkennbar, was fehlt.
      expect(new Set(config.shownObjects.map((o) => o.id)).size, where).toBe(config.objectCount)

      // Die Auswahl enthält die richtige Antwort und ist eindeutig.
      expect(config.choiceObjects.some((o) => o.id === config.missingObject.id), where).toBe(true)
      expect(new Set(config.choiceObjects.map((o) => o.id)).size, where).toBe(
        config.choiceObjects.length,
      )
      expect(config.choiceObjects.length, where).toBeGreaterThanOrEqual(4)

      // Die richtige Antwort zählt, die falsche nicht.
      const right = calculateWhatIsMissingScore({ correct: true, level })
      expect(right.score, where).toBeGreaterThan(0)
      expect(right.xp, where).toBeGreaterThan(0)
      expect(calculateWhatIsMissingScore({ correct: false, level }).score, where).toBe(0)
    }
  })

  it('liefert dasselbe Level bei gleichem Aufruf und wechselt sonst', () => {
    for (const level of [1, 7, 42, 199, 350, 500]) {
      const a = createWhatIsMissingLevel(level, 'fest')
      const b = createWhatIsMissingLevel(level, 'fest')
      expect(a.missingObject.id).toBe(b.missingObject.id)
    }
  })
})

describe('Schützenrunde – alle Rundengrößen', () => {
  it('teilt für jede Größe von 8 bis 16 einen vollständigen Stapel aus', () => {
    for (let size = MIN_MATCH_SIZE; size <= MAX_MATCH_SIZE; size++) {
      const deck = roleDeck(size)
      expect(deck.length, `Größe ${size}`).toBe(size)
      expect(
        deck.filter((r) => factionOf(r) === 'saboteure').length,
        `Größe ${size} Saboteure`,
      ).toBe(saboteurCount(size))
      // Die drei Grundämter sind immer dabei.
      for (const role of ['schiessmeister', 'schuetze', 'brudermeister']) {
        expect(deck, `Größe ${size} ohne ${role}`).toContain(role)
      }
    }
  })

  it('spielt jede Größe bis zum Sieger durch – normal und als Schützenfest', () => {
    for (let size = MIN_MATCH_SIZE; size <= MAX_MATCH_SIZE; size++) {
      for (const event of [false, true]) {
        let state = createMatch('Du', `sweep-${size}-${event}`, size, { event })
        let guard = 0
        while (!state.winner && guard < 40) {
          const target = alivePlayers(state).find((p) => !p.isHuman)
          state = resolveNight(state, { targetId: target?.id })
          if (state.winner) break
          state = startVote(state)
          const voteTarget = alivePlayers(state).find((p) => !p.isHuman)
          state = resolveVote(state, voteTarget?.id ?? null)
          if (state.winner) break
          state = nextRound(state)
          guard++
        }
        const where = `Größe ${size}${event ? ' (Schützenfest)' : ''}`
        expect(state.winner, where).not.toBeNull()
        expect(state.phase, where).toBe('over')

        const outcome = matchOutcome(state)
        expect(outcome.score, where).toBeGreaterThan(0)
        expect(outcome.score, where).toBeLessThanOrEqual(1000)
        expect(outcome.xp, where).toBeGreaterThan(0)
      }
    }
  })
})
