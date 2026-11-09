/**
 * Wer bin ich? und Stadt-Land-Fluss auf Englisch -- und auf Deutsch wie bisher.
 *
 * Die Begriffe von Wer bin ich? kommen aus der Liste der jeweiligen Sprache
 * (eigene `en-`-Kategorien, siehe docs/design/zweisprachig). Die Spalten von
 * Stadt-Land-Fluss sind dagegen reine Oberfläche: Im Zustand und auf dem
 * Server steht nur die Kennung, der Name wird beim Anzeigen nachgeschlagen.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import type { WbiOnlineState } from '@/services/werBinIchOnline'
import type { SlfOnlineState } from '@/services/stadtLandFlussOnline'

const server = vi.hoisted(() => ({
  wbi: null as WbiOnlineState | null,
  slf: null as SlfOnlineState | null,
}))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
  getMyUsername: vi.fn(async () => 'thomas'),
}))

vi.mock('@/services/werBinIchOnline', () => ({
  isWerBinIchOnlineAvailable: true,
  createWbiMatchOnline: vi.fn(async () => ({ match_id: 'w1', code: 'ABCDE' })),
  joinWbiMatch: vi.fn(async () => 'w1'),
  leaveWbiMatch: vi.fn(async () => {}),
  startWbiMatch: vi.fn(async () => {}),
  toWbiGuessPhase: vi.fn(async () => {}),
  guessWbiOnline: vi.fn(async () => {}),
  nextWbiRoundOnline: vi.fn(async () => {}),
  fetchWbiState: vi.fn(async () => structuredClone(server.wbi)),
  fetchMyWbiMatches: vi.fn(async () => []),
  fetchOeffentlicheWbiRaeume: vi.fn(async () => []),
  herzschlagWbi: vi.fn(async () => {}),
  subscribeToWbiMatch: () => () => {},
}))

vi.mock('@/services/stadtLandFlussOnline', () => ({
  isSlfOnlineAvailable: true,
  createSlfMatchOnline: vi.fn(async () => ({ match_id: 's1', code: 'FGHJK' })),
  joinSlfMatch: vi.fn(async () => 's1'),
  leaveSlfMatch: vi.fn(async () => {}),
  startSlfRound: vi.fn(async () => {}),
  submitSlfAnswers: vi.fn(async () => {}),
  tickSlf: vi.fn(async () => {}),
  fetchSlfState: vi.fn(async () => structuredClone(server.slf)),
  fetchMySlfMatches: vi.fn(async () => []),
  fetchOeffentlicheSlfRaeume: vi.fn(async () => []),
  herzschlagSlf: vi.fn(async () => {}),
  subscribeToSlfMatch: () => () => {},
}))

const { WerBinIchPage } = await import('@/pages/play/WerBinIchPage')
const { StadtLandFlussPage } = await import('@/pages/play/StadtLandFlussPage')
const { WerBinIchOnline } = await import('@/pages/play/WerBinIchOnline')
const { StadtLandFlussOnline } = await import('@/pages/play/StadtLandFlussOnline')
const { createSlfMatchOnline } = await import('@/services/stadtLandFlussOnline')

function inSprache(sprache: 'de' | 'en', ui: ReactElement) {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

async function namenEintragen(namen: string) {
  const feld = screen.getByRole('textbox')
  await userEvent.clear(feld)
  await userEvent.type(feld, namen)
}

beforeEach(() => {
  localStorage.clear()
  server.wbi = null
  server.slf = null
})

describe('Wer bin ich? am einen Gerät', () => {
  it('führt auf Englisch durch eine Runde', async () => {
    inSprache('en', <WerBinIchPage />)
    expect(screen.getByRole('heading', { name: /Who am I\?/ })).toBeInTheDocument()
    expect(screen.getByText('Players (2–12)')).toBeInTheDocument()
    expect(screen.getByText('4 players')).toBeInTheDocument()
    expect(screen.getByText(/shared with "Find the Imposter"/)).toBeInTheDocument()
    expect(screen.queryByText(/Am einen Gerät/)).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    expect(screen.getByText('Pass the device to')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: "I'm Thomas – show me" }))
    expect(screen.getByRole('heading', { name: 'Everyone else' })).toBeInTheDocument()
    expect(screen.getByText(/For Thomas only · Round 1/)).toBeInTheDocument()
  })

  it('meldet doppelte Namen auf Englisch', async () => {
    inSprache('en', <WerBinIchPage />)
    await namenEintragen('Lena{enter}lena')
    await userEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    expect(screen.getByText('Name used twice: lena')).toBeInTheDocument()
  })

  it('bleibt auf Deutsch, wie es war', async () => {
    inSprache('de', <WerBinIchPage />)
    expect(screen.getByText('Spieler (2–12)')).toBeInTheDocument()
    await namenEintragen('Lena')
    await userEvent.click(screen.getByRole('button', { name: 'Am einen Gerät spielen' }))
    expect(screen.getByText('Mindestens 2 Spieler nötig')).toBeInTheDocument()
  })
})

describe('Stadt-Land-Fluss am einen Gerät', () => {
  it('zeigt Spalten, Uhr und Auswertung auf Englisch', async () => {
    inSprache('en', <StadtLandFlussPage />)
    expect(screen.getByRole('heading', { level: 1, name: /Categories/ })).toBeInTheDocument()
    for (const name of ['City', 'Country', 'River', 'First name', 'Animal', 'Job']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Stadt' })).toBeNull()

    await namenEintragen('Lena{enter}Ida')
    await userEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    expect(screen.getByText(/90 seconds for 5 categories/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: "Let's go" }))
    expect(screen.getByLabelText('City')).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/^City starting with [A-Z]…$/),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    await userEvent.click(screen.getByRole('button', { name: "Let's go" }))
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.getByRole('heading', { name: 'Scores' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Category' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'River' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Total' })).toBeInTheDocument()
  })

  it('zeigt die Spalten auf Deutsch wie bisher', () => {
    inSprache('de', <StadtLandFlussPage />)
    expect(screen.getByRole('button', { name: 'Stadt' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Am einen Gerät spielen' })).toBeInTheDocument()
  })
})

describe('Online auf Englisch', () => {
  it('Wer bin ich?: Auflösung', async () => {
    server.wbi = {
      match: {
        id: 'w1',
        code: 'ABCDE',
        phase: 'result',
        round: 2,
        category_id: 'tiere',
        category_label: 'Tiere',
        starter_seat: 0,
        is_host: true,
        size: 2,
        open_guesses: 0,
      },
      me: { seat: 0, name: 'Thomas', guess: 'Hund', correct: false, word: 'Katze' },
      players: [
        {
          seat: 0,
          name: 'Thomas',
          is_you: true,
          word: 'Katze',
          has_guessed: true,
          guess: 'Hund',
          correct: false,
        },
        {
          seat: 1,
          name: 'Lena',
          is_you: false,
          word: 'Löwe',
          has_guessed: true,
          guess: 'Löwe',
          correct: true,
        },
      ],
    }
    inSprache('en', <WerBinIchOnline onBack={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Open a room' }))
    expect(await screen.findByRole('heading', { name: 'The answers' })).toBeInTheDocument()
    expect(screen.getByText(/2 in the room · Round 2 · Tiere/)).toBeInTheDocument()
    expect(screen.getByText('"Hund"')).toBeInTheDocument()
    expect(screen.getByText('guessed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next round' })).toBeInTheDocument()
    expect(screen.queryByText(/erraten|Runde/)).toBeNull()
  })

  it('Stadt-Land-Fluss: schickt Kennungen, zeigt englische Spalten', async () => {
    server.slf = {
      match: {
        id: 's1',
        code: 'FGHJK',
        phase: 'lobby',
        round: 1,
        letter: null,
        columns: ['stadt', 'land', 'fluss', 'name', 'tier'],
        seconds: 120,
        deadline: null,
        stopped: false,
        is_host: true,
        size: 1,
        open_writers: 0,
      },
      me: {
        seat: 0,
        name: 'Thomas',
        submitted: false,
        answers: {},
        round_score: 0,
        total_score: 0,
      },
      players: [
        {
          seat: 0,
          name: 'Thomas',
          is_you: true,
          submitted: false,
          answers: {},
          round_score: 0,
          total_score: 0,
        },
      ],
    }
    inSprache('en', <StadtLandFlussOnline onBack={() => {}} />)
    expect(await screen.findByText('Time per round: 120 s')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(vi.mocked(createSlfMatchOnline)).toHaveBeenCalledWith(
      expect.objectContaining({ columns: ['stadt', 'land', 'fluss', 'name', 'tier'] }),
    )
    expect(await screen.findByRole('heading', { name: 'Waiting room' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Share the code. Categories: City, Country, River, First name, Animal · 120 s per round.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'At least 2 players needed' })).toBeDisabled()
  })
})
