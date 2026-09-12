/**
 * Der Menschenlöser -- löst Schritt für Schritt mit benannten Techniken.
 *
 * Er hat zwei Aufgaben:
 *
 *  1. Bewerten. Ein Rätsel ist so schwer wie der schwerste Schritt, den man
 *     dafür braucht. "Leicht" heißt: nur Singles. "Mittel": Paare, Tripel,
 *     zeigende Paare. "Schwer": Fische, Wings, Färbung -- und ganz oben die
 *     Rätsel, bei denen selbst das nicht reicht und man eine Annahme
 *     durchspielen muss.
 *  2. Tipps geben. Im Spiel liefert `naechsterSchritt` den nächsten
 *     logischen Zug samt Begründung, damit ein Tipp erklärt und nicht nur
 *     verrät.
 *
 * Die Reihenfolge der Techniken ist die Reihenfolge, in der ein geübter
 * Mensch sie versucht: erst das Billige, dann das Teure. Jeder Schritt hat
 * ein Gewicht; die Summe über alle Schritte ist das zweite Maß neben dem
 * schwersten Schritt -- zwei Rätsel mit einem X-Wing sind nicht gleich
 * schwer, wenn das eine danach von selbst zerfällt und das andere nicht.
 */

import {
  ALLE_ZIFFERN,
  EINHEITEN,
  KAESTEN,
  N,
  NACHBARN,
  SPALTEN,
  ZEILEN,
  ZELLEN,
  anzahlBits,
  einzigeZiffer,
  kastenVon,
  sehenSich,
  spalteVon,
  zeileVon,
  ziffernVon,
  type Gitter,
} from './gitter'
import { loese } from './loeser'

export type Technik =
  | 'nackter-single'
  | 'versteckter-single'
  | 'zeigendes-paar'
  | 'kasten-linie'
  | 'nacktes-paar'
  | 'verstecktes-paar'
  | 'nacktes-tripel'
  | 'verstecktes-tripel'
  | 'x-wing'
  | 'xy-wing'
  | 'nacktes-quartett'
  | 'xyz-wing'
  | 'schwertfisch'
  | 'qualle'
  | 'faerbung'
  | 'kette'
  | 'rohe-gewalt'

/** Aufwand je Schritt. Die Abstände sind gefühlt, die Reihenfolge nicht. */
export const TECHNIK_GEWICHT: Record<Technik, number> = {
  'nackter-single': 10,
  'versteckter-single': 15,
  'zeigendes-paar': 30,
  'kasten-linie': 32,
  'nacktes-paar': 40,
  'verstecktes-paar': 55,
  'nacktes-tripel': 60,
  'verstecktes-tripel': 80,
  'x-wing': 120,
  'xy-wing': 140,
  'nacktes-quartett': 150,
  'xyz-wing': 160,
  schwertfisch: 180,
  qualle: 220,
  faerbung: 240,
  kette: 400,
  'rohe-gewalt': 700,
}

export const TECHNIK_NAME: Record<Technik, string> = {
  'nackter-single': 'Nackter Single',
  'versteckter-single': 'Versteckter Single',
  'zeigendes-paar': 'Zeigendes Paar',
  'kasten-linie': 'Kasten-Linie',
  'nacktes-paar': 'Nacktes Paar',
  'verstecktes-paar': 'Verstecktes Paar',
  'nacktes-tripel': 'Nacktes Tripel',
  'verstecktes-tripel': 'Verstecktes Tripel',
  'x-wing': 'X-Wing',
  'xy-wing': 'XY-Wing',
  'nacktes-quartett': 'Nacktes Quartett',
  'xyz-wing': 'XYZ-Wing',
  schwertfisch: 'Schwertfisch',
  qualle: 'Qualle',
  faerbung: 'Färbung',
  kette: 'Widerspruchskette',
  'rohe-gewalt': 'Verschachtelte Ketten',
}

/** Kandidatenstand: Werte plus je Zelle die Maske der noch möglichen Ziffern. */
export interface Zustand {
  werte: Uint8Array
  kand: Uint16Array
}

export interface Streichung {
  zelle: number
  ziffer: number
}

