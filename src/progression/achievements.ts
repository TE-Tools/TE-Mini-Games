/**
 * Central achievement definitions and unlock evaluation.
 * Achievements are stored offline and queued for sync.
 *
 * ~50 Abzeichen (30.08.2026, Thomas' Wunsch "ich will mehr Erfolge haben um
 * die 50 Stück"), gruppiert nach Kategorie: Zonentore je Spiel, Perfect-
 * Second-Feintreffer, Schützenrunde (lokal + online), 5-Sterne-Ergebnisse,
 * Rekorde, Streak, Spieler-Level, Gesamtzahl Spiele, Daily Challenge,
 * Familienmodus, Tageszeit/Wochenende und ein Sammler-Abzeichen als Krönung.
 * Neue Tier-Abzeichen brechen bereits freigeschaltete Abzeichen nicht – IDs
 * bestehender Einträge bleiben unverändert.
 */

export type AchievementId =
  | 'perfectionist'
  | 'eagle-eye'
  | 'unstoppable'
  | 'record-hunter'
  | 'allrounder'
  | 'ps-gate-100'
  | 'ps-gate-200'
  | 'ps-gate-300'
  | 'ps-gate-400'
  | 'ps-gate-500'
  | 'wim-gate-100'
  | 'wim-gate-200'
  | 'wim-gate-300'
  | 'wim-gate-400'
  | 'wim-gate-500'
  | 'ps-perfect-5'
  | 'ps-perfect-25'
  | 'ps-perfect-100'
  | 'sr-first-win'
  | 'sr-wins-10'
  | 'sr-wins-25'
  | 'sr-king-first'
  | 'sr-online-first-win'
  | 'sr-online-wins-10'
  | 'five-star-1'
  | 'five-star-10'
  | 'five-star-50'
  | 'record-hunter-25'
  | 'record-hunter-50'
  | 'streak-3'
  | 'streak-7'
  | 'streak-14'
  | 'streak-60'
  | 'player-level-5'
  | 'player-level-10'
  | 'player-level-20'
  | 'player-level-30'
  | 'games-10'
  | 'games-50'
  | 'games-100'
  | 'games-250'
  | 'daily-first'
  | 'daily-7'
  | 'daily-30'
  | 'family-first'
  | 'family-5'
  | 'night-owl'
  | 'early-bird'
  | 'weekend-warrior'
  | 'collector'

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

  // Perfect Second – Zonentore der Levelkarte (1–500)
  {
    id: 'ps-gate-100',
    name: 'Dschungel-Meister',
    description: 'Erreiche Level 100 bei Die perfekte Sekunde.',
    icon: '🌴',
  },
  {
    id: 'ps-gate-200',
    name: 'Vulkan-Bezwinger',
    description: 'Erreiche Level 200 bei Die perfekte Sekunde.',
    icon: '🌋',
  },
  {
    id: 'ps-gate-300',
    name: 'Wüsten-Wanderer',
    description: 'Erreiche Level 300 bei Die perfekte Sekunde.',
    icon: '🏜️',
  },
  {
    id: 'ps-gate-400',
    name: 'Eiszeit-Pionier',
    description: 'Erreiche Level 400 bei Die perfekte Sekunde.',
    icon: '❄️',
  },
  {
    id: 'ps-gate-500',
    name: 'Gletscherkönig',
    description: 'Erreiche Level 500 (Eispalast) bei Die perfekte Sekunde.',
    icon: '🏔️',
  },

  // Was fehlt? – Zonentore der Levelkarte (1–500)
  {
    id: 'wim-gate-100',
    name: 'Scharfer Blick',
    description: 'Erreiche Level 100 bei Was fehlt?',
    icon: '👀',
  },
  {
    id: 'wim-gate-200',
    name: 'Gedächtniskünstler',
    description: 'Erreiche Level 200 bei Was fehlt?',
    icon: '🧠',
  },
  {
    id: 'wim-gate-300',
    name: 'Merkmeister',
    description: 'Erreiche Level 300 bei Was fehlt?',
    icon: '📸',
  },
  {
    id: 'wim-gate-400',
    name: 'Eisgedächtnis',
    description: 'Erreiche Level 400 bei Was fehlt?',
    icon: '🥶',
  },
  {
    id: 'wim-gate-500',
    name: 'Gipfel-Genie',
    description: 'Erreiche Level 500 (Eispalast) bei Was fehlt?',
    icon: '🧊',
  },

  // Perfect Second – haargenaue Treffer insgesamt
  {
    id: 'ps-perfect-5',
    name: 'Feines Gespür',
    description: '5 haargenaue Treffer insgesamt bei Die perfekte Sekunde.',
    icon: '✨',
  },
  {
    id: 'ps-perfect-25',
    name: 'Zielwasser',
    description: '25 haargenaue Treffer insgesamt.',
    icon: '💧',
  },
  {
    id: 'ps-perfect-100',
    name: 'Chronometer',
    description: '100 haargenaue Treffer insgesamt.',
    icon: '⏱️',
  },

  // Schützenrunde – lokal, online, Königswürde
  {
    id: 'sr-first-win',
    name: 'Erster Sieg',
    description: 'Gewinne deine erste Schützenrunde.',
    icon: '🥇',
  },
  {
    id: 'sr-wins-10',
    name: 'Erfahrener Schütze',
    description: 'Gewinne 10 Schützenrunden.',
    icon: '🎖️',
  },
  {
    id: 'sr-wins-25',
    name: 'Veteran der Bruderschaft',
    description: 'Gewinne 25 Schützenrunden.',
    icon: '🏅',
  },
  {
    id: 'sr-king-first',
    name: 'Königswürde',
    description: 'Trage zum ersten Mal die Königswürde.',
    icon: '👑',
  },
  {
    id: 'sr-online-first-win',
    name: 'Online-Debütsieg',
    description: 'Gewinne deine erste Online-Schützenrunde.',
    icon: '🌐',
  },
  {
    id: 'sr-online-wins-10',
    name: 'Online-Anführer',
    description: 'Gewinne 10 Online-Schützenrunden.',
    icon: '🌍',
  },

  // 5-Sterne-Ergebnisse, spielübergreifend
  {
    id: 'five-star-1',
    name: 'Erste fünf Sterne',
    description: 'Erziele 5 Sterne in einem Ergebnis.',
    icon: '⭐',
  },
  {
    id: 'five-star-10',
    name: 'Sternensammler',
    description: '10 Ergebnisse mit 5 Sternen.',
    icon: '🌟',
  },
  {
    id: 'five-star-50',
    name: 'Sternenhimmel',
    description: '50 Ergebnisse mit 5 Sternen.',
    icon: '💫',
  },

  // Rekordjäger – weitere Stufen
  {
    id: 'record-hunter-25',
    name: 'Rekordsammler',
    description: 'Verbessere 25 persönliche Rekorde.',
    icon: '🏆',
  },
  {
    id: 'record-hunter-50',
    name: 'Rekordlegende',
    description: 'Verbessere 50 persönliche Rekorde.',
    icon: '🥇',
  },

  // Streak – weitere Stufen
  {
    id: 'streak-3',
    name: 'Guter Anfang',
    description: '3 Tage Streak.',
    icon: '🔥',
  },
  {
    id: 'streak-7',
    name: 'Eine Woche dabei',
    description: '7 Tage Streak.',
    icon: '🔥',
  },
  {
    id: 'streak-14',
    name: 'Zwei Wochen dabei',
    description: '14 Tage Streak.',
    icon: '🔥',
  },
  {
    id: 'streak-60',
    name: 'Zwei Monate dabei',
    description: '60 Tage Streak.',
    icon: '🔥',
  },

  // Spieler-Level (aus der Gesamt-XP)
  {
    id: 'player-level-5',
    name: 'Aufsteiger',
    description: 'Erreiche Spieler-Level 5.',
    icon: '📈',
  },
  {
    id: 'player-level-10',
    name: 'Erfahren',
    description: 'Erreiche Spieler-Level 10.',
    icon: '📊',
  },
  {
    id: 'player-level-20',
    name: 'Profi',
    description: 'Erreiche Spieler-Level 20.',
    icon: '🎓',
  },
  {
    id: 'player-level-30',
    name: 'Meister',
    description: 'Erreiche Spieler-Level 30.',
    icon: '👑',
  },

  // Gesamtzahl gespielter Runden, spielübergreifend
  {
    id: 'games-10',
    name: 'Reingeschnuppert',
    description: '10 Spiele insgesamt gespielt.',
    icon: '🎮',
  },
  {
    id: 'games-50',
    name: 'Dabeigeblieben',
    description: '50 Spiele insgesamt gespielt.',
    icon: '🕹️',
  },
  {
    id: 'games-100',
    name: 'Stammspieler',
    description: '100 Spiele insgesamt gespielt.',
    icon: '🎯',
  },
  {
    id: 'games-250',
    name: 'Unermüdlich',
    description: '250 Spiele insgesamt gespielt.',
    icon: '🚀',
  },

  // Daily Challenge
  {
    id: 'daily-first',
    name: 'Erste Challenge',
    description: 'Löse deine erste Daily Challenge.',
    icon: '📅',
  },
  {
    id: 'daily-7',
    name: 'Wochenroutine',
    description: '7 Daily Challenges gelöst.',
    icon: '🗓️',
  },
  {
    id: 'daily-30',
    name: 'Challenge-Profi',
    description: '30 Daily Challenges gelöst.',
    icon: '📆',
  },

  // Familienmodus
  {
    id: 'family-first',
    name: 'Familienrunde',
    description: 'Spiele deine erste Familienrunde zu Ende.',
    icon: '👨‍👩‍👧‍👦',
  },
  {
    id: 'family-5',
    name: 'Spieleabend-Serie',
    description: 'Beende 5 Familienrunden.',
    icon: '🎲',
  },

  // Tageszeit / Wochenende
  {
    id: 'night-owl',
    name: 'Nachteule',
    description: 'Spiele nach 22 Uhr.',
    icon: '🦉',
  },
  {
    id: 'early-bird',
    name: 'Frühaufsteher',
    description: 'Spiele vor 7 Uhr.',
    icon: '🐦',
  },
  {
    id: 'weekend-warrior',
    name: 'Wochenend-Krieger',
    description: 'Spiele am Wochenende.',
    icon: '🏖️',
  },

  // Sammler-Krönung
  {
    id: 'collector',
    name: 'Sammler',
    description: 'Schalte 40 andere Abzeichen frei.',
    icon: '🗝️',
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
  /** Highest level reached in perfect-second */
  perfectSecondHighestLevel?: number
  /** Number of personal records ever improved (running total) */
  personalRecordImprovements?: number
  /** Set of game ids the user has played at least once */
  gamesPlayed?: Set<string>
  /** Total haargenaue Treffer across all Perfect-Second results (running total) */
  perfectHitsTotal?: number
  /** Local (offline) Schützenrunde wins (running total) */
  schuetzenrundeWins?: number
  /** Schützenrunde rounds won while wearing the Königswürde, local + online (running total) */
  schuetzenrundeKingWins?: number
  /** Online Schützenrunde wins (running total) */
  schuetzenrundeOnlineWins?: number
  /** Results with the maximum star rating, across all games (running total) */
  fiveStarCount?: number
  /** Current player level, derived from total XP */
  playerLevel?: number
  /** Total number of saved game results, across all games (running total) */
  totalGamesPlayed?: number
  /** Number of completed Daily Challenge attempts (device-wide, not per user) */
  dailyAttemptsCount?: number
  /** Number of finished Family-mode sessions (device-wide, not per user) */
  familySessionsFinished?: number
  /** Local hour (0–23) the result was recorded at */
  playedAtHour?: number
  /** True if the result was recorded on a Saturday or Sunday */
  playedAtIsWeekend?: boolean
  /** Number of achievements already unlocked before this evaluation */
  unlockedCount?: number
}

