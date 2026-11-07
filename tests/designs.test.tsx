/**
 * Würfel- und Kartendesigns per Belohnungsvideo.
 *
 * Werbung kauft hier Aussehen, nie einen Vorteil: Das Standarddesign
 * bleibt, wie es war, ein Video schaltet genau ein Design frei, und jede
 * verdeckte Karte trägt denselben Rücken. Google wird nicht geladen -- die
 * Warteschlange wird abgefangen und von Hand beantwortet, wie in
 * tests/werbung.test.tsx.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { setzeWerbungFuerTests } from '@/services/werbung'
import {
  freieDesigns,
  gewaehltesDesign,
  istFrei,
  schalteFrei,
  waehleDesign,
} from '@/services/sammlung'
import { DesignWahl } from '@/components/designs/DesignWahl'
import { Wuerfelreihe } from '@/pages/play/kniffel/Wuerfelreihe'
import { Blattkarte, Ziehstapel } from '@/pages/play/maumau/Blattkarte'
import { Spielkarte } from '@/pages/play/texas/Spielkarte'

vi.mock('@/services/spielername', () => ({
  spielerNameOderDu: vi.fn(async () => 'Thomas'),
  ermittleSpielerName: vi.fn(async () => 'Thomas'),
  istEchterName: () => true,
}))
vi.mock('@/services/sound', () => ({
  spiele: vi.fn(),
  vibriere: vi.fn(),
  tonAn: () => false,
  setzeTon: vi.fn(),
  pausiereTon: vi.fn(),
}))

const { TexasHoldemPage } = await import('@/pages/play/TexasHoldemPage')
const { MauMauPage } = await import('@/pages/play/MauMauPage')

interface Wunsch {
  type?: string
  name?: string
  beforeReward?: (zeigen: () => void) => void
  adViewed?: () => void
  adDismissed?: () => void
  adBreakDone?: (info: { breakStatus: string }) => void
}

let wuensche: Wunsch[] = []
const belohnungsWuensche = () => wuensche.filter((w) => w.type === 'reward')

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('te-sprache', 'de')
  wuensche = []
  window.adsbygoogle = { push: (w: unknown) => wuensche.push(w as Wunsch) }
  setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
})

afterEach(() => {
  setzeWerbungFuerTests(null)
  vi.restoreAllMocks()
})

function zeigeWahl(art: 'wuerfel' | 'kartenruecken' = 'wuerfel') {
  return render(
    <SprachProvider>
      <DesignWahl
        art={art}
        name={art === 'wuerfel' ? 'kniffel-wuerfel' : 'karten-ruecken'}
        titel="Design"
      />
    </SprachProvider>,
  )
}

/** Google hat ein Video bereit -- der Knopf erscheint. */
async function videoBereit() {
  act(() => belohnungsWuensche().at(-1)!.beforeReward!(() => {}))
  return screen.findByRole('button', { name: /Video ansehen/ })
}

describe('Die Sammlung', () => {
  it('kennt am Anfang nur den Standard', () => {
    expect(freieDesigns('wuerfel')).toEqual(['standard'])
    expect(gewaehltesDesign('wuerfel')).toBe('standard')
    expect(gewaehltesDesign('kartenruecken')).toBe('standard')
  })

  it('merkt sich Freigeschaltetes und lässt Gesperrtes nicht wählen', () => {
    waehleDesign('wuerfel', 'gold')
    expect(gewaehltesDesign('wuerfel')).toBe('standard')
    schalteFrei('wuerfel', 'gold')
    expect(istFrei('wuerfel', 'gold')).toBe(true)
    expect(gewaehltesDesign('wuerfel')).toBe('gold')
    // Die Kartenrücken bleiben davon unberührt.
    expect(freieDesigns('kartenruecken')).toEqual(['standard'])
  })

  it('übersteht Unsinn im Speicher', () => {
    localStorage.setItem('te-sammlung', '{"wuerfel":{"frei":["erfunden"],"wahl":"erfunden"}}')
    expect(gewaehltesDesign('wuerfel')).toBe('standard')
    localStorage.setItem('te-sammlung', 'kein json')
    expect(freieDesigns('wuerfel')).toEqual(['standard'])
  })
})

