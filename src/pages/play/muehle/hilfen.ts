/**
 * Kleinigkeiten, die die Partie gegen den Computer, zu zweit und online
 * gleich brauchen: der Klang eines Zuges und der Satz, warum die Partie
 * aus ist.
 */
import { REMIS, type Ende, type Partie } from '@/games/muehle'
import type { Texte } from '@/i18n/sprache'
import { spiele } from '@/services/sound'

/** Der Klang eines Zuges: Schlagen klingt anders als Setzen und Ziehen. */
export function klangFuer(nachher: Partie) {
  spiele(nachher.letzter && nachher.letzter.zug.schlag.length > 0 ? 'treffer' : 'tick')
}

/** Warum die Partie aus ist -- in Worten, die Zahlen aus `config.ts`. */
export function endeText(tm: Texte['muehle'], ende: Ende): string {
  if (ende.art === 'ohne-muehle') return tm.ohneMuehle(REMIS.halbzuegeOhneMuehle / 2)
  if (ende.art === 'endspiel') return tm.endspiel(REMIS.halbzuegeBeideSpringen / 2)
  return tm.endeGrund[ende.art]
}
