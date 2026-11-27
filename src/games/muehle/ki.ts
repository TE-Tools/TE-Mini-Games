/**
 * Mühle – der Computergegner.
 *
 * Negamax mit Alpha-Beta-Schnitt. Am Ende der Rechnung schaut die
 * Ruhesuche noch nach Mühlen, die gerade zu schließen sind: Wer eine
 * schließen kann, darf (er muss nicht) -- sonst hielte der Computer einen
 * Zug für gut, nach dem der Gegner sofort einen Stein nimmt. Die schwere
 * Stufe vertieft Schritt für Schritt, bis die Bedenkzeit um ist, und merkt
 * sich Stellungen, die sie schon gerechnet hat (beim Mühle führen viele
 * Wege zur selben Stellung).
 *
 * Bewertet wird, was bei Mühle zählt: Steine (Hand und Brett),
 * geschlossene und offene Mühlen, Zwickmühlen, Beweglichkeit und
 * festgesetzte Steine, beim Setzen die Kreuzungspunkte. Alle Zahlen in
 * `config.ts`.
 *
 * Zufall nur über den mitgegebenen Startwert: Mit demselben Startwert und
 * derselben Tiefe zieht er dasselbe. Das macht ihn prüfbar.
 */

import { mulberry32 } from '@/games/rng'
import {
  REMIS,
  STEINE,
  STUFEN,
  WERTE,
  type MuehleRegeln,
  type MuehleStufe,
  type StufenWerte,
} from './config'
import {
  ANZAHL_FELDER,
  MUEHLEN,
  MUEHLEN_AN,
  NACHBARN,
  ausText,
  erlaubteZuege,
  kurz,
  phaseVon,
  schluessel,
  steineVon,
  vorzeichen,
  ziehe,
  type Farbe,
  type Stellung,
  type Zug,
} from './brett'

const SIEG = 30000
const UNENDLICH = 100000
/** So viele Halbzüge rechnet die Ruhesuche höchstens nach. */
const RUHE_TIEFE = 2

/** Wie eine Seite steht -- ohne Blick auf den Gegner. */
function seite(s: Stellung, f: Farbe, r: MuehleRegeln): number {
  const vz = vorzeichen(f)
  const b = s.brett
  let wert = steineVon(s, f) * WERTE.stein
  for (const m of MUEHLEN) {
    let eigene = 0
    let leer = 0
    for (const p of m) {
      if (b[p] === vz) eigene++
      else if (b[p] === 0) leer++
    }
    if (eigene === 3) wert += WERTE.muehle
    else if (eigene === 2 && leer === 1) wert += WERTE.offeneMuehle
  }
  const phase = phaseVon(s, f, r)
  for (let p = 0; p < ANZAHL_FELDER; p++) {
    if (b[p] !== vz) continue
    if (phase === 'setzen' && NACHBARN[p]!.length === 4) wert += WERTE.kreuzung
    // Schon beim Setzen zählt, ob die Steine später ziehen können.
    if (phase === 'springen') continue
    let frei = 0
    for (const n of NACHBARN[p]!) if (b[n] === 0) frei++
    wert += frei * WERTE.beweglichkeit
    if (frei === 0) wert -= WERTE.blockiert
  }
  if (phase === 'ziehen' && zwickmuehlen(b, vz) > 0) {
    wert += WERTE.zwickmuehle
  }
  return wert
}

/**
 * Wie viele Steine pendeln können: Der Stein steht in einer Mühle, und ein
 * Zug auf einen freien Nachbarn schließt sofort die nächste. Zieht er
 * zurück, ist die erste wieder zu -- jeder Zug eine Mühle.
 */
function zwickmuehlen(b: readonly number[], vz: number): number {
  let anzahl = 0
  for (let p = 0; p < ANZAHL_FELDER; p++) {
    if (b[p] !== vz) continue
    const inMuehle = MUEHLEN_AN[p]!.some((m) => MUEHLEN[m]!.every((x) => b[x] === vz))
    if (!inMuehle) continue
    const ziele = NACHBARN[p]!
    const pendelt = ziele.some(
      (q) =>
        b[q] === 0 &&
        MUEHLEN_AN[q]!.some((m) => {
          const linie = MUEHLEN[m]!
          return !linie.includes(p) && linie.every((x) => x === q || b[x] === vz)
        }),
    )
    if (pendelt) anzahl++
  }
  return anzahl
}

/** Die Stellung aus Sicht der Seite am Zug, in Hundertstel Steinen. */
export function bewerte(s: Stellung, r: MuehleRegeln): number {
  const gegner = s.amZug === 'w' ? 'b' : 'w'
  return seite(s, s.amZug, r) - seite(s, gegner, r)
}

