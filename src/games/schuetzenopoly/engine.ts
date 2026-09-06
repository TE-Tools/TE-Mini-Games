/**
 * Schützenopoly -- der Spielablauf.
 *
 * Reine Logik: kein React, kein DOM, keine Uhr. Jede Funktion nimmt einen
 * Zustand und gibt einen neuen zurück. Die Oberfläche entscheidet nur,
 * wann sie welche Funktion ruft und wie lange sie dabei animiert.
 *
 * Ein Zug läuft so:
 *   wuerfeln -> (Oberfläche animiert) -> ankommen -> ggf. Entscheidung
 *   (kaufen / Karte / Minispiel) -> zug_ende -> bauen/handeln -> zugBeenden
 */

import {
  ECKE_STRAFBANK,
  FELDER,
  FREIES_FEST_BONUS,
  MAX_AUSBAU,
  PASCH_BIS_STRAFBANK,
  START_BONUS,
  STRAFBANK_GEBUEHR,
  STRAFBANK_MAX_VERSUCHE,
  BAUEN_NUR_MIT_KOMPLETTER_GRUPPE,
  GLEICHMAESSIG_BAUEN,
  MINISPIEL_BELOHNUNG,
  type AusbauStufe,
  type Medaille,
} from './config'
import { feldAn } from './brett'
import {
  baukosten,
  gebuehrFuer,
  gruppeKomplett,
  istGrundstueck,
  kaufpreis,
  niedrigsteStufeDerGruppe,
  rueckkaufwert,
  vermoegen,
} from './gebuehren'
import { rollenBonus } from './rollen'
import { gutschrift, zahle } from './bank'
import { wendeKarteAn, ziehKarte, zufaelligesMinispiel } from './karteneffekte'
import { istHandkarte, karte as karteMit } from './karten'
import {
  aktiveSpieler,
  aktiverSpieler,
  besitzVon,
  feldName,
  mitBesitz,
  mitLog,
  mitSpieler,
  spielerMit,
  ziehZahl,
  type SpielZustand,
  type Spieler,
} from './zustand'

/* ------------------------------------------------------------------ Würfel */

export interface Wurf {
  augen: [number, number]
  summe: number
  pasch: boolean
}

function wuerfelWerfen(state: SpielZustand): { wurf: Wurf; zaehler: number } {
  const a = ziehZahl(state)
  const b = ziehZahl({ ...state, rngZaehler: a.zaehler })
  const w1 = 1 + Math.floor(a.wert * 6)
  const w2 = 1 + Math.floor(b.wert * 6)
  return {
    wurf: { augen: [w1, w2], summe: w1 + w2, pasch: w1 === w2 },
    zaehler: b.zaehler,
  }
}

/**
 * Zug in die Endphase überführen -- und dabei prüfen, ob die Partie
 * vorbei ist. Eine Zahlung mitten im Zug kann den vorletzten Spieler aus
 * dem Spiel werfen; dann darf nicht einfach weitergewürfelt werden.
 */
function zugEnde(state: SpielZustand): SpielZustand {
  if (aktiveSpieler(state).length <= 1) return beenden(state)
  return { ...state, phase: 'zug_ende' }
}

/* ------------------------------------------------------------- Zug beginnen */

/**
 * Würfeln. Danach steht `zielPosition` fest und die Oberfläche darf die
 * Figur laufen lassen; ausgewertet wird erst in `ankommen`.
 */
