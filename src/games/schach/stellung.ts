/**
 * Schach – die Stellung und ihre Züge (kein React, kein DOM).
 *
 * Das Brett ist ein 0x88-Feld: 128 Plätze, von denen die Hälfte nicht
 * existiert. Der Vorteil: Ob ein Schritt vom Brett führt, verrät ein
 * einziges `& 0x88` -- ohne Randfälle für jede Figur einzeln. Feld
 * `reihe * 16 + linie`, Reihe 0 ist die erste Reihe (Weiß), Linie 0 die
 * a-Linie.
 *
 * Figuren als Zahlen, Weiß positiv, Schwarz negativ: 1 Bauer, 2 Springer,
 * 3 Läufer, 4 Turm, 5 Dame, 6 König. So ist die Farbe ein Vorzeichen und
 * die Art ein Betrag.
 *
 * Die Stellung ist veränderlich: `ziehe` und `nimmZurueck` arbeiten am
 * selben Brett. Das braucht der Computergegner, der Hunderttausende
 * Stellungen durchgeht. Für die Oberfläche gibt es `kopie()`.
 *
 * Geprüft wird alles gegen die bekannten Perft-Zahlen (tests/schach-*):
 * Wie viele Zugfolgen gibt es von einer Stellung aus bis zur Tiefe n? Die
 * Zahlen sind seit Jahrzehnten bekannt, und schon eine falsche Rochade
 * oder ein vergessener en-passant-Fall verschiebt sie.
 */

export const BAUER = 1
export const SPRINGER = 2
export const LAEUFER = 3
export const TURM = 4
export const DAME = 5
export const KOENIG = 6

export type Farbe = 'w' | 'b'

/** Rochaderechte als Bits: weiß kurz, weiß lang, schwarz kurz, schwarz lang. */
export const WK = 1
export const WD = 2
export const SK = 4
export const SD = 8

export const ZUG_NORMAL = 0
export const ZUG_DOPPEL = 1
export const ZUG_EP = 2
export const ZUG_KURZ = 3
export const ZUG_LANG = 4

export interface Zug {
  von: number
  nach: number
  /** Die ziehende Figur, mit Vorzeichen. */
  figur: number
  /** Was geschlagen wird, mit Vorzeichen; 0 für nichts. */
  geschlagen: number
  /** Die Figurart nach der Umwandlung (2..5), sonst 0. */
  umwandlung: number
  art: number
}

interface Rueckweg {
  zug: Zug
  rochade: number
  ep: number
  halbzuege: number
}

const SPRINGER_SCHRITTE = [33, 31, 18, 14, -33, -31, -18, -14]
const KOENIG_SCHRITTE = [1, -1, 16, -16, 17, 15, -17, -15]
const LAEUFER_SCHRITTE = [17, 15, -17, -15]
const TURM_SCHRITTE = [1, -1, 16, -16]

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const ZEICHEN = ' pnbrqk'

export function feldName(feld: number): string {
  return 'abcdefgh'[feld & 7]! + String((feld >> 4) + 1)
}

export function feldAus(name: string): number {
  const linie = name.charCodeAt(0) - 97
  const reihe = name.charCodeAt(1) - 49
  if (linie < 0 || linie > 7 || reihe < 0 || reihe > 7 || name.length !== 2) return -1
  return reihe * 16 + linie
}

/**
 * Die Rochaderechte, die ein Feld kostet, wenn dort etwas zieht oder
 * geschlagen wird: König weg, beide Rechte weg; Turm weg, eines.
 */
const RECHTE_AN_FELD = new Map<number, number>([
  [0x04, WK | WD],
  [0x00, WD],
  [0x07, WK],
  [0x74, SK | SD],
  [0x70, SD],
  [0x77, SK],
])

