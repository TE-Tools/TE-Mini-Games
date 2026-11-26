/**
 * Der Computergegner für Käsekästchen.
 *
 * Rein und deterministisch: Was er zieht, hängt nur vom Auftrag (Blatt,
 * gezogene Linien, Stufe, Startwert) und dem Zufall ab, den man ihm
 * mitgibt. So lässt er sich in Vitest Zug für Zug prüfen.
 *
 * Die Begriffe, mit denen er rechnet (siehe docs/design/kaesekaestchen):
 *
 * - **sicher** ist eine Linie, die keinem Kästchen die dritte Seite gibt.
 * - **Kette**: Kästchen mit je zwei gezogenen Seiten, die über ihre freien
 *   Seiten aneinanderhängen. Wer eine Linie darin zieht, schenkt sie dem
 *   anderen. **Ring**: eine Kette, die in sich zurückläuft.
 * - **Doppelkreuz**: Wer eine geschenkte Kette frisst, kann die letzten
 *   zwei Kästchen (beim Ring vier) liegen lassen. Dann muss der andere sie
 *   nehmen und danach die nächste Kette öffnen -- wer so die Kontrolle
 *   behält, bekommt am Ende die langen Ketten.
 *
 * Die schwere Stufe bewertet ein Endspiel aus Ketten und Ringen genau
 * (`wert`), rechnet die letzten sicheren Züge durch, damit am Ende der
 * andere die erste Kette öffnen muss, und spielt das Doppelkreuz, wenn es
 * sich lohnt. Knoten (Kästchen mit drei oder vier freien Seiten zwischen
 * Ketten) zählt sie nicht mit -- dort schätzt sie.
 */

import { STUFEN, type KaestchenStufe } from './config'
import { raster, type Raster } from './raster'

export interface KiAuftrag {
  breite: number
  hoehe: number
  /** Die schon gezogenen Linien, in beliebiger Reihenfolge. */
  gezogen: readonly number[]
  stufe: KaestchenStufe
  seed: number
}

/** Liefert Zahlen in [0, 1) -- in Tests von außen vorgegeben. */
export type Zufall = () => number

