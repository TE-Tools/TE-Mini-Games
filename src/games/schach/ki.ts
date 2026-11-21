/**
 * Schach – der Computergegner.
 *
 * Ein Negamax mit Alpha-Beta-Schnitt, Ruhesuche für Schlagabtausche und
 * iterativer Vertiefung bei der schweren Stufe. Bewertet wird Material plus
 * Feldtabellen (wo steht eine Figur gut?), im gewonnenen Endspiel dazu, wie
 * weit der gegnerische König am Rand steht.
 *
 * Diese Mattführung ist ein kleiner Gewinn, kein Muss -- gemessen
 * (19.11.2026, schwere Stufe aus der Mitte des Bretts): mit Dame matt nach
 * 9 statt 11 Zügen, mit Turm nach 15 statt 18. Bei einem Zehntel der
 * Bedenkzeit, wie auf einem langsamen Handy, dasselbe Bild (10/11, 15/18).
 * Mattsetzen kann er auch ohne sie.
 *
 * Zufall nur über den mitgegebenen Startwert: Mit demselben Startwert zieht
 * er dasselbe. Das macht ihn prüfbar.
 *
 * Die Wiederholungsregel prüft er nur an der Wurzel: Ein Zug, der die
 * Stellung zum dritten Mal herbeiführt, ist Remis -- gut, wenn er schlechter
 * steht, schlecht, wenn er gewinnt. Tiefer im Baum sähe er das nur mit
 * deutlich mehr Rechenaufwand.
 */

import { mulberry32 } from '@/games/rng'
import { STUFEN, WERTE, type SchachStufe, type StufenWerte } from './config'
import { BAUER, DAME, KOENIG, LAEUFER, Stellung, TURM, uci, type Zug } from './stellung'

const MATT = 30000
const UNENDLICH = 100000

/* Feldtabellen aus Sicht von Weiß, Reihe 8 oben -- wie man ein Brett liest. */
// prettier-ignore
const TAB_BAUER = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
]
// prettier-ignore
const TAB_SPRINGER = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
]
// prettier-ignore
const TAB_LAEUFER = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
]
// prettier-ignore
const TAB_TURM = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
]
// prettier-ignore
const TAB_DAME = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
]
// prettier-ignore
const TAB_KOENIG_MITTE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
]
// prettier-ignore
const TAB_KOENIG_ENDE = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
]

const TABELLEN = [[], TAB_BAUER, TAB_SPRINGER, TAB_LAEUFER, TAB_TURM, TAB_DAME]

/** Wo in einer Tabelle ein Feld steht, aus Sicht der Farbe. */
function index(feld: number, weiss: boolean): number {
  const reihe = feld >> 4
  const linie = feld & 7
  return (weiss ? 7 - reihe : reihe) * 8 + linie
}

/* Bauernstruktur und Figurenstellung, Mittelspiel / Endspiel, Hundertstel Bauern. */
/** Freibauer nach Reihe aus eigener Sicht (0 = Grundreihe). */
const FREI_MITTE = [0, 5, 10, 15, 25, 40, 60, 0]
const FREI_ENDE = [0, 10, 20, 35, 55, 85, 120, 0]
const DOPPEL = [12, 20]
const ISOLIERT = [10, 15]
const LAEUFERPAAR = [30, 45]
const TURM_OFFEN = [20, 10]
const TURM_HALBOFFEN = [10, 5]
/** Ein eigener Bauer direkt bzw. zwei Felder vor dem König (nur Mittelspiel). */
const SCHILD = [12, 6]

/**
 * Die Stellung aus Sicht dessen, der am Zug ist. Positiv: gut für ihn.
 */
