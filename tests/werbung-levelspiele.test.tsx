/**
 * Belohnungsvideos in den kleinen Levelspielen und im Profil.
 *
 * Google wird nicht geladen: Die Warteschlange wird abgefangen und von Hand
 * beantwortet, wie in tests/werbung.test.tsx. Geprüft wird je Stelle:
 * ohne Video kein Knopf, geschaut gibt es die Hilfe, abgebrochen nichts,
 * einmal je Versuch -- und eine Runde mit Hilfe schreibt keinen Rekord,
 * bringt weder Punkte noch XP und höchstens einen Stern, das Level zählt.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { setzeWerbungFuerTests } from '@/services/werbung'
import { db } from '@/offline/db'
import { getOrCreateGameProgress, getOrCreateGuestProfile, saveGameResult } from '@/offline'
import { createKopfrechnenLevel, nachholRunde } from '@/games/kopfrechnen'
import { createReihenfolgeLevel } from '@/games/reihenfolge'
import { KopfrechnenPage } from '@/pages/play/KopfrechnenPage'
import { ReihenfolgePage } from '@/pages/play/ReihenfolgePage'
import { WhatIsMissingPage } from '@/pages/play/WhatIsMissingPage'
import { ProfilePage } from '@/pages/profile/ProfilePage'

interface Wunsch {
  type?: string
  name?: string
  beforeReward?: (zeigen: () => void) => void
  adViewed?: () => void
  adDismissed?: () => void
  adBreakDone?: (info: { breakStatus: string }) => void
}

let wuensche: Wunsch[] = []

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  wuensche = []
  window.adsbygoogle = { push: (w: unknown) => wuensche.push(w as Wunsch) }
  setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
})

afterEach(() => {
  setzeWerbungFuerTests(null)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const anfragen = (name: string) => wuensche.filter((w) => w.type === 'reward' && w.name === name)

function seite(ui: ReactElement, sprache: 'de' | 'en' = 'de') {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

/** Google meldet: Ein Video steht bereit. */
async function videoBereit(name: string): Promise<Wunsch> {
  await vi.waitFor(() => expect(anfragen(name).length).toBeGreaterThan(0))
  const wunsch = anfragen(name).at(-1)!
  act(() => wunsch.beforeReward!(() => {}))
  return wunsch
}

async function videoSchauen(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  knopf: RegExp,
  zuEnde = true,
) {
  const wunsch = await videoBereit(name)
  await user.click(await screen.findByRole('button', { name: knopf }))
  act(() => {
    if (zuEnde) wunsch.adViewed!()
    else wunsch.adDismissed!()
    wunsch.adBreakDone!({ breakStatus: zuEnde ? 'viewed' : 'dismissed' })
  })
}

const keinAngebot = () => expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()

/** Die Runde mit Hilfe: im Verlauf, aber ohne Punkte, XP, Rekord, mit höchstens einem Stern. */
async function rundeMitHilfe() {
  const alle = await db.gameResults.toArray()
  const mit = alle.filter((r) => r.resultData['zweiteChance'] === true)
  expect(mit).toHaveLength(1)
  return mit[0]!
}

describe('Ohne Rekord speichern', () => {
  it('lässt den persönlichen Rekord unberührt', async () => {
    await saveGameResult({
      gameId: 'kopfrechnen',
      level: 3,
      score: 900,
      xp: 0,
      stars: 1,
      resultData: {},
      isPersonalRecord: true,
      ohneRekord: true,
    })
    expect(await db.personalRecords.toArray()).toEqual([])
    const [gespeichert] = await db.gameResults.toArray()
    expect(gespeichert!.isPersonalRecord).toBe(false)
  })
})