export interface Schritt {
  technik: Technik
  /** Eine Ziffer wird gesetzt … */
  setze?: { zelle: number; ziffer: number }
  /** … oder Kandidaten werden gestrichen. */
  streiche?: Streichung[]
  /** Die Zellen, die den Schluss tragen -- zum Hervorheben. */
  basis: number[]
  /** Die Begründung in einem Satz. */
  text: string
}

/* ------------------------------------------------------------ Zustand */

export function zustandAus(werte: Gitter): Zustand {
  const z: Zustand = { werte: new Uint8Array(werte), kand: new Uint16Array(ZELLEN) }
  for (let i = 0; i < ZELLEN; i++) {
    if (z.werte[i] !== 0) continue
    let belegt = 0
    for (const n of NACHBARN[i]!) belegt |= 1 << z.werte[n]!
    z.kand[i] = ALLE_ZIFFERN & ~belegt
  }
  return z
}

export function kopiere(z: Zustand): Zustand {
  return { werte: new Uint8Array(z.werte), kand: new Uint16Array(z.kand) }
}

export function setzeZiffer(z: Zustand, zelle: number, ziffer: number): void {
  z.werte[zelle] = ziffer
  z.kand[zelle] = 0
  const bit = 1 << ziffer
  for (const n of NACHBARN[zelle]!) z.kand[n]! &= ~bit
}

export function wendeAn(z: Zustand, s: Schritt): void {
  if (s.setze) setzeZiffer(z, s.setze.zelle, s.setze.ziffer)
  if (s.streiche) for (const e of s.streiche) z.kand[e.zelle]! &= ~(1 << e.ziffer)
}

/** Eine leere Zelle ohne Kandidaten -- oder eine Einheit, in der eine Ziffer nirgends mehr passt. */
export function hatWiderspruch(z: Zustand): boolean {
  for (let i = 0; i < ZELLEN; i++) if (z.werte[i] === 0 && z.kand[i] === 0) return true
  for (const einheit of EINHEITEN) {
    let moeglich = 0
    let gesetzt = 0
    for (const c of einheit) {
      const w = z.werte[c]!
      if (w) {
        if (gesetzt & (1 << w)) return true
        gesetzt |= 1 << w
      } else moeglich |= z.kand[c]!
    }
    if ((moeglich | gesetzt) !== ALLE_ZIFFERN) return true
  }
  return false
}

export function istVoll(z: Zustand): boolean {
  for (let i = 0; i < ZELLEN; i++) if (z.werte[i] === 0) return false
  return true
}

/* ------------------------------------------------------------ Namen */

function zellName(zelle: number): string {
  return `Z${zeileVon(zelle) + 1}S${spalteVon(zelle) + 1}`
}

function einheitName(index: number): string {
  if (index < 9) return `Zeile ${index + 1}`
  if (index < 18) return `Spalte ${index - 9 + 1}`
  return `Kasten ${index - 18 + 1}`
}

/* ------------------------------------------------------------ Singles */

function nackterSingle(z: Zustand): Schritt | null {
  for (let i = 0; i < ZELLEN; i++) {
    if (z.werte[i] !== 0) continue
    const d = einzigeZiffer(z.kand[i]!)
    if (d) {
      return {
        technik: 'nackter-single',
        setze: { zelle: i, ziffer: d },
        basis: [i],
        text: `In ${zellName(i)} passt nur noch die ${d}.`,
      }
    }
  }
  return null
}

function versteckterSingle(z: Zustand): Schritt | null {
  for (let e = 0; e < EINHEITEN.length; e++) {
    const einheit = EINHEITEN[e]!
    for (let d = 1; d <= N; d++) {
      const bit = 1 << d
      let ort = -1
      let anzahl = 0
      let schonDa = false
      for (const c of einheit) {
        if (z.werte[c] === d) {
          schonDa = true
          break
        }
        if (z.werte[c] === 0 && z.kand[c]! & bit) {
          anzahl++
          ort = c
        }
      }
      if (schonDa || anzahl !== 1) continue
      return {
        technik: 'versteckter-single',
        setze: { zelle: ort, ziffer: d },
        basis: [ort],
        text: `${einheitName(e)}: Die ${d} passt nur noch in ${zellName(ort)}.`,
      }
    }
  }
  return null
}