export function bewerte(s: Stellung): number {
  let mitte = 0
  let ende = 0
  let phase = 0
  const material: [number, number] = [0, 0]
  // Bauern je Linie, und die vorderste/hinterste Reihe je Linie für Freibauern.
  const bauern = [new Int8Array(8), new Int8Array(8)]
  const laeufer = [0, 0]
  const tuerme: number[] = []
  const bauernFelder: number[] = []
  for (let feld = 0; feld < 128; feld++) {
    if (feld & 0x88) {
      feld += 7
      continue
    }
    const f = s.brett[feld]!
    if (f === 0) continue
    const weiss = f > 0
    const art = weiss ? f : -f
    const vz = weiss ? 1 : -1
    const i = index(feld, weiss)
    if (art === KOENIG) {
      mitte += vz * TAB_KOENIG_MITTE[i]!
      ende += vz * TAB_KOENIG_ENDE[i]!
      continue
    }
    const wert = WERTE[art]! + TABELLEN[art]![i]!
    mitte += vz * wert
    ende += vz * wert
    if (art === BAUER) {
      bauern[weiss ? 0 : 1]![feld & 7]!++
      bauernFelder.push(feld)
    } else {
      phase += art === DAME ? 4 : art === TURM ? 2 : 1
      material[weiss ? 0 : 1] += WERTE[art]!
      if (art === LAEUFER) laeufer[weiss ? 0 : 1]!++
      if (art === TURM) tuerme.push(feld)
    }
  }

  for (const feld of bauernFelder) {
    const weiss = s.brett[feld]! > 0
    const vz = weiss ? 1 : -1
    const eigene = bauern[weiss ? 0 : 1]!
    const fremde = bauern[weiss ? 1 : 0]!
    const linie = feld & 7
    const reihe = feld >> 4
    if (!(linie > 0 && eigene[linie - 1]) && !(linie < 7 && eigene[linie + 1])) {
      mitte -= vz * ISOLIERT[0]!
      ende -= vz * ISOLIERT[1]!
    }
    // Freibauer: Vor ihm, auf seiner und den Nachbarlinien, kein fremder Bauer.
    let frei = true
    for (let l = Math.max(0, linie - 1); l <= Math.min(7, linie + 1) && frei; l++) {
      if (!fremde[l]) continue
      for (let r = reihe + vz; r >= 0 && r <= 7; r += vz) {
        if (s.brett[r * 16 + l] === -vz * BAUER) {
          frei = false
          break
        }
      }
    }
    if (frei) {
      const eigeneReihe = weiss ? reihe : 7 - reihe
      mitte += vz * FREI_MITTE[eigeneReihe]!
      ende += vz * FREI_ENDE[eigeneReihe]!
    }
  }
  for (let farbe = 0; farbe < 2; farbe++) {
    const vz = farbe === 0 ? 1 : -1
    for (let l = 0; l < 8; l++) {
      const n = bauern[farbe]![l]!
      if (n > 1) {
        mitte -= vz * DOPPEL[0]! * (n - 1)
        ende -= vz * DOPPEL[1]! * (n - 1)
      }
    }
    if (laeufer[farbe]! >= 2) {
      mitte += vz * LAEUFERPAAR[0]!
      ende += vz * LAEUFERPAAR[1]!
    }
  }
  for (const feld of tuerme) {
    const weiss = s.brett[feld]! > 0
    const vz = weiss ? 1 : -1
    const l = feld & 7
    if (!bauern[weiss ? 0 : 1]![l]) {
      const offen = !bauern[weiss ? 1 : 0]![l]
      mitte += vz * (offen ? TURM_OFFEN[0]! : TURM_HALBOFFEN[0]!)
      ende += vz * (offen ? TURM_OFFEN[1]! : TURM_HALBOFFEN[1]!)
    }
  }
  // Königsschutz: Bauern vor dem König, solange noch Figuren zum Angreifen da sind.
  for (let farbe = 0; farbe < 2; farbe++) {
    const k = s.koenig[farbe]!
    if (k < 0) continue
    const vz = farbe === 0 ? 1 : -1
    const eigeneReihe = farbe === 0 ? k >> 4 : 7 - (k >> 4)
    if (eigeneReihe > 1) continue
    for (let l = Math.max(0, (k & 7) - 1); l <= Math.min(7, (k & 7) + 1); l++) {
      const eins = k + 16 * vz - (k & 7) + l
      const zwei = eins + 16 * vz
      if (!(eins & 0x88) && s.brett[eins] === vz * BAUER) mitte += vz * SCHILD[0]!
      else if (!(zwei & 0x88) && s.brett[zwei] === vz * BAUER) mitte += vz * SCHILD[1]!
    }
  }

  // 24 = alle Figuren auf dem Brett (2 Damen, 4 Türme, 8 Leichtfiguren).
  const p = Math.min(phase, 24)
  let wert = (mitte * p + ende * (24 - p)) / 24

  // Mattführung: Wer klar vorn liegt, treibt den König an den Rand und
  // rückt mit dem eigenen nach (siehe oben: schneller, nicht nötig).
  const vorsprung = material[0]! - material[1]!
  if (p <= 8 && Math.abs(vorsprung) >= 300) {
    const sieger = vorsprung > 0 ? 0 : 1
    const verlierer = s.koenig[1 - sieger]!
    const eigener = s.koenig[sieger]!
    const randAbstand = (feld: number) =>
      Math.max(3 - (feld >> 4), (feld >> 4) - 4) + Math.max(3 - (feld & 7), (feld & 7) - 4)
    const nah =
      14 - (Math.abs((eigener >> 4) - (verlierer >> 4)) + Math.abs((eigener & 7) - (verlierer & 7)))
    const zug = randAbstand(verlierer) * 10 + nah * 4
    wert += sieger === 0 ? zug : -zug
  }
  return Math.round(wert) * s.seite
}

