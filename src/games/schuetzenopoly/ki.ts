/**
 * Die KI-Gegner.
 *
 * Grundregel: Die KI darf nichts wissen, was ein Mensch am selben Tisch
 * nicht auch sieht. Sie liest den Zustand -- Brett, Besitz, Kassenstand,
 * offene Karte --, aber nie den Kartenstapel, nie den nächsten Würfelwurf,
 * nie den Zufallszähler. Deshalb bekommt sie auch im Minispiel nur eine
 * gewürfelte Leistung und keinen garantierten Treffer.
 *
 * Die drei Stufen unterscheiden sich nicht in dem, was sie dürfen, sondern
 * darin, wie weit sie denken:
 *   leicht  -- kauft, was sie sich leisten kann, baut wenn Geld übrig ist
 *   normal  -- bewertet Gruppen, hält eine Reserve, handelt gelegentlich
 *   schwer  -- rechnet Gebühren aus, blockiert Gegner, handelt gezielt
 */

import { createRng } from '@/games/rng'
import { START_KAPITAL } from './config'
import { feldAn } from './brett'
import {
  baukosten,
  gruppeKomplett,
  istGrundstueck,
  kaufpreis,
  niedrigsteStufeDerGruppe,
} from './gebuehren'
import { grundstueck, grundstueckeDerGruppe } from './grundstuecke'
import { kiMinispielPunkte, medailleFuer } from './minispiele'
import {
  bauen,
  duellAusloesen,
  kannBauen,
  karteAnwenden,
  kaufAblehnen,
  kaufen,
  koenigsaktion,
  minispielAbschliessen,
  strafbankFreikaufen,
  freikarteEinsetzen,
  tauschKandidaten,
  wahlBaustopp,
  wahlSchutz,
  wahlTausch,
  wahlUeberspringen,
  wuerfeln,
  ankommen,
  zugBeenden,
  zugOffen,
} from './engine'
import {
  bewerteAngebot,
  feldWert,
  handelAusfuehren,
  handelbareFelder,
  pruefeHandel,
  staerke,
  type Handelsangebot,
} from './handel'
import { rollenBonus } from './rollen'
import {
  aktiverSpieler,
  besitzVon,
  spielerMit,
  ziehZahl,
  type KiStufe,
  type SpielZustand,
  type Spieler,
} from './zustand'

/**
 * Wie viel Bargeld die KI nicht anfassen will.
 *
 * Wichtig zu verstehen: Am Ende zählt das Vermögen, und Grundstücke und
 * Gebäude gehen mit ihrem vollen Wert ein. Wer Taler in Besitz umwandelt,
 * verliert dabei also nichts -- er gewinnt sogar, weil Besitz Gebühren
 * einbringt. Eine große Barreserve ist damit kein vorsichtiges Spiel,
 * sondern ein schlechtes.
 *
 * Deshalb hält die starke KI die *kleinste* Reserve, gerade genug, um eine
 * durchschnittliche Gebühr zu überstehen -- und gegen Ende fast keine mehr,
 * weil dann kein Gegner mehr genug Züge hat, um sie zu ruinieren. Die
 * schwache KI hält stur eine feste Summe zurück, weil das naheliegend
 * aussieht.
 */
function reserve(state: SpielZustand, stufe: KiStufe): number {
  const fortschritt = state.runde / Math.max(1, state.rundenLimit)
  switch (stufe) {
    case 'leicht':
      return 1500
    case 'normal':
      return fortschritt > 0.75 ? 500 : 1000
    case 'schwer': {
      if (fortschritt > 0.8) return 200
      // Grob die höchste Gebühr, die auf dem Brett gerade drohen kann.
      const hoechsteGefahr = Object.values(state.besitz)
        .filter((b) => b.besitzerId && b.besitzerId !== aktiverSpieler(state).id)
        .reduce((max, b) => {
          const g = grundstueck(b.feldId)
          if (!g) return max
          return Math.max(max, g.grundgebuehr * (b.stufe === 0 ? 1 : b.stufe * 8))
        }, 0)
      return Math.min(1500, Math.round(hoechsteGefahr))
    }
  }
}