/* --------------------------------------------- Kasten und Linie */

function zeigendesPaar(z: Zustand): Schritt | null {
  for (let k = 0; k < N; k++) {
    const kasten = KAESTEN[k]!
    for (let d = 1; d <= N; d++) {
      const bit = 1 << d
      const zellen = kasten.filter((c) => z.werte[c] === 0 && z.kand[c]! & bit)
      if (zellen.length < 2) continue
      const zeilen = new Set(zellen.map(zeileVon))
      const spalten = new Set(zellen.map(spalteVon))
      let linie: readonly number[] | null = null
      let name = ''
      if (zeilen.size === 1) {
        const r = zeileVon(zellen[0]!)
        linie = ZEILEN[r]!
        name = `Zeile ${r + 1}`
      } else if (spalten.size === 1) {
        const c = spalteVon(zellen[0]!)
        linie = SPALTEN[c]!
        name = `Spalte ${c + 1}`
      }
      if (!linie) continue
      const streiche: Streichung[] = []
      for (const c of linie) {
        if (kastenVon(c) === k) continue
        if (z.werte[c] === 0 && z.kand[c]! & bit) streiche.push({ zelle: c, ziffer: d })
      }
      if (streiche.length === 0) continue
      return {
        technik: 'zeigendes-paar',
        streiche,
        basis: zellen,
        text: `Kasten ${k + 1}: Die ${d} liegt sicher in ${name} -- dort fällt sie sonst weg.`,
      }
    }
  }
  return null
}

function kastenLinie(z: Zustand): Schritt | null {
  const linien = [...ZEILEN, ...SPALTEN]
  for (let l = 0; l < linien.length; l++) {
    const linie = linien[l]!
    const name = l < 9 ? `Zeile ${l + 1}` : `Spalte ${l - 9 + 1}`
    for (let d = 1; d <= N; d++) {
      const bit = 1 << d
      const zellen = linie.filter((c) => z.werte[c] === 0 && z.kand[c]! & bit)
      if (zellen.length < 2) continue
      const kaesten = new Set(zellen.map(kastenVon))
      if (kaesten.size !== 1) continue
      const k = kastenVon(zellen[0]!)
      const streiche: Streichung[] = []
      for (const c of KAESTEN[k]!) {
        if (linie.includes(c)) continue
        if (z.werte[c] === 0 && z.kand[c]! & bit) streiche.push({ zelle: c, ziffer: d })
      }
      if (streiche.length === 0) continue
      return {
        technik: 'kasten-linie',
        streiche,
        basis: zellen,
        text: `${name}: Die ${d} muss in Kasten ${k + 1} liegen -- im Rest des Kastens fällt sie weg.`,
      }
    }
  }
  return null
}

/* ------------------------------------------------------- Teilmengen */

function kombinationen(n: number, k: number): number[][] {
  const aus: number[][] = []
  const akt: number[] = []
  const gehe = (start: number) => {
    if (akt.length === k) {
      aus.push([...akt])
      return
    }
    for (let i = start; i < n; i++) {
      akt.push(i)
      gehe(i + 1)
      akt.pop()
    }
  }
  gehe(0)
  return aus
}

const NAME_NACKT: Record<number, Technik> = {
  2: 'nacktes-paar',
  3: 'nacktes-tripel',
  4: 'nacktes-quartett',
}
const WORT: Record<number, string> = { 2: 'Paar', 3: 'Tripel', 4: 'Quartett' }

