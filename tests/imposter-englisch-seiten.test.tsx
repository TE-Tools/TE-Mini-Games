/**
 * Imposter, Wer bin ich? und Scharade wählen die Wortliste nach der Sprache:
 * auf Englisch die englischen Kategorien (`en-…`), auf Deutsch die deutschen.
 *
 * Online kommen die englischen erst, wenn der Server sie kennt (Migration
 * 029) -- vorher würde er eine englische Kategorie ablehnen. Bis dahin
 * bleibt es bei den deutschen.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { SprachKnopf } from '@/i18n/SprachKnopf'
import type * as KategorienModul from '@/services/imposterKategorien'
import { wordsForCategory } from '@/games/finde-den-imposter'

const server = vi.hoisted(() => ({ englisch: new Set<string>() as ReadonlySet<string> }))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
  getMyUsername: vi.fn(async () => 'thomas'),
}))

vi.mock('@/services/imposterKategorien', async (importOriginal) => ({
  ...(await importOriginal<typeof KategorienModul>()),
  englischeKategorienAufDemServer: vi.fn(async () => server.englisch),
}))

vi.mock('@/services/imposterOnline', () => ({
  isImposterOnlineAvailable: true,
  createOnlineMatch: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  joinOnlineMatch: vi.fn(async () => 'm1'),
  leaveOnlineMatch: vi.fn(async () => {}),
  startOnlineMatch: vi.fn(async () => {}),
  toAccusePhase: vi.fn(async () => {}),
  voteOnline: vi.fn(async () => {}),
  lastChanceOnline: vi.fn(async () => {}),
  nextRoundOnline: vi.fn(async () => {}),
  fetchOnlineState: vi.fn(async () => {
    throw new Error('nicht im Test')
  }),
  fetchMyOnlineMatches: vi.fn(async () => []),
  fetchMyCustomCategories: vi.fn(async () => []),
  fetchOeffentlicheImposterRaeume: vi.fn(async () => []),
  herzschlagImposter: vi.fn(async () => {}),
  saveCustomCategoryOnline: vi.fn(async () => {}),
  subscribeToOnlineMatch: () => () => {},
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
  fetchWbiState: vi.fn(async () => {
    throw new Error('nicht im Test')
  }),
  fetchMyWbiMatches: vi.fn(async () => []),
  fetchOeffentlicheWbiRaeume: vi.fn(async () => []),
  herzschlagWbi: vi.fn(async () => {}),
  subscribeToWbiMatch: () => () => {},
}))

const { FindeDenImposterPage } = await import('@/pages/play/FindeDenImposterPage')
const { ScharadePage } = await import('@/pages/play/ScharadePage')
const { WerBinIchPage } = await import('@/pages/play/WerBinIchPage')
const { FindeDenImposterOnline } = await import('@/pages/play/FindeDenImposterOnline')
const { WerBinIchOnline } = await import('@/pages/play/WerBinIchOnline')
const { createOnlineMatch } = await import('@/services/imposterOnline')
const { createWbiMatchOnline } = await import('@/services/werBinIchOnline')
const { onlineKategorien } = await import('@/services/imposterKategorien')

function inSprache(sprache: 'de' | 'en', ui: ReactElement) {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

/** Die Auswahl der Kategorie -- die mit Tieren drin, in welcher Sprache auch immer. */
function kategorieAuswahl(): HTMLSelectElement {
  const auswahl = screen
    .getAllByRole('combobox')
    .find((s) => s.querySelector('option[value="tiere"], option[value="en-tiere"]'))
  if (!auswahl) throw new Error('keine Kategorie-Auswahl')
  return auswahl as HTMLSelectElement
}

function angeboten(): string[] {
  return within(kategorieAuswahl())
    .getAllByRole('option')
    .map((o) => (o as HTMLOptionElement).value)
}

/** Steht irgendwo ein Wort der Kategorie für sich allein auf dem Schirm? */
function zeigtWortAus(categoryId: string): boolean {
  return wordsForCategory(categoryId).some((w) => screen.queryAllByText(w.word).length > 0)
}

beforeEach(() => {
  localStorage.clear()
  server.englisch = new Set()
  vi.mocked(createOnlineMatch).mockClear()
  vi.mocked(createWbiMatchOnline).mockClear()
})

