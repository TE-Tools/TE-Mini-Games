/**
 * Bindung: Tagesaufgaben, Feiern bei Aufstieg/Abzeichen/Aufgabe.
 * Siehe docs/design/bindung/README.md.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, GUEST_USER_ID } from '@/offline/db'
import { addXp, getOrCreateGuestProfile, getProfile } from '@/offline/profile'
import { saveGameResult } from '@/offline/results'
import { processAfterResult } from '@/progression/afterResult'
import { meldePartyRunde } from '@/progression/partyRunde'
import { todayKey } from '@/progression/daily'
import { aufFeiern, type Feier } from '@/progression/feier'
import {
  aufgabenFuerTag,
  fortschritt,
  standFuer,
  zugEintragen,
  vorschlagFuer,
  AUFGABE_XP,
  ALLE_AUFGABEN_XP,
  AUFGABEN_XP_PRO_TAG_MAX,
  LEVEL_SPIELE,
  PARTY_SPIELE,
  type Spielzug,
  type Tagesaufgabe,
} from '@/progression/tagesaufgaben'
import {
  aufstiegPruefen,
  leseTagesstand,
  schreibeGefeiertesLevel,
  leseGefeiertesLevel,
} from '@/progression/tagesaufgabenSpeicher'
import { gruppeVon, kachelFuer } from '@/pages/spiele-katalog'
import type { GameId } from '@/games/types'

function tage(start: string, anzahl: number): string[] {
  const [y, m, d] = start.split('-').map(Number)
  return Array.from({ length: anzahl }, (_, i) =>
    new Date(Date.UTC(y!, m! - 1, d! + i)).toISOString().slice(0, 10),
  )
}

const zug = (gameId: string, extra: Partial<Spielzug> = {}): Spielzug => ({
  gameId,
  level: 1,
  sterne: 0,
  neuesLevel: false,
  ...extra,
})

/** Züge, die genau diese Aufgabe erfüllen (und möglichst nichts sonst). */
function zuegeFuer(a: Tagesaufgabe): Spielzug[] {
  switch (a.art) {
    case 'rundenSpiel':
      return Array.from({ length: a.ziel }, () => zug(a.gameId!))
    case 'sterne':
      return [zug('sudoku', { sterne: a.sterne })]
    case 'neuesLevel':
      return Array.from({ length: a.ziel }, (_, i) =>
        zug('trapbound', { level: i + 1, sterne: 1, neuesLevel: true }),
      )
    case 'verschiedene':
    case 'runden': {
      const spiele: GameId[] = ['kniffel', 'schach', 'texas-holdem', 'maumau']
      return Array.from({ length: a.ziel }, (_, i) => zug(spiele[i]!))
    }
    case 'gruppe': {
      const g = (['kopfrechnen', 'trapbound', 'kniffel', 'scharade'] as GameId[]).find(
        (id) => gruppeVon(id) === a.gruppe,
      )!
      return Array.from({ length: a.ziel }, () => zug(g))
    }
  }
}

describe('Tagesaufgaben: Erzeugung', () => {
  it('ist für ein Datum immer dieselbe', () => {
    expect(aufgabenFuerTag('2026-11-25')).toEqual(aufgabenFuerTag('2026-11-25'))
    expect(aufgabenFuerTag('2026-11-25')).not.toEqual(aufgabenFuerTag('2026-11-26'))
  })

  it('gibt drei Aufgaben verschiedener Art, je eine aus jedem Fach', () => {
    for (const datum of tage('2026-01-01', 365)) {
      const [a, b, c] = aufgabenFuerTag(datum)
      expect(a!.art).toBe('rundenSpiel')
      expect(['verschiedene', 'runden', 'gruppe']).toContain(b!.art)
      expect(['sterne', 'neuesLevel']).toContain(c!.art)
      // Keine Gruppe, in der das Spiel aus Fach 1 schon steht.
      if (b!.art === 'gruppe') expect(b!.gruppe).not.toBe(gruppeVon(a!.gameId!))
      // Jedes Spiel gibt es wirklich.
      expect(kachelFuer(a!.gameId!)).toBeDefined()
    }
  })

  it('wechselt über das Jahr Spiele und Arten und wiederholt das Spiel nicht am Folgetag', () => {
    const jahr = tage('2026-01-01', 365).map(aufgabenFuerTag)
    const spiele = new Set(jahr.map((x) => x[0]!.gameId))
    const zweite = new Set(jahr.map((x) => x[1]!.id))
    const dritte = new Set(jahr.map((x) => x[2]!.id))
    expect(spiele.size).toBe(15)
    expect(zweite.size).toBeGreaterThanOrEqual(5)
    expect(dritte.size).toBe(4)
    const wiederholt = jahr.filter((x, i) => i > 0 && x[0]!.gameId === jahr[i - 1]![0]!.gameId)
    expect(wiederholt).toEqual([])
  })

  it('verlangt nie ein bestimmtes Partyspiel, aber manchmal eine Runde Party', () => {
    const jahr = tage('2026-01-01', 365).map(aufgabenFuerTag)
    for (const [a] of jahr) expect(PARTY_SPIELE).not.toContain(a!.gameId)
    expect(jahr.some(([, b]) => b!.gruppe === 'party')).toBe(true)
  })

  it('schickt für die Party-Aufgabe in Schützenrunde, die allein geht', () => {
    const a: Tagesaufgabe = { id: 'gruppe:party:1', art: 'gruppe', ziel: 1, gruppe: 'party' }
    expect(vorschlagFuer(a, [], '2026-11-25')).toBe('schuetzenrunde')
  })

  it('schickt für „verschiedene Spiele" nie in ein Partyspiel', () => {
    const a: Tagesaufgabe = { id: 'verschiedene:3', art: 'verschiedene', ziel: 3 }
    for (const datum of tage('2026-01-01', 60)) {
      expect(PARTY_SPIELE).not.toContain(vorschlagFuer(a, [], datum))
    }
  })
})