export class Stellung {
  brett = new Int8Array(128)
  /** 1 = Weiß am Zug, -1 = Schwarz. */
  seite = 1
  rochade = 0
  /** Das Feld hinter einem Doppelschritt, sonst -1. */
  ep = -1
  /** Halbzüge seit dem letzten Bauernzug oder Schlagen (50-Züge-Regel). */
  halbzuege = 0
  zugNummer = 1
  /** Wo die Könige stehen, Weiß und Schwarz. */
  koenig: [number, number] = [-1, -1]
  private stapel: Rueckweg[] = []

  static ausFen(fen: string): Stellung {
    const s = new Stellung()
    const [figuren, seite, rochade, ep, halb, voll] = fen.trim().split(/\s+/)
    if (!figuren || !seite) throw new Error(`Ungültige Stellung: ${fen}`)
    const reihen = figuren.split('/')
    if (reihen.length !== 8) throw new Error(`Ungültige Stellung: ${fen}`)
    for (let r = 0; r < 8; r++) {
      let linie = 0
      for (const c of reihen[r]!) {
        if (c >= '1' && c <= '8') {
          linie += Number(c)
          continue
        }
        const art = ZEICHEN.indexOf(c.toLowerCase())
        if (art <= 0 || linie > 7) throw new Error(`Ungültige Stellung: ${fen}`)
        const feld = (7 - r) * 16 + linie
        const figur = c === c.toUpperCase() ? art : -art
        s.brett[feld] = figur
        if (art === KOENIG) s.koenig[figur > 0 ? 0 : 1] = feld
        linie++
      }
      if (linie !== 8) throw new Error(`Ungültige Stellung: ${fen}`)
    }
    s.seite = seite === 'b' ? -1 : 1
    s.rochade =
      (rochade?.includes('K') ? WK : 0) |
      (rochade?.includes('Q') ? WD : 0) |
      (rochade?.includes('k') ? SK : 0) |
      (rochade?.includes('q') ? SD : 0)
    s.ep = ep && ep !== '-' ? feldAus(ep) : -1
    s.halbzuege = Number(halb ?? 0) || 0
    s.zugNummer = Number(voll ?? 1) || 1
    return s
  }

  fen(): string {
    const reihen: string[] = []
    for (let r = 7; r >= 0; r--) {
      let zeile = ''
      let leer = 0
      for (let l = 0; l < 8; l++) {
        const f = this.brett[r * 16 + l]!
        if (f === 0) {
          leer++
          continue
        }
        if (leer) zeile += String(leer)
        leer = 0
        const c = ZEICHEN[Math.abs(f)]!
        zeile += f > 0 ? c.toUpperCase() : c
      }
      if (leer) zeile += String(leer)
      reihen.push(zeile)
    }
    const r =
      (this.rochade & WK ? 'K' : '') +
        (this.rochade & WD ? 'Q' : '') +
        (this.rochade & SK ? 'k' : '') +
        (this.rochade & SD ? 'q' : '') || '-'
    return `${reihen.join('/')} ${this.seite === 1 ? 'w' : 'b'} ${r} ${
      this.ep >= 0 ? feldName(this.ep) : '-'
    } ${this.halbzuege} ${this.zugNummer}`
  }

  kopie(): Stellung {
    const s = new Stellung()
    s.brett.set(this.brett)
    s.seite = this.seite
    s.rochade = this.rochade
    s.ep = this.ep
    s.halbzuege = this.halbzuege
    s.zugNummer = this.zugNummer
    s.koenig = [this.koenig[0], this.koenig[1]]
    return s
  }

  farbe(): Farbe {
    return this.seite === 1 ? 'w' : 'b'
  }

