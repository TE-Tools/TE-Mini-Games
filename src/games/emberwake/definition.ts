import type { GameDefinition } from '@/games/types'
import { LEVELS, getLevel } from './data/levels'

/** Was ein Level im Rohergebnis meldet. */
export interface EmberwakeRoh {
  won: boolean
  /** 1–3 Sterne des Spiels selbst: Hauptziel, Zusatzziel, Geheimnis. */
  stars: number
  /** Sekunden bis zum Abschluss. */
  time: number
  secondary: boolean
  secret: boolean
  damageTaken: number
}

const GRUND = (level: number): number => 300 + level * 20

/**
 * Die Wertung.
 *
 * Punkte für den Abschluss, deutlich mehr für Zusatzziel und Geheimnis, ein
 * Tempobonus gegen die Zielspielzeit des Levels und ein Zuschlag, wenn der
 * Träger unversehrt zurückkam. Ein Survival-Spiel belohnt nicht das Überleben
 * allein -- das ist die Grundlage -- sondern die Entscheidung, trotzdem noch
 * einmal hinauszugehen.
 */
export const emberwakeGame: GameDefinition = {
  id: 'emberwake',
  name: 'Emberwake',
  description:
    'Trage die letzte Glut durch einen erloschenen Wald. Jeder Schritt vom Lager weg macht dein Lager dunkler.',
  icon: '🔥',
  maxLevel: LEVELS.length,
  createLevel: (level, seed) => {
    void seed
    const l = getLevel(Math.max(1, Math.min(LEVELS.length, level))) ?? LEVELS[0]!
    return {
      level: l.id,
      label: l.name,
      name: l.name,
      subtitle: l.subtitle,
      world: l.worldId,
      difficulty: l.difficulty,
      targetDuration: l.targetDuration,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as Partial<EmberwakeRoh>
    if (!raw.won) return 0
    const ziel = getLevel(level)?.targetDuration ?? 300
    const zeit = Math.max(1, raw.time ?? ziel)
    const tempo = Math.max(0, Math.min(200, Math.round((ziel - zeit) / 2)))
    const unversehrt = (raw.damageTaken ?? 0) <= 0 ? 100 : 0
    return GRUND(level) + (raw.secondary ? 200 : 0) + (raw.secret ? 250 : 0) + tempo + unversehrt
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 15 + level * 2 + Math.floor(score / 120)
  },
  calculateStars: (level, score) => {
    if (score <= 0) return 0
    const grund = GRUND(level)
    if (score >= grund + 600) return 5
    if (score >= grund + 450) return 4
    if (score >= grund + 300) return 3
    if (score >= grund + 150) return 2
    return 1
  },
}
