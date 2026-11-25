export {
  MAX_LEVEL,
  LEVELS_PER_ZONE,
  ZONES,
  zoneForLevel,
  zoneById,
  levelInZone,
  zoneProgress,
  isZoneGate,
  isFinalLevel,
  clampMapLevel,
} from './zones'
export type { LevelZone, ZoneId, ZonePalette } from './zones'

export { totalXpForLevel, levelFromTotalXp, xpProgressInLevel } from './xp'

export { ACHIEVEMENTS, getAchievementDef, evaluateAchievements } from './achievements'
export type { AchievementId, AchievementDef, AchievementContext } from './achievements'

export { applyPlayToStreak, dateKeyFromIso } from './streak'
export type { StreakState } from './streak'

export { processAfterResult } from './afterResult'
export type { AfterResultInput, AfterResultOutput } from './afterResult'

export { todayKey, dailySeed, dailyGameId, getDailyChallenge, DAILY_LEVEL } from './daily'
export type { DailyChallengeConfig } from './daily'

export {
  aufgabenFuerTag,
  fortschritt,
  istErledigt,
  zugEintragen,
  standFuer,
  neuerTag,
  vorschlagFuer,
  AUFGABE_XP,
  ALLE_AUFGABEN_XP,
  AUFGABEN_XP_PRO_TAG_MAX,
  LEVEL_SPIELE,
} from './tagesaufgaben'
export type { Tagesaufgabe, AufgabenArt, Spielzug, Tagesstand, Tageswertung } from './tagesaufgaben'

export {
  leseTagesstand,
  leseGefeiertesLevel,
  schreibeGefeiertesLevel,
} from './tagesaufgabenSpeicher'

export { meldeFeiern, aufFeiern } from './feier'
export type { Feier } from './feier'
