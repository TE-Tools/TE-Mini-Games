// Nicht über '@/games/emberwake': Das zöge App und Three.js mit hinein.
import { emberwakeGame, type EmberwakeRoh } from '@/games/emberwake/definition'
import type { LevelOutcome } from '@/games/emberwake/App'
import { wertungMitWerbehilfe } from '@/games/werbehilfe'
import { saveGameResult, addXp, recordLevelComplete } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'

/**
 * Ein abgeschlossenes Emberwake-Level in der App buchen: Ergebnis, XP,
 * Fortschritt. Wurde im Anlauf per Werbevideo wiederbelebt, gilt
 * `wertungMitWerbehilfe` -- keine Punkte, keine XP, höchstens ein Stern,
 * kein Rekord. Das nächste Level wird trotzdem frei.
 */
export async function bucheEmberwake(o: LevelOutcome): Promise<{ score: number; xp: number }> {
  const roh: EmberwakeRoh = {
    won: true,
    stars: o.stars,
    time: o.timeSeconds,
    secondary: o.secondary,
    secret: o.secret,
    damageTaken: o.damageTaken,
  }
  const punkte = emberwakeGame.calculateScore(o.levelId, roh)
  const xp = emberwakeGame.calculateXP(o.levelId, punkte)
  const sterne = emberwakeGame.calculateStars?.(o.levelId, punkte) ?? 0
  const wertung = o.mitWerbehilfe
    ? wertungMitWerbehilfe({ score: punkte, xp, stars: sterne })
    : { score: punkte, xp, stars: sterne }
  try {
    await saveGameResult({
      gameId: 'emberwake',
      level: o.levelId,
      score: wertung.score,
      xp: wertung.xp,
      stars: wertung.stars,
      resultData: { ...roh },
      mitWerbehilfe: o.mitWerbehilfe,
    })
    await addXp('guest', wertung.xp)
    await recordLevelComplete('emberwake', o.levelId, wertung.xp)
    await processAfterResult({ gameId: 'emberwake', level: o.levelId })
    void trySyncNow()
  } catch (e) {
    console.error(e)
  }
  return { score: wertung.score, xp: wertung.xp }
}
