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
  setAvatar,
  setDisplayName,
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

export { enqueueOutbox, listOutbox, removeOutboxItem } from './outbox'
export { getUnlockedAchievements, unlockMany } from './achievements'
export * from './family'
export * from './daily'
