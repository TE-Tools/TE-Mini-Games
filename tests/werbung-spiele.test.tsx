/**
 * Belohnungsvideos auf den Spielseiten: Sudoku, Squishy Dumplings, Bienen-Flow.
 *
 * Google wird nicht geladen -- die Warteschlange wird abgefangen und von
 * Hand beantwortet, wie in tests/werbung.test.tsx. Damit die Runden schnell
 * verloren gehen, sind bei Squishy die Zeit und bei Bienen-Flow das Level
 * ersetzt; alles andere läuft durch die echten Seiten und Engines.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { setzeWerbungFuerTests } from '@/services/werbung'
import { SudokuPage } from '@/pages/play/SudokuPage'
import { SquishyDumplingsPage } from '@/pages/play/SquishyDumplingsPage'
import { BienenFlowPage } from '@/pages/play/BienenFlowPage'
import {
  raetsel,
  levelNummer,
  levelName,
  merkePartie,
  leseStand,
  loescheStand,
} from '@/games/sudoku'
import { getPersonalRecord, getRecentResults } from '@/offline'
import type { BienenLevel } from '@/games/bienen-flow'
import type * as SquishyModul from '@/games/squishy-dumplings'
import type * as BienenModul from '@/games/bienen-flow'

vi.mock('@/games/squishy-dumplings', async (importOriginal) => {
  const orig = await importOriginal<typeof SquishyModul>()
  return {
    ...orig,
    // Eine Sekunde pro Level und zwei als Zugabe -- sonst wartet der Test.
    ZUSATZ_SEKUNDEN: 2,
    createDumplingLevel: (level: number) => ({ ...orig.createDumplingLevel(level), zeit: 1 }),
  }
})

/**
 * Ein Ring aus Farbe 1 um ein Pixel Farbe 2, im Nachschub fünf Blöcke der
 * verdeckten Farbe 2 vorn: Wer fünfmal die erste Spalte antippt, hat alle
 * Plätze belegt, und die Kolonie steht.
 */
vi.mock('@/games/bienen-flow', async (importOriginal) => {
  const orig = await importOriginal<typeof BienenModul>()
  const testLevel = (level: number): BienenLevel => ({
    level,
    motiv: 'Biene',
    rows: 3,
    cols: 3,
    bild: [1, 1, 1, 1, 2, 1, 1, 1, 1],
    spalten: [
      [1, 2, 3, 4, 5].map((k) => ({ id: `b${k}`, color: 2, amount: 1 })),
      [{ id: 'r', color: 1, amount: 8 }],
    ],
    slotCount: 5,
    colorCount: 2,
    isGate: false,
    label: 'Locker',
  })
  return { ...orig, createBienenLevel: testLevel }
})

interface Wunsch {
  type?: string
  name?: string
  beforeReward?: (zeigen: () => void) => void
  adViewed?: () => void
  adDismissed?: () => void
  adBreakDone?: (info: { breakStatus: string }) => void
}

let wuensche: Wunsch[] = []

const wuenscheFuer = (name: string) =>
  wuensche.filter((w) => w.type === 'reward' && w.name === name)

/** Warten, bis das Spiel ein Video anfragt, und sagen: Es steht eins bereit. */
async function videoBereit(name: string): Promise<Wunsch> {
  await vi.waitFor(() => expect(wuenscheFuer(name).length).toBeGreaterThan(0), { timeout: 4000 })
  const w = wuenscheFuer(name).at(-1)!
  act(() => w.beforeReward!(() => {}))
  return w
}

/** Den Knopf drücken und das Video zu Ende schauen (oder abbrechen). */
async function schaue(w: Wunsch, knopf: RegExp, zuEnde = true) {
  await userEvent.click(await screen.findByRole('button', { name: knopf }))
  await act(async () => {
    if (zuEnde) w.adViewed!()
    else w.adDismissed!()
  })
}

