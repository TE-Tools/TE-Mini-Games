/**
 * Wertung einer Runde, in der ein Belohnungsvideo geholfen hat.
 *
 * Regel (07.11.2026, Thomas, siehe src/services/werbung.ts): Werbung kauft
 * Hilfe oder Aussehen, nie Punkte. Eine Hilfe -- Level überspringen,
 * Wiederbeleben, noch ein Versuch -- darf Punkte und XP nicht über das
 * heben, was die Runde ohne sie gebracht hätte. Ohne die Hilfe wäre die
 * Runde gescheitert (Tod, Fehlversuch, festgefahren), hätte also nichts
 * gebracht. Darum:
 *
 *  - keine Punkte, keine XP,
 *  - höchstens ein Stern,
 *  - kein Rekord, keine Bestzeit.
 *
 * Der Fortschritt zählt trotzdem: Das nächste Level wird frei. Gebucht wird
 * das in `saveGameResult` über `mitWerbehilfe` -- dort greift diese Funktion,
 * damit kein Spiel die Regel vergessen kann.
 */

/** Höchstens so viele Sterne gibt eine Runde mit Werbehilfe. */
export const STERNE_MIT_WERBEHILFE = 1

export interface Wertung {
  score: number
  xp: number
  stars: number
}

export function wertungMitWerbehilfe(w: Wertung): Wertung {
  return {
    score: 0,
    xp: 0,
    stars: Math.max(0, Math.min(STERNE_MIT_WERBEHILFE, w.stars)),
  }
}
