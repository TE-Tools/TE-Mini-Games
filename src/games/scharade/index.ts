export { scharadeGame } from './definition'
export {
  createScharadeMatch,
  currentWord,
  startTurn,
  markCorrect,
  markSkipped,
  endTurn,
  nextTurn,
  nextScharadeRound,
  activeScharadePlayer,
  scharadeRangliste,
  MIN_SPIELER,
  MAX_SPIELER,
} from './engine'
export type { ScharadeState, ScharadePlayer, ScharadePhase, CreateScharadeOptions } from './engine'
