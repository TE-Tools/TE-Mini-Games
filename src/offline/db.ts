/**
 * IndexedDB schema via Dexie.
 * Offline-first storage for guest and local account data.
 */

import Dexie, { type EntityTable } from 'dexie'

export interface LocalProfile {
  id: string
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
  id: string
  userId: string
  gameId: string
  currentLevel: number
  highestLevel: number
  totalXp: number
  updatedAt: string
}

export interface LocalGameResult {
  id: string
  userId: string
  gameId: string
  level: number
  score: number
  xp: number
  resultData: Record<string, unknown>
  isPersonalRecord: boolean
  stars: number
  createdAt: string
  synced: number
}

export interface LocalPersonalRecord {
  id: string
  userId: string
  gameId: string
  level: number
  bestScore: number
  bestMeasurement: number | null
  achievedAt: string
  updatedAt: string
}

export interface LocalAchievement {
  id: string
  userId: string
  achievementId: string
  unlockedAt: string
  synced: number
}

export interface SyncOutboxItem {
  id: string
  type: 'game_result' | 'progress' | 'profile' | 'achievement' | 'personal_record'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  lastError: string | null
}

export interface LocalFamilySession {
  id: string
  gameId: string
  level: number
  playerNames: string[]
  currentPlayerIndex: number
  status: 'setup' | 'playing' | 'finished'
  createdAt: string
  updatedAt: string
}

export interface LocalFamilyResult {
  id: string
  sessionId: string
  playerName: string
  playerIndex: number
  score: number
  resultData: Record<string, unknown>
  createdAt: string
}

export class MiniChallengeDB extends Dexie {
  profiles!: EntityTable<LocalProfile, 'id'>
  gameProgress!: EntityTable<LocalGameProgress, 'id'>
  gameResults!: EntityTable<LocalGameResult, 'id'>
  personalRecords!: EntityTable<LocalPersonalRecord, 'id'>
  achievements!: EntityTable<LocalAchievement, 'id'>
  syncOutbox!: EntityTable<SyncOutboxItem, 'id'>
  familySessions!: EntityTable<LocalFamilySession, 'id'>
  familyResults!: EntityTable<LocalFamilyResult, 'id'>

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
    this.version(2).stores({
      profiles: 'id, updatedAt',
      gameProgress: 'id, userId, gameId, updatedAt',
      gameResults: 'id, userId, gameId, createdAt, synced',
      personalRecords: 'id, userId, gameId, level',
      achievements: 'id, userId, achievementId, synced',
      syncOutbox: 'id, type, createdAt',
      familySessions: 'id, status, createdAt',
      familyResults: 'id, sessionId, playerIndex',
    })
  }
}

export const db = new MiniChallengeDB()

export const GUEST_USER_ID = 'guest'
