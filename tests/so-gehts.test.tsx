import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { db } from '@/offline/db'
import { PerfectSecondPage } from '@/pages/play/PerfectSecondPage'
import { WhatIsMissingPage } from '@/pages/play/WhatIsMissingPage'
import { ReihenfolgePage } from '@/pages/play/ReihenfolgePage'
import { KopfrechnenPage } from '@/pages/play/KopfrechnenPage'
import { SudokuPage } from '@/pages/play/SudokuPage'
import { RueckwaertsPage } from '@/pages/play/RueckwaertsPage'
import { SprachProvider } from '@/i18n/SprachProvider'
import { SoGehts } from '@/components/levelziel/SoGehts'
import { LevelZiel } from '@/components/levelziel/LevelZiel'
import { merkeSoGehtsGesehen, soGehtsGesehen } from '@/components/levelziel/soGehtsSpeicher'
import { renderAufDeutsch } from './aufDeutsch'

const SCHRITTE = [
  { bild: '👆', text: 'Schritt eins' },
  { bild: '🐝', text: 'Schritt zwei' },
  { bild: '⬡', text: 'Schritt drei' },
]

function zeige() {
  return renderAufDeutsch(
    <SoGehts spiel="test-spiel" schritte={SCHRITTE} mehr="Die ganze lange Erklärung." />,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('So geht’s', () => {
  it('steht beim ersten Mal offen, die lange Erklärung erst auf Wunsch', async () => {
    zeige()
    expect(screen.getByRole('button', { name: /So geht’s/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Schritt zwei')).toBeInTheDocument()
    expect(screen.queryByText('Die ganze lange Erklärung.')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Mehr erklären' }))
    expect(screen.getByText('Die ganze lange Erklärung.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Weniger erklären' }))
    expect(screen.queryByText('Die ganze lange Erklärung.')).toBeNull()
  })

  it('nach der ersten Runde zugeklappt -- und aufklappbar', async () => {
    merkeSoGehtsGesehen('test-spiel')
    zeige()
    const kopf = screen.getByRole('button', { name: /So geht’s/ })
    expect(kopf).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Schritt eins')).toBeNull()
    await userEvent.click(kopf)
    expect(screen.getByText('Schritt eins')).toBeInTheDocument()
  })

  it('merkt sich das je Spiel', () => {
    merkeSoGehtsGesehen('bienen-flow')
    expect(soGehtsGesehen('bienen-flow')).toBe(true)
    expect(soGehtsGesehen('squishy-dumplings')).toBe(false)
  })

  it('gesperrter Speicher hält nichts auf: dann eben offen', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    expect(() => merkeSoGehtsGesehen('test-spiel')).not.toThrow()
    expect(soGehtsGesehen('test-spiel')).toBe(false)
  })

  it('auf Englisch', () => {
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <SoGehts spiel="test-spiel" schritte={SCHRITTE} mehr="More." />
      </SprachProvider>,
    )
    expect(screen.getByRole('button', { name: /How to play/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explain more' })).toBeInTheDocument()
  })

  it('ohne lange Erklärung kein Knopf, die Fußnote steht unter den Schritten', () => {
    renderAufDeutsch(<SoGehts spiel="test-spiel" schritte={SCHRITTE} fussnote="Kleingedrucktes." />)
    expect(screen.getByText('Kleingedrucktes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mehr erklären' })).toBeNull()
  })
})

/** Eine Spielseite mit Router und Sprache. */
function seite(ui: ReactElement, sprache: 'de' | 'en' = 'de') {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

/** Die Karte "So geht's" einer Seite -- gefunden über ihren Kopf. */
async function soGehtsKarte(name: RegExp = /So geht’s/) {
  const kopf = await screen.findByRole('button', { name })
  return { kopf, karte: kopf.closest('section')! }
}

interface LevelSpiel {
  name: string
  spiel: string
  ui: () => ReactElement
  schritt: string
  schrittEn: string
  /** Was die Runde startet, nachdem auf der Karte ein Level gewählt wurde. */
  start: (user: ReturnType<typeof userEvent.setup>) => Promise<void>
}

const levelWaehlenUndStarten = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Level 1$/ }))
  await user.click(screen.getByRole('button', { name: 'Start' }))
}

const LEVELSPIELE: LevelSpiel[] = [
  {
    name: 'Die perfekte Sekunde',
    spiel: 'perfect-second',
    ui: () => <PerfectSecondPage />,
    schritt: 'Zähl im Kopf mit – eine Uhr siehst du nicht.',
    schrittEn: 'Count in your head – there is no clock to watch.',
    start: levelWaehlenUndStarten,
  },
  {
    name: 'Was fehlt?',
    spiel: 'what-is-missing',
    ui: () => <WhatIsMissingPage />,
    schritt: 'Tippe in der Auswahl auf das fehlende Objekt.',
    schrittEn: 'Tap the missing object among the choices.',
    start: levelWaehlenUndStarten,
  },
  {
    name: 'Reihenfolge merken',
    spiel: 'reihenfolge',
    ui: () => <ReihenfolgePage />,
    schritt: 'Tippe dieselbe Reihenfolge nach.',
    schrittEn: 'Tap the same order back.',
    start: levelWaehlenUndStarten,
  },
  {
    name: 'Kopfrechnen',
    spiel: 'kopfrechnen',
    ui: () => <KopfrechnenPage />,
    schritt: '8 von 10 richtig, und das Level ist geschafft.',
    schrittEn: 'Get 8 of 10 right to clear the level.',
    start: levelWaehlenUndStarten,
  },
  {
    name: 'Sudoku',
    spiel: 'sudoku',
    ui: () => <SudokuPage />,
    schritt: 'Leicht, Mittel und Schwer sind eigene Strecken – fang an, wo du willst.',
    schrittEn: 'Easy, Medium and Hard are separate tracks – start wherever you like.',
    start: async (user) => {
      await user.click((await screen.findAllByRole('button', { name: /^Spielen · Stufe 1$/ }))[0]!)
    },
  },
]

describe('So geht’s in den Spielen', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  for (const g of LEVELSPIELE) {
    describe(g.name, () => {
      it('steht beim ersten Besuch offen über der Auswahl, mit drei Schritten', async () => {
        seite(g.ui())
        const { kopf, karte } = await soGehtsKarte()
        expect(kopf).toHaveAttribute('aria-expanded', 'true')
        expect(within(karte).getAllByRole('listitem')).toHaveLength(3)
        expect(within(karte).getByText(g.schritt)).toBeInTheDocument()
        await userEvent.click(within(karte).getByRole('button', { name: 'Mehr erklären' }))
        expect(within(karte).getByRole('button', { name: 'Weniger erklären' })).toBeInTheDocument()
      })

      it('nach dem ersten Start nur noch eine Leiste', async () => {
        const user = userEvent.setup()
        seite(g.ui())
        await soGehtsKarte()
        await g.start(user)
        expect(soGehtsGesehen(g.spiel)).toBe(true)
        cleanup()

        seite(g.ui())
        const { kopf, karte } = await soGehtsKarte()
        expect(kopf).toHaveAttribute('aria-expanded', 'false')
        expect(within(karte).queryByText(g.schritt)).toBeNull()
      })

      it('auf Englisch', async () => {
        seite(g.ui(), 'en')
        const { karte } = await soGehtsKarte(/How to play/)
        expect(within(karte).getByText(g.schrittEn)).toBeInTheDocument()
        expect(within(karte).getByRole('button', { name: 'Explain more' })).toBeInTheDocument()
      })
    })
  }
})

/** Der Absatz mit dem Mikrofonhinweis: genau dieser Satz, davor nur das Mikrofonbild. */
function mikrofonHinweis(satz: string) {
  return screen.getByText(
    (_, el) => el?.tagName === 'P' && (el.textContent ?? '').replace('🎙️', '').trim() === satz,
  )
}

describe('So geht’s bei Rückwärts', () => {
  const HINWEIS =
    'Das Spiel braucht das Mikrofon. Die Aufnahmen bleiben auf diesem Gerät, werden nirgends gespeichert und nach jeder Runde gelöscht.'

  it('drei Schritte, der Satz für zwei Spieler darunter', async () => {
    seite(<RueckwaertsPage />)
    const { kopf, karte } = await soGehtsKarte()
    expect(kopf).toHaveAttribute('aria-expanded', 'true')
    expect(within(karte).getAllByRole('listitem')).toHaveLength(3)
    expect(
      within(karte).getByText('Eine Person spricht heimlich ein Wort ein.'),
    ).toBeInTheDocument()
    expect(within(karte).getByText('Zu zweit rät, wer nachgesprochen hat.')).toBeInTheDocument()
  })

  it('der Mikrofonhinweis steht wortgleich da -- auch wenn die Karte zu ist', async () => {
    merkeSoGehtsGesehen('rueckwaerts')
    seite(<RueckwaertsPage />)
    const { kopf, karte } = await soGehtsKarte()
    expect(kopf).toHaveAttribute('aria-expanded', 'false')
    const hinweis = mikrofonHinweis(HINWEIS)
    expect(hinweis).toBeVisible()
    expect(karte).not.toContainElement(hinweis)
  })

  it('nach dem Losspielen zugeklappt', async () => {
    const user = userEvent.setup()
    seite(<RueckwaertsPage />)
    await user.click(screen.getByRole('button', { name: /Losspielen/ }))
    expect(soGehtsGesehen('rueckwaerts')).toBe(true)
  })

  it('auf Englisch, mit dem Mikrofonhinweis', async () => {
    seite(<RueckwaertsPage />, 'en')
    const { karte } = await soGehtsKarte(/How to play/)
    expect(within(karte).getByText('One person secretly records a word.')).toBeInTheDocument()
    expect(
      within(karte).getByText('With two players, whoever copied it also guesses.'),
    ).toBeInTheDocument()
    expect(
      mikrofonHinweis(
        'This game needs the microphone. Recordings stay on this device, are not stored anywhere and are deleted after every round.',
      ),
    ).toBeVisible()
  })
})

describe('Nächstes Ziel', () => {
  it('zeigt die Zeile auf Deutsch und Englisch', () => {
    renderAufDeutsch(<LevelZiel ziel={{ art: 'bisZumTor', level: 2 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Noch 2 Level bis zum Tor')
    cleanup()
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <LevelZiel ziel={{ art: 'neuerRekord', um: 40 }} />
      </SprachProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('New record – 40 points more')
  })

  it('ohne Ziel bleibt nur ein stiller Platzhalter', () => {
    renderAufDeutsch(<LevelZiel ziel={null} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
