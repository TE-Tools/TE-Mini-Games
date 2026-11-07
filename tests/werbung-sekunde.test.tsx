/**
 * Die perfekte Sekunde: „Noch ein Versuch“ per Belohnungsvideo (`sekunde-versuch`).
 *
 * Ein Fehlversuch kostet hier nichts -- außer in Leveln mit mehreren
 * Treffern hintereinander, wo er die schon geschafften Treffer kostet. Nur
 * dort gibt es das Angebot, und es gibt genau diese Treffer zurück. Wer so
 * durchkommt, bekommt keine Punkte, keinen Rekord, höchstens einen Stern --
 * das nächste Level aber schon.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { setzeWerbungFuerTests } from '@/services/werbung'
import { db } from '@/offline/db'
import {
  getOrCreateGameProgress,
  getPersonalRecord,
  getOrCreateGuestProfile,
  recordLevelComplete,
} from '@/offline'
import {
  createPerfectSecondLevel,
  darfNochEinVersuch,
  nochEinVersuch,
} from '@/games/perfect-second'
import { PerfectSecondPage } from '@/pages/play/PerfectSecondPage'

interface Wunsch {
  type?: string
  name?: string
  beforeReward?: (zeigen: () => void) => void
  adViewed?: () => void
  adDismissed?: () => void
}

let wuensche: Wunsch[] = []
const belohnungen = () => wuensche.filter((w) => w.type === 'reward')

/** Torlevel: zwei Treffer hintereinander. */
const LEVEL = 20

beforeEach(async () => {
  wuensche = []
  window.adsbygoogle = { push: (w: unknown) => wuensche.push(w as Wunsch) }
  setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
  localStorage.setItem('te-sprache', 'de')
  await db.delete()
  await db.open()
  await getOrCreateGuestProfile()
})

afterEach(async () => {
  cleanup()
  // Die Seite bucht nach dem Anzeigen weiter (Erfolge, Abgleich) -- erst
  // ausklingen lassen, dann löscht der nächste Test die Datenbank.
  await new Promise((fertig) => setTimeout(fertig, 150))
  setzeWerbungFuerTests(null)
  vi.restoreAllMocks()
})

describe('Die perfekte Sekunde: die Regel', () => {
  it('bietet nur an, wenn ein Fehlversuch Treffer gekostet hat, und nur einmal', () => {
    expect(darfNochEinVersuch({ trefferVorher: 0, hilfeGenutzt: false })).toBe(false)
    expect(darfNochEinVersuch({ trefferVorher: 1, hilfeGenutzt: false })).toBe(true)
    expect(darfNochEinVersuch({ trefferVorher: 2, hilfeGenutzt: true })).toBe(false)
  })

  it('gibt die Treffer vor dem Fehlversuch zurück, ohne den Fehlversuch', () => {
    const vorher = { treffer: ['a', 'b'], zeiten: [1.01, 0.99, 3.4] }
    expect(nochEinVersuch(vorher)).toEqual({ treffer: ['a', 'b'], zeiten: [1.01, 0.99] })
  })
})

