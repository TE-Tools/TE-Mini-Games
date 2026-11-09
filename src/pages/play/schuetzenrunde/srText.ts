/**
 * Schützenrunde in der Sprache der Oberfläche.
 *
 * Engine (`src/games/schuetzenrunde/`) und Server (Migration 007) schreiben
 * Protokoll, Erkenntnisse und die Sätze der regelbasierten Mitspieler
 * deutsch -- Tests und das SQL-Gegenstück lesen genau diese Zeilen, und an
 * den Regeln ändert die Übersetzung nichts. Die Seite liest deshalb jede
 * Zeile, erkennt, was passiert ist, und sagt es mit dem Wörterbuch neu.
 * Eine Zeile, die sie nicht erkennt, bleibt, wie sie ist.
 *
 * Die deutsche Fassung im Wörterbuch muss dabei genau die Zeile der Engine
 * ergeben; tests/schuetzenrunde-text.test.ts spielt dafür Partien durch.
 *
 * Rollen und Züge bleiben im Spielmodul als Kennung mit deutschem Namen;
 * hier wird beim Rendern nachgeschlagen.
 */

import { ROLES, roleOf, zugById, type Faction, type RoleId } from '@/games/schuetzenrunde'
import { de } from '@/i18n/texte/de'
import type { Texte } from '@/i18n/sprache'

type Rollen = Record<string, { name: string; text: string } | undefined>
type Zuege = Record<string, { name: string; kurz: string } | undefined>

function istRolle(id: string): id is RoleId {
  return Object.prototype.hasOwnProperty.call(ROLES, id)
}

/** Name einer Rolle; unbekannte Kennungen (alter Server) bleiben stehen. */
export function rollenName(t: Texte, rolle: string | null): string {
  if (!rolle) return ''
  return (
    (t.schuetzenrunde.rollen as Rollen)[rolle]?.name ??
    (istRolle(rolle) ? roleOf(rolle).name : rolle)
  )
}

/** Der Satz, den man beim Austeilen der Rolle liest. */
export function rollenText(t: Texte, rolle: string | null): string {
  if (!rolle) return ''
  return (
    (t.schuetzenrunde.rollen as Rollen)[rolle]?.text ??
    (istRolle(rolle) ? roleOf(rolle).description : '')
  )
}

export function zugName(t: Texte, zugId: string): string {
  const zug = zugById(zugId)
  return (t.schuetzenrunde.zuege as Zuege)[zug.id]?.name ?? zug.name
}

/** Kurzform für die Wahlknöpfe („Jäger" statt „Jägerzug"). */
export function zugKurz(t: Texte, zugId: string): string {
  const zug = zugById(zugId)
  return (t.schuetzenrunde.zuege as Zuege)[zug.id]?.kurz ?? zug.name
}

export function fraktionName(t: Texte, fraktion: Faction): string {
  return t.schuetzenrunde.fraktion[fraktion]
}

/* ------------------------------------------------------ Zeilen lesen */

/** Kennung zu einem deutschen Rollennamen, wie Engine und Server ihn schreiben. */
function rolleAusName(name: string): RoleId | null {
  for (const rolle of Object.values(ROLES)) if (rolle.name === name) return rolle.id
  return null
}

