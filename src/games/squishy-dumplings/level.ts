/**
 * Squishy Dumplings – die 300 Level.
 *
 * Vier Stellschrauben, alle in dieselbe Richtung (Thomas am 09.09.2026:
 * "wieder Level wie bei den anderen, um weiterzukommen, immer schwerer"):
 *
 *   FARBEN  Mit vier Farben fällt fast jeder Zug irgendwo hin; mit sechs
 *           muss man suchen. Das ist der stärkste Hebel.
 *   ZIEL    Wie viele Knödel eingesammelt werden müssen.
 *   ZEIT    Wie lange man dafür hat. Ziel hoch und Zeit runter zugleich --
 *           daraus wird der Druck.
 *   KÄFIGE  Ab Level 12. Ein Knödel im Käfig zerreißt jede Linie, und alle
 *           Käfige müssen auf, sonst zählt das Level nicht als geschafft.
 *
 * Dass die Ziele in der Zeit überhaupt zu schaffen sind, ist nicht geraten:
 * tests/squishy-dumplings.test.ts spielt jedes Level mit einem Bot durch,
 * der wie ein aufmerksamer Mensch alle 1,5 Sekunden zieht.
 */

import { isSegmentGate } from '@/progression/zones'
import { findeTreffer, hatZug, idx, moeglicheZuege, zieh } from './engine'
import {
  DUMPLING_MAX_LEVEL,
  REIHEN,
  SPALTEN,
  type DumplingLevel,
  zelle,
  type DumplingState,
  type Zelle,
} from './types'

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}

/**
 * Wie schwer ein Level sein soll: 0 (Lernstoff) bis 1 (das Schwerste).
 *
 * Die ersten zwanzig Level sind zum Lernen -- vier Farben, viel Zeit, keine
 * Käfige. Ab 21 geht es gleichmäßig bergauf. Tore liegen immer darüber.
 */
export function schwierigkeit(level: number): number {
  const L = clamp(Math.floor(level), 1, DUMPLING_MAX_LEVEL)
  const grund = L <= 20 ? ((L - 1) / 19) * 0.16 : 0.2 + ((L - 21) / (DUMPLING_MAX_LEVEL - 21)) * 0.8
  return isSegmentGate(L) ? clamp(Math.max(grund, 0.45) + 0.12, 0, 1) : grund
}

/** Ein Startfeld ohne fertige Reihen und mit mindestens einem Zug. */
function baueFeld(
  rows: number,
  cols: number,
  farben: number,
  kaefige: number,
  saat: number,
): { feld: Zelle[]; saat: number } {
  let z = saat
  for (let versuch = 0; versuch < 400; versuch++) {
    const feld: Zelle[] = new Array(rows * cols)
    for (let i = 0; i < feld.length; i++) {
      const gezogen = zieh(z, farben)
      z = gezogen.zufall
      feld[i] = zelle(gezogen.zahl + 1)
    }
    // Käfige verteilen: nicht in die unterste Reihe, sonst stehen sie von
    // Anfang an dort, wo ohnehin am meisten passiert.
    let gesetzt = 0
    for (let n = 0; n < 200 && gesetzt < kaefige; n++) {
      const r = zieh(z, rows - 1)
      z = r.zufall
      const c = zieh(z, cols)
      z = c.zufall
      const i = idx(r.zahl, c.zahl, cols)
      if (feld[i]!.kaefig) continue
      feld[i] = { ...feld[i]!, kaefig: true }
      gesetzt++
    }
    if (findeTreffer(feld, rows, cols).length > 0) continue
    const probe = { rows, cols, feld, phase: 'play' } as DumplingState
    if (!hatZug(probe)) continue
    // Ein Feld mit nur einem einzigen Zug wäre Glückssache statt Können.
    if (moeglicheZuege(probe).length < 3) continue
    return { feld, saat: z }
  }
  // Notausgang: ein glattes Feld ohne Käfige geht immer.
  const feld: Zelle[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) feld.push(zelle(((r + c * 2) % farben) + 1))
  }
  return { feld, saat: z }
}

export function createDumplingLevel(level: number): DumplingLevel {
  const L = clamp(Math.floor(level), 1, DUMPLING_MAX_LEVEL)
  const gate = isSegmentGate(L)
  const s = schwierigkeit(L)

  /**
   * Die Zahl der Farben ist der härteste Hebel: Mit vier passt fast jeder
   * Zug irgendwo, mit sechs muss man suchen. Deshalb in Stufen und nicht
   * gerechnet -- ein Sprung mitten in einem Abschnitt fällt sonst als
   * plötzliche Wand auf. Am Tor kommt eine Farbe dazu.
   */
  const farben = clamp((L <= 25 ? 4 : L <= 110 ? 5 : 6) + (gate ? 1 : 0), 4, 6)
  const ziel = Math.round((30 + s * 90) * (gate ? 1.15 : 1))
  /**
   * Die Zeit ergibt sich aus dem Tempo, das man halten muss.
   *
   * Wie schnell man überhaupt sein kann, hängt an der Zahl der Farben --
   * mit vieren fällt fast jeder Zug irgendwo hin, mit sechsen muss man
   * suchen. Gemessen an einem Bot, der zufällig gültige Züge macht und alle
   * 2,2 Sekunden zieht (tests/squishy-dumplings.test.ts): rund 2,7 Knödel
   * je Sekunde bei vier Farben, 2,0 bei fünf, 1,65 bei sechs.
   *
   * `druck` sagt, welchen Anteil davon man halten muss: am Anfang knapp ein
   * Drittel -- da hat auch ein Anfänger reichlich Luft -- und am Ende etwas
   * mehr als alles, sodass nur durchkommt, wer Ketten sucht statt den
   * erstbesten Dreier zu nehmen.
   */
  const botTempo = farben <= 4 ? 2.7 : farben === 5 ? 2.0 : 1.65
  const druck = 0.3 + s * 0.85
  const zeit = Math.round(clamp(ziel / (botTempo * druck), 35, 180))
  const kaefige = L < 12 ? 0 : clamp(Math.round(s * 7), 1, 7)

  const { feld, saat } = baueFeld(REIHEN, SPALTEN, farben, kaefige, L * 7919 + 13)

  const label = gate ? 'Tor' : s >= 0.66 ? 'Knifflig' : s >= 0.36 ? 'Mittel' : 'Locker'

  return {
    level: L,
    rows: REIHEN,
    cols: SPALTEN,
    farben,
    ziel,
    zeit,
    kaefige,
    feld,
    saat,
    isGate: gate,
    label,
  }
}
