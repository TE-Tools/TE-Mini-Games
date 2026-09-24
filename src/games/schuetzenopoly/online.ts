/**
 * Schützenopoly online: das Zugbuch.
 *
 * Thomas am 24.09.2026: "danach bitte Online-Funktion wie bei den anderen
 * Spielen -- ich mache ein Online-Game auf, wo andere Spieler joinen können,
 * steht dann unter offene Spiele."
 *
 * ## Warum ein Zugbuch und kein Spielstand auf dem Server
 *
 * Beim Kniffel rechnet der Server, weil dort der Würfel das ganze Spiel ist.
 * Hier ginge das nicht ohne die gesamte Engine ein zweites Mal in SQL --
 * Karten, Gebühren, Rollen, Insolvenz, Minispiele. Zwei Fassungen derselben
 * Regeln, die auseinanderlaufen, sobald jemand eine davon anfasst.
 *
 * Deshalb hält der Server nur drei Dinge:
 *
 *   1. den Startwert des Zufalls -- er würfelt ihn beim Start selbst,
 *      niemand kann sich einen günstigen aussuchen,
 *   2. die Sitzordnung,
 *   3. das Zugbuch: eine Liste von Aktionen, jede mit dem Sitz, von dem sie
 *      kam. Angehängt werden darf nur, wer gerade am Zug ist.
 *
 * Alles andere ergibt sich daraus. Jeder Mitspieler spielt dasselbe Zugbuch
 * durch dieselbe Engine und kommt zwangsläufig auf denselben Stand: Würfel
 * und Kartenstapel hängen am Startwert (`seed`) und am Zähler im Zustand,
 * nicht am Zufall des Geräts.
 *
 * ## Was das an Sicherheit trägt -- und was nicht
 *
 * Eine Aktion vom falschen Sitz bleibt wirkungslos: `wendeAn` prüft, ob sie
 * von dem kam, der laut Zustand dran ist, und lässt sie sonst liegen. Damit
 * rechnet jeder ehrliche Mitspieler dasselbe aus, auch wenn jemand dem Server
 * etwas anderes erzählt hat. Würfel lassen sich nicht wählen, Karten nicht
 * umsortieren, fremdes Geld nicht anfassen.
 *
 * Nicht abgedeckt ist die Medaille aus dem Schießstand: Die meldet das Gerät,
 * das gespielt hat, und niemand kann nachprüfen, ob wirklich Gold gefallen
 * ist. Ein Geschicklichkeitsspiel auf dem Server nachzurechnen ginge nicht;
 * unter Freunden ist das die richtige Grenze.
 */

import {
  abreissen,
  anBankVerkaufen,
  ankommen,
  aufgeben,
  bauen,
  duellAusloesen,
  freikarteEinsetzen,
  karteAnwenden,
  karteNeuZiehen,
  kaufAblehnen,
  kaufen,
  koenigsaktion,
  minispielAbschliessen,
  strafbankFreikaufen,
  wahlBaustopp,
  wahlSchutz,
  wahlTausch,
  wahlUeberspringen,
  wuerfeln,
  zugBeenden,
} from './engine'
import { erstellePartie } from './zustand'
import type { Medaille } from './config'
import type { SpielZustand } from './zustand'

/**
 * Eine Aktion im Zugbuch.
 *
 * Eine Aktion ist immer das, was ein Mensch antippt -- nie ein Rechenschritt.
 * `ankommen` steht deshalb mit drin: Es ist der Moment, in dem die Figur ihr
 * Ziel erreicht, und alle sollen die Figur laufen sehen, bevor das Feld wirkt.
 */
export type OnlineAktion =
  | { art: 'wuerfeln' }
  | { art: 'ankommen' }
  | { art: 'kaufen' }
  | { art: 'ablehnen' }
  | { art: 'karte' }
  | { art: 'karte_neu' }
  | { art: 'bauen'; feldId: string }
  | { art: 'abreissen'; feldId: string }
  | { art: 'verkaufen'; feldId: string }
  | { art: 'strafbank_frei' }
  | { art: 'freikarte' }
  | { art: 'koenigsaktion' }
  | { art: 'duell' }
  | { art: 'minispiel'; medaille: Medaille }
  | { art: 'wahl_baustopp'; gegnerId: string }
  | { art: 'wahl_schutz'; feldId: string }
  | { art: 'wahl_tausch'; meinFeldId: string; fremdFeldId: string }
  | { art: 'wahl_weiter' }
  | { art: 'zug_ende' }
  | { art: 'aufgeben' }