export function wuerfeln(state: SpielZustand): SpielZustand {
  if (state.phase !== 'wuerfeln' || state.siegerId) return state
  const spieler = aktiverSpieler(state)
  const { wurf, zaehler } = wuerfelWerfen(state)

  let s: SpielZustand = { ...state, rngZaehler: zaehler, wuerfel: wurf.augen }
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'info',
    text: `${spieler.name} würfelt ${wurf.augen[0]} und ${wurf.augen[1]}.`,
  })

  if (spieler.aufStrafbank) return strafbankWurf(s, spieler, wurf)

  if (wurf.pasch) {
    const serie = state.paschSerie + 1
    if (serie >= PASCH_BIS_STRAFBANK) {
      s = mitSpieler(s, spieler.id, {
        position: ECKE_STRAFBANK,
        aufStrafbank: true,
        strafbankVersuche: 0,
      })
      s = mitLog(s, {
        spielerId: spieler.id,
        art: 'strafe',
        text: `Dritter Pasch in Folge – ${spieler.name} muss auf die Strafbank.`,
      })
      return { ...s, paschSerie: 0, zielPosition: ECKE_STRAFBANK, phase: 'zug_ende' }
    }
    s = { ...s, paschSerie: serie }
  } else {
    s = { ...s, paschSerie: 0 }
  }

  const ziel = (spieler.position + wurf.summe) % FELDER
  return { ...s, zielPosition: ziel, phase: 'bewegen' }
}

function strafbankWurf(state: SpielZustand, spieler: Spieler, wurf: Wurf): SpielZustand {
  let s = state
  if (wurf.pasch) {
    s = mitSpieler(s, spieler.id, { aufStrafbank: false, strafbankVersuche: 0 })
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'info',
      text: `Pasch! ${spieler.name} ist frei und zieht ${wurf.summe} Felder.`,
    })
    const ziel = (spieler.position + wurf.summe) % FELDER
    return { ...s, paschSerie: 0, zielPosition: ziel, phase: 'bewegen' }
  }

  const versuche = spieler.strafbankVersuche + 1
  if (versuche >= STRAFBANK_MAX_VERSUCHE) {
    const ergebnis = zahle(s, spieler.id, null, STRAFBANK_GEBUEHR)
    s = ergebnis.state
    if (ergebnis.insolvent) return zugEnde(s)
    s = mitSpieler(s, spieler.id, { aufStrafbank: false, strafbankVersuche: 0 })
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'strafe',
      text: `${spieler.name} zahlt ${STRAFBANK_GEBUEHR} 🪙 und darf weiter.`,
    })
    const ziel = (spieler.position + wurf.summe) % FELDER
    return { ...s, zielPosition: ziel, phase: 'bewegen' }
  }

  s = mitSpieler(s, spieler.id, { strafbankVersuche: versuche })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'strafe',
    text: `Kein Pasch – ${spieler.name} bleibt auf der Strafbank (Versuch ${versuche} von ${STRAFBANK_MAX_VERSUCHE}).`,
  })
  return zugEnde(s)
}

/** Sich freikaufen, bevor gewürfelt wird. */
export function strafbankFreikaufen(state: SpielZustand): SpielZustand {
  const spieler = aktiverSpieler(state)
  if (!spieler.aufStrafbank || state.phase !== 'wuerfeln') return state
  if (spieler.taler < STRAFBANK_GEBUEHR) return state
  let s = zahle(state, spieler.id, null, STRAFBANK_GEBUEHR).state
  s = mitSpieler(s, spieler.id, { aufStrafbank: false, strafbankVersuche: 0 })
  return mitLog(s, {
    spielerId: spieler.id,
    art: 'geld',
    text: `${spieler.name} kauft sich für ${STRAFBANK_GEBUEHR} 🪙 frei.`,
  })
}

/** Die Fürsprache-Karte einsetzen. */
export function freikarteEinsetzen(state: SpielZustand): SpielZustand {
  const spieler = aktiverSpieler(state)
  if (!spieler.aufStrafbank) return state
  const karteId = spieler.handkarten.find((id) => karteMit(id)?.wirkung.art === 'freikarte')
  if (!karteId) return state
  let s = mitSpieler(state, spieler.id, {
    aufStrafbank: false,
    strafbankVersuche: 0,
    handkarten: spieler.handkarten.filter((id) => id !== karteId),
  })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'karte',
    text: `${spieler.name} legt die Fürsprache vor und verlässt die Strafbank.`,
  })
  return s
}

