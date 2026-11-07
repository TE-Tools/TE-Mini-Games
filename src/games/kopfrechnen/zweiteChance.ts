/**
 * Kopfrechnen -- die zweite Chance per Belohnungsvideo.
 *
 * Gescheitert ist man hier erst am Ende der Runde, und die richtigen
 * Lösungen hat man da schon gesehen. Die falschen Aufgaben einfach noch
 * einmal zu stellen, wäre geschenkt. Die zweite Chance heißt deshalb
 * **Nachholen**: Die richtigen Antworten bleiben stehen, für jede falsche
 * oder nicht mehr geschaffte kommt eine neue Aufgabe derselben Stufe, und
 * die Uhr läuft anteilig noch einmal -- einmal je Versuch.
 *
 * Eine Runde mit Nachholen wird mit `mitHilfeGewertet` abgerechnet; der
 * Zeitzuschlag fällt mit weg.
 */
import { createRng } from '@/games/rng'
import { mitHilfeGewertet } from '@/games/hilfe'
import {
  AUFGABEN_JE_RUNDE,
  aufgabeFor,
  stufeForLevel,
  type KopfrechnenLevel,
  type RechenAufgabe,
} from './level'
import { calculateKopfrechnenScore, type KopfrechnenScoreInput } from './score'

/** Weniger Zeit gibt es fürs Nachholen nie, auch wenn nur eine Aufgabe fehlt. */
export const MIN_NACHHOL_SEKUNDEN = 15

export interface NachholRunde {
  /** Erst die richtig gelösten Aufgaben, dann die neuen. */
  tasks: RechenAufgabe[]
  /** Die richtigen Antworten, die stehen bleiben (alle `true`). */
  treffer: boolean[]
  /** Zeit für die neuen Aufgaben. */
  seconds: number
}

/**
 * Baut die Nachhol-Runde nach einer gescheiterten Runde. `treffer` ist, was
 * beantwortet wurde -- kürzer als die Runde, wenn die Zeit ablief.
 * Gleicher Versuch, gleiche neue Aufgaben: Sie kommen aus dem Startwert.
 */
export function nachholRunde(cfg: KopfrechnenLevel, treffer: readonly boolean[]): NachholRunde {
  const richtige = cfg.tasks.filter((_, i) => treffer[i] === true)
  const fehlend = Math.max(0, AUFGABEN_JE_RUNDE - richtige.length)

  const rng = createRng(`${cfg.seed}-zweite-chance`)
  const stufe = stufeForLevel(cfg.level)
  const gesehen = new Set(cfg.tasks.map((a) => a.text))
  const neue: RechenAufgabe[] = []
  for (let versuch = 0; neue.length < fehlend && versuch < 200; versuch++) {
    const a = aufgabeFor(stufe, cfg.level, rng)
    if (gesehen.has(a.text)) continue
    gesehen.add(a.text)
    neue.push(a)
  }
  while (neue.length < fehlend) neue.push(aufgabeFor(stufe, cfg.level, rng))

  return {
    tasks: [...richtige, ...neue],
    treffer: richtige.map(() => true),
    seconds: Math.max(MIN_NACHHOL_SEKUNDEN, Math.ceil((cfg.seconds * fehlend) / AUFGABEN_JE_RUNDE)),
  }
}

/** Darf jetzt eine zweite Chance angeboten werden? Nur nach dem Scheitern, nur einmal. */
export function zweiteChanceMoeglich(stand: { gescheitert: boolean; genutzt: boolean }): boolean {
  return stand.gescheitert && !stand.genutzt
}

/** Die Wertung einer Runde, in der nachgeholt wurde -- ohne Zeitzuschlag. */
export function wertungMitZweiterChance(input: KopfrechnenScoreInput) {
  return { ...mitHilfeGewertet(calculateKopfrechnenScore(input)), timeBonus: 0 }
}
