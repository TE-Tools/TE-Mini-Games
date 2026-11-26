/**
 * Dame – der Computergegner.
 *
 * Negamax mit Alpha-Beta-Schnitt. Am Ende der Suche rechnet die Ruhesuche
 * Schlagfolgen zu Ende: Wer nach dem letzten gerechneten Zug schlagen muss,
 * schlägt erst, bevor bewertet wird -- sonst hielte der Computer einen Zug
 * für gut, nach dem er zwei Steine verliert. Die schwere Stufe vertieft
 * Schritt für Schritt, bis die Bedenkzeit um ist.
 *
 * Bewertet wird Material (Steine, Damen), wie weit die Steine vorgerückt
 * sind, wer die Mitte hält und wer seine Grundreihe noch bewacht; liegt
 * eine Seite vorn, sind ihr Täusche willkommen. Alle Zahlen in `config.ts`.
 *
 * Zufall nur über den mitgegebenen Startwert: Mit demselben Startwert und
 * derselben Tiefe zieht er dasselbe. Das macht ihn prüfbar.
 */

import { mulberry32 } from '@/games/rng'
import { REMIS, STUFEN, WERTE, type DameRegeln, type DameStufe, type StufenWerte } from './config'
import {
  STEIN,
  ausText,
  erlaubteZuege,
  kurz,
  linieVon,
  reiheVon,
  schluessel,
  ziehe,
  type Stellung,
  type Zug,
} from './brett'

const SIEG = 30000
const UNENDLICH = 100000
/** Tiefer rechnet die Ruhesuche nicht -- Schlagfolgen enden ohnehin bald. */
const RUHE_GRENZE = 64

const MITTE = new Set(
  Array.from({ length: 64 }, (_, f) => f).filter(
    (f) => reiheVon(f) >= 2 && reiheVon(f) <= 5 && linieVon(f) >= 2 && linieVon(f) <= 5,
  ),
)

/** Die Stellung aus Sicht der Seite am Zug, in Hundertstel Steinen. */
export function bewerte(s: Stellung, r: DameRegeln): number {
  let wert = 0
  let materialW = 0
  let materialB = 0
  let anzahl = 0
  const dame = r.fliegendeDame ? WERTE.dame : WERTE.dameKurz
  for (let feld = 0; feld < 64; feld++) {
    const figur = s.brett[feld]!
    if (figur === 0) continue
    anzahl++
    const vz = figur > 0 ? 1 : -1
    let w: number
    if (Math.abs(figur) === STEIN) {
      const reihe = vz > 0 ? reiheVon(feld) : 7 - reiheVon(feld)
      w = WERTE.stein + WERTE.vorruecken[reihe]!
      if (reihe === 0) w += WERTE.rueckreihe
      if (vz > 0) materialW += WERTE.stein
      else materialB += WERTE.stein
    } else {
      w = dame
      if (vz > 0) materialW += dame
      else materialB += dame
    }
    if (MITTE.has(feld)) w += WERTE.mitte
    wert += vz * w
  }
  // Vorn liegen und tauschen: Je leerer das Brett, desto klarer der Vorsprung.
  if (materialW !== materialB) {
    wert += Math.sign(materialW - materialB) * (24 - anzahl) * WERTE.tauschen
  }
  return s.amZug === 'w' ? wert : -wert
}

interface Suche {
  r: DameRegeln
  werte: StufenWerte
  ende: number
  knoten: number
  abgebrochen: boolean
}

function zeitUm(su: Suche): boolean {
  if ((su.knoten & 1023) === 0 && performance.now() > su.ende) su.abgebrochen = true
  return su.abgebrochen
}

/** Schlagen zuerst, lange Folgen vor kurzen, Umwandlungen vor stillen Zügen. */
function ordne(liste: Zug[], zuerst?: string): Zug[] {
  const gewicht = (z: Zug) =>
    (zuerst && kurz(z) === zuerst ? 1000 : 0) + z.geschlagen.length * 10 + (z.wirdDame ? 5 : 0)
  return [...liste].sort((a, b) => gewicht(b) - gewicht(a))
}

function ruhe(
  s: Stellung,
  alpha: number,
  beta: number,
  ply: number,
  su: Suche,
  liste: Zug[],
): number {
  su.knoten++
  if (zeitUm(su)) return 0
  if (liste.length === 0) return -SIEG + ply
  const schlaege = liste.filter((z) => z.geschlagen.length > 0)
  const erzwungen = su.r.schlagzwang && schlaege.length > 0
  let bester = -UNENDLICH
  if (!erzwungen || ply >= RUHE_GRENZE) {
    // Stillhalten ist eine Möglichkeit -- außer, man muss schlagen.
    bester = bewerte(s, su.r)
    if (bester >= beta || schlaege.length === 0 || ply >= RUHE_GRENZE) return bester
    if (bester > alpha) alpha = bester
  }
  for (const z of ordne(schlaege)) {
    const nach = ziehe(s, z)
    const wert = -ruhe(nach, -beta, -alpha, ply + 1, su, erlaubteZuege(nach, su.r))
    if (su.abgebrochen) return 0
    if (wert > bester) bester = wert
    if (wert > alpha) alpha = wert
    if (alpha >= beta) break
  }
  return bester
}