describe('Am einen Gerät', () => {
  it('Imposter auf Englisch: englische Kategorien, englisches Wort', async () => {
    inSprache('en', <FindeDenImposterPage />)
    expect(angeboten()[0]).toBe('en-tiere')
    expect(angeboten().filter((id) => !id.startsWith('en-'))).toEqual([])
    expect(kategorieAuswahl().value).toBe('en-tiere')
    expect(screen.getByRole('option', { name: 'Animals' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tiere' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    await userEvent.click(screen.getByRole('button', { name: /show my secret/ }))
    expect(zeigtWortAus('en-tiere')).toBe(true)
  })

  it('Imposter auf Deutsch: deutsche Kategorien wie bisher', async () => {
    inSprache('de', <FindeDenImposterPage />)
    expect(angeboten()[0]).toBe('tiere')
    expect(angeboten().some((id) => id.startsWith('en-'))).toBe(false)
    expect(screen.getByRole('option', { name: 'Tiere' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Am einen Gerät spielen' }))
    await userEvent.click(screen.getByRole('button', { name: /Geheimnis/ }))
    expect(zeigtWortAus('tiere')).toBe(true)
  })

  it('Scharade auf Englisch und auf Deutsch', async () => {
    const { unmount } = inSprache('en', <ScharadePage />)
    expect(kategorieAuswahl().value).toBe('en-tiere')
    expect(angeboten().every((id) => id.startsWith('en-'))).toBe(true)
    await userEvent.selectOptions(kategorieAuswahl(), 'en-essen')
    await userEvent.click(screen.getByRole('button', { name: 'Start playing' }))
    await userEvent.click(screen.getByRole('button', { name: 'Let’s go' }))
    expect(zeigtWortAus('en-essen')).toBe(true)
    unmount()

    inSprache('de', <ScharadePage />)
    expect(kategorieAuswahl().value).toBe('tiere')
    expect(angeboten().some((id) => id.startsWith('en-'))).toBe(false)
  })

  it('Wer bin ich? auf Englisch und auf Deutsch', async () => {
    const { unmount } = inSprache('en', <WerBinIchPage />)
    expect(kategorieAuswahl().value).toBe('en-tiere')
    expect(angeboten().every((id) => id.startsWith('en-'))).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    await userEvent.click(screen.getByRole('button', { name: "I'm Thomas – show me" }))
    expect(zeigtWortAus('en-tiere')).toBe(true)
    unmount()

    inSprache('de', <WerBinIchPage />)
    expect(kategorieAuswahl().value).toBe('tiere')
    expect(angeboten().some((id) => id.startsWith('en-'))).toBe(false)
  })

  it('wechselt beim Sprachwechsel auf die erste Kategorie der neuen Sprache', async () => {
    inSprache(
      'de',
      <>
        <SprachKnopf />
        <FindeDenImposterPage />
      </>,
    )
    await userEvent.selectOptions(kategorieAuswahl(), 'musik')
    expect(kategorieAuswahl().value).toBe('musik')
    await userEvent.click(screen.getByRole('button', { name: 'Switch to English' }))
    expect(kategorieAuswahl().value).toBe('en-tiere')
    expect(angeboten().every((id) => id.startsWith('en-'))).toBe(true)
  })
})

describe('Online', () => {
  it('bietet Englisch an, wenn der Server die englischen Kategorien kennt', async () => {
    server.englisch = new Set(['en-tiere', 'en-essen', 'en-berufe'])
    inSprache('en', <FindeDenImposterOnline onBack={() => {}} />)
    expect(await screen.findByRole('option', { name: 'Animals' })).toBeInTheDocument()
    expect(angeboten().filter((id) => !id.startsWith('eigen:'))).toEqual([
      'en-tiere',
      'en-essen',
      'en-berufe',
    ])
    expect(screen.queryByRole('option', { name: 'Tiere' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open game' }))
    expect(createOnlineMatch).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'en-tiere' }),
    )
  })

  it('bleibt bei Deutsch, solange der Server keine englische Kategorie kennt', async () => {
    inSprache('en', <FindeDenImposterOnline onBack={() => {}} />)
    expect(await screen.findByRole('option', { name: 'Tiere' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Animals' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open game' }))
    expect(createOnlineMatch).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'tiere' }))
  })

  it('Wer bin ich?: Englisch nur mit Server, sonst Deutsch', async () => {
    const { unmount } = inSprache('en', <WerBinIchOnline onBack={() => {}} />)
    expect(await screen.findByRole('option', { name: 'Tiere' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Animals' })).toBeNull()
    unmount()

    server.englisch = new Set(['en-tiere', 'en-maerchen'])
    inSprache('en', <WerBinIchOnline onBack={() => {}} />)
    expect(await screen.findByRole('option', { name: 'Animals' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Fairy Tales & Fantasy' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tiere' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open a room' }))
    expect(createWbiMatchOnline).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'en-tiere' }),
    )
  })

  it('bleibt auf Deutsch deutsch, auch wenn der Server Englisch kennt', async () => {
    server.englisch = new Set(['en-tiere'])
    inSprache('de', <FindeDenImposterOnline onBack={() => {}} />)
    expect(await screen.findByRole('option', { name: 'Tiere' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Animals' })).toBeNull()
  })

  it('onlineKategorien: Englisch nur mit bekannter Kategorie', () => {
    expect(onlineKategorien('en', null)[0]?.id).toBe('tiere')
    expect(onlineKategorien('en', new Set())[0]?.id).toBe('tiere')
    expect(onlineKategorien('en', new Set(['en-sport'])).map((c) => c.id)).toEqual(['en-sport'])
    expect(onlineKategorien('de', new Set(['en-sport']))[0]?.id).toBe('tiere')
  })
})
