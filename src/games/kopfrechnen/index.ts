export { kopfrechnenGame } from './definition'
export {
  createKopfrechnenLevel,
  stufeForLevel,
  secondsForLevel,
  AUFGABEN_JE_RUNDE,
  NOETIG_ZUM_BESTEHEN,
} from './level'
export type { KopfrechnenLevel, RechenAufgabe, Stufe } from './level'
export { calculateKopfrechnenScore, MAX_ZEIT_BONUS } from './score'
export type { KopfrechnenScoreInput, KopfrechnenScoreResult } from './score'
