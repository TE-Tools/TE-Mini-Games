export type Tischseite = 'unten' | 'links' | 'oben' | 'rechts'

/**
 * Wer sitzt wo -- im Uhrzeigersinn, in Zugreihenfolge.
 *
 * Zu zweit sitzt man sich an den kurzen Seiten gegenüber: Dort bleibt dem
 * Brett die volle lange Kante. Zu dritt kommt eine lange Seite dazu.
 */
export function tischplaetze(anzahl: number, quer: boolean): Tischseite[] {
  if (anzahl <= 1) return ['unten']
  if (anzahl === 2) return quer ? ['links', 'rechts'] : ['unten', 'oben']
  if (anzahl === 3) return quer ? ['unten', 'links', 'rechts'] : ['unten', 'links', 'oben']
  return ['unten', 'links', 'oben', 'rechts']
}