/* ------------------------------------------------------------------ Ankunft */

/** Figur ist am Ziel: START-Bonus verbuchen, dann das Feld auswerten. */
export function ankommen(state: SpielZustand): SpielZustand {
  if (state.phase !== 'bewegen' || state.zielPosition === null) return state
  const spieler = aktiverSpieler(state)
  const ziel = state.zielPosition
  let s = state

  if (ziel <= spieler.position && !spieler.aufStrafbank) {
    s = gutschrift(s, spieler.id, START_BONUS)
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'geld',
      text: `${spieler.name} kommt an START vorbei: +${START_BONUS} 🪙.`,
    })
  }
  s = mitSpieler(s, spieler.id, { position: ziel })
  return feldAktion(s)
}

/** Was auf dem Zielfeld passiert. */
function feldAktion(state: SpielZustand): SpielZustand {
  const spieler = aktiverSpieler(state)
  const feld = feldAn(spieler.position)
  let s = state

  switch (feld.typ) {
    case 'start':
      return zugEnde(s)

    case 'strafbank':
      s = mitLog(s, {
        spielerId: spieler.id,
        art: 'info',
        text: `${spieler.name} schaut bei der Strafbank vorbei – nur zu Besuch.`,
      })
      return zugEnde(s)

    case 'freies_fest': {
      s = gutschrift(s, spieler.id, FREIES_FEST_BONUS)
      s = mitLog(s, {
        spielerId: spieler.id,
        art: 'geld',
        text: `Freies Fest: ${spieler.name} kassiert ${FREIES_FEST_BONUS} 🪙 Standgeld.`,
      })
      return zugEnde(s)
    }

    case 'zur_strafbank': {
      s = mitSpieler(s, spieler.id, {
        position: ECKE_STRAFBANK,
        aufStrafbank: true,
        strafbankVersuche: 0,
      })
      s = mitLog(s, {
        spielerId: spieler.id,
        art: 'strafe',
        text: `${spieler.name} muss sofort auf die Strafbank.`,
      })
      return zugEnde({ ...s, paschSerie: 0 })
    }

    case 'ereignis':
    case 'vereinskarte': {
      const gezogen = ziehKarte(s, feld.typ === 'ereignis' ? 'ereignis' : 'verein')
      return { ...gezogen.state, phase: 'feld' }
    }

    case 'minispiel': {
      const { minispiel, zaehler } = zufaelligesMinispiel(s)
      return {
        ...s,
        rngZaehler: zaehler,
        offenesMinispiel: { spielerId: spieler.id, minispiel, anlass: 'feld' },
        phase: 'feld',
      }
    }

    case 'grundstueck':
    case 'sonderfeld':
    case 'verband': {
      const feldId = feld.grundstueckId!
      const besitz = s.besitz[feldId]
      if (!besitz) return zugEnde(s)

      if (!besitz.besitzerId) {
        return {
          ...s,
          kaufAngebot: { position: feld.position, feldId, preis: kaufpreis(feldId) },
          phase: 'feld',
        }
      }
      if (besitz.besitzerId === spieler.id) {
        return zugEnde(s)
      }
      return gebuehrZahlen(s, spieler)
    }
  }
}

