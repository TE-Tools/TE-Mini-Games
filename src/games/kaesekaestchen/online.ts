/**
 * Käsekästchen online: das Zugbuch.
 *
 * Wie bei Schach (siehe dort) hält der Server nur ein Zugbuch: wer am
 * Blatt sitzt, in welcher Reihenfolge, wer anfängt, und die Linien der
 * Reihe nach. Eine Spielregel steht dort nicht.
 *
 * DIE BESONDERHEIT: Wer als Nächstes dran ist, hängt hier an der Regel --
 * wer ein Kästchen schließt, zieht noch einmal. Der Server kann das nicht
 * wissen, ohne die Regel zu kennen. Deshalb meldet der Ziehende mit der
 * Linie auch, wer danach dran ist (`weiter`, ein Sitz). Der Server prüft
 * nur, dass der Absender laut seinem Buch am Zug ist, dass die Linie auf
 * dem Blatt liegt und noch frei ist und dass `weiter` ein Sitz am Tisch
 * ist -- und gibt dann `weiter` den Zug.
 *
 * Ob `weiter` stimmt, rechnet jeder Mitspieler selbst nach, indem er das
 * Buch durch diese Engine spielt. Stimmt es nicht, hat der Absender
 * geschummelt (oder einen Fehler im Programm): Die Partie endet dort, und
 * er hat verloren -- wie bei Schach der unmögliche Zug. Alle kommen zu
 * demselben Schluss, denn alle spielen dasselbe Buch durch dieselbe Engine.
 *
 * Aufgeben beendet die Partie für alle: Wer aufgibt, hat verloren; unter
 * den anderen entscheiden die Kästchen.
 */

import { naechsterNach, neuePartie, vorne, ziehe, type Partie } from './partie'

export type KaestchenAktion = { art: 'linie'; linie: number; weiter: number } | { art: 'aufgeben' }

export interface KaestchenEintrag {
  nr: number
  seat: number
  aktion: KaestchenAktion
}

/** Was der Server beim Start festhält. */
export interface OnlineTisch {
  breite: number
  hoehe: number
  /** Die Sitze in Zugreihenfolge (aufsteigend), beim Start festgehalten. */
  sitze: readonly number[]
  /** Der Sitz, der anfängt. */
  beginner: number
}

export type OnlineEnde =
  { art: 'fertig' } | { art: 'aufgabe'; sitz: number } | { art: 'ungueltig'; sitz: number }

export interface OnlineStand {
  partie: Partie
  ende: OnlineEnde | null
}

export function neuerStand(tisch: OnlineTisch): OnlineStand {
  const beginner = Math.max(0, tisch.sitze.indexOf(tisch.beginner))
  return {
    partie: neuePartie(tisch.breite, tisch.hoehe, tisch.sitze.length, beginner),
    ende: null,
  }
}

/** Welcher Sitz gerade am Zug ist -- null, wenn die Partie aus ist. */
export function sitzAmZug(stand: OnlineStand, tisch: OnlineTisch): number | null {
  if (stand.ende) return null
  return tisch.sitze[stand.partie.amZug] ?? null
}

/**
 * Wer nach dieser Linie dran ist, als Sitz -- das schickt der Ziehende mit.
 * Schließt die letzte Linie das letzte Kästchen, bleibt es beim Ziehenden.
 */
export function weiterNach(stand: OnlineStand, tisch: OnlineTisch, linie: number): number {
  return tisch.sitze[naechsterNach(stand.partie, linie)]!
}

/** Einen Eintrag anwenden -- oder liegen lassen. */
export function wendeAn(
  stand: OnlineStand,
  eintrag: KaestchenEintrag,
  tisch: OnlineTisch,
): OnlineStand {
  if (stand.ende) return stand
  const spieler = tisch.sitze.indexOf(eintrag.seat)
  if (spieler < 0) return stand
  const a = eintrag.aktion

  if (a.art === 'aufgeben') {
    return { partie: stand.partie, ende: { art: 'aufgabe', sitz: eintrag.seat } }
  }
  if (a.art !== 'linie') return stand
  // Wer nicht dran ist, zählt nicht. Der Server lässt das nicht zu; kommt
  // es trotzdem an, ist vorher schon etwas Ungültiges passiert.
  if (stand.partie.amZug !== spieler) return stand

  const neu = ziehe(stand.partie, a.linie)
  if (!neu) return { partie: stand.partie, ende: { art: 'ungueltig', sitz: eintrag.seat } }
  if (a.weiter !== weiterNach(stand, tisch, a.linie)) {
    return { partie: stand.partie, ende: { art: 'ungueltig', sitz: eintrag.seat } }
  }
  return { partie: neu, ende: neu.vorbei ? { art: 'fertig' } : null }
}

/** Die Partie aus dem Zugbuch nachspielen. */
export function standAus(tisch: OnlineTisch, buch: readonly KaestchenEintrag[]): OnlineStand {
  const geordnet = [...buch].sort((a, b) => a.nr - b.nr)
  return geordnet.reduce((s, e) => wendeAn(s, e, tisch), neuerStand(tisch))
}

export type OnlineAusgang = 'sieg' | 'remis' | 'niederlage'

/**
 * Wie es für einen Sitz ausging. Wer aufgibt oder Ungültiges schickt,
 * verliert; unter den übrigen entscheiden die Kästchen.
 */
export function ausgangFuerSitz(
  stand: OnlineStand,
  tisch: OnlineTisch,
  sitz: number,
): OnlineAusgang | null {
  const ende = stand.ende
  if (!ende) return null
  const ich = tisch.sitze.indexOf(sitz)
  if (ich < 0) return null
  const raus = ende.art === 'fertig' ? [] : [tisch.sitze.indexOf(ende.sitz)]
  if (raus.includes(ich)) return 'niederlage'
  const best = vorne(stand.partie.punkte, raus)
  if (!best.includes(ich)) return 'niederlage'
  return best.length > 1 ? 'remis' : 'sieg'
}