interface Eintrag {
  tiefe: number
  wert: number
  art: 'genau' | 'unten' | 'oben'
  bester: string
}

interface Suche {
  r: MuehleRegeln
  werte: StufenWerte
  ende: number
  knoten: number
  abgebrochen: boolean
  tabelle: Map<string, Eintrag> | null
}

function zeitUm(su: Suche): boolean {
  if ((su.knoten & 1023) === 0 && performance.now() > su.ende) su.abgebrochen = true
  return su.abgebrochen
}

/** Schlagen zuerst, dann eine Mühle zu schließen, dann der Rest. */
function ordne(liste: Zug[], zuerst?: string): Zug[] {
  const gewicht = (z: Zug) =>
    (zuerst && kurz(z) === zuerst ? 1000 : 0) + z.schlag.length * 50 + z.muehlen.length * 5
  return [...liste].sort((a, b) => gewicht(b) - gewicht(a))
}

function ruhe(s: Stellung, alpha: number, beta: number, ply: number, rest: number, su: Suche) {
  su.knoten++
  if (zeitUm(su)) return 0
  if (steineVon(s, s.amZug) < STEINE.mindestens) return -SIEG + ply
  const liste = erlaubteZuege(s, su.r)
  if (liste.length === 0) return -SIEG + ply
  // Stillhalten ist eine Möglichkeit: Niemand muss eine Mühle schließen.
  const stand = bewerte(s, su.r)
  if (stand >= beta || rest <= 0) return stand
  let bester = stand
  if (stand > alpha) alpha = stand
  for (const z of liste) {
    if (z.schlag.length === 0) continue
    const wert = -ruhe(ziehe(s, z), -beta, -alpha, ply + 1, rest - 1, su)
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
  if (steineVon(s, s.amZug) < STEINE.mindestens) return -SIEG + ply
  if (tiefe <= 0) {
    if (su.werte.ruhesuche) return ruhe(s, alpha, beta, ply, RUHE_TIEFE, su)
    if (erlaubteZuege(s, su.r).length === 0) return -SIEG + ply
    return bewerte(s, su.r)
  }
  const liste = erlaubteZuege(s, su.r)
  if (liste.length === 0) return -SIEG + ply

  const k = su.tabelle ? `${schluessel(s)}/${s.ohneMuehle}` : ''
  const gemerkt = su.tabelle?.get(k)
  if (gemerkt && gemerkt.tiefe >= tiefe) {
    if (gemerkt.art === 'genau') return gemerkt.wert
    if (gemerkt.art === 'unten' && gemerkt.wert >= beta) return gemerkt.wert
    if (gemerkt.art === 'oben' && gemerkt.wert <= alpha) return gemerkt.wert
  }

  const alphaVorher = alpha
  let bester = -UNENDLICH
  let besterZug = ''
  for (const z of ordne(liste, gemerkt?.bester)) {
    const wert = -suche(ziehe(s, z), tiefe - 1, -beta, -alpha, ply + 1, su)
    if (su.abgebrochen) return 0
    if (wert > bester) {
      bester = wert
      besterZug = kurz(z)
    }
    if (wert > alpha) alpha = wert
    if (alpha >= beta) break
  }
  // Siegwerte hängen an der Entfernung zur Wurzel -- die merkt sich die Tabelle nicht.
  if (su.tabelle && Math.abs(bester) < SIEG - 1000) {
    su.tabelle.set(k, {
      tiefe,
      wert: bester,
      art: bester <= alphaVorher ? 'oben' : bester >= beta ? 'unten' : 'genau',
      bester: besterZug,
    })
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
  // Mit Rauschen braucht jeder Zug seinen echten Wert; ohne genügt ein Schnitt.
  const breit = su.werte.rauschen > 0 || su.werte.zufall > 0
  for (const z of ordne(erlaubteZuege(s, su.r), zuerst)) {
    const nach = ziehe(s, z)
    const k = schluessel(nach)
    const wiederholt = verlauf.filter((v) => v === k).length >= REMIS.wiederholungen - 1
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
  regeln: MuehleRegeln
  /** Die Schlüssel der bisherigen Stellungen -- für die Wiederholungsregel. */
  verlauf: readonly string[]
  stufe: MuehleStufe
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
    tabelle: null,
  }
  if (werte.rauschen === 0 && werte.zufall === 0) {
    su.tabelle = new Map()
    return vertiefen(s, auftrag.verlauf, su)
  }

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