describe('Tagesaufgaben: Zählung und Mitternacht', () => {
  it('zählt Runden, Sterne, neue Level, verschiedene Spiele und Gruppen', () => {
    const zuege = [
      zug('kniffel'),
      zug('kniffel'),
      zug('sudoku', { sterne: 4, neuesLevel: true }),
      zug('schuetzenrunde', { sterne: 5 }), // Sterne, aber kein Levelspiel
      zug('kopfrechnen', { sterne: 2 }),
    ]
    expect(fortschritt({ id: 'x', art: 'rundenSpiel', ziel: 3, gameId: 'kniffel' }, zuege)).toBe(2)
    expect(fortschritt({ id: 'x', art: 'sterne', ziel: 1, sterne: 3 }, zuege)).toBe(1)
    expect(fortschritt({ id: 'x', art: 'sterne', ziel: 2, sterne: 5 }, zuege)).toBe(0)
    expect(fortschritt({ id: 'x', art: 'neuesLevel', ziel: 2 }, zuege)).toBe(1)
    expect(fortschritt({ id: 'x', art: 'verschiedene', ziel: 3 }, zuege)).toBe(3)
    expect(fortschritt({ id: 'x', art: 'gruppe', ziel: 2, gruppe: 'knobeln' }, zuege)).toBe(2)
    expect(fortschritt({ id: 'x', art: 'runden', ziel: 4 }, zuege)).toBe(4)
  })

  it('fängt um Mitternacht neu an, ohne etwas abzuziehen', () => {
    const gestern = zugEintragen(null, zug('kniffel'), '2026-11-24').stand
    expect(standFuer(gestern, '2026-11-24')).toBe(gestern)
    expect(standFuer(gestern, '2026-11-25')).toEqual({
      datum: '2026-11-25',
      zuege: [],
      erledigt: [],
      alleBelohnt: false,
    })
    const heute = zugEintragen(gestern, zug('kniffel'), '2026-11-25')
    expect(heute.stand.zuege).toHaveLength(1)
  })

  it('belohnt jede Aufgabe genau einmal und alle drei mit dem Bonus', () => {
    const datum = '2026-11-25'
    const aufgaben = aufgabenFuerTag(datum)
    let stand = null as ReturnType<typeof zugEintragen>['stand'] | null
    let xp = 0
    const erledigt: string[] = []
    let bonus = 0
    for (const a of aufgaben) {
      for (const z of zuegeFuer(a)) {
        const w = zugEintragen(stand, z, datum)
        stand = w.stand
        xp += w.xp
        erledigt.push(...w.neuErledigt.map((x) => x.id))
        if (w.alleNeu) bonus++
      }
    }
    expect(new Set(erledigt).size).toBe(erledigt.length)
    expect(erledigt.sort()).toEqual(aufgaben.map((a) => a.id).sort())
    expect(bonus).toBe(1)
    expect(xp).toBe(AUFGABEN_XP_PRO_TAG_MAX)
    expect(AUFGABEN_XP_PRO_TAG_MAX).toBe(3 * AUFGABE_XP + ALLE_AUFGABEN_XP)

    // Weiterspielen bringt keine Aufgaben-XP mehr.
    const danach = zugEintragen(stand, zug('kniffel'), datum)
    expect(danach.xp).toBe(0)
    expect(danach.neuErledigt).toEqual([])
    expect(danach.alleNeu).toBe(false)
  })

  it('schlägt ein Spiel vor, das die Aufgabe voranbringt', () => {
    const datum = '2026-11-25'
    expect(
      vorschlagFuer({ id: 'x', art: 'rundenSpiel', ziel: 1, gameId: 'kniffel' }, [], datum),
    ).toBe('kniffel')
    expect(LEVEL_SPIELE).toContain(vorschlagFuer({ id: 'x', art: 'sterne', ziel: 1 }, [], datum))
    expect(vorschlagFuer({ id: 'x', art: 'neuesLevel', ziel: 1 }, [zug('sudoku')], datum)).toBe(
      'sudoku',
    )
    expect(
      gruppeVon(vorschlagFuer({ id: 'x', art: 'gruppe', ziel: 1, gruppe: 'tisch' }, [], datum)),
    ).toBe('tisch')
    expect(
      vorschlagFuer({ id: 'x', art: 'verschiedene', ziel: 2 }, [zug('kniffel')], datum),
    ).not.toBe('kniffel')
  })
})