function nackteTeilmenge(z: Zustand, k: number): Schritt | null {
  for (let e = 0; e < EINHEITEN.length; e++) {
    const einheit = EINHEITEN[e]!
    const leer = einheit.filter((c) => z.werte[c] === 0)
    const passend = leer.filter((c) => anzahlBits(z.kand[c]!) <= k && anzahlBits(z.kand[c]!) >= 2)
    if (passend.length < k) continue
    for (const kombi of kombinationen(passend.length, k)) {
      const zellen = kombi.map((i) => passend[i]!)
      let vereint = 0
      for (const c of zellen) vereint |= z.kand[c]!
      if (anzahlBits(vereint) !== k) continue
      const streiche: Streichung[] = []
      for (const c of leer) {
        if (zellen.includes(c)) continue
        const treffer = z.kand[c]! & vereint
        if (!treffer) continue
        for (const d of ziffernVon(treffer)) streiche.push({ zelle: c, ziffer: d })
      }
      if (streiche.length === 0) continue
      return {
        technik: NAME_NACKT[k]!,
        streiche,
        basis: zellen,
        text: `${einheitName(e)}: Nacktes ${WORT[k]} ${ziffernVon(vereint).join('/')} in ${zellen
          .map(zellName)
          .join(', ')}.`,
      }
    }
  }
  return null
}

const NAME_VERSTECKT: Record<number, Technik> = {
  2: 'verstecktes-paar',
  3: 'verstecktes-tripel',
}

function versteckteTeilmenge(z: Zustand, k: number): Schritt | null {
  for (let e = 0; e < EINHEITEN.length; e++) {
    const einheit = EINHEITEN[e]!
    // Für jede offene Ziffer: in welchen Zellen (Index 0..8) sie noch geht.
    const orte: number[] = new Array(N + 1).fill(0)
    let offen: number[] = []
    for (let d = 1; d <= N; d++) {
      let m = 0
      let gesetzt = false
      for (let i = 0; i < einheit.length; i++) {
        const c = einheit[i]!
        if (z.werte[c] === d) gesetzt = true
        if (z.werte[c] === 0 && z.kand[c]! & (1 << d)) m |= 1 << i
      }
      if (gesetzt || m === 0) continue
      orte[d] = m
      offen.push(d)
    }
    offen = offen.filter((d) => anzahlBits(orte[d]!) <= k)
    if (offen.length < k) continue
    for (const kombi of kombinationen(offen.length, k)) {
      const ziffern = kombi.map((i) => offen[i]!)
      let vereint = 0
      for (const d of ziffern) vereint |= orte[d]!
      if (anzahlBits(vereint) !== k) continue
      let zifferMaske = 0
      for (const d of ziffern) zifferMaske |= 1 << d
      const zellen: number[] = []
      for (let i = 0; i < einheit.length; i++) if (vereint & (1 << i)) zellen.push(einheit[i]!)
      const streiche: Streichung[] = []
      for (const c of zellen) {
        const weg = z.kand[c]! & ~zifferMaske
        for (const d of ziffernVon(weg)) streiche.push({ zelle: c, ziffer: d })
      }
      if (streiche.length === 0) continue
      return {
        technik: NAME_VERSTECKT[k]!,
        streiche,
        basis: zellen,
        text: `${einheitName(e)}: Verstecktes ${WORT[k]} ${ziffern.join('/')} in ${zellen
          .map(zellName)
          .join(', ')}.`,
      }
    }
  }
  return null
}

/* ------------------------------------------------------------ Fische */

const NAME_FISCH: Record<number, Technik> = { 2: 'x-wing', 3: 'schwertfisch', 4: 'qualle' }