  /** Greift die Seite `von` (1 oder -1) das Feld an? */
  angegriffen(feld: number, von: number): boolean {
    const b = this.brett
    // Bauern: Ein weißer Bauer greift von unten an, also steht er eine Reihe tiefer.
    const bauer = von * BAUER
    const unten = von === 1 ? -16 : 16
    for (const seitlich of [-1, 1]) {
      const q = feld + unten + seitlich
      if (!(q & 0x88) && b[q] === bauer) return true
    }
    for (const s of SPRINGER_SCHRITTE) {
      const q = feld + s
      if (!(q & 0x88) && b[q] === von * SPRINGER) return true
    }
    for (const s of KOENIG_SCHRITTE) {
      const q = feld + s
      if (!(q & 0x88) && b[q] === von * KOENIG) return true
    }
    for (const s of LAEUFER_SCHRITTE) {
      let q = feld + s
      while (!(q & 0x88)) {
        const f = b[q]!
        if (f !== 0) {
          if (f === von * LAEUFER || f === von * DAME) return true
          break
        }
        q += s
      }
    }
    for (const s of TURM_SCHRITTE) {
      let q = feld + s
      while (!(q & 0x88)) {
        const f = b[q]!
        if (f !== 0) {
          if (f === von * TURM || f === von * DAME) return true
          break
        }
        q += s
      }
    }
    return false
  }

  /** Steht die Seite am Zug im Schach? */
  imSchach(seite = this.seite): boolean {
    const k = this.koenig[seite === 1 ? 0 : 1]
    return k >= 0 && this.angegriffen(k, -seite)
  }

  /**
   * Alle Züge, die die Figuren erlauben -- ohne zu prüfen, ob der eigene
   * König danach im Schach stünde. Rochade wird hier schon ganz geprüft:
   * Durch ein bedrohtes Feld zu ziehen, verbietet sie selbst.
   */
  pseudoZuege(nurSchlagen = false): Zug[] {
    const zuege: Zug[] = []
    const b = this.brett
    const seite = this.seite
    for (let feld = 0; feld < 128; feld++) {
      if (feld & 0x88) {
        feld += 7
        continue
      }
      const figur = b[feld]!
      if (figur === 0 || (figur > 0 ? 1 : -1) !== seite) continue
      const art = figur * seite

      if (art === BAUER) {
        const vor = seite === 1 ? 16 : -16
        const startReihe = seite === 1 ? 1 : 6
        const letzteReihe = seite === 1 ? 7 : 0
        const ziel = feld + vor
        if (!nurSchlagen && !(ziel & 0x88) && b[ziel] === 0) {
          if (ziel >> 4 === letzteReihe) {
            for (const u of [DAME, TURM, LAEUFER, SPRINGER]) {
              zuege.push({ von: feld, nach: ziel, figur, geschlagen: 0, umwandlung: u, art: ZUG_NORMAL })
            }
          } else {
            zuege.push({ von: feld, nach: ziel, figur, geschlagen: 0, umwandlung: 0, art: ZUG_NORMAL })
            const doppel = ziel + vor
            if (feld >> 4 === startReihe && b[doppel] === 0) {
              zuege.push({ von: feld, nach: doppel, figur, geschlagen: 0, umwandlung: 0, art: ZUG_DOPPEL })
            }
          }
        } else if (nurSchlagen && !(ziel & 0x88) && b[ziel] === 0 && ziel >> 4 === letzteReihe) {
          // Umwandeln ohne zu schlagen gehört in die Ruhesuche: Es ändert das Material.
          zuege.push({ von: feld, nach: ziel, figur, geschlagen: 0, umwandlung: DAME, art: ZUG_NORMAL })
        }
        for (const seitlich of [-1, 1]) {
          const q = feld + vor + seitlich
          if (q & 0x88) continue
          const opfer = b[q]!
          if (opfer !== 0 && (opfer > 0 ? 1 : -1) === -seite) {
            if (q >> 4 === letzteReihe) {
              for (const u of nurSchlagen ? [DAME] : [DAME, TURM, LAEUFER, SPRINGER]) {
                zuege.push({ von: feld, nach: q, figur, geschlagen: opfer, umwandlung: u, art: ZUG_NORMAL })
              }
            } else {
              zuege.push({ von: feld, nach: q, figur, geschlagen: opfer, umwandlung: 0, art: ZUG_NORMAL })
            }
          } else if (q === this.ep) {
            zuege.push({ von: feld, nach: q, figur, geschlagen: -seite * BAUER, umwandlung: 0, art: ZUG_EP })
          }
        }
        continue
      }

      if (art === SPRINGER || art === KOENIG) {
        for (const s of art === SPRINGER ? SPRINGER_SCHRITTE : KOENIG_SCHRITTE) {
          const q = feld + s
          if (q & 0x88) continue
          const opfer = b[q]!
          if (opfer === 0) {
            if (!nurSchlagen) {
              zuege.push({ von: feld, nach: q, figur, geschlagen: 0, umwandlung: 0, art: ZUG_NORMAL })
            }
          } else if ((opfer > 0 ? 1 : -1) === -seite) {
            zuege.push({ von: feld, nach: q, figur, geschlagen: opfer, umwandlung: 0, art: ZUG_NORMAL })
          }
        }
        if (art === KOENIG && !nurSchlagen) this.rochaden(feld, zuege)
        continue
      }

      const richtungen =
        art === LAEUFER ? LAEUFER_SCHRITTE : art === TURM ? TURM_SCHRITTE : KOENIG_SCHRITTE
      for (const s of richtungen) {
        let q = feld + s
        while (!(q & 0x88)) {
          const opfer = b[q]!
          if (opfer === 0) {
            if (!nurSchlagen) {
              zuege.push({ von: feld, nach: q, figur, geschlagen: 0, umwandlung: 0, art: ZUG_NORMAL })
            }
          } else {
            if ((opfer > 0 ? 1 : -1) === -seite) {
              zuege.push({ von: feld, nach: q, figur, geschlagen: opfer, umwandlung: 0, art: ZUG_NORMAL })
            }
            break
          }
          q += s
        }
      }
    }
    return zuege
  }