/** Unlock every id whose threshold `value` already reaches or passes. */
function addTiers(
  unlocked: AchievementId[],
  value: number | undefined,
  tiers: readonly (readonly [number, AchievementId])[],
): void {
  if (typeof value !== 'number') return
  for (const [threshold, id] of tiers) {
    if (value >= threshold) unlocked.push(id)
  }
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

  addTiers(unlocked, ctx.streakDays, [
    [3, 'streak-3'],
    [7, 'streak-7'],
    [14, 'streak-14'],
    [30, 'unstoppable'],
    [60, 'streak-60'],
  ])

  addTiers(unlocked, ctx.personalRecordImprovements, [
    [10, 'record-hunter'],
    [25, 'record-hunter-25'],
    [50, 'record-hunter-50'],
  ])

  // Drei Spiele stehen zur Wahl (Perfect Second, Was fehlt?, Schützenrunde) –
  // "alle verfügbaren Spiele" heißt seit deren Aufnahme wirklich alle drei.
  if (ctx.gamesPlayed && ctx.gamesPlayed.size >= 3) {
    unlocked.push('allrounder')
  }

  addTiers(unlocked, ctx.perfectSecondHighestLevel, [
    [100, 'ps-gate-100'],
    [200, 'ps-gate-200'],
    [300, 'ps-gate-300'],
    [400, 'ps-gate-400'],
    [500, 'ps-gate-500'],
  ])

  addTiers(unlocked, ctx.whatIsMissingHighestLevel, [
    [100, 'wim-gate-100'],
    [200, 'wim-gate-200'],
    [300, 'wim-gate-300'],
    [400, 'wim-gate-400'],
    [500, 'wim-gate-500'],
  ])

  addTiers(unlocked, ctx.perfectHitsTotal, [
    [5, 'ps-perfect-5'],
    [25, 'ps-perfect-25'],
    [100, 'ps-perfect-100'],
  ])

  addTiers(unlocked, ctx.schuetzenrundeWins, [
    [1, 'sr-first-win'],
    [10, 'sr-wins-10'],
    [25, 'sr-wins-25'],
  ])

  if (typeof ctx.schuetzenrundeKingWins === 'number' && ctx.schuetzenrundeKingWins >= 1) {
    unlocked.push('sr-king-first')
  }

  addTiers(unlocked, ctx.schuetzenrundeOnlineWins, [
    [1, 'sr-online-first-win'],
    [10, 'sr-online-wins-10'],
  ])

  addTiers(unlocked, ctx.fiveStarCount, [
    [1, 'five-star-1'],
    [10, 'five-star-10'],
    [50, 'five-star-50'],
  ])

  addTiers(unlocked, ctx.playerLevel, [
    [5, 'player-level-5'],
    [10, 'player-level-10'],
    [20, 'player-level-20'],
    [30, 'player-level-30'],
  ])

  addTiers(unlocked, ctx.totalGamesPlayed, [
    [10, 'games-10'],
    [50, 'games-50'],
    [100, 'games-100'],
    [250, 'games-250'],
  ])

  addTiers(unlocked, ctx.dailyAttemptsCount, [
    [1, 'daily-first'],
    [7, 'daily-7'],
    [30, 'daily-30'],
  ])

  addTiers(unlocked, ctx.familySessionsFinished, [
    [1, 'family-first'],
    [5, 'family-5'],
  ])

  if (typeof ctx.playedAtHour === 'number' && ctx.playedAtHour >= 22) {
    unlocked.push('night-owl')
  }
  if (typeof ctx.playedAtHour === 'number' && ctx.playedAtHour < 7) {
    unlocked.push('early-bird')
  }
  if (ctx.playedAtIsWeekend) {
    unlocked.push('weekend-warrior')
  }

  // Krönung: wer fast alles hat, bekommt noch eines obendrauf. `unlockedCount`
  // zählt, was vor diesem Aufruf schon frei war; `unlocked.length` zählt, was
  // gerade neu dazukommt – zusammen die Summe nach diesem Ergebnis.
  if (
    typeof ctx.unlockedCount === 'number' &&
    ctx.unlockedCount + unlocked.length >= 40 &&
    !unlocked.includes('collector')
  ) {
    unlocked.push('collector')
  }

  return unlocked
}