describe('Die perfekte Sekunde: im Spiel', () => {
  const config = createPerfectSecondLevel(LEVEL)
  let jetzt = 0

  async function zeigeLevel() {
    await recordLevelComplete('perfect-second', LEVEL - 1, 10)
    vi.spyOn(performance, 'now').mockImplementation(() => jetzt)
    render(
      <SprachProvider>
        <MemoryRouter>
          <PerfectSecondPage />
        </MemoryRouter>
      </SprachProvider>,
    )
    await userEvent.click(
      await screen.findByRole('button', { name: `Weiter spielen · Level ${LEVEL}` }),
    )
  }

  /** Start, `sekunden` warten, Stopp. */
  async function stoppe(sekunden: number) {
    await userEvent.click(screen.getByRole('button', { name: /^(Start|Nächster Treffer)$/ }))
    jetzt += sekunden * 1000
    await userEvent.click(screen.getByRole('button', { name: 'STOP' }))
  }

  const treffer = () => stoppe(config.targetTime)
  const daneben = () => stoppe(config.targetTime + config.tolerance * 4 + 1)

  it('braucht im Torlevel zwei Treffer', () => {
    expect(config.hitsRequired).toBe(2)
  })

  it('zeigt ohne Video keinen Knopf', async () => {
    await zeigeLevel()
    await treffer()
    await daneben()
    expect(await screen.findByText(/Daneben/)).toBeTruthy()
    expect(belohnungen()).toHaveLength(1)
    expect(belohnungen()[0]!.name).toBe('sekunde-versuch')
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
  })

  it('bietet nichts an, wenn der Fehlversuch nichts gekostet hat', async () => {
    await zeigeLevel()
    await daneben()
    expect(await screen.findByText(/Daneben/)).toBeTruthy()
    expect(belohnungen()).toHaveLength(0)
  })

  it('gibt nach dem Video den Treffer zurück; geschafft heißt: keine Punkte, kein Rekord, höchstens ein Stern', async () => {
    await zeigeLevel()
    await treffer()
    await daneben()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    const knopf = await screen.findByRole('button', {
      name: /Noch ein Versuch – dein Treffer bleibt/,
    })
    expect(knopf.textContent).toMatch(/Werbevideo – freiwillig/)
    await userEvent.click(knopf)
    act(() => belohnungen()[0]!.adViewed!())

    // Zurück am Start, mit dem einen Treffer.
    expect(await screen.findByText(/Treffer 1 geschafft/)).toBeTruthy()
    await treffer()

    expect(await screen.findByText(/Mit Hilfe eines Werbevideos geschafft/)).toBeTruthy()
    expect(screen.queryByText(/Neuer Rekord/i)).toBeNull()
    expect(screen.getByText('⭐')).toBeTruthy()
    const ergebnisse = await db.gameResults.toArray()
    const geschafft = ergebnisse.find((e) => e.level === LEVEL && !e.resultData['failedHit'])!
    expect(geschafft).toMatchObject({ score: 0, xp: 0, isPersonalRecord: false })
    expect(geschafft.stars).toBeLessThanOrEqual(1)
    // Den Eintrag mit 0 legt schon der Fehlversuch an (wie bisher); die
    // geschaffte Runde mit Hilfe hebt ihn nicht.
    expect((await getPersonalRecord('perfect-second', LEVEL))?.bestScore ?? 0).toBe(0)
    // Der Fortschritt zählt: Level 21 ist frei.
    expect((await getOrCreateGameProgress('perfect-second')).currentLevel).toBe(LEVEL + 1)
    expect(screen.getByRole('button', { name: `Weiter zu Level ${LEVEL + 1}` })).toBeTruthy()
  })

  it('höchstens einmal je Anlauf', async () => {
    await zeigeLevel()
    await treffer()
    await daneben()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    await userEvent.click(await screen.findByRole('button', { name: /Noch ein Versuch/ }))
    act(() => belohnungen()[0]!.adViewed!())
    expect(await screen.findByText(/Treffer 1 geschafft/)).toBeTruthy()

    const vorher = belohnungen().length
    await daneben()
    expect(await screen.findByText(/Daneben/)).toBeTruthy()
    expect(belohnungen()).toHaveLength(vorher)
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
  })

  it('gibt nach einem abgebrochenen Video nichts', async () => {
    await zeigeLevel()
    await treffer()
    await daneben()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    await userEvent.click(await screen.findByRole('button', { name: /Noch ein Versuch/ }))
    act(() => belohnungen()[0]!.adDismissed!())
    expect(await screen.findByText(/Video abgebrochen/)).toBeTruthy()
    expect(screen.getByText(/Daneben/)).toBeTruthy()
    expect(screen.queryByText(/Treffer 1 geschafft/)).toBeNull()
  })

  it('ohne Hilfe wie bisher: Punkte und Rekord', async () => {
    await zeigeLevel()
    await treffer()
    await treffer()
    expect(await screen.findByText(/Level geschafft/i)).toBeTruthy()
    expect(screen.queryByText(/Mit Hilfe eines Werbevideos/)).toBeNull()
    expect((await getPersonalRecord('perfect-second', LEVEL))?.bestScore).toBeGreaterThan(0)
  })
})
