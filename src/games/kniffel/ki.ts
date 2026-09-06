/**
 * Der Computergegner.
 *
 * Grundregel wie überall in dieser Sammlung: Die KI sieht nur, was ein
 * Mensch am Tisch auch sieht -- den eigenen Block, die eigenen Würfel. Sie
 * kennt den kommenden Wurf nicht.
 *
 * Bei Kniffel steckt die eigentliche Kunst darin, *was man liegen lässt*.
 * Genau daran unterscheiden sich die drei Stufen:
 *
 *   leicht  -- behält die häufigste Augenzahl, trägt den höchsten Wurf ein
 *   normal  -- erkennt zusätzlich Straßen und schont gute Felder
 *   schwer  -- probiert alle 32 Halte-Kombinationen durch und schätzt für
 *              jede den Erwartungswert, indem sie den Rest oft auswürfelt
 *
 * Zum Ausprobieren würfelt die KI mit einem eigenen Zufall, der *nicht* den
 * Zähler im Spielzustand weiterdreht -- sonst fiele die Partie anders aus,
 * nur weil ein Rechner nachgedacht hat. Das ist kein Mogeln: Sie schätzt
 * mit eigenen Proben, sie liest keine kommenden Würfe.
 */

import { createRng } from '@/games/rng'
import {
  BONUS_GRENZE,
  BONUS_PUNKTE,
  WUERFEL_ANZAHL,
  WUERFE_JE_ZUG,
  bisZumBonus,
  freieFelder,
  moeglichePunkte,
  obenSumme,
  punkteFuer,
  type Block,
  type KategorieId,
} from './regeln'
import {
  aktiverSpieler,
  darfWuerfeln,
  eintragen,
  wuerfeln,
  type KiStufe,
  type KniffelZustand,
} from './engine'

const OBERE: KategorieId[] = ['einser', 'zweier', 'dreier', 'vierer', 'fuenfer', 'sechser']

/** Wie viele Proben die starke KI je Halte-Kombination würfelt. */
const PROBEN_SCHWER = 120

/**
 * Was ein Feld ungefähr wert ist, wenn man es sich aufhebt. Damit die KI
 * einen Kniffel nicht in die Chance einträgt, nur weil das gerade 25
 * Punkte gäbe.
 */
const ERWARTUNG: Record<KategorieId, number> = {
  einser: 2,
  zweier: 4,
  dreier: 6,
  vierer: 8,
  fuenfer: 10,
  sechser: 12,
  dreierpasch: 22,
  viererpasch: 13,
  fullHouse: 15,
  kleineStrasse: 19,
  grosseStrasse: 10,
  kniffel: 5,
  chance: 22,
}

/** Zufall zum Ausprobieren -- verändert den Spielzustand nicht. */
function probenRng(state: KniffelZustand, merkmal: string): () => number {
  return createRng(`${state.seed}:ki:${state.rngZaehler}:${merkmal}`)
}

/* ------------------------------------------------------- Feld auswählen */

/**
 * In welches Feld die KI einträgt.
 *
 * Gerechnet wird nicht mit den nackten Punkten, sondern mit dem, was das
 * Feld gegenüber seiner Erwartung einbringt -- plus dem Bonus, wenn er
 * dadurch näher rückt.
 */
export function kiFeldwahl(
  block: Block,
  wuerfel: readonly number[],
  stufe: KiStufe,
  restrunden: number,
): KategorieId {
  const moeglich = moeglichePunkte(block, wuerfel)
  const felder = freieFelder(block)
  if (felder.length === 0) throw new Error('Kein freies Feld mehr')

  if (stufe === 'leicht') {
    // Nimmt schlicht das, was jetzt am meisten bringt.
    return felder.reduce((beste, id) =>
      (moeglich[id] ?? 0) > (moeglich[beste] ?? 0) ? id : beste,
    )
  }

  let bestesFeld = felder[0]!
  let besterWert = -Infinity

  /*
   * ERWARTUNG ist der Preis dafuer, ein Feld *jetzt* zu verbrauchen: was es
   * spaeter noch haette bringen koennen. Gegen Ende der Partie gibt es kein
   * Spaeter mehr, also faellt dieser Preis weg. Nur die starke KI rechnet
   * das mit -- und zwar getrennt vom Bonus.
   *
   * Der Bonus wird *nicht* verwaessert. Genau daran hing es: Solange er mit
   * derselben Kurve verrechnet wurde, hat die starke KI ihn gegen Ende
   * fallen lassen und holte ihn seltener als die mittlere.
   */
  const chanceSpaeter = stufe === 'schwer' ? Math.min(1, restrunden / 13) : 1

  for (const id of felder) {
    const punkte = moeglich[id] ?? 0
    let wert = punkte - ERWARTUNG[id] * chanceSpaeter

    // Der obere Bonus ist 35 Punkte -- die holt man nicht nebenbei.
    if (OBERE.includes(id)) {
      const auge = OBERE.indexOf(id) + 1
      const soll = auge * 3
      if (!bonusNochMoeglich(block)) {
        // Der Bonus ist ohnehin weg: dann zaehlt nur die reine Punktzahl.
        wert = punkte - ERWARTUNG[id] * 0.5 * chanceSpaeter
      } else if (punkte >= soll) {
        wert += (punkte - soll + 1) * 2
      } else {
        // Unter dem Soll einzutragen kostet den Bonus Stueck fuer Stueck.
        wert -= (soll - punkte) * 1.5
      }
    }

    // Ein Kniffel wird nicht verschenkt.
    if (stufe === 'schwer' && id === 'kniffel' && punkte > 0) wert += 30

    if (wert > besterWert) {
      besterWert = wert
      bestesFeld = id
    }
  }
  return bestesFeld
}

