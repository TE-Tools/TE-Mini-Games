/**
 * Was auf den Spielkacheln steht.
 *
 * Reihenfolge, Weg und die kurze Einordnung darunter -- an einer Stelle,
 * statt dreizehnmal im JSX. Die Einordnung ist bewusst ein Wort: Sie soll
 * beim Suchen helfen ("worauf hab ich Lust?"), nicht das Spiel erklären.
 */

import type { GameId } from '@/games/types'
import type { Texte } from '@/i18n/sprache'

export interface KachelEintrag {
  id: GameId
  /**
   * Der deutsche Name. Angezeigt wird er nicht mehr von hier aus,
   * sondern über `t.spiele[id]` -- diese Zeile bleibt als Fundstelle
   * für Suchen im Quelltext und als Beleg, welches Spiel gemeint ist.
   */
  name: string
  pfad: string
  icon: string
  /**
   * Ein Wort, das die Art des Spiels benennt. Als Schlüssel getippt:
   * Eine neue Art ohne Übersetzung ist damit ein Fehler beim Bauen und
   * keine deutsche Insel in der englischen Oberfläche.
   */
  art: keyof Texte['spielarten']
}

export const SPIELE_KACHELN: readonly KachelEintrag[] = [
  {
    id: 'perfect-second',
    name: 'Die perfekte Sekunde',
    pfad: '/play/perfect-second',
    icon: '⏱️',
    art: 'Timing',
  },
  {
    id: 'what-is-missing',
    name: 'Was fehlt?',
    pfad: '/play/what-is-missing',
    icon: '👀',
    art: 'Wahrnehmung',
  },
  {
    id: 'reihenfolge',
    name: 'Reihenfolge merken',
    pfad: '/play/reihenfolge',
    icon: '🧠',
    art: 'Gedächtnis',
  },
  { id: 'kopfrechnen', name: 'Kopfrechnen', pfad: '/play/kopfrechnen', icon: '🔢', art: 'Rechnen' },
  { id: 'sudoku', name: 'Sudoku', pfad: '/play/sudoku', icon: '🔢', art: 'Logik' },
  { id: 'bienen-flow', name: 'Bienen-Flow', pfad: '/play/bienen-flow', icon: '🐝', art: 'Puzzle' },
  {
    id: 'squishy-dumplings',
    name: 'Squishy Dumplings',
    pfad: '/play/squishy-dumplings',
    icon: '🥟',
    art: 'Drei gewinnt',
  },
  { id: 'trapbound', name: 'Trapbound', pfad: '/play/trapbound', icon: '🕳️', art: 'Jump and Run' },
  { id: 'emberwake', name: 'Emberwake', pfad: '/play/emberwake', icon: '🔥', art: 'Survival' },
  { id: 'kniffel', name: 'Kniffel', pfad: '/play/kniffel', icon: '🎲', art: 'Würfeln' },
  { id: 'maumau', name: 'Mau-Mau', pfad: '/play/maumau', icon: '🂡', art: 'Karten' },
  {
    id: 'letzte-karte',
    name: 'Letzte Karte',
    pfad: '/play/letzte-karte',
    icon: '🎴',
    art: 'Karten',
  },
  {
    id: 'texas-holdem',
    name: "Texas Hold'em",
    pfad: '/play/texas-holdem',
    icon: '🃏',
    art: 'Karten',
  },
  {
    id: 'schuetzenopoly',
    name: 'Schützenopoly',
    pfad: '/play/schuetzenopoly',
    icon: '🎲',
    art: 'Brettspiel',
  },
  {
    id: 'schuetzenrunde',
    name: 'Schützenrunde',
    pfad: '/play/schuetzenrunde',
    icon: '🎯',
    art: 'Bluffen',
  },
  {
    id: 'finde-den-imposter',
    name: 'Finde den Imposter',
    pfad: '/play/finde-den-imposter',
    icon: '😈',
    art: 'Bluffen',
  },
  { id: 'wer-bin-ich', name: 'Wer bin ich?', pfad: '/play/wer-bin-ich', icon: '🤔', art: 'Raten' },
  {
    id: 'stadt-land-fluss',
    name: 'Stadt-Land-Fluss',
    pfad: '/play/stadt-land-fluss',
    icon: '✏️',
    art: 'Wissen',
  },
  { id: 'scharade', name: 'Scharade', pfad: '/play/scharade', icon: '🎭', art: 'Schauspiel' },
  { id: 'wortbombe', name: 'Wortbombe', pfad: '/play/wortbombe', icon: '💣', art: 'Wortspiel' },
  {
    id: 'wer-wuerde-eher',
    name: 'Wer würde eher?',
    pfad: '/play/wer-wuerde-eher',
    icon: '🗳️',
    art: 'Partyspiel',
  },
]

const NACH_ID = new Map(SPIELE_KACHELN.map((k) => [k.id, k]))

export function kachelFuer(id: string): KachelEintrag | undefined {
  return NACH_ID.get(id as GameId)
}

/*
 * Die Reiter über den Kacheln (03.11.2026): Bei zweiundzwanzig Spielen
 * hilft eine grobe Sortierung beim Suchen -- "worauf hab ich Lust?" in vier
 * Antworten. Ein Spiel steht in genau einer Gruppe.
 */
export type SpielGruppe = 'knobeln' | 'geschick' | 'tisch' | 'party'

export const SPIEL_GRUPPEN: readonly { id: SpielGruppe; icon: string }[] = [
  { id: 'knobeln', icon: '🧩' },
  { id: 'geschick', icon: '⚡' },
  { id: 'tisch', icon: '🎲' },
  { id: 'party', icon: '🎉' },
]

const GRUPPE: Partial<Record<GameId, SpielGruppe>> = {
  'perfect-second': 'geschick',
  'what-is-missing': 'knobeln',
  reihenfolge: 'knobeln',
  kopfrechnen: 'knobeln',
  sudoku: 'knobeln',
  'bienen-flow': 'knobeln',
  'squishy-dumplings': 'geschick',
  trapbound: 'geschick',
  emberwake: 'geschick',
  kniffel: 'tisch',
  maumau: 'tisch',
  'letzte-karte': 'tisch',
  'texas-holdem': 'tisch',
  schuetzenopoly: 'tisch',
  schuetzenrunde: 'party',
  'finde-den-imposter': 'party',
  'wer-bin-ich': 'party',
  'stadt-land-fluss': 'party',
  scharade: 'party',
  wortbombe: 'party',
  'wer-wuerde-eher': 'party',
}

/** Ein Spiel ohne Eintrag landet bei "Knobeln" -- dort fällt es nicht aus dem Raster. */
export function gruppeVon(id: GameId): SpielGruppe {
  return GRUPPE[id] ?? 'knobeln'
}