function fisch(z: Zustand, k: number): Schritt | null {
  for (let d = 1; d <= N; d++) {
    const bit = 1 << d
    for (const basisZeilen of [true, false]) {
      const basis = basisZeilen ? ZEILEN : SPALTEN
      const deck = basisZeilen ? SPALTEN : ZEILEN
      // Für jede Basislinie: Maske der Deckpositionen mit Kandidat d.
      const masken: number[] = []
      const kandidatenLinien: number[] = []
      for (let l = 0; l < N; l++) {
        let m = 0
        for (let p = 0; p < N; p++) {
          const c = basis[l]![p]!
          if (z.werte[c] === 0 && z.kand[c]! & bit) m |= 1 << p
        }
        const n = anzahlBits(m)
        if (n >= 2 && n <= k) {
          masken.push(m)
          kandidatenLinien.push(l)
        }
      }
      if (kandidatenLinien.length < k) continue
      for (const kombi of kombinationen(kandidatenLinien.length, k)) {
        let vereint = 0
        for (const i of kombi) vereint |= masken[i]!
        if (anzahlBits(vereint) !== k) continue
        const linien = kombi.map((i) => kandidatenLinien[i]!)
        const streiche: Streichung[] = []
        const traeger: number[] = []
        for (let p = 0; p < N; p++) {
          if (!(vereint & (1 << p))) continue
          for (let l = 0; l < N; l++) {
            const c = deck[p]![l]!
            if (z.werte[c] !== 0 || !(z.kand[c]! & bit)) continue
            if (linien.includes(l)) traeger.push(c)
            else streiche.push({ zelle: c, ziffer: d })
          }
        }
        if (streiche.length === 0) continue
        const art = basisZeilen ? 'Zeilen' : 'Spalten'
        return {
          technik: NAME_FISCH[k]!,
          streiche,
          basis: traeger,
          text: `${TECHNIK_NAME[NAME_FISCH[k]!]} für die ${d} in den ${art} ${linien
            .map((l) => l + 1)
            .join('/')}.`,
        }
      }
    }
  }
  return null
}

/* ------------------------------------------------------------- Wings */

function xyWing(z: Zustand): Schritt | null {
  const zweier: number[] = []
  for (let i = 0; i < ZELLEN; i++)
    if (z.werte[i] === 0 && anzahlBits(z.kand[i]!) === 2) zweier.push(i)
  for (const drehpunkt of zweier) {
    const [x, y] = ziffernVon(z.kand[drehpunkt]!) as [number, number]
    const fluegel = zweier.filter((c) => c !== drehpunkt && sehenSich(drehpunkt, c))
    for (const a of fluegel) {
      const ma = z.kand[a]!
      if (!(ma & (1 << x)) || ma & (1 << y)) continue
      const zBit = ma & ~(1 << x)
      const zz = einzigeZiffer(zBit)
      for (const b of fluegel) {
        if (b === a) continue
        const mb = z.kand[b]!
        if (mb !== ((1 << y) | zBit)) continue
        const streiche: Streichung[] = []
        for (let c = 0; c < ZELLEN; c++) {
          if (c === drehpunkt || c === a || c === b) continue
          if (z.werte[c] !== 0 || !(z.kand[c]! & zBit)) continue
          if (sehenSich(c, a) && sehenSich(c, b)) streiche.push({ zelle: c, ziffer: zz })
        }
        if (streiche.length === 0) continue
        return {
          technik: 'xy-wing',
          streiche,
          basis: [drehpunkt, a, b],
          text: `XY-Wing mit Drehpunkt ${zellName(drehpunkt)} (${x}/${y}) und Flügeln ${zellName(
            a,
          )}, ${zellName(b)}: die ${zz} fällt weg, wo beide Flügel hinsehen.`,
        }
      }
    }
  }
  return null
}

function xyzWing(z: Zustand): Schritt | null {
  for (let drehpunkt = 0; drehpunkt < ZELLEN; drehpunkt++) {
    if (z.werte[drehpunkt] !== 0 || anzahlBits(z.kand[drehpunkt]!) !== 3) continue
    const mp = z.kand[drehpunkt]!
    const nachbarn = NACHBARN[drehpunkt]!.filter(
      (c) => z.werte[c] === 0 && anzahlBits(z.kand[c]!) === 2 && (z.kand[c]! & mp) === z.kand[c]!,
    )
    for (let i = 0; i < nachbarn.length; i++) {
      for (let j = i + 1; j < nachbarn.length; j++) {
        const a = nachbarn[i]!
        const b = nachbarn[j]!
        const gemeinsam = z.kand[a]! & z.kand[b]!
        const zz = einzigeZiffer(gemeinsam)
        if (!zz || (z.kand[a]! | z.kand[b]!) !== mp) continue
        const streiche: Streichung[] = []
        for (let c = 0; c < ZELLEN; c++) {
          if (c === drehpunkt || c === a || c === b) continue
          if (z.werte[c] !== 0 || !(z.kand[c]! & gemeinsam)) continue
          if (sehenSich(c, a) && sehenSich(c, b) && sehenSich(c, drehpunkt))
            streiche.push({ zelle: c, ziffer: zz })
        }
        if (streiche.length === 0) continue
        return {
          technik: 'xyz-wing',
          streiche,
          basis: [drehpunkt, a, b],
          text: `XYZ-Wing um ${zellName(drehpunkt)}: die ${zz} fällt weg, wo alle drei Zellen hinsehen.`,
        }
      }
    }
  }
  return null
}