describe('Aufstieg prüfen', () => {
  it('feiert nur echte Aufstiege', () => {
    expect(aufstiegPruefen(null, 4)).toEqual({ feiern: null, merken: 4 })
    expect(aufstiegPruefen(4, 4)).toEqual({ feiern: null, merken: 4 })
    expect(aufstiegPruefen(4, 6)).toEqual({ feiern: 6, merken: 6 })
    expect(aufstiegPruefen(6, 1)).toEqual({ feiern: null, merken: 1 })
  })
})

describe('processAfterResult: Aufgaben und Feiern', () => {
  let feiern: Feier[][] = []
  let ab: () => void = () => {}

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 25, 15, 0, 0))
    await db.delete()
    await db.open()
    localStorage.clear()
    await getOrCreateGuestProfile()
    feiern = []
    ab = aufFeiern((f) => feiern.push(f))
  })

  afterEach(() => {
    ab()
    vi.useRealTimers()
  })

  it('zählt die Runden der Tagesaufgabe und bucht ihre XP genau einmal', async () => {
    const [erste] = aufgabenFuerTag(todayKey())
    const vorher = (await getProfile())!.totalXp
    let gebucht = 0
    for (let i = 0; i < erste!.ziel + 2; i++) {
      const out = await processAfterResult({ gameId: erste!.gameId!, level: 1 })
      gebucht += out.aufgabenXp
    }
    const alleAufgaben = feiern.flat().filter((f) => f.art === 'aufgabe')
    const zurErsten = alleAufgaben.filter((f) => f.art === 'aufgabe' && f.aufgabe.id === erste!.id)
    expect(zurErsten).toHaveLength(1)
    // Jede gemeldete Aufgabe nur einmal.
    const ids = alleAufgaben.map((f) => (f.art === 'aufgabe' ? f.aufgabe.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
    expect(gebucht).toBe(alleAufgaben.length * AUFGABE_XP)
    expect((await getProfile())!.totalXp - vorher).toBe(gebucht)
    expect(leseTagesstand('guest')!.erledigt).toContain(erste!.id)
  })

  it('nimmt Sterne und ein neues Level aus dem gerade gespeicherten Ergebnis', async () => {
    await saveGameResult({
      gameId: 'sudoku',
      level: 3,
      score: 900,
      xp: 40,
      stars: 4,
      resultData: {},
    })
    await processAfterResult({ gameId: 'sudoku', level: 3 })
    const z = leseTagesstand('guest')!.zuege.at(-1)!
    expect(z).toEqual({ gameId: 'sudoku', level: 3, sterne: 4, neuesLevel: true })

    // Dasselbe Level noch einmal: kein neues Level mehr.
    await saveGameResult({
      gameId: 'sudoku',
      level: 3,
      score: 950,
      xp: 40,
      stars: 5,
      resultData: {},
    })
    await processAfterResult({ gameId: 'sudoku', level: 3 })
    expect(leseTagesstand('guest')!.zuege.at(-1)!.neuesLevel).toBe(false)
  })

  it('zählt eine Runde mit Hilfe für keine Aufgabe -- Werbung kauft keine XP', async () => {
    await saveGameResult({
      gameId: 'sudoku',
      level: 1,
      score: 900,
      xp: 40,
      stars: 4,
      resultData: {},
      mitWerbehilfe: true,
    })
    const out = await processAfterResult({ gameId: 'sudoku', level: 1 })
    expect(out.aufgabenXp).toBe(0)
    expect(leseTagesstand('guest')).toBeNull()

    await saveGameResult({
      gameId: 'kopfrechnen',
      level: 1,
      score: 0,
      xp: 0,
      stars: 1,
      resultData: { zweiteChance: true },
      ohneRekord: true,
    })
    await processAfterResult({ gameId: 'kopfrechnen', level: 1 })
    expect(leseTagesstand('guest')).toBeNull()
  })

  it('fängt am nächsten Tag mit neuen Aufgaben an', async () => {
    await processAfterResult({ gameId: 'kniffel', level: 1 })
    expect(leseTagesstand('guest')!.datum).toBe('2026-11-25')
    vi.setSystemTime(new Date(2026, 10, 26, 0, 5, 0))
    await processAfterResult({ gameId: 'kniffel', level: 1 })
    const stand = leseTagesstand('guest')!
    expect(stand.datum).toBe('2026-11-26')
    expect(stand.zuege).toHaveLength(1)
  })

  it('feiert einen Aufstieg genau einmal', async () => {
    schreibeGefeiertesLevel('guest', 1)
    await addXp('guest', 600) // Level 2 ab 500 XP
    await processAfterResult({ gameId: 'kniffel', level: 1 })
    await processAfterResult({ gameId: 'kniffel', level: 1 })
    const aufstiege = feiern.flat().filter((f) => f.art === 'aufstieg')
    expect(aufstiege).toEqual([{ art: 'aufstieg', level: 2 }])
    expect(leseGefeiertesLevel('guest')).toBe(2)
  })

  it('feiert ohne gemerktes Level nichts nach (erstes Spiel nach dem Einbau)', async () => {
    await addXp('guest', 5000)
    await processAfterResult({ gameId: 'kniffel', level: 1 })
    expect(feiern.flat().filter((f) => f.art === 'aufstieg')).toEqual([])
  })

  it('feiert jedes neue Abzeichen genau einmal', async () => {
    const erste = await processAfterResult({ gameId: 'perfect-second', level: 1 })
    const zweite = await processAfterResult({ gameId: 'perfect-second', level: 1 })
    const abzeichen = feiern.flat().filter((f) => f.art === 'abzeichen')
    expect(abzeichen.map((f) => (f.art === 'abzeichen' ? f.id : ''))).toEqual([
      ...erste.newlyUnlocked,
      ...zweite.newlyUnlocked,
    ])
    const ids = abzeichen.map((f) => (f.art === 'abzeichen' ? f.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('meldet eine Runde ohne Neues gar nicht', async () => {
    // Abzeichen der ersten Runde und Aufgaben vorab abräumen.
    for (let i = 0; i < 6; i++) await processAfterResult({ gameId: 'kniffel', level: 1 })
    feiern = []
    await processAfterResult({ gameId: 'kniffel', level: 1 })
    expect(feiern).toEqual([])
  })
})

describe('Partyspiele am Tisch', () => {
  let feiern: Feier[][] = []
  let ab: () => void = () => {}

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 25, 15, 0, 0))
    await db.delete()
    await db.open()
    localStorage.clear()
    await getOrCreateGuestProfile()
    feiern = []
    ab = aufFeiern((f) => feiern.push(f))
  })

  afterEach(() => {
    ab()
    vi.useRealTimers()
  })

  it('zählt eine gestartete Partie als Runde und hält die Serie', async () => {
    await meldePartyRunde('scharade')
    await meldePartyRunde('wortbombe')
    const zuege = leseTagesstand(GUEST_USER_ID)?.zuege ?? []
    expect(zuege.map((z) => z.gameId)).toEqual(['scharade', 'wortbombe'])
    expect(fortschritt({ id: 'verschiedene:3', art: 'verschiedene', ziel: 3 }, zuege)).toBe(2)
    expect(
      fortschritt({ id: 'gruppe:party:1', art: 'gruppe', ziel: 1, gruppe: 'party' }, zuege),
    ).toBe(1)
    expect((await getProfile())!.streakDays).toBe(1)
  })

  it('bucht die XP einer fertigen Aufgabe und feiert sie, ohne Punkte für die Partie', async () => {
    const vorher = (await getProfile())!.totalXp
    for (let i = 0; i < 4; i++) await meldePartyRunde('scharade')
    const aufgaben = aufgabenFuerTag(todayKey())
    const fertig = aufgaben.filter(
      (a) =>
        ['runden', 'verschiedene', 'gruppe'].includes(a.art) &&
        fortschritt(a, leseTagesstand(GUEST_USER_ID)!.zuege) >= a.ziel,
    )
    expect(fertig.length).toBeGreaterThan(0)
    const nachher = (await getProfile())!.totalXp
    expect(nachher - vorher).toBe(fertig.length * AUFGABE_XP)
    expect(feiern.flat().filter((f) => f.art === 'aufgabe')).toHaveLength(fertig.length)
  })
})