function bonusNochMoeglich(block: Block): boolean {
  let hoechstens = obenSumme(block)
  for (let i = 0; i < OBERE.length; i++) {
    const id = OBERE[i]!
    if (block[id] === null) hoechstens += (i + 1) * 5
  }
  return hoechstens >= BONUS_GRENZE
}

/* ------------------------------------------------------ Würfel behalten */

/** Welche Würfel liegen bleiben sollen. */
export function kiHaltewahl(
  block: Block,
  wuerfel: readonly number[],
  stufe: KiStufe,
  state: KniffelZustand,
  wurfNummer: number,
): boolean[] {
  if (stufe === 'leicht') return halteHaeufigste(wuerfel)
  if (stufe === 'normal') return halteMitStrassen(block, wuerfel)
  return halteBesteProbe(block, wuerfel, state, wurfNummer)
}

/** Die häufigste Augenzahl behalten; bei Gleichstand die höhere. */
function halteHaeufigste(wuerfel: readonly number[]): boolean[] {
  const zaehler = [0, 0, 0, 0, 0, 0, 0]
  for (const w of wuerfel) zaehler[w] = (zaehler[w] ?? 0) + 1
  let bestesAuge = 1
  for (let auge = 1; auge <= 6; auge++) {
    const n = zaehler[auge] ?? 0
    const b = zaehler[bestesAuge] ?? 0
    if (n > b || (n === b && auge > bestesAuge)) bestesAuge = auge
  }
  return wuerfel.map((w) => w === bestesAuge)
}

/** Wie oben, aber eine angefangene Straße wird nicht zerschlagen. */
function halteMitStrassen(block: Block, wuerfel: readonly number[]): boolean[] {
  const strassenOffen =
    block.kleineStrasse === null || block.grosseStrasse === null
  if (strassenOffen) {
    const beste = besteStrassenBasis(wuerfel)
    // Ab drei zusammenhängenden lohnt es, darauf zu setzen.
    if (beste.length >= 3) {
      const gebraucht = new Set(beste)
      return wuerfel.map((w) => {
        if (gebraucht.has(w)) {
          gebraucht.delete(w)
          return true
        }
        return false
      })
    }
  }
  return halteHaeufigste(wuerfel)
}

/** Die längste Folge verschiedener Augen im Wurf. */
function besteStrassenBasis(wuerfel: readonly number[]): number[] {
  const da = new Set(wuerfel)
  let beste: number[] = []
  let laufend: number[] = []
  for (let auge = 1; auge <= 6; auge++) {
    if (da.has(auge)) {
      laufend.push(auge)
      if (laufend.length > beste.length) beste = [...laufend]
    } else {
      laufend = []
    }
  }
  return beste
}

/**
 * Alle 32 Möglichkeiten durchprobieren: Für jede wird der Rest mehrfach
 * ausgewürfelt und geschaut, was am Ende im besten freien Feld stünde.
 * Das ist keine perfekte Kniffel-Strategie -- die wäre eine
 * Wahrscheinlichkeitstabelle --, aber deutlich mehr als eine Faustregel.
 */