/** Ein kleiner, schneller Zufall mit Startwert (mulberry32). */
export function zufallAus(seed: number): Zufall {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function waehle<T>(liste: readonly T[], zufall: Zufall): T {
  return liste[Math.min(liste.length - 1, Math.floor(zufall() * liste.length))]!
}

/* ------------------------------------------------------------ Die Lage */

/** Das Blatt zum Rechnen: veränderlich, mit Zurücknehmen. */
class Lage {
  readonly r: Raster
  readonly linie: Uint8Array
  readonly seiten: Uint8Array

  constructor(r: Raster, gezogen: readonly number[]) {
    this.r = r
    this.linie = new Uint8Array(r.anzahlLinien)
    this.seiten = new Uint8Array(r.anzahlKaestchen)
    for (const l of gezogen) {
      if (l >= 0 && l < r.anzahlLinien && !this.linie[l]) this.zieh(l)
    }
  }

  /** Zieht eine Linie; gibt zurück, wie viele Kästchen sie geschlossen hat. */
  zieh(l: number): number {
    this.linie[l] = 1
    let zu = 0
    for (const k of this.r.kaestchenAn[l]!) {
      this.seiten[k]! += 1
      if (this.seiten[k] === 4) zu++
    }
    return zu
  }

  nimm(l: number): void {
    this.linie[l] = 0
    for (const k of this.r.kaestchenAn[l]!) this.seiten[k]! -= 1
  }

  frei(): number[] {
    const frei: number[] = []
    for (let l = 0; l < this.linie.length; l++) if (!this.linie[l]) frei.push(l)
    return frei
  }

  dreiSeiter(): number[] {
    const drei: number[] = []
    for (let k = 0; k < this.seiten.length; k++) if (this.seiten[k] === 3) drei.push(k)
    return drei
  }

  /** Eine freie Seite des Kästchens (bei drei gezogenen: die einzige). */
  freieSeite(k: number, ausser = -1): number {
    for (const l of this.r.seiten[k]!) if (!this.linie[l] && l !== ausser) return l
    return -1
  }

  /** Das Kästchen auf der anderen Seite der Linie, -1 am Rand. */
  gegenueber(l: number, k: number): number {
    for (const x of this.r.kaestchenAn[l]!) if (x !== k) return x
    return -1
  }

  schliesst(l: number): number {
    let n = 0
    for (const k of this.r.kaestchenAn[l]!) if (this.seiten[k] === 3) n++
    return n
  }

  /** Gibt keinem Kästchen die dritte Seite (und schließt auch keins). */
  sicher(l: number): boolean {
    if (this.linie[l]) return false
    for (const k of this.r.kaestchenAn[l]!) if (this.seiten[k]! >= 2) return false
    return true
  }

  hatSichere(): boolean {
    for (let l = 0; l < this.linie.length; l++) if (this.sicher(l)) return true
    return false
  }

  rueckgaengig(log: readonly number[]): void {
    for (let i = log.length - 1; i >= 0; i--) this.nimm(log[i]!)
  }
}

/**
 * Von einem Kästchen mit drei Seiten aus fressen, solange die Kette
 * weitergeht. Die gezogenen Linien landen in `log`.
 */
function folge(lage: Lage, start: number, log: number[]): number {
  let k = start
  let n = 0
  while (k >= 0 && lage.seiten[k] === 3) {
    const f = lage.freieSeite(k)
    n += lage.zieh(f)
    log.push(f)
    const weiter = lage.gegenueber(f, k)
    k = weiter >= 0 && lage.seiten[weiter] === 3 ? weiter : -1
  }
  return n
}

/** Alles nehmen, was offen herumliegt. */
function frissAlles(lage: Lage, log: number[]): number {
  let n = 0
  for (;;) {
    const drei = lage.dreiSeiter()
    if (drei.length === 0) return n
    n += folge(lage, drei[0]!, log)
  }
}

/* ------------------------------------------------- Ketten und Ringe */

interface Komponente {
  ring: boolean
  n: number
}

/** Die Ketten und Ringe einer Lage ohne offene Kästchen mit drei Seiten. */
function komponenten(lage: Lage): Komponente[] {
  const { r, seiten } = lage
  const besucht = new Uint8Array(r.anzahlKaestchen)
  const liste: Komponente[] = []
  for (let k = 0; k < r.anzahlKaestchen; k++) {
    if (besucht[k] || seiten[k] !== 2) continue
    const stapel = [k]
    let glieder = 0
    let innen = 0
    while (stapel.length > 0) {
      const b = stapel.pop()!
      if (besucht[b]) continue
      besucht[b] = 1
      glieder++
      for (const l of r.seiten[b]!) {
        if (lage.linie[l]) continue
        const x = lage.gegenueber(l, b)
        if (x >= 0 && seiten[x] === 2) {
          innen++
          if (!besucht[x]) stapel.push(x)
        }
      }
    }
    // Jede innere Linie wurde von beiden Seiten gezählt.
    liste.push({ ring: innen / 2 === glieder && glieder >= 4, n: glieder })
  }
  return liste
}

type Merker = Map<string, number>

/**
 * Was der Spieler mit der Kontrolle aus einem Endspiel aus Ketten und
 * Ringen noch herausholt (seine Kästchen minus die des anderen), wenn der
 * andere als Nächster eine öffnen muss.
 *
 * Der Öffnende wählt, was ihn am wenigsten kostet. Der andere nimmt alles
 * und muss danach selbst öffnen -- oder lässt mit dem Doppelkreuz zwei
 * (beim Ring vier) liegen und behält die Kontrolle. Eine Zweierkette
 * öffnet man in der Mitte: Dann gibt es kein Doppelkreuz.
 */
function wert(liste: readonly Komponente[], merker: Merker): number {
  if (liste.length === 0) return 0
  const schluessel = liste
    .map((c) => (c.ring ? 'r' : 'k') + c.n)
    .sort()
    .join(',')
  const bekannt = merker.get(schluessel)
  if (bekannt !== undefined) return bekannt

  let best = Infinity
  const gesehen = new Set<string>()
  liste.forEach((c, i) => {
    const art = (c.ring ? 'r' : 'k') + c.n
    if (gesehen.has(art)) return
    gesehen.add(art)
    const v = wert(
      liste.filter((_, j) => j !== i),
      merker,
    )
    let kontrolle: number
    if (c.ring) kontrolle = Math.max(c.n - v, c.n - 8 + v)
    else if (c.n <= 2) kontrolle = c.n - v
    else kontrolle = Math.max(c.n - v, c.n - 4 + v)
    best = Math.min(best, kontrolle)
  })
  merker.set(schluessel, best)
  return best
}

/**
 * Wir müssen etwas öffnen und ziehen `l`: Was holt der andere ab hier
 * heraus (seine minus unsere Kästchen)? Kleiner ist besser für uns.
 */
function nachOeffnung(lage: Lage, l: number, merker: Merker): number {
  const log = [l]
  lage.zieh(l)
  const enden = lage.r.kaestchenAn[l]!.filter((k) => lage.seiten[k] === 3)
  let a = 0
  let b = 0
  let ring = false
  if (enden.length > 0) a = folge(lage, enden[0]!, log)
  if (enden.length > 1) {
    if (lage.seiten[enden[1]!] === 3) b = folge(lage, enden[1]!, log)
    else ring = true
  }
  const g = a + b + frissAlles(lage, log)
  const v = wert(komponenten(lage), merker)
  lage.rueckgaengig(log)

  let doppelkreuz = -Infinity
  if (ring) {
    if (g >= 4) doppelkreuz = g - 8 + v
  } else if (enden.length === 1) {
    if (g >= 2) doppelkreuz = g - 4 + v
  } else if (Math.max(a, b) >= 2) {
    doppelkreuz = g - 4 + v
  }
  return Math.max(g - v, doppelkreuz)
}

/* --------------------------------------------------- Die drei Stufen */

/** Schwer, wenn etwas zu nehmen ist: alles nehmen -- oder Doppelkreuz. */
function schwerFressen(lage: Lage, merker: Merker): number {
  const drei = lage.dreiSeiter()
  // Die kürzere Seite zuerst: So bleibt am Ende eine Kette mit einem Ende übrig.
  const laengen = drei.map((k) => {
    const log: number[] = []
    const n = folge(lage, k, log)
    lage.rueckgaengig(log)
    return n
  })
  let kuerzeste = 0
  laengen.forEach((n, i) => {
    if (n < laengen[kuerzeste]!) kuerzeste = i
  })
  const nimm = lage.freieSeite(drei[kuerzeste]!)

  const log: number[] = []
  const g = frissAlles(lage, log)
  const fertig = lage.seiten.every((s) => s === 4)
  const sichereDanach = !fertig && lage.hatSichere()
  const v = fertig || sichereDanach ? 0 : wert(komponenten(lage), merker)
  lage.rueckgaengig(log)
  if (fertig || sichereDanach) return nimm

  /** Zieht `l` nichts zu und gibt außer `erlaubt` keinem die dritte Seite? */
  const harmlos = (l: number, erlaubt: readonly number[]) => {
    if (l < 0) return false
    const zu = lage.zieh(l)
    const ok = zu === 0 && lage.dreiSeiter().every((k) => erlaubt.includes(k))
    lage.nimm(l)
    return ok
  }

  // Kette: X (drei Seiten) hängt an Y (zwei Seiten). Y's andere Seite ziehen.
  if (g === 2 && drei.length === 1 && v > 2) {
    const x = drei[0]!
    const f = lage.freieSeite(x)
    const y = lage.gegenueber(f, x)
    if (y >= 0 && lage.seiten[y] === 2) {
      const l = lage.freieSeite(y, f)
      if (harmlos(l, [x, y])) return l
    }
  }
  // Ring: X1 – Y1 – Y2 – X2, beide Enden mit drei Seiten. Die Mitte ziehen.
  if (g === 4 && drei.length === 2 && v > 4) {
    const [x1, x2] = drei as [number, number]
    const y1 = lage.gegenueber(lage.freieSeite(x1), x1)
    const y2 = lage.gegenueber(lage.freieSeite(x2), x2)
    if (y1 >= 0 && y2 >= 0 && y1 !== y2 && lage.seiten[y1] === 2 && lage.seiten[y2] === 2) {
      const mitte = lage.r.seiten[y1]!.find(
        (l) => !lage.linie[l] && lage.r.kaestchenAn[l]!.includes(y2),
      )
      if (mitte !== undefined && harmlos(mitte, [x1, x2, y1, y2])) return mitte
    }
  }
  return nimm
}

/** Schwer, solange es sichere Linien gibt: die letzten durchrechnen. */
function schwerSicher(
  lage: Lage,
  sichere: readonly number[],
  grenze: number,
  merker: Merker,
  zufall: Zufall,
): number {
  if (sichere.length > grenze) return waehle(sichere, zufall)

  // Wer keine sichere Linie mehr hat, muss öffnen: Er bekommt -wert.
  const tabelle = new Map<number, number>()
  const suche = (maske: number): number => {
    const bekannt = tabelle.get(maske)
    if (bekannt !== undefined) return bekannt
    let best = -Infinity
    for (let i = 0; i < sichere.length; i++) {
      if (maske & (1 << i)) continue
      const l = sichere[i]!
      if (!lage.sicher(l)) continue
      lage.zieh(l)
      best = Math.max(best, -suche(maske | (1 << i)))
      lage.nimm(l)
    }
    if (best === -Infinity) best = -wert(komponenten(lage), merker)
    tabelle.set(maske, best)
    return best
  }

  let beste: number[] = []
  let bestWert = -Infinity
  sichere.forEach((l, i) => {
    lage.zieh(l)
    const w = -suche(1 << i)
    lage.nimm(l)
    if (w > bestWert) {
      bestWert = w
      beste = [l]
    } else if (w === bestWert) beste.push(l)
  })
  return waehle(beste, zufall)
}

/** Etwas hergeben müssen: die Linie, die am wenigsten kostet. */
function kleinstesOpfer(
  frei: readonly number[],
  zufall: Zufall,
  bewerte: (l: number) => number,
): number {
  let beste: number[] = []
  let bestWert = Infinity
  for (const l of frei) {
    const w = bewerte(l)
    if (w < bestWert) {
      bestWert = w
      beste = [l]
    } else if (w === bestWert) beste.push(l)
  }
  return waehle(beste, zufall)
}

/** Wie viele Kästchen der andere nach `l` einfach nehmen kann. */
function geschenkt(lage: Lage, l: number): number {
  const log = [l]
  lage.zieh(l)
  const n = frissAlles(lage, log)
  lage.rueckgaengig(log)
  return n
}

/**
 * Die Linie, die der Computer zieht -- `null`, wenn keine mehr frei ist.
 * `zufall` ersetzt den Startwert (für Tests).
 */
export function waehleLinie(auftrag: KiAuftrag, zufall?: Zufall): number | null {
  const r = raster(auftrag.breite, auftrag.hoehe)
  const lage = new Lage(r, auftrag.gezogen)
  const z = zufall ?? zufallAus(auftrag.seed)
  const w = STUFEN[auftrag.stufe]
  const merker: Merker = new Map()

  const frei = lage.frei()
  if (frei.length === 0) return null

  const fangbar = frei.filter((l) => lage.schliesst(l) > 0)
  if (fangbar.length > 0) {
    if (w.kettenRegel) return schwerFressen(lage, merker)
    if (z() < w.nimmFrei) {
      const doppelt = fangbar.filter((l) => lage.schliesst(l) === 2)
      return waehle(doppelt.length > 0 ? doppelt : fangbar, z)
    }
  }

  const sichere = frei.filter((l) => lage.sicher(l))
  if (sichere.length > 0) {
    if (w.kettenRegel) return schwerSicher(lage, sichere, w.suchGrenze, merker, z)
    return waehle(z() < w.meideDritte ? sichere : frei, z)
  }

  const oeffnen = frei.filter((l) => lage.schliesst(l) === 0)
  const kandidaten = oeffnen.length > 0 ? oeffnen : frei
  if (w.kettenRegel) {
    // Gleich gut nach der Rechnung? Dann das, was weniger sofort hergibt.
    return kleinstesOpfer(
      kandidaten,
      z,
      (l) => nachOeffnung(lage, l, merker) * 1000 + geschenkt(lage, l),
    )
  }
  if (w.kleinstesOpfer) return kleinstesOpfer(kandidaten, z, (l) => geschenkt(lage, l))
  return waehle(frei, z)
}

/** Nur für Tests und die Doku: der Wert eines reinen Ketten-Endspiels. */
export function endspielWert(liste: readonly { ring: boolean; n: number }[]): number {
  return wert(liste, new Map())
}
