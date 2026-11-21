/**
 * Schach – ein kleines Eröffnungsbuch.
 *
 * In den ersten Zügen rechnet eine Engine wenig Brauchbares aus: Bis
 * sich eine Eröffnung auszahlt, vergehen mehr Züge, als sie vorausschaut.
 * Ohne Buch zieht sie deshalb seltsame, aber nicht verlierende Züge -- und
 * jede Partie beginnt gleich. Mit Buch spielt sie die üblichen
 * Hauptvarianten und wählt zwischen ihnen per Startwert.
 *
 * Die Zugfolgen sind Allgemeingut der Schachtheorie: Spanisch, Italienisch,
 * Sizilianisch, Französisch, Caro-Kann, Damengambit, Slawisch, Nimzowitsch-
 * und Königsindisch, Grünfeld, Englisch, Réti, London und ein paar weitere.
 * Sie sind kurz gehalten -- nach dem Buch rechnet die Engine selbst.
 *
 * `tests/schach-rechner.test.ts` spielt jede Zeile nach: Ein Tippfehler
 * hier wäre sonst ein illegaler Zug, der erst in einer Partie auffiele.
 */

import { findeZug, neuePartie, zieheIn } from './partie'

export const BUCH_ZEILEN: readonly string[] = [
  // Offene Spiele
  'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6',
  'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6',
  'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3 d7d6 e1g1 e8g8',
  'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8e7 e1g1 e8g8',
  'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6',
  'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3',
  'e2e4 e7e5 b1c3 g8f6 g1f3 b8c6 f1b5 f8b4',
  // Sizilianisch
  'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3',
  'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6',
  'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3',
  'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3 d7d6',
  'e2e4 c7c5 c2c3 g8f6 e4e5 f6d5 d2d4 c5d4 g1f3',
  // Französisch, Caro-Kann, Skandinavisch, Aljechin, Pirc
  'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7',
  'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6',
  'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5',
  'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6',
  'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2',
  'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8f5',
  'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 c8g4 f1e2 e7e6',
  'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8',
  // Damenbauer
  'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6',
  'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5',
  'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5',
  'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 c7c5 c2c3 b8c6',
  'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3',
  'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7',
  'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5',
  'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7',
  'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6',
  'd2d4 f7f5 g2g3 g8f6 f1g2 g7g6 g1f3 f8g7',
  // Flankeneröffnungen
  'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5',
  'c2c4 c7c5 g1f3 g8f6 b1c3 b8c6 g2g3 g7g6',
  'c2c4 g8f6 b1c3 e7e6 e2e4 d7d5 e4e5',
  'g1f3 d7d5 g2g3 g8f6 f1g2 e7e6 e1g1 f8e7 d2d3 e8g8',
  'g1f3 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6',
]

let buch: Map<string, string[]> | null = null

/** Stellung → die Buchzüge, die dort gespielt werden. Einmal aufgebaut. */
function baue(): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const zeile of BUCH_ZEILEN) {
    let p = neuePartie()
    for (const z of zeile.split(' ')) {
      const schluessel = p.verlauf.at(-1)!
      const liste = m.get(schluessel) ?? []
      if (!liste.includes(z)) liste.push(z)
      m.set(schluessel, liste)
      const weiter = zieheIn(p, z)
      if (!weiter) break
      p = weiter
    }
  }
  return m
}

/**
 * Ein Buchzug für diese Stellung, oder null. `zufall` liefert eine Zahl in
 * [0, 1) -- derselbe Startwert, derselbe Zug.
 */
export function buchZug(schluessel: string, fen: string, zufall: () => number): string | null {
  buch ??= baue()
  const liste = buch.get(schluessel)
  if (!liste) return null
  const z = liste[Math.floor(zufall() * liste.length)]!
  // Nur zur Sicherheit: Das Buch darf nie einen Zug liefern, den es nicht gibt.
  return findeZug(neuePartie(fen).stellung, z) ? z : null
}