/** Gebühr abrechnen, inklusive Rollenboni. */
function gebuehrZahlen(state: SpielZustand, spieler: Spieler): SpielZustand {
  const summe = state.wuerfel ? state.wuerfel[0] + state.wuerfel[1] : 7
  const faellig = gebuehrFuer(state, spieler.position, summe, spieler.id)
  if (!faellig) return zugEnde(state)

  let s = state
  if (faellig.grund === 'geschuetzt' || faellig.betrag <= 0) {
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'info',
      text: `${feldName(faellig.feldId)} ist geschützt – keine Gebühr fällig.`,
    })
    return zugEnde(s)
  }

  if (spieler.gebuehrErlassen) {
    s = mitSpieler(s, spieler.id, { gebuehrErlassen: false })
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'karte',
      text: `Vereinsfreundschaft: ${spieler.name} zahlt diesmal nichts.`,
    })
    return zugEnde(s)
  }

  let betrag = faellig.betrag
  const rabatt = rollenBonus(spieler.rolle).gebuehrRabattJeRunde
  if (rabatt && spieler.rabattRunde !== s.runde) {
    betrag = Math.round(betrag * (1 - rabatt))
    s = mitSpieler(s, spieler.id, { rabattRunde: s.runde })
    s = mitLog(s, {
      spielerId: spieler.id,
      art: 'info',
      text: `${spieler.name} handelt die Gebühr herunter.`,
    })
  }

  const besitzer = spielerMit(s, faellig.besitzerId)
  const ergebnis = zahle(s, spieler.id, faellig.besitzerId, betrag)
  s = ergebnis.state

  // Der Aufschlag des Majors kommt aus der Vereinskasse, nicht aus der
  // Tasche des Zahlenden -- sonst wäre die Rolle eine versteckte Steuer.
  if (besitzer) {
    const bonus = rollenBonus(besitzer.rolle).einnahmenBonus ?? 0
    if (bonus > 0 && !spielerMit(s, besitzer.id)?.insolvent) {
      s = gutschrift(s, besitzer.id, Math.round(ergebnis.gezahlt * bonus))
    }
    const nachher = spielerMit(s, besitzer.id)
    if (nachher) {
      s = mitSpieler(s, besitzer.id, {
        kassierteGebuehren: nachher.kassierteGebuehren + ergebnis.gezahlt,
      })
    }
  }
  const zahlerJetzt = spielerMit(s, spieler.id)
  if (zahlerJetzt) {
    s = mitSpieler(s, spieler.id, {
      gezahlteGebuehren: zahlerJetzt.gezahlteGebuehren + ergebnis.gezahlt,
    })
  }

  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'geld',
    text: `${spieler.name} zahlt ${ergebnis.gezahlt} 🪙 an ${besitzer?.name ?? 'die Bank'} für ${feldName(faellig.feldId)}.`,
  })
  return zugEnde(s)
}

/* ------------------------------------------------------------------- Kaufen */

export function kaufen(state: SpielZustand): SpielZustand {
  const angebot = state.kaufAngebot
  if (!angebot) return state
  const spieler = aktiverSpieler(state)
  if (spieler.taler < angebot.preis) return state

  let s = zahle(state, spieler.id, null, angebot.preis).state
  s = mitBesitz(s, angebot.feldId, { besitzerId: spieler.id })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'kauf',
    text: `${spieler.name} kauft ${feldName(angebot.feldId)} für ${angebot.preis} 🪙.`,
  })
  return zugEnde({ ...s, kaufAngebot: null })
}

/**
 * Nicht kaufen. In V1 bleibt das Feld frei -- eine Versteigerung wäre auf
 * dem Handy ein eigener Dialog für alle Mitspieler und ist für V2 vorgesehen.
 */
export function kaufAblehnen(state: SpielZustand): SpielZustand {
  if (!state.kaufAngebot) return state
  return zugEnde({ ...state, kaufAngebot: null })
}

/* -------------------------------------------------------------------- Karte */

/** Die aufgedeckte Karte anwenden. */
export function karteAnwenden(state: SpielZustand): SpielZustand {
  const karte = state.offeneKarte
  if (!karte) return state
  const folge = wendeKarteAn(state, karte)
  let s = folge.state
  if (folge.feldAuswerten) {
    s = { ...s, phase: 'bewegen' }
    return ankommen(s)
  }
  if (s.offeneWahl || s.offenesMinispiel) return { ...s, phase: 'feld' }
  return zugEnde(s)
}