function suche(
  s: Stellung,
  tiefe: number,
  alpha: number,
  beta: number,
  ply: number,
  su: Suche,
): number {
  su.knoten++
  if (zeitUm(su)) return 0
  const liste = erlaubteZuege(s, su.r)
  if (liste.length === 0) return -SIEG + ply
  if (tiefe <= 0) {
    return su.werte.ruhesuche ? ruhe(s, alpha, beta, ply, su, liste) : bewerte(s, su.r)
  }
  let bester = -UNENDLICH
  for (const z of ordne(liste)) {
    const wert = -suche(ziehe(s, z), tiefe - 1, -beta, -alpha, ply + 1, su)
    if (su.abgebrochen) return 0
    if (wert > bester) bester = wert
    if (wert > alpha) alpha = wert
    if (alpha >= beta) break
  }
  return bester
}

export interface Bewerteter {
  zug: string
  wert: number
}

/**
 * Jeden Zug an der Wurzel bewerten. Ein Zug, der eine Stellung zum dritten
 * Mal herbeiführt, ist Remis (0) -- gut, wenn er schlechter steht.
 */
function alleBewerten(
  s: Stellung,
  verlauf: readonly string[],
  tiefe: number,
  su: Suche,
  zuerst?: string,
): Bewerteter[] {
  const ergebnis: Bewerteter[] = []
  let alpha = -UNENDLICH
  for (const z of ordne(erlaubteZuege(s, su.r), zuerst)) {
    const nach = ziehe(s, z)
    const k = schluessel(nach)
    const wiederholt = verlauf.filter((v) => v === k).length >= REMIS.wiederholungen - 1
    // Mit Rauschen braucht jeder Zug seinen echten Wert; ohne genügt ein Schnitt.
    const breit = su.werte.rauschen > 0 || su.werte.zufall > 0
    const wert = wiederholt
      ? 0
      : -suche(nach, tiefe - 1, -UNENDLICH, breit ? UNENDLICH : -alpha, 1, su)
    if (su.abgebrochen) break
    ergebnis.push({ zug: kurz(z), wert })
    if (wert > alpha) alpha = wert
  }
  return ergebnis
}

/** Schwer: Schritt für Schritt tiefer, bis die Zeit um ist. */
function vertiefen(s: Stellung, verlauf: readonly string[], su: Suche): string | null {
  const liste = erlaubteZuege(s, su.r)
  if (liste.length === 0) return null
  if (liste.length === 1) return kurz(liste[0]!)
  let bester = kurz(ordne(liste)[0]!)
  for (let tiefe = 1; tiefe <= su.werte.tiefe; tiefe++) {
    const runde = alleBewerten(s, verlauf, tiefe, su, bester)
    if (runde.length === 0) break
    const vorn = runde.reduce((b, x) => (x.wert > b.wert ? x : b), runde[0]!)
    /*
     * Eine halbe Runde zählt auch: Der alte beste Zug wird zuerst gerechnet,
     * und was danach fertig wurde und mehr bringt, ist genau gerechnet.
     */
    if (su.abgebrochen) {
      if (runde[0]!.zug === bester) bester = vorn.zug
      break
    }
    bester = vorn.zug
    // Einen gefundenen Gewinn macht tieferes Rechnen nicht besser.
    if (vorn.wert > SIEG - 100 || vorn.wert < -SIEG + 100) break
  }
  return bester
}

export interface KiAuftrag {
  /** Die Stellung als Text (`alsText`). */
  stellung: string
  regeln: DameRegeln
  /** Die Schlüssel der bisherigen Stellungen -- für die Wiederholungsregel. */
  verlauf: readonly string[]
  stufe: DameStufe
  seed: number
  /** Nur für Tests: andere Werte als die der Stufe. */
  werte?: Partial<StufenWerte>
}

/** Den Zug des Computers bestimmen. Liefert null, wenn es keinen gibt. */
export function waehleZug(auftrag: KiAuftrag): string | null {
  const werte = { ...STUFEN[auftrag.stufe], ...auftrag.werte }
  const s = ausText(auftrag.stellung)
  const su: Suche = {
    r: auftrag.regeln,
    werte,
    ende: performance.now() + werte.zeitMs,
    knoten: 0,
    abgebrochen: false,
  }
  if (werte.rauschen === 0 && werte.zufall === 0) return vertiefen(s, auftrag.verlauf, su)

  // Leicht und mittel: feste Tiefe, ohne Uhr -- sie sind ohnehin schnell.
  su.ende = Infinity
  const bewertet = alleBewerten(s, auftrag.verlauf, werte.tiefe, su)
  if (bewertet.length === 0) return null
  // Einen Sieg lässt keine Stufe liegen, auch nicht mit dem gelegentlichen Zufallszug.
  const sieg = bewertet.find((b) => b.wert > SIEG - 100)
  if (sieg) return sieg.zug
  const zufall = mulberry32(auftrag.seed)
  if (zufall() < werte.zufall) return bewertet[Math.floor(zufall() * bewertet.length)]!.zug
  let bester = bewertet[0]!
  let besterWert = -Infinity
  for (const b of bewertet) {
    const rausch = Math.abs(b.wert) > SIEG - 100 ? 0 : (zufall() * 2 - 1) * werte.rauschen
    if (b.wert + rausch > besterWert) {
      besterWert = b.wert + rausch
      bester = b
    }
  }
  return bester.zug
}