/** Ein Eintrag, wie der Server ihn führt: Nummer, Sitz, Aktion. */
export interface ZugbuchEintrag {
  nr: number
  seat: number
  aktion: OnlineAktion
}

/** Sitze zählen ab eins, die Spieler im Zustand ab null. */
export function sitzSpielerId(seat: number): string {
  return `p${seat - 1}`
}

/** Der Sitz dessen, der gerade am Zug ist -- für den Server. */
export function amZugSitz(state: SpielZustand): number {
  return state.amZug + 1
}

/**
 * Namen eindeutig machen.
 *
 * `erstellePartie` besteht auf unterschiedlichen Namen -- zu Recht, sonst
 * weiß am Tisch niemand, wer gemeint ist. Zwei Konten dürfen aber denselben
 * Anzeigenamen tragen, und daran darf eine Runde nicht scheitern.
 */
export function eindeutigeNamen(namen: string[]): string[] {
  const gezaehlt = new Map<string, number>()
  return namen.map((roh) => {
    const name = roh.trim() || 'Gast'
    const schluessel = name.toLowerCase()
    const schonDa = gezaehlt.get(schluessel) ?? 0
    gezaehlt.set(schluessel, schonDa + 1)
    return schonDa === 0 ? name : `${name} (${schonDa + 1})`
  })
}

/**
 * Eine Aktion anwenden -- oder liegen lassen.
 *
 * Die Prüfung "kam sie vom richtigen Sitz" steht hier und nicht in der
 * Oberfläche: Sie ist der Grund, warum alle auf denselben Stand kommen. Der
 * Server lässt nur den Anhängen, der laut seiner Buchführung dran ist; dass
 * das auch nach den Regeln stimmt, prüft jeder Mitspieler hier noch einmal
 * selbst.
 *
 * Aufgeben darf man jederzeit, auch wenn ein anderer würfelt -- wer
 * hinwirft, wartet nicht erst, bis er wieder dran ist.
 */
export function wendeAn(state: SpielZustand, eintrag: ZugbuchEintrag): SpielZustand {
  const a = eintrag.aktion
  if (a.art === 'aufgeben') return aufgeben(state, sitzSpielerId(eintrag.seat))
  if (eintrag.seat !== amZugSitz(state)) return state

  switch (a.art) {
    case 'wuerfeln':
      return wuerfeln(state)
    case 'ankommen':
      return ankommen(state)
    case 'kaufen':
      return kaufen(state)
    case 'ablehnen':
      return kaufAblehnen(state)
    case 'karte':
      return karteAnwenden(state)
    case 'karte_neu':
      return karteNeuZiehen(state)
    case 'bauen':
      return bauen(state, a.feldId)
    case 'abreissen':
      return abreissen(state, a.feldId)
    case 'verkaufen':
      return anBankVerkaufen(state, a.feldId)
    case 'strafbank_frei':
      return strafbankFreikaufen(state)
    case 'freikarte':
      return freikarteEinsetzen(state)
    case 'koenigsaktion':
      return koenigsaktion(state)
    case 'duell':
      return duellAusloesen(state)
    case 'minispiel':
      return minispielAbschliessen(state, a.medaille)
    case 'wahl_baustopp':
      return wahlBaustopp(state, a.gegnerId)
    case 'wahl_schutz':
      return wahlSchutz(state, a.feldId)
    case 'wahl_tausch':
      return wahlTausch(state, a.meinFeldId, a.fremdFeldId)
    case 'wahl_weiter':
      return wahlUeberspringen(state)
    case 'zug_ende':
      return zugBeenden(state)
  }
}

export interface OnlinePartie {
  seed: number
  /** Die Namen in Sitzreihenfolge, Sitz 1 zuerst. */
  namen: string[]
  rundenLimit: number
  zugbuch: readonly ZugbuchEintrag[]
}

/** Die Partie aus dem Zugbuch nachspielen. */
export function zustandAus(partie: OnlinePartie): SpielZustand {
  const start = erstellePartie({
    spieler: eindeutigeNamen(partie.namen).map((name) => ({ name, typ: 'mensch' as const })),
    rundenLimit: partie.rundenLimit,
    seed: partie.seed,
  })
  // Der Reihe nach, nach Nummer -- der Server vergibt sie lückenlos, aber
  // die Antwort muss deshalb nicht sortiert ankommen.
  const geordnet = [...partie.zugbuch].sort((a, b) => a.nr - b.nr)
  return geordnet.reduce(wendeAn, start)
}
