/**
 * Karten und Protokoll in der Sprache der Oberfläche.
 *
 * Die Engine (src/games/maumau) bleibt deutsch: Farben heissen dort
 * `herz` und `rot`, ein Bube steht als 'B' auf der Karte, und das
 * Protokoll schreibt „Lena legt 7♥". Das ist Kennung, nicht Anzeige --
 * Tests lesen es, und online schreibt der Server (Migration 023)
 * dieselben Zeilen in derselben Form.
 *
 * Deshalb wird hier erst beim Rendern übersetzt: Farbe und Bild über
 * ihre Kennung, Protokollzeilen über ihr Muster. Eine Zeile, die kein
 * Muster trifft, bleibt, wie sie ist -- lieber deutsch als leer.
 */

import { FARB_ZEICHEN, FRANZ_FARBEN, type Karte } from '@/games/maumau'
import type { Texte } from '@/i18n/sprache'

type Wirkungsname = keyof Texte['maumau']['wirkungen']

function nachschlagen<T extends string>(tabelle: Record<string, T>, schluessel: string): T | null {
  return Object.prototype.hasOwnProperty.call(tabelle, schluessel) ? tabelle[schluessel]! : null
}

/** Der Name einer Farbe: `herz` -> „Herz" bzw. „Hearts". */
export function farbName(t: Texte, farbe: string): string {
  return nachschlagen(t.maumau.farben, farbe) ?? farbe
}

/** Was in der Ecke steht: aus dem Buben 'B' wird auf Englisch 'J'. */
export function eckText(t: Texte, text: string): string {
  return nachschlagen(t.maumau.bildEcke, text) ?? text
}

function istFranzoesisch(farbe: string | null): boolean {
  return farbe !== null && (FRANZ_FARBEN as readonly string[]).includes(farbe)
}

/** Wie die Karte vorgelesen wird -- die übersetzte Fassung von `karteName`. */
export function karteVorlesen(t: Texte, k: Karte): string {
  const m = t.maumau
  const wirkung =
    k.wirkung === 'keine' || k.wirkung === 'haende'
      ? null
      : m.wirkungen[k.wirkung satisfies Wirkungsname]
  if (istFranzoesisch(k.farbe)) {
    const rang = nachschlagen(m.bildName, k.text) ?? k.text
    return m.karteFranz(farbName(t, k.farbe!), rang, wirkung)
  }
  const farbe = k.farbe ? farbName(t, k.farbe) : m.schwarz
  return m.karteBunt(farbe, wirkung ?? k.text)
}

/* ------------------------------------------------------------ Protokoll */

const ZEICHEN_ZU_FARBE: Record<string, string> = Object.fromEntries(
  FRANZ_FARBEN.map((f) => [FARB_ZEICHEN[f]!, f]),
)

/** Die deutschen Farbnamen der Kurzform („Rot +2") zurück auf die Kennung. */
const BUNT_NAME_ZU_FARBE: Record<string, string> = {
  Rot: 'rot',
  Blau: 'blau',
  Grün: 'gruen',
  Gelb: 'gelb',
}

/**
 * Die Kurzform aus dem Protokoll („7♥", „Rot +2", „Wunsch", „+4") in der
 * Sprache der Oberfläche. Unbekanntes bleibt stehen.
 */
export function kurzUebersetzen(t: Texte, kurz: string): string {
  if (kurz === 'Wunsch') return t.maumau.wunschKurz
  const franz = /^(.+)([♥♦♠♣])$/u.exec(kurz)
  if (franz && ZEICHEN_ZU_FARBE[franz[2]!]) return `${eckText(t, franz[1]!)}${franz[2]}`
  const bunt = /^(\S+) (.+)$/u.exec(kurz)
  if (bunt) {
    const farbe = nachschlagen(BUNT_NAME_ZU_FARBE, bunt[1]!)
    if (farbe) return `${farbName(t, farbe)} ${bunt[2]}`
  }
  return kurz
}

/**
 * Eine Zeile aus dem Protokoll -- von der Engine („Du legst …") oder vom
 * Server („Lena legt …") -- in der Sprache der Oberfläche.
 *
 * Die Muster sind die, die `notiere()` in engine.ts und `mm_e_notiere`
 * in Migration 023 schreiben. Kommt dort eine Zeile dazu, gehört ihr
 * Muster hierher; bis dahin erscheint sie deutsch.
 */
export function protokollZeile(t: Texte, zeile: string): string {
  const p = t.maumau.protokoll
  switch (zeile) {
    case 'Der Stapel wird neu gemischt':
      return p.neuGemischt
    case 'Der Stapel ist leer':
      return p.stapelLeer
    case 'Niemand kann mehr legen':
      return p.niemandKann
    case 'Die Hände wandern weiter':
      return p.haendeWandern
    case 'Du: Mau!':
      return p.duMau
  }

  let m: RegExpExecArray | null
  if ((m = /^Es liegt (.+)$/u.exec(zeile))) return p.esLiegt(kurzUebersetzen(t, m[1]!))
  if ((m = /^Du legst (.+)$/u.exec(zeile))) return p.duLegst(kurzUebersetzen(t, m[1]!))
  if ((m = /^Du ziehst (\d+)$/u.exec(zeile))) return p.duZiehst(Number(m[1]))
  if ((m = /^Du hast Mau vergessen und ziehst (\d+)$/u.exec(zeile)))
    return p.duMauVergessen(Number(m[1]))
  if ((m = /^(.+) hat Mau vergessen und zieht (\d+)$/u.exec(zeile)))
    return p.mauVergessen(m[1]!, Number(m[2]))
  if ((m = /^(.+) legt (.+)$/u.exec(zeile))) return p.legt(m[1]!, kurzUebersetzen(t, m[2]!))
  if ((m = /^(.+) zieht (\d+)$/u.exec(zeile))) return p.zieht(m[1]!, Number(m[2]))
  if ((m = /^(.+): Mau!$/u.exec(zeile))) return p.mau(m[1]!)
  return zeile
}
