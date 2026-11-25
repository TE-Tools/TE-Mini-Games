/**
 * Der Satz zu einer Tagesaufgabe, in der gewählten Sprache.
 *
 * Die Aufgabe trägt nur Kennungen (Spiel, Gruppe); Namen werden hier beim
 * Rendern nachgeschlagen -- sonst behielte sie beim Sprachwechsel die alte
 * Sprache (Falle 1 in docs/design/zweisprachig/README.md).
 */

import type { Texte } from '@/i18n/sprache'
import type { Tagesaufgabe } from '@/progression/tagesaufgaben'

export function aufgabenText(aufgabe: Tagesaufgabe, t: Texte): string {
  const a = t.bindung.aufgabe
  switch (aufgabe.art) {
    case 'rundenSpiel':
      return a.rundenSpiel(aufgabe.ziel, aufgabe.gameId ? t.spiele[aufgabe.gameId] : '')
    case 'sterne':
      return a.sterne(aufgabe.sterne ?? 3)
    case 'neuesLevel':
      return a.neuesLevel(aufgabe.ziel)
    case 'verschiedene':
      return a.verschiedene(aufgabe.ziel)
    case 'gruppe':
      return a.gruppe(aufgabe.ziel, aufgabe.gruppe ? t.gruppen[aufgabe.gruppe] : '')
    case 'runden':
      return a.runden(aufgabe.ziel)
  }
}
