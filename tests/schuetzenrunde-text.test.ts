/**
 * Schützenrunde auf Englisch: Engine und Server schreiben Verlauf,
 * Erkenntnisse und die Sätze der Mitspieler deutsch, die Seite sagt sie mit
 * dem Wörterbuch neu (pages/play/schuetzenrunde/srText.ts). Hier werden viele
 * Partien durchgespielt: Auf Deutsch muss jede Zeile genau so herauskommen,
 * wie die Engine sie schreibt, und auf Englisch darf kein deutsches Wort
 * übrig bleiben -- eine Zeile ohne Muster fiele sonst still ins Deutsche.
 */
import { describe, it, expect } from 'vitest'
import {
  createMatch,
  resolveNight,
  startVote,
  resolveVote,
  nextRound,
  alivePlayers,
  humanPlayer,
  ROLES,
  ZUEGE,
  type MatchState,
} from '@/games/schuetzenrunde'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import {
  aussageText,
  notizZeile,
  protokollZeile,
  rollenName,
  rollenText,
  zugKurz,
  zugName,
} from '@/pages/play/schuetzenrunde/srText'

const NAMEN = [
  'Karl',
  'Hilde',
  'Werner',
  'Anneliese',
  'Josef',
  'Gertrud',
  'Heinz',
  'Marlies',
  'Otto',
  'Elfriede',
  'Bernd',
  'Rosi',
  'Ludwig',
  'Käthe',
  'Franz',
  'Irmgard',
  'Anna',
]

const DEUTSCH =
  /[äöüßÄÖÜ]|\b(Nacht|Tag|wurde|wurdest|Bruderschaft|Saboteure|gehört|gehören|Weder|Unter|Ich|ist|bist|raus|Vogel|Zeughaus|Schützenfest|Abstimmung|euch|und|nicht|Du)\b/

function ohneNamen(text: string): string {
  return NAMEN.reduce((rest, name) => rest.split(name).join('#'), text)
}

interface Zeilen {
  log: Set<string>
  notes: Set<string>
  talk: Set<string>
}

function spieleDurch(state: MatchState, zeilen: Zeilen): void {
  let current = state
  let guard = 0
  const merke = (s: MatchState) => {
    s.log.forEach((l) => zeilen.log.add(l))
    s.notes.forEach((n) => zeilen.notes.add(n))
    s.statements.forEach((st) => zeilen.talk.add(st.text))
  }
  while (!current.winner && guard < 30) {
    const ziel = alivePlayers(current).find((p) => !p.isHuman)
    current = resolveNight(current, { targetId: ziel?.id, useShot: true, spreadRumour: true })
    merke(current)
    if (current.winner) break
    current = startVote(current)
    // Mal stimmt der Mensch mit, mal nicht -- so gibt es auch Gleichstände.
    const stimme =
      guard % 2 === 0 ? (alivePlayers(current).find((p) => !p.isHuman)?.id ?? null) : null
    current = resolveVote(current, stimme)
    merke(current)
    if (current.winner) break
    current = nextRound(current)
    guard++
  }
  merke(current)
}

function sammle(): Zeilen {
  const zeilen: Zeilen = { log: new Set(), notes: new Set(), talk: new Set() }
  for (let i = 0; i < 400; i++) {
    const size = [8, 10, 12, 14, 16][i % 5]!
    spieleDurch(createMatch('Anna', `text-${i}`, size, { event: i % 3 === 0 }), zeilen)
  }
  return zeilen
}

const zeilen = sammle()

describe('Schützenrunde – Texte aus der Engine', () => {
  it('kommen genug verschiedene Zeilen zusammen', () => {
    expect(zeilen.log.size).toBeGreaterThan(100)
    expect(zeilen.notes.size).toBeGreaterThan(20)
    expect(zeilen.talk.size).toBeGreaterThan(20)
    const alles = [...zeilen.log].join('\n')
    for (const stueck of [
      'Zeughaus',
      'alten Hasen',
      'Du wurdest',
      'Ein Schuss fiel',
      'unentschieden',
      'Vogelschießen',
      'trifft sich',
    ]) {
      expect(alles).toContain(stueck)
    }
    const notizen = [...zeilen.notes].join('\n')
    for (const stueck of ['gehört zu', 'Gerede', 'mindestens ein', 'Weder']) {
      expect(notizen).toContain(stueck)
    }
  })

  it('ergeben auf Deutsch genau die Zeile der Engine', () => {
    for (const l of zeilen.log) expect(protokollZeile(de, l)).toBe(l)
    for (const n of zeilen.notes) expect(notizZeile(de, n)).toBe(n)
    for (const s of zeilen.talk) expect(aussageText(de, s)).toBe(s)
  })

  it('lassen auf Englisch kein deutsches Wort übrig', () => {
    const uebrig: string[] = []
    const pruefe = (aus: string) => {
      if (DEUTSCH.test(ohneNamen(aus))) uebrig.push(aus)
    }
    for (const l of zeilen.log) pruefe(protokollZeile(en, l))
    for (const n of zeilen.notes) pruefe(notizZeile(en, n))
    for (const s of zeilen.talk) pruefe(aussageText(en, s))
    expect(uebrig).toEqual([])
  })

  it('übersetzen die Zeilen, die nur der Server schreibt', () => {
    expect(protokollZeile(en, 'Nacht 2: Rosi wurde von den Saboteuren erwischt.')).toBe(
      'Night 2: The saboteurs got Rosi.',
    )
    expect(protokollZeile(en, 'Die Saboteure haben die Bruderschaft übernommen.')).toBe(
      en.schuetzenrunde.sabotageSieg,
    )
    expect(
      protokollZeile(
        en,
        'Tag 3: Bert wurde ausgeschlossen (Stellvertretender Brudermeister, Bruderschaft).',
      ),
    ).toBe('Day 3: Bert was expelled (Deputy Grand Master, Brotherhood).')
  })

  it('lassen fremde Zeilen und den Chat der Menschen stehen', () => {
    expect(protokollZeile(en, 'Etwas ganz anderes.')).toBe('Etwas ganz anderes.')
    expect(aussageText(en, 'Karl war das')).toBe('Karl war das')
  })
})

describe('Schützenrunde – Rollen und Züge', () => {
  it('haben für jede Kennung einen Namen und einen Text', () => {
    for (const id of Object.keys(ROLES)) {
      expect(rollenName(de, id)).toBe(ROLES[id as keyof typeof ROLES].name)
      expect(rollenText(de, id)).toBe(ROLES[id as keyof typeof ROLES].description)
      expect(rollenName(en, id)).not.toBe('')
      expect(rollenText(en, id)).not.toMatch(/[äöüß]/)
    }
    for (const zug of ZUEGE) {
      expect(zugName(de, zug.id)).toBe(zug.name)
      expect(zugKurz(de, zug.id)).toBe(zug.name.replace('zug', ''))
      expect(zugName(en, zug.id)).toMatch(/Platoon$/)
    }
  })

  it('fällt bei unbekannter Rolle auf die Kennung zurück', () => {
    expect(rollenName(en, 'gibtsnicht')).toBe('gibtsnicht')
    expect(humanPlayer(createMatch('Du', 'x', 8)).name).toBe('Du')
  })
})