/* ---------------------------------------------------------- Färbung */

/**
 * Einfache Färbung: Für eine Ziffer werden alle "starken Verbindungen"
 * (Einheiten mit genau zwei Kandidaten) zu einem Graphen, der sich in zwei
 * Farben teilen lässt -- eine der beiden Farben ist wahr. Sehen sich zwei
 * Zellen gleicher Farbe, ist diese Farbe falsch. Sieht eine ungefärbte
 * Zelle beide Farben, fällt die Ziffer dort weg.
 */
function faerbung(z: Zustand): Schritt | null {
  for (let d = 1; d <= N; d++) {
    const bit = 1 << d
    const kanten = new Map<number, number[]>()
    const verbinde = (a: number, b: number) => {
      if (!kanten.has(a)) kanten.set(a, [])
      if (!kanten.has(b)) kanten.set(b, [])
      kanten.get(a)!.push(b)
      kanten.get(b)!.push(a)
    }
    for (const einheit of EINHEITEN) {
      const zellen = einheit.filter((c) => z.werte[c] === 0 && z.kand[c]! & bit)
      if (zellen.length === 2) verbinde(zellen[0]!, zellen[1]!)
    }
    const farbe = new Map<number, number>()
    for (const start of kanten.keys()) {
      if (farbe.has(start)) continue
      const komponente: number[] = []
      farbe.set(start, 0)
      const schlange = [start]
      while (schlange.length) {
        const c = schlange.pop()!
        komponente.push(c)
        for (const n of kanten.get(c)!) {
          if (farbe.has(n)) continue
          farbe.set(n, 1 - farbe.get(c)!)
          schlange.push(n)
        }
      }
      if (komponente.length < 4) continue
      const gruppe = [0, 1].map((f) => komponente.filter((c) => farbe.get(c) === f))
      // Zwei gleiche Farben, die sich sehen: diese Farbe ist falsch.
      for (const f of [0, 1]) {
        const g = gruppe[f]!
        let widerspruch = false
        for (let i = 0; i < g.length && !widerspruch; i++)
          for (let j = i + 1; j < g.length; j++)
            if (sehenSich(g[i]!, g[j]!)) {
              widerspruch = true
              break
            }
        if (widerspruch) {
          return {
            technik: 'faerbung',
            streiche: g.map((c) => ({ zelle: c, ziffer: d })),
            basis: komponente,
            text: `Färbung der ${d}: Eine Farbe sieht sich selbst -- dort fällt die ${d} überall weg.`,
          }
        }
      }
      // Ungefärbte Zellen, die beide Farben sehen.
      const streiche: Streichung[] = []
      for (let c = 0; c < ZELLEN; c++) {
        if (z.werte[c] !== 0 || !(z.kand[c]! & bit) || farbe.has(c)) continue
        const siehtA = gruppe[0]!.some((g) => sehenSich(c, g))
        const siehtB = gruppe[1]!.some((g) => sehenSich(c, g))
        if (siehtA && siehtB) streiche.push({ zelle: c, ziffer: d })
      }
      if (streiche.length) {
        return {
          technik: 'faerbung',
          streiche,
          basis: komponente,
          text: `Färbung der ${d}: ${streiche.length === 1 ? 'Eine Zelle sieht' : 'Zellen sehen'} beide Farben -- dort fällt die ${d} weg.`,
        }
      }
    }
  }
  return null
}

/* ------------------------------------------------------------ Ketten */

/**
 * In Feldern mit höchstens so vielen Kandidaten wird eine Annahme geprüft.
 * Zwei ist das, was man auf Papier noch tut: "entweder 3 oder 7". Was sich
 * damit nicht knacken lässt, braucht Annahmen in Annahmen -- verschachtelt.
 */
export const KETTEN_BREITE = 2