/**
 * Ein Zufallswert, der den Zähler im Zustand *nicht* weiterdreht.
 * So bleibt die Entscheidung reproduzierbar, ohne den Würfelstrom zu
 * verschieben -- sonst würfelte eine Partie anders, nur weil die KI
 * zwischendurch überlegt hat.
 */
function launenZahl(state: SpielZustand, merkmal: string): number {
  return createRng(`${state.seed}:${state.rngZaehler}:${merkmal}`)()
}

/* ------------------------------------------------------------------- Kaufen */

export function kiWillKaufen(state: SpielZustand, spieler: Spieler): boolean {
  const angebot = state.kaufAngebot
  if (!angebot) return false
  const stufe = spieler.kiStufe ?? 'normal'
  if (spieler.taler < angebot.preis) return false
  const rest = spieler.taler - angebot.preis

  if (stufe === 'leicht') {
    // Kauft grundsätzlich, aber ohne Plan: mal ja, mal nein, und immer mit
    // einem dicken Polster im Rücken.
    if (rest < reserve(state, 'leicht')) return false
    return launenZahl(state, `kauf:${angebot.feldId}`) < 0.8
  }

  const wert = feldWert(state, angebot.feldId, spieler.id)
  if (rest < reserve(state, stufe)) {
    // Ausnahme: ein Feld, das eine Gruppe schließt, ist die Klemme wert.
    const schliesst = wert >= angebot.preis * 2
    if (!schliesst || rest < 0) return false
  }

  if (stufe === 'normal') return wert >= angebot.preis * 0.95

  // schwer: kauft breit, weil Besitz Gebühren bringt und im Vermögen voll
  // zählt. Zurückhaltung nur, wenn das Feld für niemanden etwas taugt.
  return wert >= angebot.preis * 0.8
}

/* -------------------------------------------------------------------- Bauen */

interface Bauplan {
  feldId: string
  kosten: number
  nutzen: number
}

/** Wo Bauen am meisten bringt -- gemessen an der Gebühr, die dann anfällt. */
function bauplaene(state: SpielZustand, spieler: Spieler): Bauplan[] {
  const plaene: Bauplan[] = []
  for (const b of besitzVon(state, spieler.id)) {
    if (!istGrundstueck(b.feldId)) continue
    const pruefung = kannBauen(state, spieler.id, b.feldId)
    if (!pruefung.erlaubt) continue
    const g = grundstueck(b.feldId)
    if (!g) continue
    // Nutzen: erwarteter Gebührensprung. Grob, aber ohne Blick in die Zukunft.
    const nutzen = g.grundgebuehr * (b.stufe === 0 ? 3 : 6)
    plaene.push({ feldId: b.feldId, kosten: pruefung.kosten, nutzen })
  }
  return plaene.sort((a, b) => b.nutzen / b.kosten - a.nutzen / a.kosten)
}

export function kiBaut(state: SpielZustand, spieler: Spieler): SpielZustand {
  const stufe = spieler.kiStufe ?? 'normal'
  let s = state
  let sicherung = 0

  while (sicherung < 12) {
    sicherung++
    const aktuell = spielerMit(s, spieler.id)
    if (!aktuell || aktuell.insolvent) break
    const plaene = bauplaene(s, aktuell)
    const plan = plaene[0]
    if (!plan) break

    const rest = aktuell.taler - plan.kosten
    // Die schwache KI baut nur, wenn die Kasse üppig voll ist -- sie sieht
    // Bauen als Luxus statt als Investition.
    if (stufe === 'leicht' && rest < 3000) break
    if (stufe !== 'leicht' && rest < reserve(s, stufe)) break

    const vorher = s
    s = bauen(s, plan.feldId)
    if (s === vorher) break
  }
  return s
}