  private rochaden(feld: number, zuege: Zug[]): void {
    const b = this.brett
    const weiss = this.seite === 1
    const grund = weiss ? 0x00 : 0x70
    if (feld !== grund + 4) return
    const kurz = weiss ? WK : SK
    const lang = weiss ? WD : SD
    const turm = this.seite * TURM
    const gegner = -this.seite
    if (this.rochade & (kurz | lang) && this.angegriffen(feld, gegner)) return
    if (
      this.rochade & kurz &&
      b[grund + 5] === 0 &&
      b[grund + 6] === 0 &&
      b[grund + 7] === turm &&
      !this.angegriffen(grund + 5, gegner) &&
      !this.angegriffen(grund + 6, gegner)
    ) {
      zuege.push({ von: feld, nach: grund + 6, figur: b[feld]!, geschlagen: 0, umwandlung: 0, art: ZUG_KURZ })
    }
    if (
      this.rochade & lang &&
      b[grund + 3] === 0 &&
      b[grund + 2] === 0 &&
      b[grund + 1] === 0 &&
      b[grund + 0] === turm &&
      !this.angegriffen(grund + 3, gegner) &&
      !this.angegriffen(grund + 2, gegner)
    ) {
      zuege.push({ von: feld, nach: grund + 2, figur: b[feld]!, geschlagen: 0, umwandlung: 0, art: ZUG_LANG })
    }
  }

