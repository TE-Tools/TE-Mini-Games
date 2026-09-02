/**
 * Scoring (Spec-aligned):
 * - Group (non-imposters) correctly identifies an imposter: +2 each
 * - Group majority wrong / imposters survive vote: imposters +2 each
 * - Last chance: if accused imposter guesses the secret word → imposters +3 (or +2 extra)
 * Simplified for MVP:
 *   - Correct accusation (at least one real imposter voted out by majority): villagers +2
 *   - Wrong accusation: imposters +2
 *   - Last chance success: that imposter +3 (and other imposters +1)
 *   - Last chance fail after correct accusation: villagers +1 bonus
 */

import type { ImposterPlayer } from './types'

export const POINTS = {
  villagerCorrect: 2,
  villagerBonusAfterFailedLastChance: 1,
  imposterSurvived: 2,
  imposterLastChanceSuccess: 3,
  imposterAllyOnLastChance: 1,
} as const

export function applyRoundScores(args: {
  players: ImposterPlayer[]
  correctAccusation: boolean
  lastChanceSuccess: boolean | null
}): ImposterPlayer[] {
  const { players, correctAccusation, lastChanceSuccess } = args

  return players.map((p) => {
    let pts = 0
    if (p.isImposter) {
      if (!correctAccusation) {
        pts += POINTS.imposterSurvived
      } else if (lastChanceSuccess === true) {
        // The one who guessed gets full points; allies a bit
        if (p.lastChanceGuess && p.lastChanceGuess.length > 0) {
          pts += POINTS.imposterLastChanceSuccess
        } else {
          pts += POINTS.imposterAllyOnLastChance
        }
      }
      // correct accusation + failed last chance → 0 for imposters
    } else {
      if (correctAccusation) {
        pts += POINTS.villagerCorrect
        if (lastChanceSuccess === false) {
          pts += POINTS.villagerBonusAfterFailedLastChance
        }
      }
    }
    return {
      ...p,
      roundPoints: pts,
      totalPoints: p.totalPoints + pts,
    }
  })
}

export function rankPlayers(players: ImposterPlayer[]): ImposterPlayer[] {
  return [...players].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, 'de'))
}
