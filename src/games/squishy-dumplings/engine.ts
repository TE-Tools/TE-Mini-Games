/**
 * Squishy Dumplings – reine Spiellogik (kein React, kein DOM).
 *
 * Ein Zug ist: zwei benachbarte Knödel tauschen. Entsteht dadurch keine
 * Reihe, gilt der Zug nicht und das Feld bleibt, wie es war -- das ist die
 * Regel, an der man merkt, dass man vorausschauen muss.
 *
 * Der Zufall für den Nachschub steckt als Zahl im Zustand. Damit ist jede
 * Partie nachrechenbar: Gleicher Startwert und gleiche Züge ergeben immer
 * dasselbe Feld, und der Test kann ganze Partien durchspielen.
 */

import { REIHE_AB, type DumplingLevel, type DumplingState, type Farbe, type Zelle } from './types'

function mulberry(seed: number): { wert: number; naechste: number } {
  let t = (seed + 0x6d2b79f5) >>> 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
  t = t >>> 0
  return { wert: ((r ^ (r >>> 14)) >>> 0) / 4294967296, naechste: t }
}

/** Eine Zufallszahl ziehen und den Zustand weiterdrehen. */
export function zieh(zufall: number, grenze: number): { zahl: number; zufall: number } {
  const { wert, naechste } = mulberry(zufall)
  return { zahl: Math.floor(wert * grenze) % grenze, zufall: naechste }
}

export function idx(row: number, col: number, cols: number): number {
  return row * cols + col
}

export function sindNachbarn(a: number, b: number, cols: number): boolean {
  const ra = Math.floor(a / cols)
  const ca = a % cols
  const rb = Math.floor(b / cols)
  const cb = b % cols
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1
}

/**
 * Alle Zellen, die in einer Reihe aus drei oder mehr gleichen liegen.
 *
 * Käfige zählen nicht mit: Ein Knödel im Käfig zerreißt jede Linie. Nur
 * dadurch sind Käfige überhaupt ein Hindernis und nicht bloß Deko.
 */
export function findeTreffer(feld: Zelle[], rows: number, cols: number): number[] {
  const treffer = new Set<number>()

  const pruefe = (lauf: number[]) => {
    if (lauf.length >= REIHE_AB) for (const i of lauf) treffer.add(i)
  }

  const zaehlbar = (z: Zelle | undefined) => z != null && z.farbe > 0 && !z.kaefig

  for (let r = 0; r < rows; r++) {
    let lauf: number[] = []
    let farbe: Farbe = 0
    for (let c = 0; c <= cols; c++) {
      const i = idx(r, c, cols)
      const z = c < cols ? feld[i] : undefined
      if (zaehlbar(z) && z!.farbe === farbe) {
        lauf.push(i)
        continue
      }
      pruefe(lauf)
      lauf = zaehlbar(z) ? [i] : []
      farbe = zaehlbar(z) ? z!.farbe : 0
    }
    pruefe(lauf)
  }

  for (let c = 0; c < cols; c++) {
    let lauf: number[] = []
    let farbe: Farbe = 0
    for (let r = 0; r <= rows; r++) {
      const i = idx(r, c, cols)
      const z = r < rows ? feld[i] : undefined
      if (zaehlbar(z) && z!.farbe === farbe) {
        lauf.push(i)
        continue
      }
      pruefe(lauf)
      lauf = zaehlbar(z) ? [i] : []
      farbe = zaehlbar(z) ? z!.farbe : 0
    }
    pruefe(lauf)
  }

  return [...treffer].sort((a, b) => a - b)
}

/** Welche Käfige eine Reihe aufspringen lässt: die direkt daneben. */
function kaefigeDaneben(feld: Zelle[], rows: number, cols: number, treffer: number[]): number[] {
  const auf = new Set<number>()
  for (const i of treffer) {
    const r = Math.floor(i / cols)
    const c = i % cols
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      const j = idx(nr, nc, cols)
      if (feld[j]!.kaefig) auf.add(j)
    }
  }
  return [...auf].sort((a, b) => a - b)
}

/**
 * Nachrutschen und auffüllen.
 *
 * Ein Knödel im Käfig fällt wie jeder andere -- er lässt sich nur nicht
 * schieben und nicht wegräumen. Das hält das Nachrutschen einfach und sorgt
 * nebenbei dafür, dass Käfige nach unten sinken, wo man leichter an sie
 * herankommt.
 */
