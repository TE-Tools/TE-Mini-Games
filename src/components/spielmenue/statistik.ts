/**
 * Die Bilanz auf dem Startbildschirm eines Spiels.
 *
 * Gelesen wird nur, was ohnehin auf dem Gerät liegt: die gespeicherten
 * Ergebnisse (src/offline). Kein Netz, keine neue Tabelle -- die Leiste
 * funktioniert offline genauso wie online.
 *
 * Im Zustand steht nur Zahlen und ein Zeitstempel, nie ein fertiger
 * Satz: Der Text entsteht beim Rendern, sonst behielte er beim
 * Sprachwechsel die alte Sprache (docs/design/zweisprachig, Falle 1).
 */

import { db, GUEST_USER_ID, type LocalGameResult } from '@/offline'
import type { GameId } from '@/games/types'
import type { Texte } from '@/i18n/sprache'

/** Die Spiele mit einem Startbildschirm aus diesem Baukasten. */
export type MenueSpiel = Extract<
  GameId,
  | 'kniffel'
  | 'maumau'
  | 'letzte-karte'
  | 'texas-holdem'
  | 'schach'
  | 'dame'
  | 'kaesekaestchen'
  | 'schuetzenopoly'
>

export interface MenueStatistik {
  partien: number
  siege: number
  /** Höchste Punktzahl, null ohne Partie. */
  bestwert: number | null
  /** Siege am Stück, von der letzten Partie rückwärts gezählt. */
  serie: number
  /** Zeitpunkt der letzten Partie (ms), null ohne Partie. */
  zuletzt: number | null
}

export const LEERE_STATISTIK: MenueStatistik = {
  partien: 0,
  siege: 0,
  bestwert: null,
  serie: 0,
  zuletzt: null,
}

/**
 * Gewonnen? Die Spiele schreiben das verschieden auf: die meisten als
 * `gewonnen`, Schach und Dame als `ausgang: 'sieg'` (ein Remis ist kein Sieg).
 */
export function istSieg(r: Pick<LocalGameResult, 'resultData'>): boolean {
  const d = r.resultData
  return d['gewonnen'] === true || d['ausgang'] === 'sieg'
}

/** Rechnet die Bilanz aus den Ergebnissen eines Spiels. Rein, ohne Datenbank. */
export function berechneStatistik(
  ergebnisse: readonly Pick<LocalGameResult, 'score' | 'resultData' | 'createdAt'>[],
): MenueStatistik {
  if (ergebnisse.length === 0) return LEERE_STATISTIK
  const neuesteZuerst = [...ergebnisse].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  let serie = 0
  for (const r of neuesteZuerst) {
    if (!istSieg(r)) break
    serie++
  }
  const zuletzt = Date.parse(neuesteZuerst[0]!.createdAt)
  return {
    partien: ergebnisse.length,
    siege: ergebnisse.filter(istSieg).length,
    bestwert: Math.max(...ergebnisse.map((r) => r.score)),
    serie,
    zuletzt: Number.isNaN(zuletzt) ? null : zuletzt,
  }
}

/** Liest die Ergebnisse eines Spiels aus dem Gerät und rechnet die Bilanz. */
export async function ladeMenueStatistik(
  spiel: MenueSpiel,
  userId: string = GUEST_USER_ID,
): Promise<MenueStatistik> {
  const ergebnisse = await db.gameResults
    .where('gameId')
    .equals(spiel)
    .and((r) => r.userId === userId)
    .toArray()
  return berechneStatistik(ergebnisse)
}

export interface StatistikChip {
  id: 'serie' | 'siege' | 'bestwert' | 'zuletzt' | 'partien'
  icon: string
  text: string
}

/** Höchstens so viele Chips -- mehr wird auf dem Telefon zur Wand. */
const MAX_CHIPS = 4

/**
 * Welche Chips eine Bilanz hergibt, in der Reihenfolge ihres Gewichts.
 * Was noch keinen Wert hat, fehlt -- „0 Siege“ zieht niemanden an den Tisch.
 */
export function statistikChips(
  t: Texte,
  s: MenueStatistik,
  mitBestwert: boolean,
  jetzt: number = Date.now(),
): StatistikChip[] {
  const tm = t.spielMenue
  const chips: StatistikChip[] = []
  if (s.serie >= 2) chips.push({ id: 'serie', icon: '🔥', text: tm.serie(s.serie) })
  if (s.siege > 0) chips.push({ id: 'siege', icon: '🏆', text: tm.siege(s.siege) })
  if (mitBestwert && s.bestwert !== null && s.bestwert > 0) {
    chips.push({ id: 'bestwert', icon: '⭐', text: tm.bestwert(s.bestwert) })
  }
  if (s.zuletzt !== null) {
    const tage = tageSeit(s.zuletzt, jetzt)
    const text = tage === 0 ? tm.zuletztHeute : tage === 1 ? tm.zuletztGestern : tm.zuletztVor(tage)
    chips.push({ id: 'zuletzt', icon: '🕒', text })
  }
  if (s.partien > 0) chips.push({ id: 'partien', icon: '🎮', text: tm.partien(s.partien) })
  return chips.slice(0, MAX_CHIPS)
}

/** Wie viele Kalendertage liegt `damals` zurück? Heute ist 0, gestern 1. */
export function tageSeit(damals: number, jetzt: number = Date.now()): number {
  const tag = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  }
  return Math.max(0, Math.round(tag(jetzt) - tag(damals)))
}
