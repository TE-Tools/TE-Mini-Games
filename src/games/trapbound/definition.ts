import type { GameDefinition } from '@/games/types'
import { LEVEL_ANZAHL, levelDaten } from './levels'
import { spieleLoesung } from './loesung'

const sollzeiten = new Map<number, number>()

/**
 * Wie lange ein Level dauert, wenn man es kennt: die Zeit der hinterlegten
 * Lösung.
 *
 * Der Tempo-Zuschlag hing bis zum 05.11.2026 an festen dreißig Sekunden.
 * Das passte zu den ersten Leveln, die einen Bildschirm breit sind. Ein
 * Level von zweieinhalb Bildschirmen braucht aber selbst fehlerfrei zwanzig
 * Sekunden, und damit gab es ab Welt 3 keine fünf Sterne mehr -- außer mit
 * Kristall, und Kristalle liegen nur in Welt 1.
 */
function sollzeit(level: number): number {
  const da = sollzeiten.get(level)
  if (da !== undefined) return da
  const r = spieleLoesung(levelDaten(level))
  const zeit = r.geschafft ? Math.max(2, r.zeit) : 15
  sollzeiten.set(level, zeit)
  return zeit
}

/** Der volle Tempo-Zuschlag. */
const TEMPO_MAX = 180

/**
 * Die Wertung.
 *
 * Punkte für den Abschluss, Abzug für jeden Tod, Zuschlag für Tempo und für
 * den Kristall. Ein Fallenspiel belohnt nicht Geschicklichkeit im ersten
 * Versuch -- sterben gehört dazu -- aber wer ein Level kennt, soll es sauber
 * und schnell abliefern können.
 */
export const trapboundGame: GameDefinition = {
  id: 'trapbound',
  name: 'Trapbound',
  description:
    'Kurze Level, freundlicher Anblick, gemeine Fallen. Lauf nach rechts – wenn du dich traust.',
  icon: '🕳️',
  maxLevel: LEVEL_ANZAHL,
  createLevel: (level, seed) => {
    void seed
    const l = levelDaten(Math.max(1, Math.min(LEVEL_ANZAHL, level)))
    return {
      level: l.nr,
      welt: l.welt,
      abschnitt: l.abschnitt,
      name: l.name,
      label: l.name,
      objekte: l.objekte.length,
    }
  },
  calculateScore: (level, rawResult) => {
    const raw = rawResult as { won?: boolean; tode?: number; zeit?: number; kristall?: boolean }
    if (!raw.won) return 0
    const tode = Math.max(0, raw.tode ?? 0)
    const zeit = Math.max(1, raw.zeit ?? 60)
    // Voller Zuschlag bis knapp über der Lösungszeit, danach weniger, und
    // nichts mehr ab dem Zweieinhalbfachen (mindestens zwanzig Sekunden
    // mehr -- ein kurzes Level soll nicht schon nach Sekunden nichts geben).
    const soll = sollzeit(level)
    const voll = soll * 1.3
    const nichts = Math.max(soll * 2.5, soll + 20)
    const flott = Math.round(TEMPO_MAX * Math.min(1, Math.max(0, (nichts - zeit) / (nichts - voll))))
    return 250 + level * 12 + Math.max(0, 200 - tode * 25) + flott + (raw.kristall ? 150 : 0)
  },
  calculateXP: (level, score) => {
    if (score <= 0) return 0
    return 12 + Math.floor(level / 3) + Math.floor(score / 100)
  },
  calculateStars: (level, score) => {
    if (score <= 0) return 0
    const grund = 250 + level * 12
    if (score >= grund + 380) return 5
    if (score >= grund + 280) return 4
    if (score >= grund + 180) return 3
    if (score >= grund + 90) return 2
    return 1
  },
}