/** Eine gezogene Karte ablehnen (Oberst, einmal je Partie). */
export function karteNeuZiehen(state: SpielZustand): SpielZustand {
  const karte = state.offeneKarte
  const spieler = aktiverSpieler(state)
  if (!karte || spieler.karteNeuGenutzt) return state
  if (!rollenBonus(spieler.rolle).karteNeuJePartie) return state

  let s = mitSpieler(state, spieler.id, { karteNeuGenutzt: true })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'karte',
    text: `${spieler.name} legt die Karte zurück und zieht neu.`,
  })
  return ziehKarte(s, karte.stapel).state
}

/* ------------------------------------------------------------------- Wahlen */

export function wahlBaustopp(state: SpielZustand, gegnerId: string): SpielZustand {
  if (state.offeneWahl?.art !== 'baustopp') return state
  const gegner = spielerMit(state, gegnerId)
  if (!gegner || gegner.insolvent || gegnerId === aktiverSpieler(state).id) return state
  let s = mitSpieler(state, gegnerId, { bauverbotBis: state.runde })
  s = mitLog(s, {
    spielerId: aktiverSpieler(state).id,
    art: 'karte',
    text: `Baustopp für ${gegner.name} bis zu seinem nächsten Zug.`,
  })
  return zugEnde({ ...s, offeneWahl: null })
}

export function wahlSchutz(state: SpielZustand, feldId: string): SpielZustand {
  if (state.offeneWahl?.art !== 'schutz') return state
  const spieler = aktiverSpieler(state)
  if (state.besitz[feldId]?.besitzerId !== spieler.id) return state
  let s = mitBesitz(state, feldId, { geschuetztBis: state.runde + 1 })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'karte',
    text: `${feldName(feldId)} steht eine Runde lang unter Hausrecht.`,
  })
  return zugEnde({ ...s, offeneWahl: null })
}

export interface TauschPaar {
  meinFeldId: string
  fremdFeldId: string
  fremdBesitzerId: string
  ausgleich: number
}

/**
 * Mögliche Tauschgeschäfte der Grundstückstausch-Karte: gleicher Wert
 * (± 40 %), Differenz wird in Talern ausgeglichen.
 */
export function tauschKandidaten(state: SpielZustand, spielerId: string): TauschPaar[] {
  const eigene = besitzVon(state, spielerId).filter((b) => istGrundstueck(b.feldId) && b.stufe === 0)
  const fremde = Object.values(state.besitz).filter(
    (b) =>
      b.besitzerId &&
      b.besitzerId !== spielerId &&
      istGrundstueck(b.feldId) &&
      b.stufe === 0 &&
      !spielerMit(state, b.besitzerId)?.insolvent,
  )
  const paare: TauschPaar[] = []
  for (const mein of eigene) {
    for (const fremd of fremde) {
      const a = kaufpreis(mein.feldId)
      const b = kaufpreis(fremd.feldId)
      if (Math.abs(a - b) > Math.max(a, b) * 0.4) continue
      paare.push({
        meinFeldId: mein.feldId,
        fremdFeldId: fremd.feldId,
        fremdBesitzerId: fremd.besitzerId!,
        ausgleich: b - a,
      })
    }
  }
  return paare
}

export function wahlTausch(
  state: SpielZustand,
  meinFeldId: string,
  fremdFeldId: string,
): SpielZustand {
  if (state.offeneWahl?.art !== 'tausch') return state
  const spieler = aktiverSpieler(state)
  const paar = tauschKandidaten(state, spieler.id).find(
    (p) => p.meinFeldId === meinFeldId && p.fremdFeldId === fremdFeldId,
  )
  if (!paar) return state

  let s = state
  if (paar.ausgleich > 0) {
    const ergebnis = zahle(s, spieler.id, paar.fremdBesitzerId, paar.ausgleich)
    s = ergebnis.state
    if (ergebnis.insolvent) return zugEnde({ ...s, offeneWahl: null })
  } else if (paar.ausgleich < 0) {
    s = zahle(s, paar.fremdBesitzerId, spieler.id, -paar.ausgleich).state
  }

  s = mitBesitz(s, meinFeldId, { besitzerId: paar.fremdBesitzerId, geschuetztBis: null })
  s = mitBesitz(s, fremdFeldId, { besitzerId: spieler.id, geschuetztBis: null })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'kauf',
    text: `Tausch: ${feldName(meinFeldId)} gegen ${feldName(fremdFeldId)}.`,
  })
  return zugEnde({ ...s, offeneWahl: null })
}