function rutschen(
  feld: Zelle[],
  rows: number,
  cols: number,
  farben: number,
  zufall: number,
): { feld: Zelle[]; zufall: number } {
  const neu = feld.map((z) => ({ ...z }))
  let z = zufall
  for (let c = 0; c < cols; c++) {
    let schreib = rows - 1
    for (let r = rows - 1; r >= 0; r--) {
      const zelle = neu[idx(r, c, cols)]!
      if (zelle.farbe === 0) continue
      neu[idx(schreib, c, cols)] = { ...zelle }
      schreib--
    }
    // Von unten nach oben auffüllen, und dabei keine fertige Reihe
    // nachliefern: Sonst löst sich das Feld von allein auf. Gemessen kam ein
    // Zug vorher auf zehn Knödel und mehr -- da musste niemand mehr suchen.
    // Ketten entstehen jetzt nur noch daraus, dass vorhandene Knödel
    // zusammenfallen, und genau die sind das Kunststück.
    for (let r = schreib; r >= 0; r--) {
      const gezogen = zieh(z, farben)
      z = gezogen.zufall
      const i = idx(r, c, cols)
      let farbe = gezogen.zahl + 1
      for (let k = 0; k < farben; k++) {
        const kandidat = ((gezogen.zahl + k) % farben) + 1
        neu[i] = { farbe: kandidat, kaefig: false }
        if (findeTreffer(neu, rows, cols).length === 0) {
          farbe = kandidat
          break
        }
      }
      neu[i] = { farbe, kaefig: false }
    }
  }
  return { feld: neu, zufall: z }
}

/** Ein Schritt der Auflösung – die Anzeige spielt sie nacheinander ab. */
export interface Schritt {
  /** Zellen, die verschwinden. */
  treffer: number[]
  /** Käfige, die dabei aufspringen. */
  befreit: number[]
  /** Das Feld nach dem Nachrutschen. */
  feld: Zelle[]
  /** Die wievielte Auflösung in Folge (1 = der Zug selbst). */
  kette: number
}

/**
 * Alles auflösen, was gerade passt – so lange, bis nichts mehr fällt.
 *
 * Gibt jeden Zwischenstand zurück, damit die Anzeige die Kette vorführen
 * kann statt nur das Endergebnis zu zeigen.
 */
export function loeseAuf(
  feld: Zelle[],
  rows: number,
  cols: number,
  farben: number,
  zufall: number,
): { feld: Zelle[]; zufall: number; schritte: Schritt[]; gesammelt: number; befreit: number } {
  let aktuell = feld.map((z) => ({ ...z }))
  let z = zufall
  const schritte: Schritt[] = []
  let gesammelt = 0
  let befreitGesamt = 0

  for (let kette = 1; kette <= 60; kette++) {
    const treffer = findeTreffer(aktuell, rows, cols)
    if (treffer.length === 0) break
    const befreit = kaefigeDaneben(aktuell, rows, cols, treffer)
    for (const i of treffer) aktuell[i] = { farbe: 0, kaefig: false }
    for (const i of befreit) aktuell[i] = { ...aktuell[i]!, kaefig: false }
    gesammelt += treffer.length
    befreitGesamt += befreit.length
    const nach = rutschen(aktuell, rows, cols, farben, z)
    aktuell = nach.feld
    z = nach.zufall
    schritte.push({ treffer, befreit, feld: aktuell.map((x) => ({ ...x })), kette })
  }

  return { feld: aktuell, zufall: z, schritte, gesammelt, befreit: befreitGesamt }
}

/** Ob ein Tausch überhaupt erlaubt ist: benachbart, keiner im Käfig. */
export function tauschErlaubt(state: DumplingState, a: number, b: number): boolean {
  if (state.phase !== 'play') return false
  if (a < 0 || b < 0 || a >= state.feld.length || b >= state.feld.length) return false
  if (!sindNachbarn(a, b, state.cols)) return false
  if (state.feld[a]!.kaefig || state.feld[b]!.kaefig) return false
  return true
}

/** Ob ein Tausch auch etwas bringt: Entsteht dadurch eine Reihe? */
export function tauschBringtEtwas(state: DumplingState, a: number, b: number): boolean {
  if (!tauschErlaubt(state, a, b)) return false
  const probe = state.feld.map((z) => ({ ...z }))
  const merk = probe[a]!
  probe[a] = probe[b]!
  probe[b] = merk
  return findeTreffer(probe, state.rows, state.cols).length > 0
}

/** Alle Züge, die gerade etwas bringen. */
export function moeglicheZuege(state: DumplingState): [number, number][] {
  const out: [number, number][] = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const i = idx(r, c, state.cols)
      if (c + 1 < state.cols) {
        const j = idx(r, c + 1, state.cols)
        if (tauschBringtEtwas(state, i, j)) out.push([i, j])
      }
      if (r + 1 < state.rows) {
        const j = idx(r + 1, c, state.cols)
        if (tauschBringtEtwas(state, i, j)) out.push([i, j])
      }
    }
  }
  return out
}

export function hatZug(state: DumplingState): boolean {
  return moeglicheZuege(state).length > 0
}