interface Suche {
  werte: StufenWerte
  ende: number
  knoten: number
  abgebrochen: boolean
  killer: Zug[][]
  /** Wie oft ein ruhiger Zug (Figur, Zielfeld) zum Schnitt führte. */
  verlauf: Int32Array
  /** Die Kennungen der Stellungen bis hierher: Partie, dann der Suchpfad. */
  pfadA: number[]
  pfadB: number[]
}

/* ---------------------------------------------- Verwandlungstabelle
 * Das Gedächtnis der Suche: Was eine Stellung schon einmal ergab, und
 * welcher Zug dort der beste war. Dieselbe Stellung kommt auf vielen Wegen
 * zustande (Sf3 und Sc3 oder Sc3 und Sf3); ohne Gedächtnis rechnet die
 * Suche sie jedes Mal neu. Und der gemerkte beste Zug zuerst gespielt
 * macht Alpha-Beta erst richtig scharf. */
const TT_BITS = 19
const TT_GROESSE = 1 << TT_BITS
const ttPruef = new Int32Array(TT_GROESSE)
const ttZug = new Int32Array(TT_GROESSE)
const ttWert = new Int32Array(TT_GROESSE)
const ttTiefe = new Int8Array(TT_GROESSE)
/** 0 leer, 1 genau, 2 mindestens (Schnitt), 3 höchstens. */
const ttArt = new Uint8Array(TT_GROESSE)
const GENAU = 1
const MINDESTENS = 2
const HOECHSTENS = 3

function zugCode(z: Zug): number {
  return z.von | (z.nach << 7) | (z.umwandlung << 14)
}

/* Matt-Werte hängen davon ab, wie weit das Matt vom Wurzelknoten weg ist.
 * In der Tabelle stehen sie relativ zum Knoten selbst. */
function wertInTabelle(wert: number, ply: number): number {
  if (wert > MATT - 1000) return wert + ply
  if (wert < -MATT + 1000) return wert - ply
  return wert
}
function wertAusTabelle(wert: number, ply: number): number {
  if (wert > MATT - 1000) return wert - ply
  if (wert < -MATT + 1000) return wert + ply
  return wert
}

function merke(
  s: Stellung,
  tiefe: number,
  wert: number,
  art: number,
  zug: Zug | null,
  ply: number,
) {
  const i = s.hashA & (TT_GROESSE - 1)
  // Tiefere Ergebnisse derselben Stellung nicht durch flachere ersetzen.
  if (ttArt[i] && ttPruef[i] === s.hashB && ttTiefe[i]! > tiefe) return
  ttPruef[i] = s.hashB
  ttZug[i] = zug ? zugCode(zug) : 0
  ttWert[i] = wertInTabelle(wert, ply)
  ttTiefe[i] = tiefe
  ttArt[i] = art
}

function gleich(a: Zug | undefined, b: Zug): boolean {
  return Boolean(a) && a!.von === b.von && a!.nach === b.nach && a!.umwandlung === b.umwandlung
}

/** Gute Züge zuerst: Dann schneidet Alpha-Beta mehr weg. */
function ordne(
  zuege: Zug[],
  erster: number,
  killer: Zug[] | undefined,
  verlauf: Int32Array | null,
): Zug[] {
  const wert = (z: Zug) => {
    if (erster && zugCode(z) === erster) return 1e9
    if (z.geschlagen)
      return 1e8 + 10 * WERTE[Math.abs(z.geschlagen)]! - WERTE[Math.abs(z.figur)]! / 10
    if (z.umwandlung) return 9e7 + WERTE[z.umwandlung]!
    if (killer && (gleich(killer[0], z) || gleich(killer[1], z))) return 8e7
    return verlauf ? verlauf[(z.figur + 6) * 128 + z.nach]! : 0
  }
  return zuege
    .map((z) => ({ z, w: wert(z) }))
    .sort((a, b) => b.w - a.w)
    .map((e) => e.z)
}

