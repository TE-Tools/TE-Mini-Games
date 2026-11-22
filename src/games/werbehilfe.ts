/**
 * Wertung einer Runde, in der ein Belohnungsvideo geholfen hat.
 *
 * Die Regel selbst steht in src/games/hilfe.ts -- einmal, für alle Spiele.
 * Diese Datei ist die Form, die `saveGameResult` braucht: Dort greift sie
 * über `mitWerbehilfe`, damit kein Spiel die Regel vergessen kann.
 */
import { HOECHSTENS_STERNE_MIT_HILFE, mitHilfeGewertet } from './hilfe'

/** Höchstens so viele Sterne gibt eine Runde mit Werbehilfe. */
export const STERNE_MIT_WERBEHILFE = HOECHSTENS_STERNE_MIT_HILFE

export interface Wertung {
  score: number
  xp: number
  stars: number
}

export function wertungMitWerbehilfe(w: Wertung): Wertung {
  const { score, xp, stars } = mitHilfeGewertet(w)
  return { score, xp, stars }
}
