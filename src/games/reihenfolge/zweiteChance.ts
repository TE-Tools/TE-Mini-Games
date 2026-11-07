/**
 * Reihenfolge merken -- die zweite Chance per Belohnungsvideo.
 *
 * Nach einem Fehlgriff darf man einmal je Versuch weitermachen: Die Folge
 * wird noch einmal ganz vorgespielt, die richtig getippten Schritte bleiben
 * stehen, und es geht bei dem Schritt weiter, der danebenging.
 *
 * Eine Runde mit zweiter Chance wird mit `mitHilfeGewertet` abgerechnet.
 */
import { mitHilfeGewertet } from '@/games/hilfe'
import { calculateReihenfolgeScore, type ReihenfolgeScoreInput } from './score'

/**
 * Was von der Eingabe stehen bleibt: alles bis vor den ersten Fehlgriff.
 * Ohne Fehlgriff bleibt alles.
 */
export function eingabeNachFehler(eingabe: readonly number[], folge: readonly number[]): number[] {
  const richtig: number[] = []
  for (let i = 0; i < eingabe.length && i < folge.length; i++) {
    if (eingabe[i] !== folge[i]) break
    richtig.push(eingabe[i]!)
  }
  return richtig
}

/** Darf jetzt eine zweite Chance angeboten werden? Nur nach einem Fehler, nur einmal. */
export function zweiteChanceMoeglich(stand: { gescheitert: boolean; genutzt: boolean }): boolean {
  return stand.gescheitert && !stand.genutzt
}

/** Die Wertung einer Runde, in der die zweite Chance genutzt wurde. */
export function wertungMitZweiterChance(input: ReihenfolgeScoreInput) {
  return mitHilfeGewertet(calculateReihenfolgeScore(input))
}