/* ------------------------------------------------------------------- Handel */

/**
 * Ein Angebot, das dem Gegner echten Wert bietet und der KI eine Gruppe
 * näherbringt. Ohne Gegenwert würde jeder ablehnen -- also legt die KI
 * Taler drauf.
 */
export function kiHandelsvorschlag(
  state: SpielZustand,
  spieler: Spieler,
): Handelsangebot | null {
  const stufe = spieler.kiStufe ?? 'normal'
  if (stufe === 'leicht') return null

  const eigene = handelbareFelder(state, spieler.id)
  let bestes: { angebot: Handelsangebot; gewinn: number } | null = null

  for (const gegner of state.spieler) {
    if (gegner.id === spieler.id || gegner.insolvent || gegner.typ === 'mensch') {
      // Menschen bekommen ebenfalls Angebote -- aber nur eines je Zug, weiter unten.
    }
    if (gegner.id === spieler.id || gegner.insolvent) continue

    for (const zielFeld of handelbareFelder(state, gegner.id)) {
      const g = grundstueck(zielFeld)
      if (!g) continue
      const fehlt = grundstueckeDerGruppe(g.gruppe).filter(
        (andere) => state.besitz[andere.id]?.besitzerId !== spieler.id && andere.id !== zielFeld,
      ).length
      // Nur interessant, wenn das Feld die Gruppe schließt oder fast schließt.
      if (fehlt > (stufe === 'schwer' ? 1 : 0)) continue

      const wertFuerMich = feldWert(state, zielFeld, spieler.id)
      const tauschKandidat = eigene
        .filter((f) => {
          const meins = grundstueck(f)
          return meins && meins.gruppe !== g.gruppe && !gruppeKomplett(state, f)
        })
        .sort((a, b) => feldWert(state, a, spieler.id) - feldWert(state, b, spieler.id))[0]

      const gebeFelder = tauschKandidat ? [tauschKandidat] : []
      const gegenwert = gebeFelder.reduce((s, f) => s + feldWert(state, f, gegner.id), 0)
      const noetig = Math.max(0, feldWert(state, zielFeld, gegner.id) - gegenwert)
      const aufschlag = Math.round(noetig * 1.25) + 200
      if (aufschlag > spieler.taler - reserve(state, stufe)) continue

      const angebot: Handelsangebot = {
        vonId: spieler.id,
        anId: gegner.id,
        gebeFelder,
        gebeTaler: aufschlag,
        willFelder: [zielFeld],
        willTaler: 0,
      }
      if (!pruefeHandel(state, angebot).gueltig) continue

      const gewinn = wertFuerMich - aufschlag - gegenwert
      if (gewinn <= 0) continue
      if (!bestes || gewinn > bestes.gewinn) bestes = { angebot, gewinn }
    }
  }
  return bestes?.angebot ?? null
}

/** Nimmt die KI ein Angebot an? */
export function kiNimmtAn(state: SpielZustand, angebot: Handelsangebot): boolean {
  const empfaenger = spielerMit(state, angebot.anId)
  if (!empfaenger || empfaenger.typ !== 'ki') return false
  if (!pruefeHandel(state, angebot).gueltig) return false

  const stufe = empfaenger.kiStufe ?? 'normal'
  const netto = bewerteAngebot(state, angebot)

  if (stufe === 'leicht') return netto > 0

  // Ein Feld herzugeben, das dem Gegner die Gruppe schließt, muss teuer sein.
  let strafe = 0
  for (const feldId of angebot.willFelder) {
    const g = grundstueck(feldId)
    if (!g) continue
    const gegnerHat = grundstueckeDerGruppe(g.gruppe).filter(
      (andere) => andere.id !== feldId && state.besitz[andere.id]?.besitzerId === angebot.vonId,
    ).length
    if (gegnerHat === grundstueckeDerGruppe(g.gruppe).length - 1) {
      strafe += kaufpreis(feldId) * (stufe === 'schwer' ? 1.5 : 0.8)
    }
  }

  if (stufe === 'normal') return netto - strafe > 100

  // schwer: schaut zusätzlich darauf, wer ohnehin schon führt.
  const meineStaerke = staerke(state, empfaenger.id)
  const seineStaerke = staerke(state, angebot.vonId)
  const fuehrungsAufschlag = seineStaerke > meineStaerke ? 0.25 : 0
  return netto - strafe - seineStaerke * fuehrungsAufschlag * 0.02 > 200
}