function zeitUm(su: Suche): boolean {
  if ((su.knoten & 1023) === 0 && performance.now() > su.ende) su.abgebrochen = true
  return su.abgebrochen
}

/** Stand diese Stellung seit dem letzten Bauernzug oder Schlagen schon einmal da? */
function wiederholt(s: Stellung, su: Suche): boolean {
  const n = su.pfadA.length
  const grenze = Math.max(0, n - 1 - s.halbzuege)
  for (let i = n - 3; i >= grenze; i -= 2) {
    if (su.pfadA[i] === s.hashA && su.pfadB[i] === s.hashB) return true
  }
  return false
}

/** Hat die Seite am Zug noch etwas außer Bauern? Sonst ist der Nullzug gefährlich (Zugzwang). */
function hatFiguren(s: Stellung): boolean {
  for (let q = 0; q < 128; q++) {
    if (q & 0x88) {
      q += 7
      continue
    }
    const f = s.brett[q]! * s.seite
    if (f > BAUER && f < KOENIG) return true
  }
  return false
}

function ruhe(s: Stellung, alpha: number, beta: number, su: Suche, ply: number): number {
  su.knoten++
  if (zeitUm(su)) return 0
  const stehen = bewerte(s)
  if (stehen >= beta) return beta
  if (stehen > alpha) alpha = stehen
  if (ply > 40) return alpha
  for (const z of ordne(s.pseudoZuege(true), 0, undefined, null)) {
    // Ein Schlag, der selbst im besten Fall nicht an Alpha heranreicht, lohnt nicht.
    if (!z.umwandlung && stehen + WERTE[Math.abs(z.geschlagen)]! + 200 < alpha) continue
    s.ziehe(z)
    if (s.imSchach(-s.seite)) {
      s.nimmZurueck()
      continue
    }
    const wert = -ruhe(s, -beta, -alpha, su, ply + 1)
    s.nimmZurueck()
    if (su.abgebrochen) return 0
    if (wert >= beta) return beta
    if (wert > alpha) alpha = wert
  }
  return alpha
}

function ziehe(s: Stellung, z: Zug | null, su: Suche) {
  if (z) s.ziehe(z)
  else s.zieheNull()
  su.pfadA.push(s.hashA)
  su.pfadB.push(s.hashB)
}
function zurueck(s: Stellung, su: Suche) {
  s.nimmZurueck()
  su.pfadA.pop()
  su.pfadB.pop()
}

