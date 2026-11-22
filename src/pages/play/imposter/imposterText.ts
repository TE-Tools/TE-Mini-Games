/**
 * Finde den Imposter in der Sprache der Oberfläche.
 *
 * Das Spielmodul (src/games/finde-den-imposter) bleibt deutsch: Modi,
 * Chaos-Regeln und Phasen haben dort ihren deutschen Namen, und die
 * Fehlermeldungen der Engine sind deutsche Sätze -- Tests lesen sie. Hier
 * wird erst beim Rendern übersetzt: Namen über ihre Kennung, Meldungen über
 * ihr Muster. Was kein Muster trifft, bleibt, wie es ist -- lieber deutsch
 * als leer.
 *
 * Nicht übersetzt werden die Wörter, die Hilfswörter und die Namen der
 * Kategorien: Das ist Inhalt (online steht er in SQL), und ein englischer
 * Spieler braucht dafür eigene englische Listen.
 */

import {
  MODES,
  chaosRuleLabel,
  type ImposterModeId,
  type ImposterPhase,
} from '@/games/finde-den-imposter'
import type { Texte } from '@/i18n/sprache'

function nachschlagen<T>(tabelle: Record<string, T>, schluessel: string): T | null {
  return Object.prototype.hasOwnProperty.call(tabelle, schluessel) ? tabelle[schluessel]! : null
}

/** Name eines Modus: `classic` -> „Klassisch" bzw. „Classic". */
export function modusName(t: Texte, id: ImposterModeId | string): string {
  return nachschlagen(t.imposter.modi, id)?.name ?? MODES.find((m) => m.id === id)?.label ?? id
}

/** Erklärung eines Modus. */
export function modusText(t: Texte, id: ImposterModeId | string): string {
  return (
    nachschlagen(t.imposter.modi, id)?.text ?? MODES.find((m) => m.id === id)?.description ?? id
  )
}

/** Der Satz zu einer Chaos-Regel -- auch für die Kennungen, die online kommen. */
export function chaosRegel(t: Texte, id: string | null): string | null {
  if (!id) return null
  return nachschlagen(t.imposter.chaosRegeln, id) ?? chaosRuleLabel(id)
}

/** Kurzer Name einer Phase für die Kopfzeile. */
export function phasenName(t: Texte, phase: ImposterPhase): string {
  return nachschlagen(t.imposter.phasen, phase) ?? phase
}

/** Deutscher Modusname (wie in der Engine-Meldung) -> Name in der Oberflächensprache. */
function modusAusDeutschemNamen(t: Texte, name: string): string {
  const def = MODES.find((m) => m.label === name)
  return def ? modusName(t, def.id) : name
}

type Muster = [RegExp, (t: Texte, m: RegExpMatchArray) => string]

const ZAHL = (s: string | undefined) => Number(s ?? 0)

/**
 * Die deutschen Sätze aus engine.ts und customCategories.ts. Wer dort eine
 * Meldung ändert oder ergänzt, ergänzt hier das Muster.
 */
const MUSTER: Muster[] = [
  [/^Mindestens (\d+) Spieler nötig$/, (tx, m) => tx.imposter.fehler.mindestensSpieler(ZAHL(m[1]))],
  [/^Maximal (\d+) Spieler$/, (tx, m) => tx.imposter.fehler.hoechstensSpieler(ZAHL(m[1]))],
  [/^Name doppelt: (.*)$/s, (tx, m) => tx.imposter.fehler.nameDoppelt(m[1] ?? '')],
  [
    /^„(.*)" braucht mindestens (\d+) Mitspielende$/s,
    (tx, m) =>
      tx.imposter.fehler.modusBrauchtMindestens(modusAusDeutschemNamen(tx, m[1] ?? ''), ZAHL(m[2])),
  ],
  [/^Ungültige Imposter-Anzahl$/, (tx) => tx.imposter.fehler.imposterAnzahl],
  [/^Die Kategorie braucht einen Namen$/, (tx) => tx.imposter.fehler.kategorieOhneName],
  [
    /^Der Name ist zu lang \(höchstens (\d+) Zeichen\)$/,
    (tx, m) => tx.imposter.fehler.nameZuLang(ZAHL(m[1])),
  ],
  [
    /^Mindestens (\d+) verschiedene Wörter – es sind (\d+)$/,
    (tx, m) => tx.imposter.fehler.zuWenigWoerter(ZAHL(m[1]), ZAHL(m[2])),
  ],
  [/^„(.*)" gibt es schon$/s, (tx, m) => tx.imposter.fehler.gibtEsSchon(m[1] ?? '')],
  [
    /^Mehr als (\d+) eigene Kategorien gehen nicht$/,
    (tx, m) => tx.imposter.fehler.zuVieleKategorien(ZAHL(m[1])),
  ],
  [/^Das ist kein gültiges JSON/, (tx) => tx.imposter.fehler.keinJson],
  [/^In der Datei stecken keine Kategorien$/, (tx) => tx.imposter.fehler.keineKategorien],
  [
    /^(.*): braucht einen Namen und mindestens (\d+) Wörter$/s,
    (tx, m) =>
      tx.imposter.fehler.uebersprungenUnvollstaendig(
        m[1] === 'Namenloser Eintrag' ? tx.imposter.fehler.namenloserEintrag : (m[1] ?? ''),
        ZAHL(m[2]),
      ),
  ],
  [
    /^(.*): mehr als (\d+) Kategorien gehen nicht$/s,
    (tx, m) => tx.imposter.fehler.uebersprungenZuViele(m[1] ?? '', ZAHL(m[2])),
  ],
]

/** Eine deutsche Meldung des Spielmoduls in der Oberflächensprache. */
export function meldungText(t: Texte, meldung: string): string {
  for (const [muster, bauen] of MUSTER) {
    const treffer = meldung.match(muster)
    if (treffer) return bauen(t, treffer)
  }
  return meldung
}
