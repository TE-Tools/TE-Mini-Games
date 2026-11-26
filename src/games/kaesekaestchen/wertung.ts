/**
 * Was eine Partie wert ist. Eigene Datei wie bei Schach: So lässt sich
 * prüfen, was gebucht wird, ohne eine Partie zu spielen.
 */
import { GROESSEN, PUNKTE, type KaestchenGroesse, type KaestchenStufe } from './config'
import { vorne, type Partie } from './partie'

export type Gegner = KaestchenStufe | 'online'

export type Ausgang = 'sieg' | 'remis' | 'niederlage'

/** Wie eine beendete Partie für einen Spieler ausging; null, solange sie läuft. */
export function ausgangFuer(p: Partie, spieler: number): Ausgang | null {
  if (!p.vorbei) return null
  const best = vorne(p.punkte)
  if (!best.includes(spieler)) return 'niederlage'
  return best.length > 1 ? 'remis' : 'sieg'
}

/** Die Größe zu einem Blatt -- für Blätter, die keiner Stufe entsprechen, die nächstkleinere. */
export function groesseVon(breite: number, hoehe: number): KaestchenGroesse {
  const kaestchen = breite * hoehe
  const passend = (Object.keys(GROESSEN) as KaestchenGroesse[])
    .filter((g) => GROESSEN[g].breite * GROESSEN[g].hoehe <= kaestchen)
    .sort((a, b) => GROESSEN[b].breite * GROESSEN[b].hoehe - GROESSEN[a].breite * GROESSEN[a].hoehe)
  return passend[0] ?? 'klein'
}

export function partiePunkte(ausgang: Ausgang, gegner: Gegner, groesse: KaestchenGroesse): number {
  const faktor = GROESSEN[groesse].punkteFaktor
  if (ausgang === 'niederlage') return PUNKTE.niederlage
  const sieg = Math.round(PUNKTE.sieg[gegner] * faktor)
  return ausgang === 'sieg' ? sieg : Math.round(sieg * PUNKTE.remisAnteil)
}

export function partieXp(punkte: number): number {
  return Math.round(punkte / 4)
}