/** Eine Auswahl verfallen lassen -- es gibt nicht immer ein gutes Ziel. */
export function wahlUeberspringen(state: SpielZustand): SpielZustand {
  if (!state.offeneWahl) return state
  return zugEnde({ ...state, offeneWahl: null })
}

/* ----------------------------------------------------------------- Minispiel */

export function minispielAbschliessen(
  state: SpielZustand,
  medaille: Medaille,
): SpielZustand {
  const auftrag = state.offenesMinispiel
  if (!auftrag) return state
  const spieler = spielerMit(state, auftrag.spielerId)
  if (!spieler) return zugEnde({ ...state, offenesMinispiel: null })

  const bonus = rollenBonus(spieler.rolle).minispielBelohnung ?? 0
  const belohnung = Math.round(MINISPIEL_BELOHNUNG[medaille] * (1 + bonus))

  let s = state
  if (belohnung > 0) s = gutschrift(s, spieler.id, belohnung)
  s = mitSpieler(s, spieler.id, { medaillen: [...spieler.medaillen, medaille] })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'minispiel',
    text:
      medaille === 'keine'
        ? `${spieler.name} geht am Schießstand leer aus.`
        : `${spieler.name} holt ${medaille.toUpperCase()} und kassiert ${belohnung} 🪙.`,
  })
  return zugEnde({ ...s, offenesMinispiel: null })
}

/** Der Leutnant fordert selbst zum Duell -- einmal je Partie. */
export function duellAusloesen(state: SpielZustand): SpielZustand {
  const spieler = aktiverSpieler(state)
  if (spieler.duellGenutzt || state.offenesMinispiel) return state
  if (!rollenBonus(spieler.rolle).duellJePartie) return state
  const { minispiel, zaehler } = zufaelligesMinispiel(state)
  let s = mitSpieler(state, spieler.id, { duellGenutzt: true })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'minispiel',
    text: `${spieler.name} fordert zum Duell am Schießstand.`,
  })
  return {
    ...s,
    rngZaehler: zaehler,
    offenesMinispiel: { spielerId: spieler.id, minispiel, anlass: 'duell' },
    phase: 'feld',
  }
}

/** Königsaktion: einmal je Partie zahlt die Vereinskasse. */
export function koenigsaktion(state: SpielZustand): SpielZustand {
  const spieler = aktiverSpieler(state)
  const betrag = rollenBonus(spieler.rolle).koenigsaktion
  if (!betrag || spieler.koenigsaktionGenutzt) return state
  let s = gutschrift(state, spieler.id, betrag)
  s = mitSpieler(s, spieler.id, { koenigsaktionGenutzt: true })
  return mitLog(s, {
    spielerId: spieler.id,
    art: 'geld',
    text: `Königsaktion: ${spieler.name} erhält ${betrag} 🪙 aus der Vereinskasse.`,
  })
}

/* -------------------------------------------------------------------- Bauen */

export interface BauPruefung {
  erlaubt: boolean
  grund?: string
  kosten: number
}