/* -------------------------------------------------------------- Kartenwahl */

function kiWahl(state: SpielZustand, spieler: Spieler): SpielZustand {
  const wahl = state.offeneWahl
  if (!wahl) return state

  if (wahl.art === 'baustopp') {
    const ziel = state.spieler
      .filter((g) => g.id !== spieler.id && !g.insolvent)
      .sort((a, b) => staerke(state, b.id) - staerke(state, a.id))[0]
    return ziel ? wahlBaustopp(state, ziel.id) : wahlUeberspringen(state)
  }

  if (wahl.art === 'schutz') {
    const bestes = besitzVon(state, spieler.id)
      .filter((b) => istGrundstueck(b.feldId))
      .sort((a, b) => kaufpreis(b.feldId) - kaufpreis(a.feldId))[0]
    return bestes ? wahlSchutz(state, bestes.feldId) : wahlUeberspringen(state)
  }

  const paare = tauschKandidaten(state, spieler.id)
    .map((p) => ({
      p,
      gewinn:
        feldWert(state, p.fremdFeldId, spieler.id) -
        feldWert(state, p.meinFeldId, spieler.id) -
        Math.max(0, p.ausgleich),
    }))
    .sort((a, b) => b.gewinn - a.gewinn)[0]
  if (!paare || paare.gewinn <= 0) return wahlUeberspringen(state)
  return wahlTausch(state, paare.p.meinFeldId, paare.p.fremdFeldId)
}

/* ---------------------------------------------------------------- Minispiel */

export function kiSpieltMinispiel(state: SpielZustand): SpielZustand {
  const auftrag = state.offenesMinispiel
  if (!auftrag) return state
  const spieler = spielerMit(state, auftrag.spielerId)
  if (!spieler) return state

  const { wert, zaehler } = ziehZahl(state)
  const bonus = rollenBonus(spieler.rolle).minispielPunkte ?? 0
  const punkte = Math.round(
    kiMinispielPunkte(auftrag.minispiel, spieler.kiStufe ?? 'normal', wert) * (1 + bonus),
  )
  return minispielAbschliessen({ ...state, rngZaehler: zaehler }, medailleFuer(auftrag.minispiel, punkte))
}

/* ------------------------------------------------------------ Ein KI-Schritt */

export interface KiSchritt {
  state: SpielZustand
  /** Was gerade passiert ist -- die Oberfläche kann daraus eine Pause machen. */
  aktion:
    | 'wuerfeln'
    | 'bewegen'
    | 'kaufen'
    | 'ablehnen'
    | 'karte'
    | 'wahl'
    | 'minispiel'
    | 'bauen'
    | 'handel'
    | 'strafbank'
    | 'zug_ende'
    | 'nichts'
}

/**
 * Ein einzelner Schritt der KI. Die Oberfläche ruft das wiederholt auf und
 * legt zwischen den Schritten eine kurze Pause ein, damit man sieht, was
 * passiert. Ohne Pause liefe eine KI-Runde in einem Frame durch.
 */