describe('Kopfrechnen: zweite Chance', () => {
  const cfg = createKopfrechnenLevel(1)

  async function antworte(user: ReturnType<typeof userEvent.setup>, zahl: number) {
    await user.type(screen.getByRole('textbox'), `${zahl}{enter}`)
  }

  async function scheitern(user: ReturnType<typeof userEvent.setup>, sprache: 'de' | 'en' = 'de') {
    seite(<KopfrechnenPage />, sprache)
    await user.click(await screen.findByRole('button', { name: /Level 1$|level 1$/ }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    for (const a of cfg.tasks) await antworte(user, a.answer + 1)
    await screen.findByText(sprache === 'de' ? '0 von 10 richtig' : '0 of 10 correct')
  }

  it('bietet ohne Video nichts an und fragt ohne Werbung gar nicht', async () => {
    setzeWerbungFuerTests({ client: null })
    const user = userEvent.setup()
    await scheitern(user)
    keinAngebot()
    expect(anfragen('kopfrechnen-chance')).toHaveLength(0)
  })

  it('geschaut: nachholen, Level zählt, aber keine Punkte, keine XP, kein Rekord, ein Stern', async () => {
    const user = userEvent.setup()
    await scheitern(user)
    await videoSchauen(
      user,
      'kopfrechnen-chance',
      /Video ansehen: zweite Chance – falsche Aufgaben nachholen/,
    )
    expect(await screen.findByText(/Nachholen: 10 neue Aufgaben/)).toBeInTheDocument()

    const runde = nachholRunde(
      cfg,
      cfg.tasks.map(() => false),
    )
    for (const a of runde.tasks) await antworte(user, a.answer)
    await screen.findByText('10 von 10 richtig')
    expect(screen.getByLabelText('1 von 5 Sternen')).toBeInTheDocument()
    expect(screen.getByText(/keine Punkte, keine XP, kein Rekord/)).toBeInTheDocument()

    // Einmal je Versuch: kein zweites Angebot, keine neue Anfrage.
    keinAngebot()
    expect(anfragen('kopfrechnen-chance')).toHaveLength(1)

    const mit = await rundeMitHilfe()
    expect(mit).toMatchObject({ score: 0, xp: 0, stars: 1, isPersonalRecord: false })
    const rekorde = await db.personalRecords.toArray()
    expect(rekorde.every((r) => r.bestScore === 0)).toBe(true)
    expect((await getOrCreateGuestProfile()).totalXp).toBe(0)
    expect((await getOrCreateGameProgress('kopfrechnen')).currentLevel).toBe(2)
  })

  it('abgebrochen: keine Belohnung, die Runde bleibt verloren', async () => {
    const user = userEvent.setup()
    await scheitern(user)
    await videoSchauen(user, 'kopfrechnen-chance', /Video ansehen/, false)
    expect(await screen.findByText('Video abgebrochen – keine Belohnung.')).toBeInTheDocument()
    expect(screen.getByText('0 von 10 richtig')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(await db.gameResults.count()).toBe(1)
  })

  it('bietet auch auf Englisch an', async () => {
    const user = userEvent.setup()
    await scheitern(user, 'en')
    await videoBereit('kopfrechnen-chance')
    const knopf = await screen.findByRole('button', {
      name: /Watch a video: second chance – make up the wrong sums/,
    })
    expect(knopf.textContent).toMatch(/Ad video – optional/)
  })
})

describe('Reihenfolge: zweite Chance', () => {
  const cfg = createReihenfolgeLevel(1)
  const takt = cfg.showMs + cfg.gapMs

  beforeEach(() => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
  })

  async function zuschauen() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(cfg.sequence.length * takt + 50)
    })
    await screen.findByText('Jetzt du!')
  }

  const tippe = (user: ReturnType<typeof userEvent.setup>, feld: number) =>
    user.click(screen.getByRole('button', { name: `Feld ${feld + 1}` }))

  async function scheitern(user: ReturnType<typeof userEvent.setup>) {
    seite(<ReihenfolgePage />)
    await user.click(await screen.findByRole('button', { name: /Level 1$/ }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await zuschauen()
    await tippe(user, cfg.sequence[0]!)
    await tippe(user, (cfg.sequence[1]! + 1) % cfg.padCount)
    await screen.findByText('Daneben')
  }

  it('bietet ohne Video nichts an', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await scheitern(user)
    keinAngebot()
  })

  it('geschaut: Folge noch einmal, weiter ab dem Fehler, ohne Punkte und Rekord', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await scheitern(user)
    await videoSchauen(user, 'reihenfolge-chance', /Video ansehen: zweite Chance/)
    expect(await screen.findByText('Schau zu …')).toBeInTheDocument()
    await zuschauen()
    // Der richtige erste Schritt bleibt stehen.
    expect(screen.getByText(`1 von ${cfg.sequenceLength}`)).toBeInTheDocument()
    for (const feld of cfg.sequence.slice(1)) await tippe(user, feld)

    await screen.findByText('Ganze Folge!')
    expect(screen.getByLabelText('1 von 5 Sternen')).toBeInTheDocument()
    expect(screen.getByText(/kein Rekord/)).toBeInTheDocument()
    keinAngebot()
    expect(anfragen('reihenfolge-chance')).toHaveLength(1)

    const mit = await rundeMitHilfe()
    expect(mit).toMatchObject({ score: 0, xp: 0, stars: 1, isPersonalRecord: false })
    expect((await getOrCreateGuestProfile()).totalXp).toBe(0)
    expect((await getOrCreateGameProgress('reihenfolge')).currentLevel).toBe(2)
  })

  it('abgebrochen: keine Belohnung', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await scheitern(user)
    await videoSchauen(user, 'reihenfolge-chance', /Video ansehen/, false)
    expect(await screen.findByText('Video abgebrochen – keine Belohnung.')).toBeInTheDocument()
    expect(screen.getByText('Daneben')).toBeInTheDocument()
    expect(screen.queryByText('Schau zu …')).toBeNull()
  })
})

