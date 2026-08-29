export { db, GUEST_USER_ID } from './db'
export type {
  LocalProfile,
  LocalGameProgress,
  LocalGameResult,
  LocalPersonalRecord,
  LocalAchievement,
  SyncOutboxItem,
} from './db'

export {
  getOrCreateGuestProfile,
  getProfile,
  addXp,
  updateStreak,
} from './profile'

export {
  getGameProgress,
  getOrCreateGameProgress,
  recordLevelComplete,
  getAllGameProgress,
} from './progress'

export {
  saveGameResult,
  getPersonalRecord,
  getRecentResults,
} from './results'

export {
  enqueueOutbox,
  getPendingOutbox,
  markOutboxSuccess,
  markOutboxFailure,
  outboxCount,
} from './outbox'

export {
  hasAchievement,
  unlockAchievement,
  getUnlockedAchievements,
  unlockMany,
} from './achievements'

export {
  createFamilySession,
  getFamilySession,
  saveFamilyPlayerResult,
  getFamilyResults,
  rankFamilyResults,
  getActiveFamilySessions,
} from './family'
export type { FamilyStanding } from './family'

export {
  getDailyAttempt,
  hasCompletedDaily,
  saveDailyAttempt,
} from './daily'