  /** Einen Zug ausführen. Ob er erlaubt ist, prüft `legaleZuege`. */
  ziehe(z: Zug): void {
    const b = this.brett
    this.stapel.push({ zug: z, rochade: this.rochade, ep: this.ep, halbzuege: this.halbzuege })

    b[z.von] = 0
    b[z.nach] = z.umwandlung ? (z.figur > 0 ? z.umwandlung : -z.umwandlung) : z.figur
    if (z.art === ZUG_EP) b[z.nach + (z.figur > 0 ? -16 : 16)] = 0
    if (z.art === ZUG_KURZ) {
      b[z.von + 1] = b[z.von + 3]!
      b[z.von + 3] = 0
    } else if (z.art === ZUG_LANG) {
      b[z.von - 1] = b[z.von - 4]!
      b[z.von - 4] = 0
    }
    if (Math.abs(z.figur) === KOENIG) this.koenig[z.figur > 0 ? 0 : 1] = z.nach

    this.rochade &= ~((RECHTE_AN_FELD.get(z.von) ?? 0) | (RECHTE_AN_FELD.get(z.nach) ?? 0))
    this.ep = z.art === ZUG_DOPPEL ? (z.von + z.nach) >> 1 : -1
    this.halbzuege = Math.abs(z.figur) === BAUER || z.geschlagen ? 0 : this.halbzuege + 1
    if (this.seite === -1) this.zugNummer++
    this.seite = -this.seite
  }

  nimmZurueck(): void {
    const r = this.stapel.pop()
    if (!r) return
    const z = r.zug
    const b = this.brett
    this.seite = -this.seite
    if (this.seite === -1) this.zugNummer--
    b[z.von] = z.figur
    if (z.art === ZUG_EP) {
      b[z.nach] = 0
      b[z.nach + (z.figur > 0 ? -16 : 16)] = z.geschlagen
    } else {
      b[z.nach] = z.geschlagen
    }
    if (z.art === ZUG_KURZ) {
      b[z.von + 3] = b[z.von + 1]!
      b[z.von + 1] = 0
    } else if (z.art === ZUG_LANG) {
      b[z.von - 4] = b[z.von - 1]!
      b[z.von - 1] = 0
    }
    if (Math.abs(z.figur) === KOENIG) this.koenig[z.figur > 0 ? 0 : 1] = z.von
    this.rochade = r.rochade
    this.ep = r.ep
    this.halbzuege = r.halbzuege
  }

  /** Die Züge, die wirklich erlaubt sind: danach steht der eigene König nicht im Schach. */
  legaleZuege(): Zug[] {
    const ergebnis: Zug[] = []
    const seite = this.seite
    for (const z of this.pseudoZuege()) {
      this.ziehe(z)
      if (!this.imSchach(seite)) ergebnis.push(z)
      this.nimmZurueck()
    }
    return ergebnis
  }

  /**
   * Die Stellung als Schlüssel für die Wiederholungsregel: Brett, wer am
   * Zug ist, Rochaderechte -- und das en-passant-Feld nur, wenn dort auch
   * wirklich geschlagen werden kann. Sonst wären zwei gleiche Stellungen
   * verschieden, nur weil zuvor ein Bauer zwei Felder gezogen ist.
   */
  schluessel(): string {
    let ep = '-'
    if (this.ep >= 0) {
      const bauer = this.seite * BAUER
      const unten = this.seite === 1 ? -16 : 16
      for (const seitlich of [-1, 1]) {
        const q = this.ep + unten + seitlich
        if (!(q & 0x88) && this.brett[q] === bauer) ep = feldName(this.ep)
      }
    }
    return this.fen().split(' ').slice(0, 3).join(' ') + ' ' + ep
  }
}

/** Ein Zug in der üblichen Kurzform: e2e4, e7e8q. */
export function uci(z: Zug): string {
  return feldName(z.von) + feldName(z.nach) + (z.umwandlung ? ZEICHEN[z.umwandlung]! : '')
}

/** Zugfolgen bis zur Tiefe n zählen -- der Prüfstein für den Zuggenerator. */
export function perft(s: Stellung, tiefe: number): number {
  if (tiefe === 0) return 1
  const zuege = s.legaleZuege()
  if (tiefe === 1) return zuege.length
  let n = 0
  for (const z of zuege) {
    s.ziehe(z)
    n += perft(s, tiefe - 1)
    s.nimmZurueck()
  }
  return n
}