export function kannBauen(
  state: SpielZustand,
  spielerId: string,
  feldId: string,
): BauPruefung {
  const kosten = istGrundstueck(feldId) ? baukosten(feldId) : 0
  const b = state.besitz[feldId]
  const spieler = spielerMit(state, spielerId)
  if (!b || !spieler) return { erlaubt: false, grund: 'Unbekanntes Feld', kosten }
  if (!istGrundstueck(feldId))
    return { erlaubt: false, grund: 'Hier lässt sich nicht bauen', kosten }
  if (b.besitzerId !== spielerId)
    return { erlaubt: false, grund: 'Gehört dir nicht', kosten }
  if (b.stufe >= MAX_AUSBAU) return { erlaubt: false, grund: 'Voll ausgebaut', kosten }
  if (spieler.bauverbotBis !== null && spieler.bauverbotBis >= state.runde)
    return { erlaubt: false, grund: 'Baustopp', kosten }
  if (BAUEN_NUR_MIT_KOMPLETTER_GRUPPE && !gruppeKomplett(state, feldId))
    return { erlaubt: false, grund: 'Gruppe noch nicht komplett', kosten }
  if (GLEICHMAESSIG_BAUEN && b.stufe > niedrigsteStufeDerGruppe(state, feldId))
    return { erlaubt: false, grund: 'Erst die anderen der Gruppe nachziehen', kosten }
  const rabatt = rollenBonus(spieler.rolle).baukostenRabatt ?? 0
  const preis = Math.round(kosten * (1 - rabatt))
  if (spieler.taler < preis) return { erlaubt: false, grund: 'Zu wenig Taler', kosten: preis }
  return { erlaubt: true, kosten: preis }
}

export function bauen(state: SpielZustand, feldId: string): SpielZustand {
  const spieler = aktiverSpieler(state)
  const pruefung = kannBauen(state, spieler.id, feldId)
  if (!pruefung.erlaubt) return state
  const b = state.besitz[feldId]!
  let s = zahle(state, spieler.id, null, pruefung.kosten).state
  const neueStufe = (b.stufe + 1) as AusbauStufe
  s = mitBesitz(s, feldId, { stufe: neueStufe })
  s = mitLog(s, {
    spielerId: spieler.id,
    art: 'bau',
    text: `${spieler.name} baut auf ${feldName(feldId)} (Stufe ${neueStufe}).`,
  })
  return s
}

/** Eine Ausbaustufe zurückbauen und die Hälfte erstattet bekommen. */
export function abreissen(state: SpielZustand, feldId: string): SpielZustand {
  const spieler = aktiverSpieler(state)
  const b = state.besitz[feldId]
  if (!b || b.besitzerId !== spieler.id || b.stufe <= 0) return state
  const erloes = rueckkaufwert(baukosten(feldId))
  let s = gutschrift(state, spieler.id, erloes)
  s = mitBesitz(s, feldId, { stufe: (b.stufe - 1) as AusbauStufe })
  return mitLog(s, {
    spielerId: spieler.id,
    art: 'bau',
    text: `${spieler.name} baut auf ${feldName(feldId)} zurück (+${erloes} 🪙).`,
  })
}

/** Ein Grundstück an die Bank zurückgeben. */
export function anBankVerkaufen(state: SpielZustand, feldId: string): SpielZustand {
  const spieler = aktiverSpieler(state)
  const b = state.besitz[feldId]
  if (!b || b.besitzerId !== spieler.id || b.stufe > 0) return state
  const erloes = rueckkaufwert(kaufpreis(feldId))
  let s = gutschrift(state, spieler.id, erloes)
  s = mitBesitz(s, feldId, { besitzerId: null, stufe: 0, geschuetztBis: null })
  return mitLog(s, {
    spielerId: spieler.id,
    art: 'kauf',
    text: `${spieler.name} gibt ${feldName(feldId)} zurück (+${erloes} 🪙).`,
  })
}

/* -------------------------------------------------------------- Zug beenden */

/** Offene Entscheidungen? Dann darf der Zug noch nicht enden. */
export function zugOffen(state: SpielZustand): boolean {
  return Boolean(state.kaufAngebot || state.offeneKarte || state.offenesMinispiel || state.offeneWahl)
}