describe('Was fehlt?: zweiter Blick', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    })
  })

  /** Der Countdown läuft in Schritten von 0,1 s, jeder nach einem Rendern. */
  async function merkzeitVorbei() {
    for (let i = 0; i < 80 && !screen.queryByText('Welches Objekt fehlt?'); i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })
    }
    await screen.findByText('Welches Objekt fehlt?')
  }

  const inhalt = (liste: HTMLElement) =>
    within(liste)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')

  /** Startet Level 1 und liefert, was fehlt (Emoji und Name). */
  async function bisZurWahl(user: ReturnType<typeof userEvent.setup>) {
    seite(<WhatIsMissingPage />)
    await user.click(await screen.findByRole('button', { name: /Level 1$/ }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    const gezeigt = inhalt(await screen.findByRole('list'))
    await merkzeitVorbei()
    const noch = new Set(inhalt(screen.getByRole('list', { name: 'Noch sichtbare Objekte' })))
    return gezeigt.find((o) => !noch.has(o))!
  }

  const waehle = async (user: ReturnType<typeof userEvent.setup>, objekt: string) => {
    const knopf = screen
      .getAllByRole('button')
      .find((b) => b.textContent === objekt && b.closest('li'))!
    await user.click(knopf)
  }

  it('ohne Video: kein Knopf, fünf Sterne wie bisher', async () => {
    setzeWerbungFuerTests({ client: null })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fehlt = await bisZurWahl(user)
    keinAngebot()
    expect(anfragen('wasfehlt-chance')).toHaveLength(0)
    await waehle(user, fehlt)
    await screen.findByText('Richtig!')
    expect(screen.getByLabelText('5 von 5 Sternen')).toBeInTheDocument()
    expect(screen.getByText(/\+1000/)).toBeInTheDocument()
  })

  it('geschaut: alles noch einmal sehen; richtig gewählt zählt das Level, ohne Punkte und Rekord', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fehlt = await bisZurWahl(user)
    await videoSchauen(user, 'wasfehlt-chance', /Video ansehen: zweite Chance – alles noch einmal/)
    // Wieder die Merkphase, mit allen Objekten.
    expect(await screen.findByText(/^\d+\.\d s$/)).toBeInTheDocument()
    expect(screen.getAllByText(fehlt.replace(/^\p{Extended_Pictographic}️?/u, '')).length).toBe(1)
    await merkzeitVorbei()
    keinAngebot()
    expect(anfragen('wasfehlt-chance')).toHaveLength(1)

    await waehle(user, fehlt)
    await screen.findByText('Richtig!')
    expect(screen.getByLabelText('1 von 5 Sternen')).toBeInTheDocument()
    expect(screen.queryByText(/\+1000/)).toBeNull()
    expect(screen.getByText(/kein Rekord/)).toBeInTheDocument()

    const mit = await rundeMitHilfe()
    expect(mit).toMatchObject({ score: 0, xp: 0, stars: 1, isPersonalRecord: false })
    expect(await db.personalRecords.count()).toBe(0)
    expect((await getOrCreateGuestProfile()).totalXp).toBe(0)
    expect((await getOrCreateGameProgress('what-is-missing')).currentLevel).toBe(2)
  })

  it('abgebrochen: keine Belohnung, es bleibt bei der Wahl', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await bisZurWahl(user)
    await videoSchauen(user, 'wasfehlt-chance', /Video ansehen/, false)
    expect(await screen.findByText('Video abgebrochen – keine Belohnung.')).toBeInTheDocument()
    expect(screen.getByText('Welches Objekt fehlt?')).toBeInTheDocument()
  })
})

