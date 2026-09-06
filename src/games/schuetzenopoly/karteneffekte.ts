/**
 * Karten ziehen und anwenden.
 *
 * Die Stapel werden einmal gemischt und dann der Reihe nach abgearbeitet;
 * ist der Stapel durch, geht es von vorn los. Das ist berechenbarer als
 * ständiges Neumischen -- wer aufpasst, weiß irgendwann, was noch kommt,
 * und genau das macht Kartenspiele interessant.
 */

import { FELDER, START_BONUS } from './config'
import { ALLE_KARTEN, istHandkarte, type Karte, type KartenStapel } from './karten'
import { istGrundstueck } from './gebuehren'
import { rollenBonus } from './rollen'
import { gutschrift, verrechneMitAllen, zahle } from './bank'
import {
  besitzVon,
  mitLog,
  mitSpieler,
  spielerMit,
  ziehZahl,
  type MinispielId,
  type SpielZustand,
} from './zustand'

const MINISPIELE: MinispielId[] = ['koenigsschiessen', 'ringschiessen', 'praezision']

export interface KartenZug {
  state: SpielZustand
  karte: Karte
}

/** Nächste Karte vom Stapel -- der Zeiger wandert, gemischt wird nicht neu. */
export function ziehKarte(state: SpielZustand, stapel: KartenStapel): KartenZug {
  const ids = stapel === 'ereignis' ? state.ereignisStapel : state.vereinsStapel
  const index = stapel === 'ereignis' ? state.ereignisIndex : state.vereinsIndex
  const id = ids[index % ids.length]!
  const karte = ALLE_KARTEN.find((k) => k.id === id)
  if (!karte) throw new Error(`Karte ${id} fehlt im Katalog`)

  const naechster = (index + 1) % ids.length
  const state2: SpielZustand =
    stapel === 'ereignis'
      ? { ...state, ereignisIndex: naechster, offeneKarte: karte }
      : { ...state, vereinsIndex: naechster, offeneKarte: karte }

  return { state: state2, karte }
}

export interface KartenFolge {
  state: SpielZustand
  /** Der Spieler ist auf ein neues Feld gezogen; das muss noch ausgewertet werden. */
  feldAuswerten: boolean
}

function istSchlecht(karte: Karte): boolean {
  const w = karte.wirkung
  if (w.art === 'geld') return w.betrag < 0
  if (w.art === 'von_allen') return w.betrag < 0
  return w.art === 'reparatur' || w.art === 'strafbank'
}

/** Zufälliges Minispiel -- alle drei sollen vorkommen. */
export function zufaelligesMinispiel(state: SpielZustand): {
  minispiel: MinispielId
  zaehler: number
} {
  const { wert, zaehler } = ziehZahl(state)
  return { minispiel: MINISPIELE[Math.floor(wert * MINISPIELE.length)] ?? 'praezision', zaehler }
}

/**
 * Wendet die Wirkung einer Karte an. Karten, die eine Auswahl brauchen,
 * setzen `offeneWahl` -- die Oberfläche oder die KI entscheidet dann.
 */
export function wendeKarteAn(state: SpielZustand, karte: Karte): KartenFolge {
  const spieler = spielerMit(state, state.spieler[state.amZug]!.id)!
  let s = mitLog(state, {
    spielerId: spieler.id,
    art: 'karte',
    text: `${spieler.name}: ${karte.icon} ${karte.titel} – ${karte.text}`,
  })

  if (istSchlecht(karte) && spieler.schutzschild) {
    s = mitSpieler(s, spieler.id, { schutzschild: false })
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'karte',
      text: 'Der Vorstandsbeschluss fängt das ab – die Karte verfällt.',
    })
    return { state: { ...s, offeneKarte: null }, feldAuswerten: false }
  }

  if (istHandkarte(karte)) {
    s = mitSpieler(s, spieler.id, { handkarten: [...spieler.handkarten, karte.id] })
    return { state: { ...s, offeneKarte: null }, feldAuswerten: false }
  }

  const w = karte.wirkung
  switch (w.art) {
    case 'geld': {
      if (w.betrag >= 0) {
        const bonus = rollenBonus(spieler.rolle).kartenBonus ?? 0
        s = gutschrift(s, spieler.id, Math.round(w.betrag * (1 + bonus)))
      } else {
        s = zahle(s, spieler.id, null, -w.betrag).state
      }
      break
    }
    case 'von_allen': {
      s = verrechneMitAllen(s, spieler.id, w.betrag)
      break
    }
    case 'gehe_zu': {
      const alt = spieler.position
      const ziel = ((w.position % FELDER) + FELDER) % FELDER
      if (ziel <= alt) s = gutschrift(s, spieler.id, START_BONUS)
      s = mitSpieler(s, spieler.id, { position: ziel })
      return { state: { ...s, offeneKarte: null, zielPosition: ziel }, feldAuswerten: true }
    }
    case 'strafbank': {
      s = mitSpieler(s, spieler.id, {
        position: 10,
        aufStrafbank: true,
        strafbankVersuche: 0,
      })
      break
    }
    case 'reparatur': {
      const stufen = besitzVon(s, spieler.id)
        .filter((b) => istGrundstueck(b.feldId))
        .reduce((summe, b) => summe + b.stufe, 0)
      if (stufen > 0) s = zahle(s, spieler.id, null, stufen * w.jeStufe).state
      else
        s = mitLog(s, {
          spielerId: spieler.id,
          art: 'karte',
          text: 'Nichts gebaut, nichts zu reparieren.',
        })
      break
    }
    case 'baustopp': {
      return { state: { ...s, offeneKarte: null, offeneWahl: { art: 'baustopp' } }, feldAuswerten: false }
    }
    case 'grundstueck_schuetzen': {
      return { state: { ...s, offeneKarte: null, offeneWahl: { art: 'schutz' } }, feldAuswerten: false }
    }
    case 'tausch': {
      return { state: { ...s, offeneKarte: null, offeneWahl: { art: 'tausch' } }, feldAuswerten: false }
    }
    case 'minispiel': {
      const { minispiel, zaehler } = zufaelligesMinispiel(s)
      s = {
        ...s,
        rngZaehler: zaehler,
        offenesMinispiel: { spielerId: spieler.id, minispiel, anlass: 'karte' },
      }
      break
    }
    // Handkarten sind oben schon abgefangen.
    case 'freikarte':
    case 'gebuehr_erlassen':
    case 'schutzschild':
      break
  }

  return { state: { ...s, offeneKarte: null }, feldAuswerten: false }
}
