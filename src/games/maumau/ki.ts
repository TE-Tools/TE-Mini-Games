/**
 * Die Mitspieler am Kartentisch.
 *
 * Kein Suchbaum -- bei Mau-Mau sieht man die Hände der anderen nicht,
 * also gibt es auch nichts durchzurechnen. Was ein Mensch tut, tut der
 * Rechner auch: die teuren Karten loswerden, die Farbe behalten, von der
 * man viel hat, und zuschlagen, wenn jemand fast fertig ist.
 *
 * Die beiden Stufen unterscheiden sich im Blick, nicht im Wissen:
 * „Leicht" legt die erste Karte, die passt, und vergisst manchmal Mau.
 * „Normal" wählt aus und vergisst es nie.
 */

import { createRng } from '@/games/rng'
import type { Karte } from './karten'
import {
  amZugSpieler,
  meineSpielbaren,
  haeufigsteFarbe,
  oberste,
  regelnVon,
  type MauSpieler,
  type MauZustand,
} from './engine'

export type KiZug =
  | { art: 'legen'; karte: Karte; wunsch: string; mau: boolean }
  | { art: 'ziehen' }
  | { art: 'behalten' }

/** Wer als Nächstes drankommt -- für die Frage, ob sich Angriff lohnt. */
function naechsterSpieler(state: MauZustand): MauSpieler {
  const n = state.spieler.length
  return state.spieler[(state.amZug + state.richtung + n) % n]!
}

function wuerfel(state: MauZustand): number {
  return createRng(`${state.seed}:ki:${state.ablage.length}:${state.amZug}:${state.zaehler}`)()
}

/**
 * Wie gern wird diese Karte gelegt? Höher ist besser.
 *
 * Die Reihenfolge der Gründe ist das eigentliche Spiel:
 *   1. Wer fast fertig ist, bekommt eine Aktionskarte ab.
 *   2. Schwarze Karten sind zu schade -- sie passen immer, also später.
 *   3. Teure Karten zuerst, solange die Hand noch gross ist.
 *   4. Bei gleichem Rang die Farbe, von der man ohnehin viel hat.
 */
function bewerte(karte: Karte, state: MauZustand, ich: MauSpieler): number {
  const naechster = naechsterSpieler(state)
  const bedroht = naechster.hand.length <= 2
  const schwarz = karte.farbe === null
  const aktion = karte.wirkung !== 'keine' && karte.wirkung !== 'haende'

  let wert = karte.punkte * 0.5
  if (aktion && bedroht) wert += 60
  if (schwarz) wert -= 45
  if (karte.wirkung === 'zieh2' || karte.wirkung === 'zieh4') wert += bedroht ? 20 : 5
  if (karte.farbe && karte.farbe === haeufigsteFarbe(ich)) wert += 8
  // Die Null verschiebt die Hände -- gut, wenn die eigene gross ist.
  if (karte.wirkung === 'haende' && regelnVon(state).haendeWandern) {
    const fremdeKleinste = Math.min(
      ...state.spieler.filter((s) => s.id !== ich.id).map((s) => s.hand.length),
    )
    wert += ich.hand.length > fremdeKleinste ? 40 : -10
  }
  return wert
}

export function kiZug(state: MauZustand): KiZug {
  const ich = amZugSpieler(state)
  const moeglich = meineSpielbaren(state, ich)

  if (moeglich.length === 0) {
    return state.gezogene ? { art: 'behalten' } : { art: 'ziehen' }
  }

  const stufe = ich.kiStufe ?? 'normal'
  let gewaehlt = moeglich[0]!
  if (stufe !== 'leicht') {
    let beste = -Infinity
    for (const k of moeglich) {
      const wert = bewerte(k, state, ich)
      if (wert > beste) {
        beste = wert
        gewaehlt = k
      }
    }
  }

  /*
   * Die Wunschfarbe: die eigene häufigste -- aber ohne die Karte, die
   * gerade weggeht. Wer seinen letzten Roten legt und sich Rot wünscht,
   * hat sich selbst eingemauert.
   */
  const rest: MauSpieler = { ...ich, hand: ich.hand.filter((k) => k.id !== gewaehlt.id) }
  const wunsch = haeufigsteFarbe(rest.hand.length > 0 ? rest : ich)

  // „Leicht" vergisst manchmal, Mau zu sagen -- wie am Küchentisch.
  const vergisst = stufe === 'leicht' && wuerfel(state) < 0.35
  const mau = ich.hand.length === 2 && !vergisst

  void oberste(state)
  return { art: 'legen', karte: gewaehlt, wunsch, mau }
}
