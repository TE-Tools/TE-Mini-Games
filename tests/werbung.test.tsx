/**
 * Werbung: nur freiwillige Belohnungsvideos, nur wenn eingeschaltet, nie
 * offline. Google wird hier nicht geladen -- die Warteschlange, in die die
 * App ihre Wünsche legt, wird abgefangen und von Hand beantwortet.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { belohnungAnfragen, setzeWerbungFuerTests, werbungAktiv } from '@/services/werbung'
import { BelohnungsKnopf } from '@/components/werbung/BelohnungsKnopf'
import { DatenschutzPage } from '@/pages/recht/DatenschutzPage'

interface Wunsch {
  type?: string
  name?: string
  beforeReward?: (zeigen: () => void) => void
  adViewed?: () => void
  adDismissed?: () => void
  adBreakDone?: (info: { breakStatus: string }) => void
}

let wuensche: Wunsch[] = []

beforeEach(() => {
  wuensche = []
  window.adsbygoogle = { push: (w: unknown) => wuensche.push(w as Wunsch) }
  setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
  localStorage.setItem('te-sprache', 'de')
})

afterEach(() => {
  setzeWerbungFuerTests(null)
  vi.restoreAllMocks()
})

const letzterWunsch = () => wuensche.filter((w) => w.type === 'reward').at(-1)!

describe('Der Dienst', () => {
  it('ist ohne Publisher-Kennung aus und fragt nichts an', async () => {
    setzeWerbungFuerTests({ client: null })
    expect(werbungAktiv()).toBe(false)
    expect(await belohnungAnfragen('test')).toBeNull()
    expect(wuensche).toHaveLength(0)
  })

  it('bietet offline nichts an', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    expect(await belohnungAnfragen('test')).toBeNull()
    expect(wuensche).toHaveLength(0)
  })

  it('bietet an, sobald ein Video bereitsteht -- und belohnt nur zu Ende geschaut', async () => {
    const anfrage = belohnungAnfragen('sudoku-tipp')
    const wunsch = letzterWunsch()
    expect(wunsch.name).toBe('sudoku-tipp')
    const zeigen = vi.fn()
    wunsch.beforeReward!(zeigen)
    const angebot = await anfrage
    expect(angebot).not.toBeNull()

    const geschaut = angebot!.zeigen()
    expect(zeigen).toHaveBeenCalled()
    wunsch.adViewed!()
    wunsch.adBreakDone!({ breakStatus: 'viewed' })
    expect(await geschaut).toBe(true)
  })

  it('belohnt ein abgebrochenes Video nicht', async () => {
    const anfrage = belohnungAnfragen('test')
    const wunsch = letzterWunsch()
    wunsch.beforeReward!(() => {})
    const angebot = await anfrage
    const geschaut = angebot!.zeigen()
    wunsch.adDismissed!()
    wunsch.adBreakDone!({ breakStatus: 'dismissed' })
    expect(await geschaut).toBe(false)
  })

  it('bietet nichts an, wenn Google kein Video hat', async () => {
    const anfrage = belohnungAnfragen('test')
    letzterWunsch().adBreakDone!({ breakStatus: 'noAdPreloaded' })
    expect(await anfrage).toBeNull()
  })
})

describe('Der Knopf', () => {
  function zeige(onBelohnt = vi.fn(), aktiv = true) {
    render(
      <SprachProvider>
        <BelohnungsKnopf name="test" aktiv={aktiv} belohnung="+1 Tipp" onBelohnt={onBelohnt} />
      </SprachProvider>,
    )
    return onBelohnt
  }

  it('ist unsichtbar, solange kein Video bereitsteht', () => {
    zeige()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('erscheint mit Video, ist als Werbung beschriftet und belohnt nach dem Video', async () => {
    const onBelohnt = zeige()
    letzterWunsch().beforeReward!(() => {})
    const knopf = await screen.findByRole('button', { name: /Video ansehen: \+1 Tipp/ })
    expect(knopf.textContent).toMatch(/Werbevideo – freiwillig/)

    await userEvent.click(knopf)
    const wunsch = wuensche.filter((w) => w.type === 'reward')[0]!
    wunsch.adViewed!()
    await vi.waitFor(() => expect(onBelohnt).toHaveBeenCalledTimes(1))
  })

  it('fragt nicht an, solange das Spiel nichts anbietet', () => {
    zeige(vi.fn(), false)
    expect(wuensche.filter((w) => w.type === 'reward')).toHaveLength(0)
  })
})

describe('Datenschutzerklärung', () => {
  const zeigeSeite = () =>
    render(
      <SprachProvider>
        <MemoryRouter>
          <DatenschutzPage />
        </MemoryRouter>
      </SprachProvider>,
    )

  it('nennt mit Werbung Google AdSense, die Einwilligung und den Widerruf', () => {
    const { container } = zeigeSeite()
    const text = container.textContent ?? ''
    expect(text).toContain('Google AdSense')
    expect(text).toContain('§ 25 Abs. 1 TDDDG')
    expect(text).not.toContain('keine Werbung')
    expect(screen.getByRole('button', { name: 'Einstellungen für Werbung öffnen' })).toBeDefined()
  })

  it('bleibt ohne Werbung, wie sie war', () => {
    setzeWerbungFuerTests({ client: null })
    const { container } = zeigeSeite()
    const text = container.textContent ?? ''
    expect(text).not.toContain('AdSense')
    expect(text).toContain('keine Werbung, kein Tracking')
  })
})