/**
 * Nur Singles nachziehen, bis nichts mehr geht oder ein Widerspruch da ist.
 * Das ist das, was man im Kopf mitführt, wenn man eine Annahme prüft.
 */
function ziehSinglesNach(z: Zustand): 'ok' | 'widerspruch' {
  for (;;) {
    if (hatWiderspruch(z)) return 'widerspruch'
    const s = nackterSingle(z) ?? versteckterSingle(z)
    if (!s) return 'ok'
    wendeAn(z, s)
  }
}

/**
 * Widerspruchskette: Eine Annahme in einer Zelle mit wenigen Kandidaten
 * wird mit Singles zu Ende gedacht. Führt sie in einen Widerspruch, ist
 * der Kandidat weg. Zellen mit zwei Kandidaten zuerst -- da ist der Schluss
 * am kürzesten.
 */
function kette(z: Zustand, breite: number): Schritt | null {
  const reihenfolge: number[] = []
  for (let i = 0; i < ZELLEN; i++) if (z.werte[i] === 0) reihenfolge.push(i)
  reihenfolge.sort((a, b) => anzahlBits(z.kand[a]!) - anzahlBits(z.kand[b]!))
  for (const c of reihenfolge) {
    if (anzahlBits(z.kand[c]!) > breite) break
    for (const d of ziffernVon(z.kand[c]!)) {
      const probe = kopiere(z)
      setzeZiffer(probe, c, d)
      if (ziehSinglesNach(probe) === 'widerspruch') {
        return {
          technik: 'kette',
          streiche: [{ zelle: c, ziffer: d }],
          basis: [c],
          text: `Wäre in ${zellName(c)} die ${d}, liefe es in einen Widerspruch -- also fällt sie weg.`,
        }
      }
    }
  }
  return null
}

/* ------------------------------------------------------- Der Schritt */

/**
 * Der nächste logische Schritt, oder null, wenn keine der Techniken mehr
 * greift. Ist das Gitter voll, ebenfalls null.
 */
export function naechsterSchritt(
  z: Zustand,
  mitKette = true,
  kettenBreite = KETTEN_BREITE,
): Schritt | null {
  if (istVoll(z)) return null
  return (
    nackterSingle(z) ??
    versteckterSingle(z) ??
    zeigendesPaar(z) ??
    kastenLinie(z) ??
    nackteTeilmenge(z, 2) ??
    versteckteTeilmenge(z, 2) ??
    nackteTeilmenge(z, 3) ??
    versteckteTeilmenge(z, 3) ??
    fisch(z, 2) ??
    xyWing(z) ??
    nackteTeilmenge(z, 4) ??
    xyzWing(z) ??
    fisch(z, 3) ??
    fisch(z, 4) ??
    faerbung(z) ??
    (mitKette ? kette(z, kettenBreite) : null)
  )
}

/* --------------------------------------------------------- Bewertung */

export interface Bewertung {
  /** Bis zum Ende gekommen (notfalls mit roher Gewalt). */
  geloest: boolean
  /** Der schwerste Schritt. */
  hoechste: Technik
  /** Summe aller Schrittgewichte. */
  punkte: number
  /** Wie oft jede Technik gebraucht wurde. */
  schritte: Partial<Record<Technik, number>>
}

export function gewichtVon(technik: Technik): number {
  return TECHNIK_GEWICHT[technik]
}

/** Vergleich zweier Techniken nach Schwere. */
export function schwerer(a: Technik, b: Technik): boolean {
  return TECHNIK_GEWICHT[a] > TECHNIK_GEWICHT[b]
}

/**
 * Löst das Rätsel mit den Techniken oben und merkt sich, was nötig war.
 * Greift nichts mehr, wird ein Feld aus der Rechenlösung übernommen und als
 * "rohe Gewalt" gezählt -- das sind die Rätsel, bei denen selbst eine
 * einfache Annahme nicht reicht und man Annahmen ineinander schachteln muss.
 */
