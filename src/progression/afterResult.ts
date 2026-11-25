/**
 * Run after every game result: update streak, evaluate achievements,
 * count the daily missions (Tagesaufgaben) and announce celebrations.
 *
 * Die Feiern (Aufstieg, Abzeichen, Tagesaufgabe) werden hier gemeldet und
 * nicht in den Spielseiten: So feiert jedes Spiel mit, das hierher meldet,
 * und die Anzeige steht einmal in der App-Hülle (docs/design/bindung/).
 */

import { applyPlayToStreak } from './streak'
import { evaluateAchievements, type AchievementId } from './achievements'
import { unlockMany, getUnlockedAchievements } from '@/offline/achievements'
import { getProfile, updateStreak, addXp, GUEST_USER_ID } from '@/offline'
import { db, type LocalGameResult } from '@/offline/db'
import { todayKey } from './daily'
import { levelFromTotalXp } from './xp'
import {
  zugEintragen,
  LEVEL_SPIELE,
  AUFGABE_XP,
  ALLE_AUFGABEN_XP,
  type Spielzug,
  type Tagesaufgabe,
} from './tagesaufgaben'
import {
  leseTagesstand,
  schreibeTagesstand,
  leseGefeiertesLevel,
  schreibeGefeiertesLevel,
  aufstiegPruefen,
} from './tagesaufgabenSpeicher'
import { meldeFeiern, type Feier } from './feier'
import {
  countPersonalRecordImprovements,
  getGamesPlayed,
  getHighestLevel,
  countPerfectHits,
  countFiveStarResults,
  countSchuetzenrundeWins,
  countSchuetzenrundeKingWins,
  countSchuetzenrundeOnlineWins,
  countTotalGamesPlayed,
  countDailyAttempts,
  countFinishedFamilySessions,
} from './stats'

export interface AfterResultInput {
  gameId: string
  level: number
  deviation?: number
  isPersonalRecord?: boolean
  userId?: string
}

export interface AfterResultOutput {
  streakDays: number
  newlyUnlocked: AchievementId[]
  /** Tagesaufgaben, die mit dieser Runde fertig wurden. */
  aufgabenErledigt: Tagesaufgabe[]
  /** XP, die dafür gebucht wurden (Aufgaben plus Bonus für alle drei). */
  aufgabenXp: number
  /** Alles, was gefeiert wird -- dieselbe Liste ging an `meldeFeiern`. */
  feiern: Feier[]
}

/**
 * Wie alt ein gespeichertes Ergebnis höchstens sein darf, um als „diese
 * Runde" zu gelten. Daily und Familienrunde speichern keins; ohne die
 * Grenze bekämen sie die Sterne einer längst vergangenen Runde.
 */
const ERGEBNIS_FRISCH_MS = 5 * 60 * 1000

/**
 * Sterne und „neues Level" der gerade gemeldeten Runde, aus dem Ergebnis,
 * das die Spielseite kurz vorher gespeichert hat. Neu ist ein Level, wenn
 * es mit mindestens einem Stern geschafft ist und es in diesem Spiel kein
 * früheres geschafftes Ergebnis auf diesem oder einem höheren Level gibt.
 *
 * `null` heißt: Diese Runde zählt für keine Tagesaufgabe. Das gilt für jede
 * Runde mit Hilfe (Belohnungsvideo, zweite Chance, Hinweise): Werbung kauft
 * Hilfe, nie Punkte -- und auch keine XP über den Umweg einer Aufgabe
 * (src/games/hilfe.ts, src/services/werbung.ts).
 */
async function spielzugAus(
  input: AfterResultInput,
  userId: string,
  now: Date,
): Promise<Spielzug | null> {
  const zug: Spielzug = { gameId: input.gameId, level: input.level, sterne: 0, neuesLevel: false }
  const ergebnisse = await db.gameResults
    .where('userId')
    .equals(userId)
    .and((r) => r.gameId === input.gameId)
    .toArray()
  if (ergebnisse.length === 0) return zug
  ergebnisse.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const letztes = ergebnisse[ergebnisse.length - 1]!
  const alter = now.getTime() - new Date(letztes.createdAt).getTime()
  if (alter > ERGEBNIS_FRISCH_MS || letztes.level !== input.level) return zug
  if (mitHilfe(letztes)) return null

  // Geschafft heißt: Sterne UND XP. Sterne allein reichen nicht -- eine
  // gescheiterte Runde Kopfrechnen oder Reihenfolge hat oft schon welche.
  const geschafft = letztes.stars > 0 && letztes.xp > 0
  const levelSpiel = (LEVEL_SPIELE as readonly string[]).includes(input.gameId)
  const frueherGeschafft = ergebnisse.some(
    (r) => r.id !== letztes.id && r.stars > 0 && r.xp > 0 && r.level >= input.level,
  )
  return {
    ...zug,
    sterne: geschafft ? letztes.stars : 0,
    neuesLevel: levelSpiel && geschafft && !frueherGeschafft,
  }
}

