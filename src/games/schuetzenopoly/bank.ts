/**
 * Geld, Zwangsverkauf und Insolvenz.
 *
 * Wer nicht zahlen kann, verkauft automatisch: erst Gebäude, dann
 * Grundstücke, immer das jeweils Kleinste zuerst. Das ist eine bewusste
 * Entscheidung fürs Handy -- ein Zwangsverkauf-Dialog mitten in der
 * Zahlung würde jede Partie zerreißen, und die KI müsste ihn ebenfalls
 * bedienen. Wer selbst verkaufen will, tut das am Zugende.
 */

import type { AusbauStufe } from './config'
import {
  baukosten,
  istGrundstueck,
  kaufpreis,
  rueckkaufwert,
  verwertbaresVermoegen,
} from './gebuehren'
import {
  besitzVon,
  mitBesitz,
  mitLog,
  mitSpieler,
  spielerMit,
  feldName,
  type SpielZustand,
} from './zustand'

/** Geld gutschreiben. */
export function gutschrift(
  state: SpielZustand,
  spielerId: string,
  betrag: number,
): SpielZustand {
  if (betrag <= 0) return state
  const spieler = spielerMit(state, spielerId)
  if (!spieler) return state
  return mitSpieler(state, spielerId, { taler: spieler.taler + betrag })
}

/** Das kleinste verkäufliche Stück -- Gebäude vor Grundstück. */
function naechsterNotverkauf(
  state: SpielZustand,
  spielerId: string,
): { feldId: string; art: 'gebaeude' | 'grundstueck'; erloes: number } | null {
  const eigene = besitzVon(state, spielerId)

  const mitGebaeude = eigene
    .filter((b) => istGrundstueck(b.feldId) && b.stufe > 0)
    .sort((a, b) => rueckkaufwert(baukosten(a.feldId)) - rueckkaufwert(baukosten(b.feldId)))
  const gebaeude = mitGebaeude[0]
  if (gebaeude) {
    return {
      feldId: gebaeude.feldId,
      art: 'gebaeude',
      erloes: rueckkaufwert(baukosten(gebaeude.feldId)),
    }
  }

  const frei = eigene.sort((a, b) => kaufpreis(a.feldId) - kaufpreis(b.feldId))[0]
  if (frei) {
    return { feldId: frei.feldId, art: 'grundstueck', erloes: rueckkaufwert(kaufpreis(frei.feldId)) }
  }
  return null
}

/** Verkauft so lange, bis der Betrag gedeckt ist oder nichts mehr da ist. */
function notverkauf(state: SpielZustand, spielerId: string, betrag: number): SpielZustand {
  let s = state
  let sicherung = 0
  while ((spielerMit(s, spielerId)?.taler ?? 0) < betrag && sicherung < 200) {
    sicherung++
    const naechster = naechsterNotverkauf(s, spielerId)
    if (!naechster) break
    const b = s.besitz[naechster.feldId]!
    if (naechster.art === 'gebaeude') {
      s = mitBesitz(s, naechster.feldId, { stufe: (b.stufe - 1) as AusbauStufe })
    } else {
      s = mitBesitz(s, naechster.feldId, { besitzerId: null, stufe: 0, geschuetztBis: null })
    }
    s = gutschrift(s, spielerId, naechster.erloes)
    s = mitLog(s, {
      spielerId,
      art: 'geld',
      text: `${spielerMit(s, spielerId)?.name} muss ${feldName(naechster.feldId)} versilbern (+${naechster.erloes} 🪙).`,
    })
  }
  return s
}

/** Alles abgeben: an den Gläubiger, oder zurück an die Bank. */
function abwickeln(
  state: SpielZustand,
  schuldnerId: string,
  glaeubigerId: string | null,
): SpielZustand {
  let s = state
  for (const b of besitzVon(s, schuldnerId)) {
    if (glaeubigerId) {
      s = mitBesitz(s, b.feldId, { besitzerId: glaeubigerId, geschuetztBis: null })
    } else {
      s = mitBesitz(s, b.feldId, { besitzerId: null, stufe: 0, geschuetztBis: null })
    }
  }
  const rest = spielerMit(s, schuldnerId)?.taler ?? 0
  if (rest > 0 && glaeubigerId) s = gutschrift(s, glaeubigerId, rest)
  s = mitSpieler(s, schuldnerId, { taler: 0, insolvent: true, handkarten: [] })
  return s
}

export interface ZahlungErgebnis {
  state: SpielZustand
  /** Was tatsächlich geflossen ist. */
  gezahlt: number
  insolvent: boolean
}

/**
 * Zahlung. `anId` null bedeutet: an die Bank.
 * Reicht das Geld nicht, wird verkauft; reicht auch das nicht, ist der
 * Spieler insolvent und scheidet aus.
 */
export function zahle(
  state: SpielZustand,
  vonId: string,
  anId: string | null,
  betrag: number,
): ZahlungErgebnis {
  if (betrag <= 0) return { state, gezahlt: 0, insolvent: false }
  let s = state
  const spieler = spielerMit(s, vonId)
  if (!spieler || spieler.insolvent) return { state: s, gezahlt: 0, insolvent: true }

  if (spieler.taler < betrag) {
    // Erst rechnen, dann verkaufen. Wer die Summe auch nach dem letzten
    // Notverkauf nicht zusammenbekommt, soll seinen Besitz dem Gläubiger
    // übergeben statt ihn vorher an die Bank zu verschleudern.
    if (spieler.taler + verwertbaresVermoegen(s, vonId) < betrag) {
      const gezahlt = spieler.taler
      s = mitLog(s, {
        spielerId: vonId,
        art: 'strafe',
        text: `${spieler.name} kann ${betrag} 🪙 nicht aufbringen und scheidet aus.`,
      })
      s = abwickeln(s, vonId, anId)
      return { state: s, gezahlt, insolvent: true }
    }
    s = notverkauf(s, vonId, betrag)
  }

  const jetzt = spielerMit(s, vonId)!
  if (jetzt.taler < betrag) {
    const gezahlt = jetzt.taler
    s = mitLog(s, {
      spielerId: vonId,
      art: 'strafe',
      text: `${jetzt.name} kann ${betrag} 🪙 nicht aufbringen und scheidet aus.`,
    })
    s = abwickeln(s, vonId, anId)
    return { state: s, gezahlt, insolvent: true }
  }

  s = mitSpieler(s, vonId, { taler: jetzt.taler - betrag })
  if (anId) s = gutschrift(s, anId, betrag)
  return { state: s, gezahlt: betrag, insolvent: false }
}

/** Einnahme von allen Mitspielern (positiv) oder Zahlung an alle (negativ). */
export function verrechneMitAllen(
  state: SpielZustand,
  spielerId: string,
  betragJeSpieler: number,
): SpielZustand {
  let s = state
  const gegner = s.spieler.filter((g) => g.id !== spielerId && !g.insolvent).map((g) => g.id)
  for (const gegnerId of gegner) {
    if (betragJeSpieler > 0) {
      s = zahle(s, gegnerId, spielerId, betragJeSpieler).state
    } else {
      s = zahle(s, spielerId, gegnerId, -betragJeSpieler).state
      if (spielerMit(s, spielerId)?.insolvent) break
    }
  }
  return s
}