export function zugBeenden(state: SpielZustand): SpielZustand {
  if (state.phase === 'ende' || zugOffen(state)) return state
  const spieler = aktiverSpieler(state)

  // Pasch: derselbe Spieler noch einmal -- außer er sitzt jetzt auf der Bank.
  if (state.paschSerie > 0 && !spieler.aufStrafbank && !spieler.insolvent) {
    return { ...state, phase: 'wuerfeln', zielPosition: null }
  }

  let s: SpielZustand = { ...state, paschSerie: 0, zielPosition: null, wuerfel: state.wuerfel }
  const naechster = naechsterSpielerIndex(s)
  if (naechster === null) return beenden(s)

  const neueRunde = naechster <= s.amZug ? s.runde + 1 : s.runde
  s = { ...s, amZug: naechster, runde: neueRunde, phase: 'wuerfeln' }

  if (neueRunde > s.rundenLimit) return beenden(s)
  if (aktiveSpieler(s).length <= 1) return beenden(s)
  return s
}

function naechsterSpielerIndex(state: SpielZustand): number | null {
  const n = state.spieler.length
  for (let schritt = 1; schritt <= n; schritt++) {
    const i = (state.amZug + schritt) % n
    if (!state.spieler[i]!.insolvent) return i
  }
  return null
}

export interface Endstand {
  spielerId: string
  name: string
  vermoegen: number
  insolvent: boolean
}

export function endstand(state: SpielZustand): Endstand[] {
  return state.spieler
    .map((s) => ({
      spielerId: s.id,
      name: s.name,
      vermoegen: s.insolvent ? 0 : vermoegen(state, s.id),
      insolvent: s.insolvent,
    }))
    .sort((a, b) => b.vermoegen - a.vermoegen)
}

/** Partie abschließen und den Sieger festhalten. */
export function beenden(state: SpielZustand): SpielZustand {
  const tabelle = endstand(state)
  const sieger = tabelle[0]
  let s: SpielZustand = {
    ...state,
    phase: 'ende',
    siegerId: sieger?.spielerId ?? null,
    kaufAngebot: null,
    offeneKarte: null,
    offenesMinispiel: null,
    offeneWahl: null,
  }
  if (sieger) {
    s = mitLog(s, {
      spielerId: sieger.spielerId,
      art: 'ende',
      text: `${sieger.name} gewinnt mit einem Vermögen von ${sieger.vermoegen.toLocaleString('de-DE')} 🪙.`,
    })
  }
  return s
}

/** Vorzeitig aufgeben -- der Spieler scheidet aus. */
export function aufgeben(state: SpielZustand, spielerId: string): SpielZustand {
  const spieler = spielerMit(state, spielerId)
  if (!spieler || spieler.insolvent) return state
  let s = state
  for (const b of besitzVon(s, spielerId)) {
    s = mitBesitz(s, b.feldId, { besitzerId: null, stufe: 0, geschuetztBis: null })
  }
  s = mitSpieler(s, spielerId, { insolvent: true, taler: 0, handkarten: [] })
  s = mitLog(s, { spielerId, art: 'ende', text: `${spieler.name} gibt auf.` })
  if (aktiveSpieler(s).length <= 1) return beenden(s)
  if (s.amZug === s.spieler.findIndex((p) => p.id === spielerId)) {
    return zugBeenden({ ...s, paschSerie: 0, kaufAngebot: null, offeneKarte: null, offenesMinispiel: null, offeneWahl: null })
  }
  return s
}

/** Alle Karten auf der Hand eines Spielers. */
export function handkarten(state: SpielZustand, spielerId: string) {
  const spieler = spielerMit(state, spielerId)
  if (!spieler) return []
  return spieler.handkarten.map((id) => karteMit(id)).filter((k): k is NonNullable<typeof k> => Boolean(k) && istHandkarte(k!))
}