/**
 * Ein festgefahrenes Feld neu mischen.
 *
 * Die Farben werden durchgetauscht, bis wieder ein Zug möglich ist und
 * nichts von allein passt. Käfige bleiben, wo sie sind -- sonst wäre das
 * Mischen ein Ausweg aus jeder schwierigen Lage.
 */
export function mische(state: DumplingState): DumplingState {
  let z = state.zufall
  for (let versuch = 0; versuch < 200; versuch++) {
    const feld = state.feld.map((x) => ({ ...x }))
    const frei: number[] = []
    for (let i = 0; i < feld.length; i++) if (!feld[i]!.kaefig) frei.push(i)
    for (let k = frei.length - 1; k > 0; k--) {
      const gezogen = zieh(z, k + 1)
      z = gezogen.zufall
      const a = frei[k]!
      const b = frei[gezogen.zahl]!
      const merk = feld[a]!.farbe
      feld[a] = { ...feld[a]!, farbe: feld[b]!.farbe }
      feld[b] = { ...feld[b]!, farbe: merk }
    }
    const probe: DumplingState = { ...state, feld, zufall: z }
    if (findeTreffer(feld, state.rows, state.cols).length === 0 && hatZug(probe)) {
      return { ...probe, mischungen: state.mischungen + 1 }
    }
  }
  return { ...state, zufall: z }
}

export interface ZugErgebnis {
  state: DumplingState
  /** Falsch, wenn der Tausch keine Reihe ergibt -- dann bleibt alles liegen. */
  gueltig: boolean
  schritte: Schritt[]
  /** Das Feld direkt nach dem Tausch, vor dem Auflösen (für die Anzeige). */
  getauscht: Zelle[]
  /** Ob danach neu gemischt werden musste. */
  gemischt: boolean
}

/** Zwei benachbarte Knödel tauschen und alles auflösen, was dadurch passt. */
export function tausche(state: DumplingState, a: number, b: number): ZugErgebnis {
  if (!tauschErlaubt(state, a, b)) {
    return { state, gueltig: false, schritte: [], getauscht: state.feld, gemischt: false }
  }
  const feld = state.feld.map((z) => ({ ...z }))
  const merk = feld[a]!
  feld[a] = feld[b]!
  feld[b] = merk

  if (findeTreffer(feld, state.rows, state.cols).length === 0) {
    return { state, gueltig: false, schritte: [], getauscht: feld, gemischt: false }
  }

  const auf = loeseAuf(feld, state.rows, state.cols, state.farben, state.zufall)
  let neu: DumplingState = {
    ...state,
    feld: auf.feld,
    zufall: auf.zufall,
    gesammelt: state.gesammelt + auf.gesammelt,
    kaefigeZu: Math.max(0, state.kaefigeZu - auf.befreit),
    zuege: state.zuege + 1,
    besteKette: Math.max(state.besteKette, auf.schritte.length),
  }
  neu = bewerte(neu)

  let gemischt = false
  if (neu.phase === 'play' && !hatZug(neu)) {
    neu = mische(neu)
    gemischt = true
  }

  return { state: neu, gueltig: true, schritte: auf.schritte, getauscht: feld, gemischt }
}

/**
 * Gewonnen ist, wenn das Ziel erreicht ist UND alle Käfige offen sind.
 *
 * Verloren wird nur über die Zeit -- die zählt die Anzeige, nicht die
 * Logik. Deshalb setzt `bewerte` nie auf 'lost'.
 */
function bewerte(state: DumplingState): DumplingState {
  if (state.phase !== 'play') return state
  const fertig = state.gesammelt >= state.ziel && state.kaefigeZu === 0
  return fertig ? { ...state, phase: 'won' } : state
}

/** Die Zeit ist um. */
export function zeitAbgelaufen(state: DumplingState): DumplingState {
  if (state.phase !== 'play') return state
  return { ...state, phase: 'lost' }
}

export function createDumplingMatch(level: DumplingLevel): DumplingState {
  const state: DumplingState = {
    level: level.level,
    rows: level.rows,
    cols: level.cols,
    farben: level.farben,
    feld: level.feld.map((z) => ({ ...z })),
    ziel: level.ziel,
    gesammelt: 0,
    kaefigeZu: level.feld.filter((z) => z.kaefig).length,
    zuege: 0,
    besteKette: 1,
    mischungen: 0,
    phase: 'play',
    zufall: level.saat,
  }
  return hatZug(state) ? state : mische(state)
}

export function fortschritt(state: DumplingState): number {
  return Math.min(1, state.ziel === 0 ? 1 : state.gesammelt / state.ziel)
}

export function isWon(state: DumplingState): boolean {
  return state.phase === 'won'
}

export function isLost(state: DumplingState): boolean {
  return state.phase === 'lost'
}
