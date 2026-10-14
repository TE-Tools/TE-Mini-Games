/**
 * Meine Würfelauswahl gegen den nächsten Abruf verteidigen.
 *
 * Thomas am 14.10.2026: "wenn ich welche markiere die bleiben sollen,
 * sollen die markiert bleiben für den nächsten Wurf."
 *
 * Im Solospiel war daran nichts auszusetzen (nachgemessen: über Wurf zwei
 * und drei bleibt alles stehen). Online aber lief ein Wettrennen:
 *
 *   1. Ich tippe einen Würfel an. Die Anzeige merkt ihn sich sofort,
 *      damit es sich nicht träge anfühlt.
 *   2. Die Meldung geht zum Server.
 *   3. Dazwischen holt die Seite den Stand neu -- alle vier Sekunden von
 *      selbst, und zusätzlich bei jeder Regung im Raum.
 *
 * Kommt 3 vor dem Ende von 2 an, überschreibt der alte Serverstand meine
 * Markierung, und sie springt vor meinen Augen wieder heraus. Auf einem
 * Telefon im Mobilfunknetz ist das kein seltener Fall.
 *
 * Deshalb gilt: Was ich angetippt habe, steht -- bis der Server denselben
 * Stand zurückmeldet oder der Wurf weitergeht. Dann hat der Server recht,
 * denn dann weiß er mehr als ich.
 */

import type { KniffelOnlineState } from '@/services/kniffelOnline'

export interface EigeneAuswahl {
  /** Zu welchem Wurf diese Auswahl gehört. */
  wurf: number
  gehalten: boolean[]
}

function gleich(a: readonly boolean[], b: readonly boolean[]): boolean {
  return a.length === b.length && a.every((w, i) => w === b[i])
}

/** Ist die Auswahl angekommen oder überholt? Dann weg damit. */
export function auswahlErledigt(neu: KniffelOnlineState, wunsch: EigeneAuswahl | null): boolean {
  if (!wunsch) return true
  if (wunsch.wurf !== neu.match.wurf_nummer) return true
  return gleich(wunsch.gehalten, neu.match.gehalten)
}

/**
 * Den frisch geholten Stand mit meiner noch nicht bestätigten Auswahl
 * zusammenbringen. Alles andere am Stand bleibt, wie der Server es sagt --
 * gestritten wird nur um die fünf Häkchen.
 */
export function mitEigenerAuswahl(
  neu: KniffelOnlineState,
  wunsch: EigeneAuswahl | null,
): KniffelOnlineState {
  if (!wunsch || auswahlErledigt(neu, wunsch)) return neu
  return { ...neu, match: { ...neu.match, gehalten: [...wunsch.gehalten] } }
}