export function bewerte(werte: Gitter, grenze = 2000, kettenBreite = KETTEN_BREITE): Bewertung {
  const z = zustandAus(werte)
  const schritte: Partial<Record<Technik, number>> = {}
  let hoechste: Technik = 'nackter-single'
  let punkte = 0
  let loesung: Gitter | null | undefined
  for (let n = 0; n < grenze; n++) {
    if (istVoll(z)) return { geloest: true, hoechste, punkte, schritte }
    const s = naechsterSchritt(z, true, kettenBreite)
    if (s) {
      wendeAn(z, s)
      schritte[s.technik] = (schritte[s.technik] ?? 0) + 1
      punkte += TECHNIK_GEWICHT[s.technik]
      if (schwerer(s.technik, hoechste)) hoechste = s.technik
      continue
    }
    // Rohe Gewalt: eine Zelle aus der echten Lösung übernehmen.
    if (loesung === undefined) loesung = loese(werte)
    if (!loesung) return { geloest: false, hoechste, punkte, schritte }
    let ziel = -1
    let wenigste = 10
    for (let i = 0; i < ZELLEN; i++) {
      if (z.werte[i] !== 0) continue
      const k = anzahlBits(z.kand[i]!)
      if (k < wenigste) {
        wenigste = k
        ziel = i
      }
    }
    if (ziel < 0) break
    setzeZiffer(z, ziel, loesung[ziel]!)
    schritte['rohe-gewalt'] = (schritte['rohe-gewalt'] ?? 0) + 1
    punkte += TECHNIK_GEWICHT['rohe-gewalt']
    hoechste = 'rohe-gewalt'
  }
  return { geloest: istVoll(z), hoechste, punkte, schritte }
}

/* ------------------------------------------------------------- Tipp */

export interface Tipp {
  zelle: number
  ziffer: number
  /** Die Techniken auf dem Weg dorthin, die schwerste zuletzt. */
  techniken: Technik[]
  /** Begründung des Schritts, der die Ziffer setzt. */
  text: string
  /** Zellen, die zur Begründung gehören. */
  basis: number[]
}

/**
 * Der nächste Tipp fürs Spiel: rechnet vom aktuellen Stand aus (ohne die
 * Notizen des Spielers, die dürfen falsch sein) so lange weiter, bis eine
 * Ziffer gesetzt wird. Was auf dem Weg an Streichungen nötig war, steht in
 * `techniken`, damit der Spieler erfährt, was er hätte sehen müssen.
 *
 * Steht im Gitter ein Fehler, gibt es keinen Tipp -- er wäre falsch.
 */
export function tippFuer(werte: Gitter, loesung: Gitter): Tipp | null {
  for (let i = 0; i < ZELLEN; i++) if (werte[i] !== 0 && werte[i] !== loesung[i]) return null
  const z = zustandAus(werte)
  const techniken: Technik[] = []
  for (let n = 0; n < 200; n++) {
    const s = naechsterSchritt(z)
    if (!s) break
    if (!techniken.includes(s.technik)) techniken.push(s.technik)
    if (s.setze) {
      techniken.sort((a, b) => TECHNIK_GEWICHT[a] - TECHNIK_GEWICHT[b])
      return {
        zelle: s.setze.zelle,
        ziffer: s.setze.ziffer,
        techniken,
        text: s.text,
        basis: s.basis,
      }
    }
    wendeAn(z, s)
  }
  // Keine Technik greift mehr: dann eben die Zelle mit den wenigsten Kandidaten aus der Lösung.
  let ziel = -1
  let wenigste = 10
  for (let i = 0; i < ZELLEN; i++) {
    if (z.werte[i] !== 0) continue
    const k = anzahlBits(z.kand[i]!)
    if (k < wenigste) {
      wenigste = k
      ziel = i
    }
  }
  if (ziel < 0) return null
  techniken.push('rohe-gewalt')
  return {
    zelle: ziel,
    ziffer: loesung[ziel]!,
    techniken,
    text: `Hier hilft keine einzelne Technik mehr -- in ${zellName(ziel)} steht die ${loesung[ziel]}.`,
    basis: [ziel],
  }
}

/** Alle Kandidaten für den Knopf "Notizen füllen". */
export function alleKandidaten(werte: Gitter): Uint16Array {
  return zustandAus(werte).kand
}