function suche(
  s: Stellung,
  tiefe: number,
  alpha: number,
  beta: number,
  su: Suche,
  ply: number,
  nullErlaubt = true,
): number {
  if (ply > 0 && (s.halbzuege >= 100 || wiederholt(s, su))) return 0
  if (tiefe <= 0) {
    if (su.werte.ruhesuche) return ruhe(s, alpha, beta, su, ply)
    su.knoten++
    return bewerte(s)
  }
  su.knoten++
  if (zeitUm(su)) return 0

  const i = s.hashA & (TT_GROESSE - 1)
  let tabellenZug = 0
  if (ttArt[i] && ttPruef[i] === s.hashB) {
    tabellenZug = ttZug[i]!
    if (ttTiefe[i]! >= tiefe) {
      const w = wertAusTabelle(ttWert[i]!, ply)
      if (ttArt[i] === GENAU) return w
      if (ttArt[i] === MINDESTENS && w >= beta) return w
      if (ttArt[i] === HOECHSTENS && w <= alpha) return w
    }
  }

  const imSchach = s.imSchach()
  // Wer im Schach steht, hat wenig Auswahl -- eine Ebene mehr kostet kaum.
  if (imSchach) tiefe++

  // Nullzug: Steht man sogar nach einem ausgelassenen Zug noch über Beta,
  // braucht es hier keine genaue Rechnung.
  if (nullErlaubt && !imSchach && tiefe >= 3 && beta < MATT - 1000 && hatFiguren(s)) {
    if (bewerte(s) >= beta) {
      ziehe(s, null, su)
      const r = tiefe >= 6 ? 3 : 2
      const wert = -suche(s, tiefe - 1 - r, -beta, -beta + 1, su, ply + 1, false)
      zurueck(s, su)
      if (su.abgebrochen) return 0
      if (wert >= beta) return beta
    }
  }

  const alphaVorher = alpha
  let besterWert = -UNENDLICH
  let besterZug: Zug | null = null
  let legal = 0
  for (const z of ordne(s.pseudoZuege(), tabellenZug, su.killer[ply], su.verlauf)) {
    ziehe(s, z, su)
    if (s.imSchach(-s.seite)) {
      zurueck(s, su)
      continue
    }
    legal++
    let wert: number
    if (legal === 1) {
      wert = -suche(s, tiefe - 1, -beta, -alpha, su, ply + 1)
    } else {
      // Späte, ruhige Züge sind selten die besten: erst flacher prüfen und
      // nur genau nachrechnen, wenn sie doch etwas taugen.
      const ruhig = !z.geschlagen && !z.umwandlung && !imSchach && !s.imSchach()
      const r = ruhig && tiefe >= 3 && legal > 3 ? (legal > 10 ? 2 : 1) : 0
      wert = -suche(s, tiefe - 1 - r, -alpha - 1, -alpha, su, ply + 1)
      if (wert > alpha && r > 0) wert = -suche(s, tiefe - 1, -alpha - 1, -alpha, su, ply + 1)
      if (wert > alpha && wert < beta) wert = -suche(s, tiefe - 1, -beta, -alpha, su, ply + 1)
    }
    zurueck(s, su)
    if (su.abgebrochen) return 0
    if (wert > besterWert) {
      besterWert = wert
      besterZug = z
    }
    if (wert > alpha) alpha = wert
    if (alpha >= beta) {
      if (!z.geschlagen && !z.umwandlung) {
        const k = (su.killer[ply] ??= [])
        if (!gleich(k[0], z)) {
          k[1] = k[0]!
          k[0] = z
        }
        su.verlauf[(z.figur + 6) * 128 + z.nach]! += tiefe * tiefe
      }
      merke(s, tiefe, besterWert, MINDESTENS, z, ply)
      return besterWert
    }
  }
  if (legal === 0) return imSchach ? -MATT + ply : 0
  merke(s, tiefe, besterWert, alpha > alphaVorher ? GENAU : HOECHSTENS, besterZug, ply)
  return besterWert
}

/**
 * Was ein Zug an der Wurzel sofort ergibt: Remis durch Wiederholung oder
 * 50 Züge, Matt oder Patt. null, wenn weitergerechnet werden muss.
 *
 * Matt in einem Zug sieht damit jede Stufe -- auch die leichte, die nach
 * ihrem Zug sonst nur noch die Stellung ansieht und nicht, ob der Gegner
 * überhaupt noch ziehen kann.
 */
function sofort(s: Stellung, verlauf: readonly string[]): number | null {
  if (s.legaleZuege().length === 0) return s.imSchach() ? MATT : 0
  if (s.halbzuege >= 100) return 0
  if (verlauf.filter((k) => k === s.schluessel()).length >= 2) return 0
  return null
}

export interface Bewerteter {
  zug: string
  wert: number
}

/**
 * Jeden Zug an der Wurzel genau bewerten -- für die Stufen, die sich
 * verschätzen dürfen. Ohne den ganzen Bereich wüsste man nur, welcher Zug
 * der beste ist, nicht, wie knapp die anderen dahinter liegen.
 */
function alleBewerten(s: Stellung, verlauf: readonly string[], su: Suche): Bewerteter[] {
  const ergebnis: Bewerteter[] = []
  for (const z of ordne(s.legaleZuege(), 0, undefined, null)) {
    ziehe(s, z, su)
    const wert = sofort(s, verlauf) ?? -suche(s, su.werte.tiefe - 1, -UNENDLICH, UNENDLICH, su, 1)
    zurueck(s, su)
    ergebnis.push({ zug: uci(z), wert })
  }
  return ergebnis
}