/** Eine Zeile aus dem Verlauf in der Sprache der Oberfläche. */
export function protokollZeile(t: Texte, zeile: string): string {
  const p = t.schuetzenrunde.protokoll
  const d = de.schuetzenrunde
  let m: RegExpMatchArray | null

  if (
    (m = zeile.match(
      /^Die Bruderschaft trifft sich – (\d+) Mitglieder, (drei|zwei) Saboteure unter euch\.$/,
    ))
  )
    return p.treffen(Number(m[1]), m[2] === 'drei' ? 3 : 2)
  if (zeile === d.protokoll.fest) return p.fest
  if (zeile === d.sabotageSieg) return t.schuetzenrunde.sabotageSieg
  if (zeile === d.bruderschaftSieg) return t.schuetzenrunde.bruderschaftSieg

  if (
    (m = zeile.match(/^Nacht (\d+): Das Zeughaus war verschlossen – der Anschlag ging daneben\.$/))
  )
    return p.zeughaus(Number(m[1]))
  if ((m = zeile.match(/^Nacht (\d+): Der Anschlag traf einen alten Hasen – er steht noch\.$/)))
    return p.alterHase(Number(m[1]))
  if ((m = zeile.match(/^Nacht (\d+): Du wurdest von den Saboteuren erwischt\.$/)))
    return p.erwischt(Number(m[1]), null)
  if ((m = zeile.match(/^Nacht (\d+): (.+) wurde von den Saboteuren erwischt\.$/)))
    return p.erwischt(Number(m[1]), m[2]!)
  if ((m = zeile.match(/^Nacht (\d+): Ein Schuss fiel – Du bist raus\.$/)))
    return p.schuss(Number(m[1]), null)
  if ((m = zeile.match(/^Nacht (\d+): Ein Schuss fiel – (.+) ist raus\.$/)))
    return p.schuss(Number(m[1]), m[2]!)

  if (
    (m = zeile.match(
      /^Tag (\d+): (?:Du wurdest|(.+) wurde) ausgeschlossen \((.+), (Saboteur|Bruderschaft)\)\.$/,
    ))
  ) {
    const rolle = rolleAusName(m[3]!)
    if (!rolle) return zeile
    const fraktion: Faction = m[4] === 'Saboteur' ? 'saboteure' : 'bruderschaft'
    return p.ausgeschlossen(
      Number(m[1]),
      m[2] === undefined ? null : m[2],
      rollenName(t, rolle),
      p.ausgeschlossenFraktion[fraktion],
    )
  }
  if ((m = zeile.match(/^Tag (\d+): Die Abstimmung endete unentschieden – niemand fliegt raus\.$/)))
    return p.unentschieden(Number(m[1]))

  if (
    (m = zeile.match(
      /^Vogelschießen: (?:Du holst|(.+) holt) den Vogel von der Stange und trägt die Königswürde\.$/,
    ))
  )
    return p.vogel(m[1] === undefined ? null : m[1])

  return zeile
}

/** Eine private Erkenntnis (Schießmeister, Gerüchtemacher, Schriftführer). */
export function notizZeile(t: Texte, zeile: string): string {
  const n = t.schuetzenrunde.notizen
  let m: RegExpMatchArray | null

  if ((m = zeile.match(/^Nacht (\d+): Du hast (.+) ins Gerede gebracht\.$/)))
    return n.gerede(Number(m[1]), m[2]!)
  if ((m = zeile.match(/^Nacht (\d+): Unter (.+) und (.+) ist mindestens ein Saboteur\.$/)))
    return n.mindestensEiner(Number(m[1]), m[2]!, m[3]!)
  if ((m = zeile.match(/^Nacht (\d+): Weder (.+) noch (.+) gehören zu den Saboteuren\.$/)))
    return n.keiner(Number(m[1]), m[2]!, m[3]!)
  if ((m = zeile.match(/^Nacht (\d+): (.+) gehört zu (den Saboteuren|der Bruderschaft)\.$/)))
    return n.gehoertZu(Number(m[1]), m[2]!, m[3] === 'den Saboteuren')

  return zeile
}

/**
 * Was am Tag gesagt wird -- von Rechner-Spielern wie von Menschen, die seit
 * dem 07.11.2026 nur noch feste Sätze wählen (`festeSaetze.ts`). Ein Satz,
 * der keiner Vorlage entspricht (etwa freier Text aus älteren Runden),
 * bleibt, wie er ist.
 */
export function aussageText(t: Texte, text: string): string {
  const a = t.schuetzenrunde.aussagen
  const d = de.schuetzenrunde.aussagen

  const verteidigung = d.verteidigungen.indexOf(text)
  if (verteidigung >= 0) return a.verteidigungen[verteidigung] ?? text
  const allgemein = d.allgemein.indexOf(text)
  if (allgemein >= 0) return a.allgemein[allgemein] ?? text

  const mitNamen: [readonly ((wer: string) => string)[], readonly ((wer: string) => string)[]][] = [
    [d.vorwuerfe, a.vorwuerfe],
    [d.fuersprache, a.fuersprache],
  ]
  for (const [vorlagen, uebersetzt] of mitNamen) {
    for (let i = 0; i < vorlagen.length; i++) {
      // Die deutsche Vorlage mit einer Lücke für den Namen.
      const vorlage = vorlagen[i]!('\u0000')
      const [vorne = '', hinten = ''] = vorlage.split('\u0000')
      if (
        text.length > vorne.length + hinten.length &&
        text.startsWith(vorne) &&
        text.endsWith(hinten)
      ) {
        const name = text.slice(vorne.length, text.length - hinten.length)
        const satz = uebersetzt[i]
        return satz ? satz(name) : text
      }
    }
  }
  return text
}
