/**
 * Central achievement definitions and unlock evaluation.
 * Achievements are stored offline and queued for sync.
 */

export type AchievementId =
  | 'perfectionist'
  | 'eagle-eye'
  | 'unstoppable'
  | 'record-hunter'
  | 'allrounder'

export interface AchievementDef {
  id: AchievementId
  name: string
  description: string
  icon: string
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'perfectionist',
    name: 'Perfektionist',
    description: 'Triff eine Zeit mit maximal 0,01 s Abweichung.',
    icon: '🎯',
  },
  {
    id: 'eagle-eye',
    name: 'Adlerauge',
    description: 'Erreiche Level 50 bei Was fehlt?',
    icon: '👁️',
  },
  {
    id: 'unstoppable',
    name: 'Unaufhaltsam',
    description: '30 Tage Streak.',
    icon: '🔥',
  },
  {
    id: 'record-hunter',
    name: 'Rekordjäger',
    description: 'Verbessere 10 persönliche Rekorde.',
    icon: '🏆',
  },
  {
    id: 'allrounder',
    name: 'Allround-Talent',
    description: 'Spiele alle verfügbaren Spiele.',
    icon: '🌟',
  },
] as const

export function getAchievementDef(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

/** Context passed when evaluating unlocks after a game result or session event */
export interface AchievementContext {
  gameId?: string
  level?: number
  /** Perfect Second: absolute deviation in seconds */
  deviation?: number
  isPersonalRecord?: boolean
  /** Current streak days after update */
  streakDays?: number
  /** Highest level reached in what-is-missing */
  whatIsMissingHighestLevel?: number
  /** Number of personal records ever improved (running total) */
  personalRecordImprovements?: number
  /** Set of game ids the user has played at least once */
  gamesPlayed?: Set<string>
}

export function evaluateAchievements(ctx: AchievementContext): AchievementId[] {
  const unlocked: AchievementId[] = []

  if (
    ctx.gameId === 'perfect-second' &&
    typeof ctx.deviation === 'number' &&
    ctx.deviation <= 0.01
  ) {
    unlocked.push('perfectionist')
  }

  if (
    typeof ctx.whatIsMissingHighestLevel === 'number' &&
    ctx.whatIsMissingHighestLevel >= 50
  ) {
    unlocked.push('eagle-eye')
  }

  if (typeof ctx.streakDays === 'number' && ctx.streakDays >= 30) {
    unlocked.push('unstoppable')
  }

  if (
    typeof ctx.personalRecordImprovements === 'number' &&
    ctx.personalRecordImprovements >= 10
  ) {
    unlocked.push('record-hunter')
  }

  if (ctx.gamesPlayed && ctx.gamesPlayed.size >= 2) {
    unlocked.push('allrounder')
  }

  return unlocked
}