function halteBesteProbe(
  block: Block,
  wuerfel: readonly number[],
  state: KniffelZustand,
  wurfNummer: number,
): boolean[] {
  const restWuerfe = Math.max(0, WUERFE_JE_ZUG - wurfNummer)
  if (restWuerfe === 0) return wuerfel.map(() => true)

  let besteMaske: boolean[] = wuerfel.map(() => false)
  let besterSchnitt = -Infinity

  for (let maske = 0; maske < 1 << WUERFEL_ANZAHL; maske++) {
    const halten = Array.from({ length: WUERFEL_ANZAHL }, (_, i) => (maske & (1 << i)) !== 0)
    const rng = probenRng(state, `m${maske}:w${wurfNummer}`)
    let summe = 0

    for (let probe = 0; probe < PROBEN_SCHWER; probe++) {
      const gewuerfelt = [...wuerfel]
      // So oft neu würfeln, wie in diesem Zug noch Würfe übrig sind.
      for (let wurf = 0; wurf < restWuerfe; wurf++) {
        for (let i = 0; i < WUERFEL_ANZAHL; i++) {
          if (!halten[i]) gewuerfelt[i] = 1 + Math.floor(rng() * 6)
        }
      }
      summe += bestesErgebnis(block, gewuerfelt)
    }
    const schnitt = summe / PROBEN_SCHWER
    if (schnitt > besterSchnitt) {
      besterSchnitt = schnitt
      besteMaske = halten
    }
  }
  return besteMaske
}

/**
 * Der beste Wert, den ein Wurf in irgendeinem freien Feld erzielt.
 *
 * Der obere Bonus muss hier mitgerechnet werden, sonst sieht die Suche nur
 * die nackten Punkte -- und drei Sechser (18) sehen dann schlechter aus als
 * eine gute Chance (24), obwohl sie den 35-Punkte-Bonus tragen. Genau das
 * war zu messen: Die starke KI holte den Bonus seltener als die mittlere,
 * weil sie ihn mit einem festen Sechstel viel zu billig bewertet hat.
 *
 * Jetzt wird er auf die noch offenen oberen Felder verteilt. Sind nur noch
 * zwei offen, hängt an jedem die Hälfte des Bonus -- und die Suche behandelt
 * ihn entsprechend dringend.
 */
function bestesErgebnis(block: Block, wuerfel: readonly number[]): number {
  const offenOben = OBERE.filter((id) => block[id] === null).length
  const bonusAnteil =
    offenOben > 0 && bisZumBonus(block) > 0 ? BONUS_PUNKTE / offenOben : 0

  let beste = 0
  for (const id of freieFelder(block)) {
    let wert = punkteFuer(id, wuerfel)
    if (bonusAnteil > 0 && OBERE.includes(id)) {
      const auge = OBERE.indexOf(id) + 1
      const soll = auge * 3
      // Ueber dem Soll traegt das Feld seinen Anteil am Bonus, darunter
      // frisst es ihn an.
      wert += wert >= soll ? bonusAnteil : -bonusAnteil * ((soll - wert) / soll)
    }
    if (wert > beste) beste = wert
  }
  return beste
}

/* --------------------------------------------------------- Ein Schritt */

export interface KiSchritt {
  state: KniffelZustand
  aktion: 'wuerfeln' | 'halten' | 'eintragen' | 'nichts'
}

/**
 * Ein einzelner Schritt. Die Oberfläche ruft das wiederholt auf und legt
 * kurze Pausen ein, damit man sieht, was passiert.
 */
export function kiSchritt(state: KniffelZustand): KiSchritt {
  if (state.phase === 'ende') return { state, aktion: 'nichts' }
  const spieler = aktiverSpieler(state)
  if (spieler.typ !== 'ki') return { state, aktion: 'nichts' }
  const stufe = spieler.kiStufe ?? 'normal'

  if (state.wurfNummer === 0) return { state: wuerfeln(state), aktion: 'wuerfeln' }

  const restrunden = freieFelder(spieler.block).length

  // Nach dem letzten Wurf bleibt nur noch eintragen.
  if (!darfWuerfeln(state)) {
    const feld = kiFeldwahl(spieler.block, state.wuerfel, stufe, restrunden)
    return { state: eintragen(state, feld), aktion: 'eintragen' }
  }

  // Lohnt Weiterwürfeln überhaupt? Wenn alles gehalten würde, nicht.
  const halten = kiHaltewahl(spieler.block, state.wuerfel, stufe, state, state.wurfNummer)
  if (halten.every(Boolean)) {
    const feld = kiFeldwahl(spieler.block, state.wuerfel, stufe, restrunden)
    return { state: eintragen(state, feld), aktion: 'eintragen' }
  }

  return { state: wuerfeln({ ...state, gehalten: halten }), aktion: 'wuerfeln' }
}