/**
 * Hatte die Runde Hilfe? Die Spiele merken es verschieden an
 * (`mitWerbehilfe` aus saveGameResult, `zweiteChance`, `mitHilfe`); die
 * Wertung mit Hilfe hat außerdem eine feste Form: 0 Punkte, 0 XP, aber
 * ein Stern (src/games/hilfe.ts) -- eine gescheiterte Runde hat keinen.
 */
function mitHilfe(r: LocalGameResult): boolean {
  const d = r.resultData
  return (
    d['mitWerbehilfe'] === true ||
    d['zweiteChance'] === true ||
    d['mitHilfe'] === true ||
    (r.score === 0 && r.xp === 0 && r.stars > 0)
  )
}

export async function processAfterResult(input: AfterResultInput): Promise<AfterResultOutput> {
  const userId = input.userId ?? GUEST_USER_ID
  const profile = await getProfile(userId)

  const streakState = applyPlayToStreak({
    streakDays: profile?.streakDays ?? 0,
    // Nicht lastPlayedAt: Das hat addXp kurz vorher schon auf heute gesetzt.
    lastPlayedDate: profile?.streakDate ?? null,
  })
  await updateStreak(userId, streakState.streakDays, streakState.lastPlayedDate)

  const now = new Date()

  const [
    recordCount,
    gamesPlayed,
    wimHighest,
    psHighest,
    perfectHitsTotal,
    fiveStarCount,
    schuetzenrundeWins,
    schuetzenrundeKingWins,
    schuetzenrundeOnlineWins,
    totalGamesPlayed,
    dailyAttemptsCount,
    familySessionsFinished,
    unlockedBefore,
  ] = await Promise.all([
    countPersonalRecordImprovements(userId),
    getGamesPlayed(userId),
    getHighestLevel('what-is-missing', userId),
    getHighestLevel('perfect-second', userId),
    countPerfectHits(userId),
    countFiveStarResults(userId),
    countSchuetzenrundeWins(userId),
    countSchuetzenrundeKingWins(userId),
    countSchuetzenrundeOnlineWins(userId),
    countTotalGamesPlayed(userId),
    countDailyAttempts(),
    countFinishedFamilySessions(),
    getUnlockedAchievements(userId),
  ])

  const candidates = evaluateAchievements({
    gameId: input.gameId,
    level: input.level,
    deviation: input.deviation,
    isPersonalRecord: input.isPersonalRecord,
    streakDays: streakState.streakDays,
    whatIsMissingHighestLevel: wimHighest,
    perfectSecondHighestLevel: psHighest,
    personalRecordImprovements: recordCount,
    gamesPlayed,
    perfectHitsTotal,
    fiveStarCount,
    schuetzenrundeWins,
    schuetzenrundeKingWins,
    schuetzenrundeOnlineWins,
    playerLevel: profile?.playerLevel,
    totalGamesPlayed,
    dailyAttemptsCount,
    familySessionsFinished,
    playedAtHour: now.getHours(),
    playedAtIsWeekend: now.getDay() === 0 || now.getDay() === 6,
    unlockedCount: unlockedBefore.length,
  })

  const newlyUnlocked = await unlockMany(candidates, userId)

  // Tagesaufgaben: die Runde eintragen, Neues genau einmal belohnen.
  // Eine Runde mit Hilfe zählt nicht mit (siehe spielzugAus).
  const zug = await spielzugAus(input, userId, now)
  const wertung = zug
    ? zugEintragen(leseTagesstand(userId), zug, todayKey(now))
    : { neuErledigt: [], alleNeu: false, xp: 0, stand: null }
  if (wertung.stand) schreibeTagesstand(userId, wertung.stand)
  const nachher = wertung.xp > 0 ? await addXp(userId, wertung.xp) : await getProfile(userId)

  // Aufstieg: gegen das zuletzt gefeierte Level, nicht gegen das Profil von
  // vorhin -- die Spielseite hat ihre XP schon vor diesem Aufruf gebucht.
  const levelJetzt = levelFromTotalXp(nachher?.totalXp ?? 0)
  const aufstieg = aufstiegPruefen(leseGefeiertesLevel(userId), levelJetzt)
  schreibeGefeiertesLevel(userId, aufstieg.merken)

  const feiern: Feier[] = [
    ...newlyUnlocked.map((id): Feier => ({ art: 'abzeichen', id })),
    ...wertung.neuErledigt.map((aufgabe): Feier => ({ art: 'aufgabe', aufgabe, xp: AUFGABE_XP })),
    ...(wertung.alleNeu ? [{ art: 'alleAufgaben', xp: ALLE_AUFGABEN_XP } as const] : []),
    ...(aufstieg.feiern !== null ? [{ art: 'aufstieg', level: aufstieg.feiern } as const] : []),
  ]
  meldeFeiern(feiern)

  return {
    streakDays: streakState.streakDays,
    newlyUnlocked,
    aufgabenErledigt: wertung.neuErledigt,
    aufgabenXp: wertung.xp,
    feiern,
  }
}
