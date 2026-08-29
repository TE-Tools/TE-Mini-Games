/**
 * IndexedDB schema via Dexie.
 * Offline-first storage for guest and local account data.
 */

import Dexie, { type EntityTable } from 'dexie'

export interface LocalProfile {
  id: string // 'guest' or supabase user id
  displayName: string
  avatar: string | null
  totalXp: number
  playerLevel: number
  streakDays: number
  lastPlayedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LocalGameProgress {
  id: string // `${userId}:${gameId}`
  userId: string
  gameId: string
  currentLevel: number
  highestLevel: number
  totalXp: number
  updatedAt: string
}

export interface LocalGameResult {
  id: string // uuid
  userId: string
  gameId: string
  level: number
  score: number
  xp: number
  resultData: Record<string, unknown>
  isPersonalRecord: boolean
  stars: number
  createdAt: string
  synced: number // 0 | 1 – IndexedDB index friendly
}

export interface LocalPersonalRecord {
  id: string // `${userId}:${gameId}:${level}`
  userId: string
  gameId: string
  level: number
  bestScore: number
  bestMeasurement: number | null
  achievedAt: string
  updatedAt: string
}

export interface LocalAchievement {
  id: string // `${userId}:${achievementId}`
  userId: string
  achievementId: string
  unlockedAt: string
  synced: number
}

/** Outbox for offline → online sync */
export interface SyncOutboxItem {
  id: string // uuid
  type: 'game_result' | 'progress' | 'profile' | 'achievement' | 'personal_record'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError: string | null
}

export class MiniChallengeDB extends Dexie {
  profiles!: EntityTable<LocalProfile, 'id'>
  gameProgress!: EntityTable<LocalGameProgress, 'id'>
  gameResults!: EntityTable<LocalGameResult, 'id'>
  personalRecords!: EntityTable<LocalPersonalRecord, 'id'>
  achievements!: EntityTable<LocalAchievement, 'id'>
  syncOutbox!: EntityTable<SyncOutboxItem, 'id'>

  constructor() {
    super('mini-challenge')
    this.version(1).stores({
      profiles: 'id, updatedAt',
      gameProgress: 'id, userId, gameId, updatedAt',
      gameResults: 'id, userId, gameId, createdAt, synced',
      personalRecords: 'id, userId, gameId, level',
      achievements: 'id, userId, achievementId, synced',
      syncOutbox: 'id, type, createdAt',
    })
  }
}

export const db = new MiniChallengeDB()

export const GUEST_USER_ID = 'guest'
