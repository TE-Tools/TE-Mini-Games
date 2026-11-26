/**
 * Dame – eine Partie: Regeln, Zugfolge, Ende.
 *
 * Eine Partie ist unveränderlich: `zieheIn` liefert eine neue. Sie trägt
 * ihre Hausregeln mit (`regeln`), damit eine laufende Partie nicht von
 * einer geänderten Voreinstellung umgeworfen wird -- und damit online beide
 * Seiten mit denselben Regeln nachspielen.
 *
 * Wann Schluss ist:
 * - Wer nicht mehr ziehen kann, verliert -- weil er keine Steine mehr hat
 *   oder weil alle festsitzen.
 * - Remis: dreimal dieselbe Stellung, oder 25 Züge je Seite ohne Schlagen
 *   und ohne Steinzug (Werte in `config.ts`). Beides greift von selbst.
 * - Aufgeben, Remis vereinbaren und der ungültige Zug im Zugbuch kommen von
 *   außen (`beende`).
 */

import { REMIS, STANDARD_REGELN, type DameRegeln } from './config'
import {
  andere,
  erlaubteZuege,
  findeZug,
  grundstellung,
  kurz,
  schluessel,
  vorzeichen,
  ziehe,
  type Farbe,
  type Stellung,
  type Zug,
} from './brett'

export type EndeArt =
  | 'keine-steine'
  | 'blockiert'
  | 'wiederholung'
  | 'ohne-fortschritt'
  | 'aufgabe'
  | 'remis-vereinbart'
  | 'ungueltiger-zug'

export interface Ende {
  art: EndeArt
  /** Wer gewonnen hat; null bei Remis. */
  sieger: Farbe | null
}

export interface Partie {
  regeln: DameRegeln
  /** Die Stellung jetzt. */
  stellung: Stellung
  /** Die Züge in der Kurzform (c3-d4, e3xc5xa7). */
  zuege: string[]
  /** Die Schlüssel aller Stellungen der Partie, die erste zuerst. */
  verlauf: string[]
  /** Der letzte Zug und was er geschlagen hat -- fürs Brett (Gleiten, verblassende Steine). */
  letzter: { zug: Zug; opfer: number[] } | null
  ende: Ende | null
}

function endeVon(s: Stellung, r: DameRegeln, verlauf: readonly string[]): Ende | null {
  if (erlaubteZuege(s, r).length === 0) {
    const vz = vorzeichen(s.amZug)
    const hatSteine = s.brett.some((f) => f * vz > 0)
    return { art: hatSteine ? 'blockiert' : 'keine-steine', sieger: andere(s.amZug) }
  }
  if (s.ohneFortschritt >= REMIS.halbzuegeOhneFortschritt) {
    return { art: 'ohne-fortschritt', sieger: null }
  }
  const jetzt = verlauf[verlauf.length - 1]
  if (verlauf.filter((k) => k === jetzt).length >= REMIS.wiederholungen) {
    return { art: 'wiederholung', sieger: null }
  }
  return null
}

export function neuePartie(regeln: DameRegeln = STANDARD_REGELN, start = grundstellung()): Partie {
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
    letzter: { zug: z, opfer: z.geschlagen.map((g) => p.stellung.brett[g]!) },
    ende: endeVon(s, p.regeln, verlauf),
  }
}

/** Eine Partie aus einer Zugliste. Hält beim ersten Zug an, der nicht geht. */
export function partieAus(regeln: DameRegeln, zuege: readonly string[]): Partie {
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

/** Alle erlaubten Züge jetzt -- leer, wenn die Partie aus ist. */
export function zuegeJetzt(p: Partie): Zug[] {
  return p.ende ? [] : erlaubteZuege(p.stellung, p.regeln)
}

const beginntMit = (pfad: readonly number[], anfang: readonly number[]) =>
  anfang.every((f, i) => pfad[i] === f)

/**
 * Die Züge der Figur auf `von`, die zu den schon angetippten Landefeldern
 * passen. So lässt sich eine Schlagfolge Sprung für Sprung antippen.
 */
export function zuegeVon(p: Partie, von: number, teilpfad: readonly number[] = []): Zug[] {
  return zuegeJetzt(p).filter((z) => z.von === von && beginntMit(z.pfad, teilpfad))
}

/** Die Felder, die als nächstes angetippt werden können. */
export function naechsteFelder(p: Partie, von: number, teilpfad: readonly number[] = []): number[] {
  const felder = new Set<number>()
  for (const z of zuegeVon(p, von, teilpfad)) {
    const f = z.pfad[teilpfad.length]
    if (f !== undefined) felder.add(f)
  }
  return [...felder]
}

/**
 * Die Steine, die schlagen müssen -- nur bei Schlagzwang, sonst leer. Die
 * Seite hebt sie hervor, damit niemand rätselt, warum ein Stein nicht geht.
 */
export function schlagpflichtig(p: Partie): number[] {
  if (!p.regeln.schlagzwang) return []
  const felder = new Set<number>()
  for (const z of zuegeJetzt(p)) if (z.geschlagen.length > 0) felder.add(z.von)
  return [...felder]
}
