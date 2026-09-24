/**
 * Nachreichen, was der alte Punktedeckel verschluckt hat.
 *
 * ANLASS (24.09.2026, Thomas): "die XP unter Ranglisten ändern sich nicht."
 *
 * Bis Migration 020 nahm die Datenbank nur Ergebnisse bis 1000 Punkte an.
 * Trapbound zählt ab Level 63 darüber, Emberwake ab Level 36, Schützenopoly
 * immer. Solche Ergebnisse wurden abgewiesen und nach fünf Versuchen aus der
 * Warteschlange geworfen (`isPermanentFailure` in sync.ts) -- mitsamt ihrer
 * XP, die deshalb nie in der Rangliste ankam.
 *
 * Verloren sind sie trotzdem nicht: Auf dem Gerät liegt jede Runde weiter in
 * `gameResults`. Diese Datei stellt genau die wieder in die Warteschlange,
 * die der alte Deckel betraf -- alles über 1000 Punkte. Der Server nimmt sie
 * per Upsert auf die Ergebnis-ID an; was schon da ist, bleibt wie es ist, es
 * zählt also nichts doppelt.
 *
 * Es passiert einmal je Gerät. Der Vermerk steht im Browserspeicher und
 * nicht in der Datenbank: Er gehört zu diesem einen Gerät, dessen
 * Warteschlange damals geleert wurde.
 */

import { db, GUEST_USER_ID } from '@/offline/db'
import { enqueueOutbox } from '@/offline/outbox'

/** Die alte Grenze. Alles darüber hat der Server nie zu sehen bekommen. */
export const ALTER_PUNKTEDECKEL = 1000

const VERMERK = 'te-mini:nachtrag-punktedeckel'

export interface NachtragErgebnis {
  /** Wie viele Runden wieder in die Warteschlange gegangen sind. */
  ergebnisse: number
  /** Wie viele Bestwerte. */
  bestwerte: number
}

function schonGelaufen(): boolean {
  try {
    return window.localStorage.getItem(VERMERK) === 'ja'
  } catch {
    // Privater Modus oder gesperrter Speicher: Dann eben bei jedem Abgleich.
    // Doppelt hochladen schadet nicht, der Server nimmt es nur einmal.
    return false
  }
}

function merkeGelaufen(): void {
  try {
    window.localStorage.setItem(VERMERK, 'ja')
  } catch {
    /* siehe oben */
  }
}

/**
 * Alles über dem alten Deckel noch einmal in die Warteschlange stellen.
 *
 * Gibt zurück, wie viel nachgereicht wurde -- damit die Oberfläche es sagen
 * kann, statt nur stumm zu synchronisieren.
 */
export async function holeVerloreneErgebnisseNach(
  userId: string = GUEST_USER_ID,
  nochmal = false,
): Promise<NachtragErgebnis> {
  if (!nochmal && schonGelaufen()) return { ergebnisse: 0, bestwerte: 0 }

  const ergebnisse = (await db.gameResults.where('userId').equals(userId).toArray()).filter(
    (r) => r.score > ALTER_PUNKTEDECKEL,
  )
  for (const r of ergebnisse) {
    await enqueueOutbox('game_result', {
      id: r.id,
      userId: r.userId,
      gameId: r.gameId,
      level: r.level,
      score: r.score,
      xp: r.xp,
      resultData: r.resultData,
      isPersonalRecord: r.isPersonalRecord,
      stars: r.stars,
      createdAt: r.createdAt,
    })
  }

  const bestwerte = (await db.personalRecords.where('userId').equals(userId).toArray()).filter(
    (r) => r.bestScore > ALTER_PUNKTEDECKEL,
  )
  for (const r of bestwerte) {
    await enqueueOutbox('personal_record', {
      gameId: r.gameId,
      level: r.level,
      bestScore: r.bestScore,
      bestMeasurement: r.bestMeasurement,
      achievedAt: r.achievedAt,
    })
  }

  merkeGelaufen()
  return { ergebnisse: ergebnisse.length, bestwerte: bestwerte.length }
}
