/**
 * Schützenopoly in der Sprache der Oberfläche.
 *
 * Das Spielmodul bleibt deutsch: Rollen, Karten, Minispiele und Felder
 * tragen dort ihren deutschen Namen, und die Engine schreibt ihr Protokoll
 * auf Deutsch. Die Seite schlägt anhand der Kennung im Wörterbuch nach und
 * fällt sonst auf den deutschen Namen zurück -- so bleibt eine neue Karte,
 * die noch niemand übersetzt hat, wenigstens lesbar.
 *
 * Nicht übersetzt werden die 22 Grundstücke: Sie stehen für echte Feste
 * und heißen in jeder Sprache gleich (docs/design/schuetzenopoly/).
 */

import {
  AUSBAU_NAMEN,
  feldName,
  karte as karteMit,
  minispiel,
  rolle,
  type BrettFeld,
  type Karte,
  type LogEintrag,
  type MinispielId,
  type RollenId,
} from '@/games/schuetzenopoly'
import type { Sprache, Texte } from '@/i18n/sprache'

type Eintrag<T> = Record<string, T | undefined>

/** Name und Kurzname eines Feldes, das kein Grundstück ist -- nach Feldtyp oder Kennung. */
function feldEintrag(t: Texte, schluessel: string | undefined) {
  if (!schluessel) return undefined
  return (t.schuetzenopoly.felder as Eintrag<{ name: string; kurz: string }>)[schluessel]
}

/** Der Name eines kaufbaren Feldes. Grundstücke behalten ihren deutschen Namen. */
export function feldNameIn(t: Texte, feldId: string): string {
  return feldEintrag(t, feldId)?.name ?? feldName(feldId)
}

/** Was ein Feld auf dem Brett und auf der Karte heißt. */
export function feldAnzeige(t: Texte, feld: BrettFeld): { name: string; kurz?: string } {
  const schluessel = feld.typ === 'grundstueck' ? undefined : (feld.grundstueckId ?? feld.typ)
  const eintrag = feldEintrag(t, schluessel)
  return eintrag ?? { name: feld.name }
}

export function ausbauName(t: Texte, stufe: number): string {
  return t.schuetzenopoly.ausbau[stufe] ?? AUSBAU_NAMEN[stufe] ?? String(stufe)
}

export function rollenText(t: Texte, id: RollenId): { name: string; beschreibung: string } {
  const r = rolle(id)
  return (
    (t.schuetzenopoly.rollen as Eintrag<{ name: string; beschreibung: string }>)[id] ?? {
      name: r.name,
      beschreibung: r.beschreibung,
    }
  )
}

export function karteText(t: Texte, karte: Karte): { titel: string; text: string } {
  return (
    (t.schuetzenopoly.karten as Eintrag<{ titel: string; text: string }>)[karte.id] ?? {
      titel: karte.titel,
      text: karte.text,
    }
  )
}

export function minispielText(t: Texte, id: MinispielId): { name: string; anleitung: string } {
  const m = minispiel(id)
  return t.schuetzenopoly.minispiele[id] ?? { name: m.name, anleitung: m.anleitung }
}

/**
 * Eine Zeile aus dem Spielprotokoll in der Sprache der Oberfläche.
 *
 * Partien, die vor dem 06.11.2026 gespeichert wurden, haben die Meldung
 * noch nicht -- dann gilt der deutsche Text der Engine.
 */
export function protokollZeile(t: Texte, sprache: Sprache, eintrag: LogEintrag): string {
  const m = eintrag.meldung
  if (!m) return eintrag.text
  const p = t.schuetzenopoly.protokoll
  const zahl = (n: number) => n.toLocaleString(sprache)
  const feld = (id: string) => feldNameIn(t, id)
  switch (m.art) {
    case 'start':
      return p.start
    case 'wurf':
      return p.wurf(m.name, m.a, m.b)
    case 'dritterPasch':
      return p.dritterPasch(m.name)
    case 'paschFrei':
      return p.paschFrei(m.name, m.felder)
    case 'strafbankBezahlt':
      return p.strafbankBezahlt(m.name, zahl(m.betrag))
    case 'keinPasch':
      return p.keinPasch(m.name, m.versuch, m.von)
    case 'freigekauft':
      return p.freigekauft(m.name, zahl(m.betrag))
    case 'fuersprache':
      return p.fuersprache(m.name)
    case 'startBonus':
      return p.startBonus(m.name, zahl(m.betrag))
    case 'besuch':
      return p.besuch(m.name)
    case 'freiesFest':
      return p.freiesFest(m.name, zahl(m.betrag))
    case 'zurStrafbank':
      return p.zurStrafbank(m.name)
    case 'geschuetzt':
      return p.geschuetzt(feld(m.feldId))
    case 'gebuehrErlassen':
      return p.gebuehrErlassen(m.name)
    case 'rabatt':
      return p.rabatt(m.name)
    case 'gebuehr':
      return p.gebuehr(m.name, zahl(m.betrag), m.an ?? p.dieBank, feld(m.feldId))
    case 'kauf':
      return p.kauf(m.name, feld(m.feldId), zahl(m.preis))
    case 'karteNeu':
      return p.karteNeu(m.name)
    case 'baustopp':
      return p.baustopp(m.name)
    case 'hausrecht':
      return p.hausrecht(feld(m.feldId))
    case 'tausch':
      return p.tausch(feld(m.meinFeldId), feld(m.fremdFeldId))
    case 'schiessstandLeer':
      return p.schiessstandLeer(m.name)
    case 'medaille':
      return p.medaille(m.name, t.schuetzenopoly.medaillen[m.medaille], zahl(m.betrag))
    case 'duell':
      return p.duell(m.name)
    case 'koenigsaktion':
      return p.koenigsaktion(m.name, zahl(m.betrag))
    case 'bau':
      return p.bau(m.name, feld(m.feldId), m.stufe)
    case 'rueckbau':
      return p.rueckbau(m.name, feld(m.feldId), zahl(m.betrag))
    case 'rueckgabe':
      return p.rueckgabe(m.name, feld(m.feldId), zahl(m.betrag))
    case 'sieg':
      return p.sieg(m.name, zahl(m.vermoegen))
    case 'aufgabe':
      return p.aufgabe(m.name)
    case 'versilbern':
      return p.versilbern(m.name, feld(m.feldId), zahl(m.betrag))
    case 'pleite':
      return p.pleite(m.name, zahl(m.betrag))
    case 'handel': {
      const beschreibe = (felder: string[], taler: number) => {
        const teile = felder.map(feld)
        if (taler > 0) teile.push(`${zahl(taler)} 🪙`)
        return teile.length ? teile.join(' + ') : p.nichts
      }
      return p.handel(
        m.von,
        beschreibe(m.gebeFelder, m.gebeTaler),
        m.an,
        beschreibe(m.willFelder, m.willTaler),
      )
    }
    case 'karte': {
      const k = (t.schuetzenopoly.karten as Eintrag<{ titel: string; text: string }>)[m.karteId]
      // Eine Karte, die es nicht mehr gibt: lieber die Zeile der Engine als nichts.
      if (!k) return eintrag.text
      return p.karte(m.name, karteMit(m.karteId)?.icon ?? '', k.titel, k.text)
    }
    case 'vorstand':
      return p.vorstand
    case 'nichtsZuReparieren':
      return p.nichtsZuReparieren
  }
}