/** Iterative Vertiefung: Tiefe um Tiefe, bis die Zeit um ist. */
function vertiefen(s: Stellung, verlauf: readonly string[], su: Suche): string | null {
  const zuege = s.legaleZuege()
  if (zuege.length === 0) return null
  let bester: Zug = zuege[0]!
  for (let tiefe = 1; tiefe <= su.werte.tiefe; tiefe++) {
    let alpha = -UNENDLICH
    let besterHier: Zug | null = null
    let erster = true
    for (const z of ordne(zuege, zugCode(bester), undefined, su.verlauf)) {
      ziehe(s, z, su)
      let wert = sofort(s, verlauf)
      if (wert === null) {
        if (erster) wert = -suche(s, tiefe - 1, -UNENDLICH, -alpha, su, 1)
        else {
          wert = -suche(s, tiefe - 1, -alpha - 1, -alpha, su, 1)
          if (wert > alpha && !su.abgebrochen)
            wert = -suche(s, tiefe - 1, -UNENDLICH, -alpha, su, 1)
        }
      }
      zurueck(s, su)
      if (su.abgebrochen) break
      erster = false
      if (wert > alpha) {
        alpha = wert
        besterHier = z
      }
    }
    // Eine abgebrochene Tiefe zählt nur, wenn sie schon einen besseren Zug fand.
    if (besterHier) bester = besterHier
    if (su.abgebrochen) break
    // Ein gefundenes Matt wird durch tieferes Suchen nicht besser.
    if (alpha > MATT - 100) break
  }
  return uci(bester)
}

export interface KiAuftrag {
  fen: string
  /** Die Schlüssel der bisherigen Stellungen -- für die Wiederholungsregel. */
  verlauf: readonly string[]
  stufe: SchachStufe
  seed: number
  /** Nur für Tests: andere Werte als die der Stufe. */
  werte?: Partial<StufenWerte>
}

/** Den Zug des Computers bestimmen. Liefert null, wenn es keinen gibt. */
export function waehleZug(auftrag: KiAuftrag): string | null {
  const werte = { ...STUFEN[auftrag.stufe], ...auftrag.werte }
  const s = Stellung.ausFen(auftrag.fen)
  // Jede Frage fängt mit leerem Gedächtnis an: Derselbe Auftrag ergibt so
  // denselben Zug, egal was vorher gefragt wurde.
  ttArt.fill(0)
  const su: Suche = {
    werte,
    ende: performance.now() + werte.zeitMs,
    knoten: 0,
    abgebrochen: false,
    killer: [],
    verlauf: new Int32Array(13 * 128),
    pfadA: [],
    pfadB: [],
  }
  // Die Partie bis hierher -- für die Wiederholungen in der Suche.
  for (const k of auftrag.verlauf) {
    try {
      const v = Stellung.ausFen(k)
      su.pfadA.push(v.hashA)
      su.pfadB.push(v.hashB)
    } catch {
      // Was sich nicht lesen lässt, kann sich auch nicht wiederholen.
      su.pfadA.push(0)
      su.pfadB.push(0)
    }
  }
  if (su.pfadA.at(-1) !== s.hashA || su.pfadB.at(-1) !== s.hashB) {
    su.pfadA.push(s.hashA)
    su.pfadB.push(s.hashB)
  }
  const zufall = mulberry32(auftrag.seed)

  if (werte.rauschen === 0 && werte.zufall === 0) return vertiefen(s, auftrag.verlauf, su)

  const bewertet = alleBewerten(s, auftrag.verlauf, su)
  if (bewertet.length === 0) return null
  // Ein Matt in einem Zug lässt keine Stufe liegen -- auch nicht mit dem
  // gelegentlichen Zufallszug. Alles andere wäre kein schwacher Gegner,
  // sondern ein seltsamer.
  const matt = bewertet.find((b) => b.wert === MATT)
  if (matt) return matt.zug
  if (zufall() < werte.zufall) return bewertet[Math.floor(zufall() * bewertet.length)]!.zug
  let bester = bewertet[0]!
  let besterWert = -Infinity
  for (const b of bewertet) {
    // Ein Matt bleibt ein Matt: Daran verschätzt sich keine Stufe.
    const rausch = Math.abs(b.wert) > MATT - 100 ? 0 : (zufall() * 2 - 1) * werte.rauschen
    if (b.wert + rausch > besterWert) {
      besterWert = b.wert + rausch
      bester = b
    }
  }
  return bester.zug
}