describe('Gesichter per Video', () => {
  it('ohne Werbung: keine gesperrten Gesichter, kein Knopf', async () => {
    setzeWerbungFuerTests({ client: null })
    seite(<ProfilePage />)
    await screen.findByRole('button', { name: 'Lachen' })
    expect(screen.queryByText('Gesichter per Video')).toBeNull()
    keinAngebot()
  })

  it('geschaut: das gewählte Gesicht ist frei, bleibt frei und steht im Auswahlfeld', async () => {
    const user = userEvent.setup()
    const { unmount } = seite(<ProfilePage />)
    expect(await screen.findByText('Gesichter per Video')).toBeInTheDocument()
    expect(screen.getAllByText('▶ per Video').length).toBeGreaterThanOrEqual(4)
    await user.click(screen.getByRole('button', { name: 'Roboter – per Video freischalten' }))
    await videoSchauen(
      user,
      'gesicht-freischalten',
      /Video ansehen: Gesicht „Roboter“ freischalten/,
    )

    const roboter = await screen.findByRole('button', { name: 'Roboter' })
    await vi.waitFor(() => expect(roboter).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByRole('button', { name: 'Roboter – per Video freischalten' })).toBeNull()
    expect((await getOrCreateGuestProfile()).avatar).toBe('video-4')

    // Neu geöffnet, ohne Werbung: Das Gesicht bleibt ein normales Gesicht.
    unmount()
    setzeWerbungFuerTests({ client: null })
    seite(<ProfilePage />)
    expect(await screen.findByRole('button', { name: 'Roboter' })).toBeInTheDocument()
    expect(screen.queryByText('Gesichter per Video')).toBeNull()
  })

  it('abgebrochen: nichts freigeschaltet', async () => {
    const user = userEvent.setup()
    seite(<ProfilePage />)
    await screen.findByText('Gesichter per Video')
    await videoSchauen(user, 'gesicht-freischalten', /Video ansehen/, false)
    expect(await screen.findByText('Video abgebrochen – keine Belohnung.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drache' })).toBeNull()
    expect(localStorage.getItem('te-gesichter-per-video')).toBeNull()
  })

  it('auf Englisch', async () => {
    seite(<ProfilePage />, 'en')
    expect(await screen.findByText('Faces by video')).toBeInTheDocument()
    await videoBereit('gesicht-freischalten')
    expect(
      await screen.findByRole('button', { name: /Watch a video: unlock the “Dragon” face/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/per Video|Drache/)).toBeNull()
  })
})