describe('Die Auswahl', () => {
  it('fehlt ohne Werbung ganz, solange nichts freigeschaltet ist', () => {
    setzeWerbungFuerTests({ client: null })
    const { container } = zeigeWahl()
    expect(container.textContent).toBe('')
    expect(wuensche).toHaveLength(0)
  })

  it('zeigt gesperrte Designs, aber keinen Knopf, solange kein Video bereitsteht', () => {
    zeigeWahl()
    expect(screen.getByRole('button', { name: 'Gold – per Video freischalten' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Klassisch' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
  })

  it('bietet offline nichts an', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    zeigeWahl()
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
    expect(belohnungsWuensche()).toHaveLength(0)
  })

  it('schaltet nach einem zu Ende geschauten Video genau ein Design frei -- auch nach dem Neuladen', async () => {
    const { unmount } = zeigeWahl()
    await userEvent.click(screen.getByRole('button', { name: 'Holz – per Video freischalten' }))
    const knopf = await videoBereit()
    expect(knopf.textContent).toContain('Design „Holz“')
    expect(belohnungsWuensche()[0]!.name).toBe('kniffel-wuerfel')

    await userEvent.click(knopf)
    act(() => belohnungsWuensche()[0]!.adViewed!())

    await screen.findByRole('button', { name: 'Holz' })
    expect(freieDesigns('wuerfel')).toEqual(['standard', 'holz'])
    expect(gewaehltesDesign('wuerfel')).toBe('holz')
    expect(screen.getByRole('button', { name: 'Holz' }).getAttribute('aria-pressed')).toBe('true')

    // „Neu laden“: alles weg, nur der Speicher bleibt.
    unmount()
    setzeWerbungFuerTests({ client: null })
    zeigeWahl()
    expect(screen.getByRole('button', { name: 'Holz' }).getAttribute('aria-pressed')).toBe('true')
    // Ohne Werbung bleibt das Freigeschaltete wählbar -- Gesperrtes steht nicht da.
    expect(screen.queryByRole('button', { name: /per Video freischalten/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Klassisch' }))
    expect(gewaehltesDesign('wuerfel')).toBe('standard')
  })

  it('schaltet bei einem abgebrochenen Video nichts frei', async () => {
    zeigeWahl('kartenruecken')
    const knopf = await videoBereit()
    expect(belohnungsWuensche()[0]!.name).toBe('karten-ruecken')
    await userEvent.click(knopf)
    act(() => belohnungsWuensche()[0]!.adDismissed!())

    await screen.findByText('Video abgebrochen – keine Belohnung.')
    expect(freieDesigns('kartenruecken')).toEqual(['standard'])
    expect(gewaehltesDesign('kartenruecken')).toBe('standard')
  })

  it('steht auf Englisch auf Englisch da', () => {
    localStorage.setItem('te-sprache', 'en')
    zeigeWahl('kartenruecken')
    expect(screen.getByRole('button', { name: 'Forest – unlock with a video' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Classic' })).toBeDefined()
    expect(screen.getByText('Looks only – no advantage. Only you see your choice.')).toBeDefined()
  })
})

describe('In den Spielmenüs', () => {
  it('Mau-Mau zeigt die Kartenrücken auf Deutsch', () => {
    render(
      <SprachProvider>
        <MemoryRouter>
          <MauMauPage spiel="letzte-karte" />
        </MemoryRouter>
      </SprachProvider>,
    )
    const wahl = screen.getByRole('region', { name: 'Kartenrücken' })
    expect(
      within(wahl).getByRole('button', { name: 'Wald – per Video freischalten' }),
    ).toBeDefined()
  })

  it('Texas zeigt die Kartenrücken auf Englisch', () => {
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <MemoryRouter>
          <TexasHoldemPage />
        </MemoryRouter>
      </SprachProvider>,
    )
    const wahl = screen.getByRole('region', { name: 'Card backs' })
    expect(within(wahl).getByRole('button', { name: 'Copper – unlock with a video' })).toBeDefined()
  })
})

describe('Die Würfel', () => {
  const zeigeWuerfel = () =>
    render(
      <SprachProvider>
        <Wuerfelreihe
          wuerfel={[1, 2, 3, 4, 5]}
          gehalten={[false, true, false, false, false]}
          haltbar
          rollt={false}
          onHalten={() => {}}
        />
      </SprachProvider>,
    )
  const brett = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-wuerfel-design]')!

  it('sehen ohne Design aus wie immer', () => {
    const { container } = zeigeWuerfel()
    expect(brett(container).dataset.wuerfelDesign).toBe('standard')
    expect(brett(container).getAttribute('style')).toBeNull()
  })

  it('tragen das gewählte Design', () => {
    schalteFrei('wuerfel', 'nacht')
    const { container } = zeigeWuerfel()
    expect(brett(container).dataset.wuerfelDesign).toBe('nacht')
    expect(brett(container).style.getPropertyValue('--wuerfel-flaeche')).toContain('#2b3461')
    expect(brett(container).style.getPropertyValue('--wuerfel-auge')).toContain('#ffffff')
  })

  it('wechseln, sobald ein anderes gewählt wird', () => {
    schalteFrei('wuerfel', 'gold')
    schalteFrei('wuerfel', 'kirsche')
    const { container } = zeigeWuerfel()
    expect(brett(container).dataset.wuerfelDesign).toBe('kirsche')
    act(() => waehleDesign('wuerfel', 'gold'))
    expect(brett(container).dataset.wuerfelDesign).toBe('gold')
  })
})

describe('Die Kartenrücken', () => {
  it('sehen ohne Design aus wie immer', () => {
    render(
      <SprachProvider>
        <Blattkarte zu />
        <Spielkarte zu />
      </SprachProvider>,
    )
    for (const karte of screen.getAllByRole('img')) {
      expect(karte.getAttribute('style')).toBeNull()
      expect(karte.dataset.ruecken).toBe('standard')
    }
  })

  it('tragen das gewählte Design -- jede verdeckte Karte dasselbe', () => {
    schalteFrei('kartenruecken', 'bordeaux')
    const { container } = render(
      <SprachProvider>
        <Blattkarte zu />
        <Blattkarte zu klein />
        <Blattkarte karte={null} />
        <Ziehstapel anzahl={12} />
        <Spielkarte zu />
        <Spielkarte zu groesse="klein" />
      </SprachProvider>,
    )
    const ruecken = [...container.querySelectorAll<HTMLElement>('[data-ruecken]')]
    expect(ruecken).toHaveLength(7)
    const stile = new Set(ruecken.map((r) => r.getAttribute('style')))
    expect(stile.size).toBe(1)
    expect(ruecken[0]!.dataset.ruecken).toBe('bordeaux')
    expect(ruecken[0]!.style.getPropertyValue('--ruecken-flaeche')).toContain('#8f2a3d')
  })

  it('verraten am Pokertisch nichts: Alle Gegnerkarten tragen denselben Rücken', async () => {
    schalteFrei('kartenruecken', 'sternennacht')
    render(
      <SprachProvider>
        <MemoryRouter>
          <TexasHoldemPage />
        </MemoryRouter>
      </SprachProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Turnier gegen den Rechner/ }))
    await userEvent.click(screen.getByRole('button', { name: '3' }))
    await userEvent.click(screen.getByRole('button', { name: /Los geht/ }))

    const verdeckte = await screen.findAllByLabelText('verdeckte Karte')
    expect(verdeckte.length).toBeGreaterThanOrEqual(6)
    const stile = new Set(verdeckte.map((k) => k.getAttribute('style')))
    const designs = new Set(verdeckte.map((k) => k.dataset.ruecken))
    expect(stile.size).toBe(1)
    expect([...designs]).toEqual(['sternennacht'])
    // Die eigenen Karten bleiben offen und tragen keinen Rücken.
    const meine = screen.getByLabelText('Deine Karten')
    for (const karte of within(meine).getAllByRole('img')) {
      expect(karte.dataset.ruecken).toBeUndefined()
    }
  })
})
