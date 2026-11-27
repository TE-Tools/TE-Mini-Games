/**
 * Mühle – eine Partie: Regeln, Zugfolge, Ende.
 *
 * Eine Partie ist unveränderlich: `zieheIn` liefert eine neue. Sie trägt
 * ihre Hausregeln mit (`regeln`), damit eine laufende Partie nicht von
 * einer geänderten Voreinstellung umgeworfen wird -- und damit online beide
 * Seiten mit denselben Regeln nachspielen.
 *
 * Wann Schluss ist:
 * - Wer weniger als drei Steine hat (Hand und Brett), verliert.
 * - Wer nicht ziehen kann, verliert.
 * - Remis: dreimal dieselbe Stellung; 25 Züge je Seite ohne Mühle; springen
 *   beide, 10 Züge je Seite ohne Mühle (Zahlen in `config.ts`). Das greift
 *   von selbst.
 * - Aufgeben, Remis vereinbaren und der ungültige Zug im Zugbuch kommen von
 *   außen (`beende`).
 */

import { REMIS, STANDARD_REGELN, STEINE, type MuehleRegeln } from './config'
import {
  andere,
  basisVon,
  brettVorSchlag,
  erlaubteZuege,
  findeZug,
  grundstellung,
  kurz,
  phaseVon,
  schluessel,
  steineVon,
  zaehle,
  ziehe,
  type Farbe,
  type Phase,
  type Stellung,
  type Zug,
} from './brett'

export type EndeArt =
  | 'zwei-steine'
  | 'blockiert'
  | 'wiederholung'
  | 'ohne-muehle'
  | 'endspiel'
  | 'aufgabe'
  | 'remis-vereinbart'
  | 'ungueltiger-zug'

export interface Ende {
  art: EndeArt
  /** Wer gewonnen hat; null bei Remis. */
  sieger: Farbe | null
}

export interface Partie {
  regeln: MuehleRegeln
  /** Die Stellung jetzt. */
  stellung: Stellung
  /** Die Züge in der Kurzform (d2, a1-a4xd7). */
  zuege: string[]
  /** Die Schlüssel aller Stellungen der Partie, die erste zuerst. */
  verlauf: string[]
  /** Der letzte Zug und wer ihn gespielt hat -- fürs Brett (Gleiten, Mühle, Schlag). */
  letzter: { zug: Zug; farbe: Farbe } | null
  ende: Ende | null
}

function endeVon(s: Stellung, r: MuehleRegeln, verlauf: readonly string[]): Ende | null {
  if (steineVon(s, s.amZug) < STEINE.mindestens) {
    return { art: 'zwei-steine', sieger: andere(s.amZug) }
  }
  if (erlaubteZuege(s, r).length === 0) return { art: 'blockiert', sieger: andere(s.amZug) }
  const zugphase = s.hand.w === 0 && s.hand.b === 0
  if (zugphase && s.ohneMuehle >= REMIS.halbzuegeOhneMuehle) {
    return { art: 'ohne-muehle', sieger: null }
  }
  const beideSpringen =
    zugphase && phaseVon(s, 'w', r) === 'springen' && phaseVon(s, 'b', r) === 'springen'
  if (beideSpringen && s.ohneMuehle >= REMIS.halbzuegeBeideSpringen) {
    return { art: 'endspiel', sieger: null }
  }
  const jetzt = verlauf[verlauf.length - 1]
  if (verlauf.filter((k) => k === jetzt).length >= REMIS.wiederholungen) {
    return { art: 'wiederholung', sieger: null }
  }
  return null
}

export function neuePartie(
  regeln: MuehleRegeln = STANDARD_REGELN,
  start = grundstellung(),
): Partie {
  const verlauf = [schluessel(start)]
  return {
    regeln: { ...regeln },
    stellung: start,
    zuege: [],
    verlauf,
    letzter: null,
    ende: endeVon(start, regeln, verlauf),
  }
}

/**
 * Einen Zug spielen. Liefert die neue Partie -- oder null, wenn der Zug
 * nicht erlaubt ist oder die Partie schon zu Ende war.
 */
export function zieheIn(p: Partie, text: string): Partie | null {
  if (p.ende) return null
  const z = findeZug(p.stellung, p.regeln, text)
  if (!z) return null
  const s = ziehe(p.stellung, z)
  const verlauf = [...p.verlauf, schluessel(s)]
  return {
    regeln: p.regeln,
    stellung: s,
    zuege: [...p.zuege, kurz(z)],
    verlauf,
    letzter: { zug: z, farbe: p.stellung.amZug },
    ende: endeVon(s, p.regeln, verlauf),
  }
}

/** Eine Partie aus einer Zugliste. Hält beim ersten Zug an, der nicht geht. */
export function partieAus(regeln: MuehleRegeln, zuege: readonly string[]): Partie {
  let p = neuePartie(regeln)
  for (const z of zuege) {
    const weiter = zieheIn(p, z)
    if (!weiter) break
    p = weiter
  }
  return p
}

/** Die Partie beenden, ohne dass auf dem Brett etwas geschieht. */
export function beende(p: Partie, ende: Ende): Partie {
  return p.ende ? p : { ...p, ende }
}

export function amZug(p: Partie): Farbe {
  return p.stellung.amZug
}

/** Was die Seite am Zug gerade tut: setzen, ziehen oder springen. */
export function phaseJetzt(p: Partie): Phase {
  return phaseVon(p.stellung, p.stellung.amZug, p.regeln)
}

/** Alle erlaubten Züge jetzt -- leer, wenn die Partie aus ist. */
export function zuegeJetzt(p: Partie): Zug[] {
  return p.ende ? [] : erlaubteZuege(p.stellung, p.regeln)
}

/** Die Züge, die mit diesem Setzen oder Ziehen beginnen (`d2`, `a1-a4`). */
export function zuegeMitBasis(p: Partie, basis: string): Zug[] {
  return zuegeJetzt(p).filter((z) => basisVon(z) === basis)
}

/** Die Punkte, auf die der Stein auf `von` jetzt ziehen kann. */
export function zieleVon(p: Partie, von: number): number[] {
  return [
    ...new Set(
      zuegeJetzt(p)
        .filter((z) => z.von === von)
        .map((z) => z.nach),
    ),
  ]
}

/** Die Steine, die jetzt ziehen können -- in der Setzphase keine. */
export function beweglicheSteine(p: Partie): number[] {
  const felder = new Set<number>()
  for (const z of zuegeJetzt(p)) if (z.von !== null) felder.add(z.von)
  return [...felder]
}

/** Die Punkte, auf die jetzt gesetzt werden kann -- außerhalb der Setzphase keine. */
export function setzFelder(p: Partie): number[] {
  return [
    ...new Set(
      zuegeJetzt(p)
        .filter((z) => z.von === null)
        .map((z) => z.nach),
    ),
  ]
}

/**
 * Wie das Brett aussieht, solange nach einer Mühle der Schlag noch
 * gewählt wird: Der Stein steht schon, geschlagen ist noch nichts.
 */
export function brettNachBasis(p: Partie, basis: string): number[] | null {
  const z = zuegeMitBasis(p, basis)[0]
  return z ? brettVorSchlag(p.stellung, z) : null
}

/** Wie viele Steine eine Seite hat -- auf dem Brett, in der Hand, schon verloren. */
export function bestand(p: Partie, f: Farbe): { brett: number; hand: number; verloren: number } {
  const z = zaehle(p.stellung, f)
  return { ...z, verloren: STEINE.jeSeite - z.brett - z.hand }
}
