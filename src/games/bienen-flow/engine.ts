/**
 * Bienen-Flow – reine Spiellogik (kein React, kein DOM).
 *
 * Der Ablauf in einem Satz: Oberster Block einer Nachschub-Spalte antippen,
 * er wandert auf einen freien Platz, die Bienen tragen so viele Pollen ins
 * Bild, wie diese Farbe noch braucht -- geht es genau auf, verschwindet der
 * Block und der Platz ist wieder frei; bleibt etwas übrig, ist der Platz
 * verloren. Fünf verlorene Plätze beenden das Level.
 *
 * Warum die Lieferung sofort passiert statt in Echtzeit mitzuzählen: So ist
 * jeder Zug ein abgeschlossener Schritt, den man prüfen und mit einem Löser
 * durchrechnen kann. Die Anzeige zählt die Zahl trotzdem sichtbar herunter --
 * das ist Schau, nicht Regel.
 */

import { SICHTBARE_REIHEN, type BienenBlock, type BienenLevel, type BienenState } from './types'

export function createMatch(level: BienenLevel): BienenState {
  const offen: number[] = []
  for (const c of level.bild) {
    if (c === 0) continue
    offen[c] = (offen[c] ?? 0) + 1
  }
  for (let i = 0; i <= level.colorCount; i++) if (offen[i] === undefined) offen[i] = 0

  return {
    level: level.level,
    rows: level.rows,
    cols: level.cols,
    gefuellt: new Array(level.bild.length).fill(0),
    bild: level.bild.slice(),
    offen,
    spalten: level.spalten.map((s) => s.map((b) => ({ ...b }))),
    slots: Array.from({ length: level.slotCount }, () => null),
    slotCount: level.slotCount,
    colorCount: level.colorCount,
    phase: 'play',
    moves: 0,
    verstopft: 0,
  }
}

/**
 * Was die Anzeige zeigen darf: die obersten drei Reihen. Was darunter liegt,
 * weiß nur die Engine -- der Nachschub rückt nach, ohne sich vorher in die
 * Karten schauen zu lassen.
 */
export function sichtbareSpalten(state: BienenState): BienenBlock[][] {
  return state.spalten.map((s) => s.slice(0, SICHTBARE_REIHEN))
}

/** Wie viele Blöcke unter der sichtbaren Tiefe noch warten. */
export function verdeckteBloecke(state: BienenState): number {
  return state.spalten.reduce((n, s) => n + Math.max(0, s.length - SICHTBARE_REIHEN), 0)
}

/** Der oberste Block einer Spalte -- nur der lässt sich antippen. */
export function obersterBlock(state: BienenState, spalte: number): BienenBlock | null {
  return state.spalten[spalte]?.[0] ?? null
}

export function freieSlots(state: BienenState): number {
  let n = 0
  for (const s of state.slots) if (s == null) n++
  return n
}

export function kannTippen(state: BienenState, spalte: number): boolean {
  if (state.phase !== 'play') return false
  if (spalte < 0 || spalte >= state.spalten.length) return false
  if (!obersterBlock(state, spalte)) return false
  return freieSlots(state) > 0
}

/**
 * Ob ein Block sauber aufgeht. Das Spiel zeigt das an -- ohne diesen Hinweis
 * wäre jeder Zug ein Blindflug, und im Original gibt es ihn auch.
 */
export function gehtAuf(state: BienenState, block: BienenBlock | null): boolean {
  if (!block) return false
  return block.amount <= (state.offen[block.color] ?? 0)
}

/*
 * Warum es hier KEINE Prüfung auf "geht das Bild überhaupt noch auf?" gibt:
 * Ein Block liefert immer zuerst alles, was seine Farbe noch braucht, und
 * behält nur den Rest. Eine Farbe kann dadurch nie zu wenig bekommen -- sie
 * wird immer voll, sobald man alle ihre Blöcke hochschickt. Der Preis für
 * einen Block zu viel ist ausschließlich der Platz, den sein Rest für immer
 * belegt. Deshalb ist die einzige Niederlage: fünf verstopfte Plätze.
 */

export interface TapResult {
  state: BienenState
  /** Der Block, wie er auf dem Platz liegt (Rest, falls etwas übrig blieb). */
  block: BienenBlock
  slot: number
  /** Wie viele Pollen ins Bild gegangen sind. */
  geliefert: number
  /** Die gefüllten Pixel in der Reihenfolge, in der sie gefüllt wurden. */
  zellen: number[]
  /** Blieb etwas übrig, ist dieser Platz für den Rest des Levels verloren. */
  verstopft: boolean
}

export function tapSpalte(state: BienenState, spalte: number): TapResult | null {
  if (!kannTippen(state, spalte)) return null
  const spalten = state.spalten.map((s) => s.map((b) => ({ ...b })))
  const block = spalten[spalte]!.shift()!

  const offen = state.offen.slice()
  const gefuellt = state.gefuellt.slice()
  const geliefert = Math.min(block.amount, offen[block.color] ?? 0)

  const zellen: number[] = []
  if (geliefert > 0) {
    for (let i = 0; i < gefuellt.length && zellen.length < geliefert; i++) {
      if (state.bild[i] === block.color && gefuellt[i] === 0) {
        gefuellt[i] = block.color
        zellen.push(i)
      }
    }
    offen[block.color] = (offen[block.color] ?? 0) - geliefert
    block.amount -= geliefert
  }

  const slots = state.slots.slice()
  const platz = slots.findIndex((s) => s == null)
  const verstopft = block.amount > 0
  if (verstopft) slots[platz] = block

  const fertig = offen.every((n) => n === 0)
  const belegt = slots.reduce((n, s) => n + (s == null ? 0 : 1), 0)

  const neu: BienenState = {
    ...state,
    spalten,
    slots,
    offen,
    gefuellt,
    moves: state.moves + 1,
    verstopft: belegt,
    phase: fertig ? 'won' : belegt >= state.slotCount ? 'lost' : 'play',
  }

  return { state: neu, block, slot: platz, geliefert, zellen, verstopft }
}

/** Wie viele Pixel im Bild noch fehlen. */
export function offenePixel(state: BienenState): number {
  return state.offen.reduce((n, x) => n + x, 0)
}

/** Wie viele Pollen noch im Nachschub liegen. */
export function pollenImNachschub(state: BienenState): number {
  return state.spalten.reduce((n, s) => n + s.reduce((m, b) => m + b.amount, 0), 0)
}

export function isWon(state: BienenState): boolean {
  return state.phase === 'won'
}

export function isLost(state: BienenState): boolean {
  return state.phase === 'lost'
}
