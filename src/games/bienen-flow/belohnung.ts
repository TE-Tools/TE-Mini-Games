/**
 * Was ein Belohnungsvideo bei Bienen-Flow bringt -- und was nicht.
 *
 * Regel (Thomas, 07.11.2026): Werbung kauft Hilfe, nie Punkte.
 *
 * Steht die Kolonie (alle Plätze belegt, keine Farbe zugänglich), darf man
 * einmal je Versuch per Video einen Platz freiräumen und weiterspielen.
 * Welcher Platz, ist genau festgelegt (`welcherPlatz`):
 *
 *   1. Ein toter Block zuerst -- einer, dessen Farbe es im Bild nicht mehr
 *      gibt. Er könnte nie voll werden und ist schlicht zu viel; er
 *      verschwindet ganz. Gibt es mehrere, der am weitesten links.
 *   2. Sonst der Block mit der größten Restzahl (bei Gleichstand der am
 *      weitesten links): Er wartet am längsten. Er geht NICHT verloren,
 *      sondern zurück in den Nachschub, und zwar ganz unten in die kürzeste
 *      Spalte (bei Gleichstand die linke). So bleibt die Rechnung „es muss
 *      genau aufgehen“ stimmig -- seine Pixel liegen ja noch im Bild --, und
 *      er versperrt keine Spalte, weil er hinten ansteht.
 *
 * Die Runde trägt danach `mitHilfe`: Wird das Bild trotzdem fertig, ist das
 * nächste Level frei, aber es gibt keine Punkte, keine XP, keinen Rekord und
 * genau einen Stern. Ohne die Hilfe wäre die Runde verloren gewesen.
 */

import { bienenFlowGame } from './definition'
import { pixelDerFarbe } from './engine'
import type { BienenState } from './types'

/** Darf gerade „einen Platz freiräumen“ angeboten werden? */
export function platzAngebot(state: BienenState | null): boolean {
  return state != null && state.phase === 'lost' && !state.mitHilfe
}

/** Welcher Platz geräumt wird -- und ob der Block in den Nachschub zurückgeht. */
export function welcherPlatz(state: BienenState): { slot: number; zurueck: boolean } | null {
  let tot = -1
  let groesster = -1
  for (let i = 0; i < state.slots.length; i++) {
    const b = state.slots[i]
    if (!b) continue
    if (tot < 0 && pixelDerFarbe(state, b.color) === 0) tot = i
    if (groesster < 0 || b.amount > state.slots[groesster]!.amount) groesster = i
  }
  if (tot >= 0) return { slot: tot, zurueck: false }
  if (groesster >= 0) return { slot: groesster, zurueck: true }
  return null
}

/** Nach dem Video: einen Platz freiräumen und weiterspielen. */
export function raeumePlatz(state: BienenState): BienenState {
  if (!platzAngebot(state)) return state
  const wahl = welcherPlatz(state)
  if (!wahl) return state
  const slots = state.slots.slice()
  const block = slots[wahl.slot]!
  slots[wahl.slot] = null
  const spalten = state.spalten.map((s) => s.map((b) => ({ ...b })))
  if (wahl.zurueck && spalten.length > 0) {
    let kuerzeste = 0
    for (let i = 1; i < spalten.length; i++) {
      if (spalten[i]!.length < spalten[kuerzeste]!.length) kuerzeste = i
    }
    spalten[kuerzeste]!.push({ ...block })
  }
  const tote = slots.reduce(
    (n, s) => n + (s != null && pixelDerFarbe(state, s.color) === 0 ? 1 : 0),
    0,
  )
  return { ...state, slots, spalten, tote, phase: 'play', mitHilfe: true }
}

export interface BienenWertung {
  score: number
  xp: number
  stars: number
}

/** Die Wertung einer geschafften Runde; mit Hilfe: 0 Punkte, 0 XP, 1 Stern. */
export function wertungFuer(
  level: number,
  raw: { won: boolean; tote: number; slotCount: number },
  mitHilfe: boolean,
): BienenWertung {
  if (mitHilfe) return { score: 0, xp: 0, stars: raw.won ? 1 : 0 }
  const score = bienenFlowGame.calculateScore(level, raw)
  return {
    score,
    xp: bienenFlowGame.calculateXP(level, score),
    stars: bienenFlowGame.calculateStars?.(level, score) ?? 0,
  }
}