export function kiSchritt(state: SpielZustand): KiSchritt {
  if (state.phase === 'ende') return { state, aktion: 'nichts' }
  const spieler = aktiverSpieler(state)
  if (spieler.typ !== 'ki') return { state, aktion: 'nichts' }

  if (state.offenesMinispiel) return { state: kiSpieltMinispiel(state), aktion: 'minispiel' }
  if (state.offeneKarte) return { state: karteAnwenden(state), aktion: 'karte' }
  if (state.offeneWahl) return { state: kiWahl(state, spieler), aktion: 'wahl' }
  if (state.kaufAngebot) {
    return kiWillKaufen(state, spieler)
      ? { state: kaufen(state), aktion: 'kaufen' }
      : { state: kaufAblehnen(state), aktion: 'ablehnen' }
  }

  if (state.phase === 'bewegen') return { state: ankommen(state), aktion: 'bewegen' }

  if (state.phase === 'wuerfeln') {
    if (spieler.aufStrafbank) {
      const mitKarte = freikarteEinsetzen(state)
      if (mitKarte !== state) return { state: mitKarte, aktion: 'strafbank' }
      const stufe = spieler.kiStufe ?? 'normal'
      if (stufe !== 'leicht' && spieler.strafbankVersuche >= 1 && spieler.taler > 4000) {
        const frei = strafbankFreikaufen(state)
        if (frei !== state) return { state: frei, aktion: 'strafbank' }
      }
    }
    if (
      spieler.taler < 500 &&
      !spieler.koenigsaktionGenutzt &&
      rollenBonus(spieler.rolle).koenigsaktion
    ) {
      return { state: koenigsaktion(state), aktion: 'nichts' }
    }
    return { state: wuerfeln(state), aktion: 'wuerfeln' }
  }

  if (state.phase === 'zug_ende') {
    if (zugOffen(state)) return { state, aktion: 'nichts' }

    // Duell des Leutnants, wenn die Kasse knapp wird.
    if (!spieler.duellGenutzt && spieler.taler < START_KAPITAL * 0.4) {
      const duell = duellAusloesen(state)
      if (duell !== state) return { state: duell, aktion: 'minispiel' }
    }

    const gebaut = kiBaut(state, spieler)
    if (gebaut !== state) return { state: gebaut, aktion: 'bauen' }

    const vorschlag = kiHandelsvorschlag(state, spieler)
    if (vorschlag) {
      const empfaenger = spielerMit(state, vorschlag.anId)
      // Menschen entscheiden selbst; KI-Gegner antworten sofort.
      if (empfaenger?.typ === 'ki' && kiNimmtAn(state, vorschlag)) {
        return { state: handelAusfuehren(state, vorschlag), aktion: 'handel' }
      }
    }

    return { state: zugBeenden(state), aktion: 'zug_ende' }
  }

  return { state, aktion: 'nichts' }
}

/** Vorschlag der KI an einen Menschen -- die Oberfläche zeigt ihn als Dialog. */
export function kiAngebotAnMenschen(state: SpielZustand): Handelsangebot | null {
  const spieler = aktiverSpieler(state)
  if (spieler.typ !== 'ki' || state.phase !== 'zug_ende') return null
  const vorschlag = kiHandelsvorschlag(state, spieler)
  if (!vorschlag) return null
  return spielerMit(state, vorschlag.anId)?.typ === 'mensch' ? vorschlag : null
}

/** Ob auf dem Zielfeld überhaupt etwas zu entscheiden ist. */
export function feldBrauchtEntscheidung(state: SpielZustand): boolean {
  const spieler = aktiverSpieler(state)
  const feld = feldAn(spieler.position)
  return Boolean(feld.kaufbar) && state.kaufAngebot !== null
}

/** Wie stark ein Grundstück für den Ausbau spricht -- auch für Tipps im Spiel. */
export function ausbauEmpfehlung(state: SpielZustand, spielerId: string): string | null {
  const spieler = spielerMit(state, spielerId)
  if (!spieler) return null
  for (const b of besitzVon(state, spielerId)) {
    if (!istGrundstueck(b.feldId)) continue
    if (!gruppeKomplett(state, b.feldId)) continue
    if (b.stufe > niedrigsteStufeDerGruppe(state, b.feldId)) continue
    if (spieler.taler >= baukosten(b.feldId)) return b.feldId
  }
  return null
}
