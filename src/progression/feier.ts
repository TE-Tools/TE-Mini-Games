/**
 * Feiern: ein Level hoch, ein Abzeichen, eine Tagesaufgabe.
 *
 * `processAfterResult` meldet hier, was es nach einer Runde gefunden hat,
 * und die Feierschicht in der App-Hülle (src/components/feier/) zeigt es
 * an. So feiert jedes Spiel mit, ohne dass eine Spielseite davon weiß.
 *
 * Bewusst ein eigenes EventTarget statt `window`: läuft auch dort, wo es
 * kein Fenster gibt, und kein fremdes Skript kann eine Feier vortäuschen.
 */

import type { AchievementId } from './achievements'
import type { Tagesaufgabe } from './tagesaufgaben'

export type Feier =
  | { art: 'aufstieg'; level: number }
  | { art: 'abzeichen'; id: AchievementId }
  | { art: 'aufgabe'; aufgabe: Tagesaufgabe; xp: number }
  | { art: 'alleAufgaben'; xp: number }

const FEIER_EREIGNIS = 'feier'
const ziel = new EventTarget()

/** Meldet eine Folge von Feiern auf einmal. Eine leere Liste meldet nichts. */
export function meldeFeiern(feiern: readonly Feier[]): void {
  if (feiern.length === 0) return
  ziel.dispatchEvent(new CustomEvent<Feier[]>(FEIER_EREIGNIS, { detail: [...feiern] }))
}

/** Hört auf Feiern; gibt die Abmeldung zurück. */
export function aufFeiern(rueckruf: (feiern: Feier[]) => void): () => void {
  const hoerer = (e: Event) => rueckruf((e as CustomEvent<Feier[]>).detail)
  ziel.addEventListener(FEIER_EREIGNIS, hoerer)
  return () => ziel.removeEventListener(FEIER_EREIGNIS, hoerer)
}