function zeige(seite: ReactElement, sprache: 'de' | 'en' = 'de') {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{seite}</MemoryRouter>
    </SprachProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  wuensche = []
  window.adsbygoogle = { push: (w: unknown) => wuensche.push(w as Wunsch) }
  setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
})

afterEach(() => {
  setzeWerbungFuerTests(null)
  vi.restoreAllMocks()
})

/* -------------------------------------------------------------- Sudoku */

describe('Sudoku: falsche Ziffern entfernen (sudoku-hilfe)', { timeout: 15000 }, () => {
  const nr = levelNummer('schwer', 1)
  const r = raetsel(nr)
  const leer = Array.from(r.vorgabe).findIndex((v) => v === 0)
  const falsch = (r.loesung[leer]! % 9) + 1
  const zelle = () =>
    screen.getByRole('gridcell', {
      name: new RegExp(`^Zeile ${Math.floor(leer / 9) + 1} Spalte ${(leer % 9) + 1},`),
    })

  /** Ein angefangenes schweres Rätsel: voll, eine Ziffer falsch. */
  async function vollMitFehler(sprache: 'de' | 'en' = 'de') {
    loescheStand()
    const w = Array.from(r.loesung).map(String)
    w[leer] = String(falsch)
    merkePartie({
      nr,
      werte: w.join(''),
      notizen: new Array(81).fill(0),
      sekunden: 120,
      fehler: 1,
      tipps: 0,
    })
    zeige(<SudokuPage />, sprache)
    await userEvent.click(screen.getByRole('button', { name: new RegExp(levelName(nr)) }))
  }

  it('ohne Video gibt es keinen Knopf, und das Spiel ist wie immer', async () => {
    setzeWerbungFuerTests({ client: null })
    await vollMitFehler()
    expect(zelle().textContent).toBe(String(falsch))
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
    expect(wuensche).toHaveLength(0)
  })

  it('auf Englisch heißt das Angebot auch englisch', async () => {
    await vollMitFehler('en')
    await videoBereit('sudoku-hilfe')
    expect(
      await screen.findByRole('button', { name: /Watch a video: remove wrong digits/ }),
    ).toBeDefined()
  })

  it('abgebrochen: keine Belohnung, die falsche Ziffer bleibt', async () => {
    await vollMitFehler()
    const w = await videoBereit('sudoku-hilfe')
    await schaue(w, /Video ansehen: falsche Ziffern entfernen/, false)
    expect(zelle().textContent).toBe(String(falsch))
    expect(await screen.findByText('Video abgebrochen – keine Belohnung.')).toBeDefined()
  })

  it('zu Ende geschaut: Fehler weg, einmal je Versuch, und gelöst gibt es keinen Rekord', async () => {
    await vollMitFehler()
    const w = await videoBereit('sudoku-hilfe')
    await schaue(w, /Video ansehen: falsche Ziffern entfernen/)
    await vi.waitFor(() => expect(zelle().textContent).toBe(''))
    expect(await screen.findByText('1 falsche Ziffer entfernt.')).toBeDefined()

    // Wieder falsch eingetragen: Das Gitter ist voll und falsch -- aber
    // diesmal kommt kein Angebot mehr.
    await userEvent.click(zelle())
    await userEvent.keyboard(String(falsch))
    expect(zelle().textContent).toBe(String(falsch))
    expect(wuenscheFuer('sudoku-hilfe')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()

    // Richtig eintragen: gelöst, mit Hilfe.
    await userEvent.keyboard(String(r.loesung[leer]))
    expect(
      await screen.findByText(
        'Mit Hilfe gelöst: höchstens ein Stern, keine Bestzeit und keine Bestpunkte.',
      ),
    ).toBeDefined()
    expect(screen.getByLabelText('1 von 5 Sternen')).toBeDefined()

    const l = leseStand().level[String(nr)]!
    expect(l.fertig).toBe(true)
    expect(l.sterne).toBe(1)
    expect(l.bestePunkte).toBe(0)
    expect(Number.isFinite(l.besteZeit)).toBe(false)
    expect(leseStand().frei.schwer).toBe(2)

    await vi.waitFor(async () => {
      const [ergebnis] = await getRecentResults('sudoku')
      expect(ergebnis?.level).toBe(nr)
      expect(ergebnis?.isPersonalRecord).toBe(false)
      expect(ergebnis?.stars).toBe(1)
      expect(ergebnis?.resultData['mitHilfe']).toBe(true)
    })
    expect(await getPersonalRecord('sudoku', nr)).toBeUndefined()
  })
})

/* ------------------------------------------------------------ Squishy */

describe('Squishy Dumplings: Zugabe nach „Zeit um!“ (squishy-zeit)', { timeout: 15000 }, () => {
  async function bisZeitUm() {
    zeige(<SquishyDumplingsPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Level 1, aktuell' }))
    expect(await screen.findByText('Zeit um!', {}, { timeout: 3000 })).toBeDefined()
  }

  it('ohne Video gibt es keinen Knopf', async () => {
    setzeWerbungFuerTests({ client: null })
    await bisZeitUm()
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
    expect(wuensche).toHaveLength(0)
  })

  it('abgebrochen: keine Zugabe', async () => {
    await bisZeitUm()
    const w = await videoBereit('squishy-zeit')
    await schaue(w, /Video ansehen: \+2 Sekunden/, false)
    expect(screen.getByText('Zeit um!')).toBeDefined()
    expect(await screen.findByText('Video abgebrochen – keine Belohnung.')).toBeDefined()
  })

  it('zu Ende geschaut: weiterspielen -- und nur einmal je Versuch', async () => {
    await bisZeitUm()
    const w = await videoBereit('squishy-zeit')
    await schaue(w, /Video ansehen: \+2 Sekunden/)
    await vi.waitFor(() => expect(screen.queryByText('Zeit um!')).toBeNull())
    expect(screen.getByText(/2s/)).toBeDefined()

    // Die Zugabe läuft ab: wieder verloren, aber kein zweites Angebot.
    expect(await screen.findByText('Zeit um!', {}, { timeout: 4000 })).toBeDefined()
    await new Promise((fertig) => setTimeout(fertig, 50))
    expect(wuenscheFuer('squishy-zeit')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()

    // Nochmal ist ein neuer Versuch: Dort gibt es die Zugabe wieder.
    await userEvent.click(screen.getByRole('button', { name: 'Nochmal' }))
    expect(await screen.findByText('Zeit um!', {}, { timeout: 3000 })).toBeDefined()
    await vi.waitFor(() => expect(wuenscheFuer('squishy-zeit')).toHaveLength(2))
  })
})

describe(
  'Squishy Dumplings: der Sternschnuppen-Bao (squishy-sonderknoedel)',
  { timeout: 15000 },
  () => {
    async function regalAuf(sprache: 'de' | 'en' = 'de') {
      zeige(<SquishyDumplingsPage />, sprache)
      await userEvent.click(
        await screen.findByRole('button', {
          name: sprache === 'de' ? /Deine Sammlung/ : /Your collection/,
        }),
      )
    }

    it('ohne Werbung kein Platz im Regal und kein Knopf', async () => {
      setzeWerbungFuerTests({ client: null })
      await regalAuf()
      expect(screen.queryByText('per Video freischalten')).toBeNull()
      expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
      expect(wuensche).toHaveLength(0)
    })

    it('steht verschlossen im Regal; abgebrochen bleibt er zu', async () => {
      await regalAuf()
      expect(screen.getByText('per Video freischalten')).toBeDefined()
      const w = await videoBereit('squishy-sonderknoedel')
      await schaue(w, /Video ansehen: Sternschnuppen-Bao für deine Sammlung/, false)
      expect(screen.getByText('per Video freischalten')).toBeDefined()
      expect(localStorage.getItem('squishy-dumplings:video-knoedel')).toBeNull()
    })

    it('zu Ende geschaut: gehört dir, wird getragen und bleibt nach dem Neuladen', async () => {
      await regalAuf()
      const w = await videoBereit('squishy-sonderknoedel')
      await schaue(w, /Video ansehen: Sternschnuppen-Bao/)
      expect(await screen.findByRole('button', { name: /Sternschnuppen-Bao/ })).toBeDefined()
      expect(screen.queryByText('per Video freischalten')).toBeNull()
      expect(localStorage.getItem('squishy-dumplings:video-knoedel')).toBe('1')
      expect(localStorage.getItem('squishy-dumplings:knoedel')).toBe('bao-sternschnuppe')

      // Neu geladen, ohne Werbung und ohne Netz: Er ist noch da.
      document.body.innerHTML = ''
      setzeWerbungFuerTests({ client: null })
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      await regalAuf()
      const platz = screen.getByRole('button', { name: /Sternschnuppen-Bao/ })
      expect((platz as HTMLButtonElement).disabled).toBe(false)
      expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
    })

    it('auf Englisch', async () => {
      await regalAuf('en')
      expect(screen.getByText('unlock with a video')).toBeDefined()
      await videoBereit('squishy-sonderknoedel')
      expect(
        await screen.findByRole('button', {
          name: /Watch a video: Shooting star bao for your collection/,
        }),
      ).toBeDefined()
    })
  },
)

/* ---------------------------------------------------------- Bienen-Flow */

describe('Bienen-Flow: einen Platz freiräumen (bienen-platz)', { timeout: 15000 }, () => {
  async function bisKolonieSteht() {
    zeige(<BienenFlowPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Level 1, aktuell' }))
    for (let k = 0; k < 5; k++) {
      const nachschub = screen.getByLabelText('Nachschub')
      const oben = within(nachschub)
        .getAllByRole('button')
        .find((b) => !(b as HTMLButtonElement).disabled)!
      await userEvent.click(oben)
    }
    expect(await screen.findByText('Die Kolonie steht', {}, { timeout: 3000 })).toBeDefined()
  }

  it('ohne Video gibt es keinen Knopf', async () => {
    setzeWerbungFuerTests({ client: null })
    await bisKolonieSteht()
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
    expect(wuensche).toHaveLength(0)
  })

  it('abgebrochen: die Kolonie steht weiter', async () => {
    await bisKolonieSteht()
    const w = await videoBereit('bienen-platz')
    await schaue(w, /Video ansehen: einen Platz freiräumen/, false)
    expect(screen.getByText('Die Kolonie steht')).toBeDefined()
    expect(screen.getByText('Plätze 5/5')).toBeDefined()
  })

  it('zu Ende geschaut: ein Platz frei, weiterspielen -- und nur einmal je Versuch', async () => {
    await bisKolonieSteht()
    const w = await videoBereit('bienen-platz')
    await schaue(w, /Video ansehen: einen Platz freiräumen/)
    await vi.waitFor(() => expect(screen.queryByText('Die Kolonie steht')).toBeNull())
    expect(screen.getByText('Plätze 4/5')).toBeDefined()

    // Den zurückgestellten Block wieder hoch: wieder fest, aber kein Angebot mehr.
    const nachschub = screen.getByLabelText('Nachschub')
    await userEvent.click(
      within(nachschub)
        .getAllByRole('button')
        .find((b) => !(b as HTMLButtonElement).disabled && b.textContent === '1')!,
    )
    expect(await screen.findByText('Die Kolonie steht', {}, { timeout: 3000 })).toBeDefined()
    await new Promise((fertig) => setTimeout(fertig, 50))
    expect(wuenscheFuer('bienen-platz')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Video ansehen/ })).toBeNull()
  })
})
