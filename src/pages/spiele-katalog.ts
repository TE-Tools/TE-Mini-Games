/**
 * Was auf den Spielkacheln steht.
 *
 * Reihenfolge, Weg und die kurze Einordnung darunter -- an einer Stelle,
 * statt dreizehnmal im JSX. Die Einordnung ist bewusst ein Wort: Sie soll
 * beim Suchen helfen ("worauf hab ich Lust?"), nicht das Spiel erklären.
 */

import type { GameId } from '@/games/types'

export interface KachelEintrag {
  id: GameId
  name: string
  pfad: string
  icon: string
  /** Ein Wort, das die Art des Spiels benennt. */
  art: string
}

export const SPIELE_KACHELN: readonly KachelEintrag[] = [
  { id: 'perfect-second', name: 'Die perfekte Sekunde', pfad: '/play/perfect-second', icon: '⏱️', art: 'Timing' },
  { id: 'what-is-missing', name: 'Was fehlt?', pfad: '/play/what-is-missing', icon: '👀', art: 'Wahrnehmung' },
  { id: 'reihenfolge', name: 'Reihenfolge merken', pfad: '/play/reihenfolge', icon: '🧠', art: 'Gedächtnis' },
  { id: 'kopfrechnen', name: 'Kopfrechnen', pfad: '/play/kopfrechnen', icon: '🔢', art: 'Rechnen' },
  { id: 'bienen-flow', name: 'Bienen-Flow', pfad: '/play/bienen-flow', icon: '🐝', art: 'Puzzle' },
  { id: 'kniffel', name: 'Kniffel', pfad: '/play/kniffel', icon: '🎲', art: 'Würfeln' },
  { id: 'schuetzenopoly', name: 'Schützenopoly', pfad: '/play/schuetzenopoly', icon: '🎲', art: 'Brettspiel' },
  { id: 'schuetzenrunde', name: 'Schützenrunde', pfad: '/play/schuetzenrunde', icon: '🎯', art: 'Bluffen' },
  { id: 'finde-den-imposter', name: 'Finde den Imposter', pfad: '/play/finde-den-imposter', icon: '😈', art: 'Bluffen' },
  { id: 'wer-bin-ich', name: 'Wer bin ich?', pfad: '/play/wer-bin-ich', icon: '🤔', art: 'Raten' },
  { id: 'stadt-land-fluss', name: 'Stadt-Land-Fluss', pfad: '/play/stadt-land-fluss', icon: '✏️', art: 'Wissen' },
  { id: 'scharade', name: 'Scharade', pfad: '/play/scharade', icon: '🎭', art: 'Schauspiel' },
  { id: 'wortbombe', name: 'Wortbombe', pfad: '/play/wortbombe', icon: '💣', art: 'Wortspiel' },
  { id: 'wer-wuerde-eher', name: 'Wer würde eher?', pfad: '/play/wer-wuerde-eher', icon: '🗳️', art: 'Partyspiel' },
]

const NACH_ID = new Map(SPIELE_KACHELN.map((k) => [k.id, k]))

export function kachelFuer(id: string): KachelEintrag | undefined {
  return NACH_ID.get(id as GameId)
}
