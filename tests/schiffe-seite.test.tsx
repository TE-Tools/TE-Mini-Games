/**
 * Die Seite Schiffe versenken: Menü, Aufstellen, ein Schuss gegen den
 * Computer bis zum Ergebnis, zu zweit mit Übergabe -- und der Online-Tisch
 * gegen einen nachgebauten Server, auch ohne eingespielte Migration.
 *
 * jsdom hat keine Leinwand: Die Rakete fliegt hier nicht, die Seite nimmt
 * den schlichten Weg (kurze Pause, dann das Ergebnis) -- derselbe Weg wie
 * bei „Bewegung reduzieren" und im Sparmodus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import {
  FLOTTE,
  SPEICHER_SCHLUESSEL,
  STANDARD_REGELN,
  neuePartie,
  schiesse,
  sichtFuer,
  type Schiff,
} from '@/games/schiffe-versenken'
import type { SchiffeOnlineState } from '@/services/schiffeOnline'
import { renderAufDeutsch as render } from './aufDeutsch'

const gebucht = vi.hoisted(() => vi.fn())
const gemeldet = vi.hoisted(() => vi.fn())
const server = vi.hoisted(() => ({
  stand: null as SchiffeOnlineState | null,
  fehlt: false,
}))
const rufe = vi.hoisted(() => ({
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  schiessen: vi.fn(async (_m: string, feld: number) => ({ feld, ergebnis: 'wasser' })),
}))

vi.mock('@/pages/play/schiffe/partieBuchen', () => ({ buchePartie: gebucht }))
vi.mock('@/progression/partyRunde', () => ({ meldePartyRunde: gemeldet }))
vi.mock('@/services/sound', () => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: async () => 'Thomas',
  istEchterName: () => true,
}))
vi.mock('@/services/schiffeOnline', () => {
  const fehlt = () =>
    Promise.reject(
      new Error(
        'Die Online-Runden sind auf dem Server noch nicht eingerichtet. Am einen Gerät könnt ihr sofort weiterspielen.',
      ),
    )
  return {
    isSchiffeOnlineAvailable: true,
    createSchiffeMatch: (...a: unknown[]) => (server.fehlt ? fehlt() : rufe.create(...(a as []))),
    joinSchiffeMatch: vi.fn(async () => 'm1'),
    leaveSchiffeMatch: vi.fn(async () => {}),
    startSchiffeMatch: vi.fn(async () => {}),
    setzeSchiffeFlotte: vi.fn(async () => {}),
    schiesseOnline: rufe.schiessen,
    gibSchiffeAuf: vi.fn(async () => {}),
    fetchSchiffeState: vi.fn(async () => server.stand),
    fetchMySchiffeMatches: () => (server.fehlt ? fehlt() : Promise.resolve([])),
    fetchOeffentlicheSchiffeRaeume: vi.fn(async () => []),
    herzschlagSchiffe: vi.fn(async () => {}),
    subscribeToSchiffeMatch: () => () => {},
  }
})

const { SchiffeVersenkenPage } = await import('@/pages/play/SchiffeVersenkenPage')
const { SchiffeVersenkenOnline } = await import('@/pages/play/SchiffeVersenkenOnline')

function zeige() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <SchiffeVersenkenPage />
      </MemoryRouter>
    </StrictMode>,
  )
}

const meer = (name: RegExp | string) => screen.getByRole('group', { name })
const feldIn = (brett: HTMLElement, feld: number) =>
  brett.querySelector<HTMLButtonElement>(`[data-feld="${feld}"]`)!

beforeEach(() => {
  localStorage.clear()
  gebucht.mockReset()
  gebucht.mockResolvedValue({ punkte: 120, xp: 30, ausgang: 'sieg', bestwert: false })
  gemeldet.mockReset()
  server.fehlt = false
  server.stand = null
  rufe.create.mockClear()
  rufe.schiessen.mockClear()
})

describe('Schiffe versenken gegen den Computer', () => {
  it('Menü, Flotte zufällig aufstellen, ein Schuss bis zum Ergebnis, dann schießt der Computer', async () => {
    zeige()
    expect(screen.getByTestId('spiel-hero')).toBeInTheDocument()
    expect(screen.getByText('Zu zweit an einem Gerät')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leicht' }))
    await userEvent.click(screen.getByRole('button', { name: 'Flotte aufstellen' }))

    expect(screen.getByText('Stell deine Flotte auf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Zufällig verteilen' }))
    // Fünf Schiffe mit eigener Form, 17 Felder davon sind Schiff.
    expect(document.querySelectorAll('[data-schiff]')).toHaveLength(FLOTTE.length)
    expect(screen.getAllByRole('button', { name: /: Schiff$/ })).toHaveLength(17)
    await userEvent.click(screen.getByRole('button', { name: 'Fertig – Leinen los!' }))

    const ziel = meer('Meer von Computer · Leicht')
    // Von der fremden Flotte ist nichts zu sehen.
    expect(ziel.querySelectorAll('[data-schiff]')).toHaveLength(0)
    expect(screen.getByText('Du bist dran – wähl ein Feld')).toBeInTheDocument()

    await userEvent.click(feldIn(ziel, 44))
    // Während die Rakete fliegt, nimmt das Meer nichts an.
    expect(screen.getByText('Rakete unterwegs …')).toBeInTheDocument()
    expect(feldIn(ziel, 45)).toBeDisabled()
    // Erst beim Einschlag steht das Ergebnis da.
    await waitFor(() => expect(feldIn(ziel, 44).dataset['ergebnis']).toBeTruthy())
    expect(screen.getByRole('status')).toHaveTextContent(/Wasser|Treffer!|versenkt!/)

    // Danach schießt der Computer aufs eigene Meer (außer bei einem Treffer
    // ohne Extraschuss-Regel ist er immer dran).
    const eigen = meer('Deine Flotte')
    await waitFor(
      () => expect(eigen.querySelectorAll('[data-ergebnis]').length).toBeGreaterThan(0),
      { timeout: 4000 },
    )
    await screen.findByText('Du bist dran – wähl ein Feld', {}, { timeout: 3000 })

    const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)
    expect(gespeichert.modus).toBe('computer')
    expect(gespeichert.felder).toHaveLength(2)
    expect(gespeichert.felder[0]).toBe(44)
    expect(gespeichert.regeln).toEqual(STANDARD_REGELN)
  })

  it('Aufstellen: antippen wählt, nochmal antippen dreht', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Flotte aufstellen' }))
    expect(screen.getByRole('button', { name: 'Drehen' })).toBeDisabled()
    const erstes = screen.getAllByRole('button', { name: /: Schiff$/ })[0]!
    await userEvent.click(erstes)
    expect(screen.getByText(/ausgewählt$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drehen' })).toBeEnabled()
  })

  it('Weiterspielen: Eine unterbrochene Partie steht im Menü', async () => {
    const f: Schiff[] = FLOTTE.map((a, i) => ({ ...a, x: 0, y: i * 2, richtung: 'h' }))
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({
        modus: 'computer',
        stufe: 'schwer',
        regeln: STANDARD_REGELN,
        flotten: [f, f],
        beginner: 0,
        felder: [99, 98],
        partieId: 'p1',
        seed: 1,
        gesehen: [0, 0],
      }),
    )
    zeige()
    await userEvent.click(screen.getByText(/Partie fortsetzen – Schwer, 2 Schüsse/))
    const ziel = meer('Meer von Computer · Schwer')
    // Fortgesetzt: Was schon war, steht gleich da -- ohne Rakete.
    expect(feldIn(ziel, 99).dataset['ergebnis']).toBe('wasser')
  })
})

describe('Schiffe versenken zu zweit', () => {
  it('Aufstellen und Schießen mit Übergabe -- niemand sieht die andere Flotte', async () => {
    zeige()
    await userEvent.click(screen.getByText('Zu zweit an einem Gerät'))
    expect(screen.getByText('Spieler 1, stell deine Flotte auf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fertig – Leinen los!' }))

    expect(screen.getByText('Gib das Handy an Spieler 2')).toBeInTheDocument()
    // Auf dem Übergabebildschirm ist kein einziges Schiff.
    expect(document.querySelectorAll('[data-schiff]')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Ich bin Spieler 2 – los' }))
    expect(screen.getByText('Spieler 2, stell deine Flotte auf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fertig – Leinen los!' }))

    expect(screen.getByText('Gib das Handy an Spieler 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ich bin Spieler 1 – los' }))
    const ziel = meer('Meer von Spieler 2')
    expect(ziel.querySelectorAll('[data-schiff]')).toHaveLength(0)
    expect(within(meer('Deine Flotte')).queryAllByRole('button')).toHaveLength(100)

    await userEvent.click(feldIn(ziel, 0))
    await waitFor(() => expect(feldIn(ziel, 0).dataset['ergebnis']).toBeTruthy())
    // Ohne Extraschuss-Regel ist danach immer Spieler 2 dran: Übergabe.
    await screen.findByText('Gib das Handy an Spieler 2', {}, { timeout: 3000 })
    expect(document.querySelectorAll('[data-schiff]')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Ich bin Spieler 2 – los' }))
    // Spieler 2 sieht den Einschlag auf seinem eigenen Meer -- nach seiner Rakete.
    await waitFor(() => expect(feldIn(meer('Deine Flotte'), 0).dataset['ergebnis']).toBeTruthy())
    expect(gebucht).not.toHaveBeenCalled()
  })
})

describe('Schiffe versenken online', () => {
  function zeigeOnline() {
    return render(
      <MemoryRouter>
        <SchiffeVersenkenOnline regeln={STANDARD_REGELN} onZurueck={() => {}} />
      </MemoryRouter>,
    )
  }

  it('ohne eingespielte Migration: eine freundliche Meldung statt eines Absturzes', async () => {
    server.fehlt = true
    zeigeOnline()
    expect(await screen.findByText(/noch nicht eingerichtet/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tisch aufmachen' }))
    expect(await screen.findAllByText(/noch nicht eingerichtet/)).not.toHaveLength(0)
  })

  it('zeigt die Sicht vom Server und schickt einen Schuss -- das Ergebnis kommt vom Server', async () => {
    const f: Schiff[] = FLOTTE.map((a, i) => ({ ...a, x: 0, y: i * 2, richtung: 'h' }))
    const p = schiesse(neuePartie(STANDARD_REGELN, f, f, 1), 55)!
    server.stand = {
      match: {
        id: 'm1',
        code: 'ABCDE',
        phase: 'spiel',
        partie: 1,
        beginner: 2,
        regeln: STANDARD_REGELN,
        is_public: true,
        is_host: true,
        size: 2,
      },
      me: { seat: 1 },
      players: [
        { seat: 1, name: 'Thomas', is_you: true, bereit: false },
        { seat: 2, name: 'Lena', is_you: false, bereit: false },
      ],
      flotte: null,
      // Was der Server schickt: nur die eigene Sicht.
      sicht: sichtFuer(p, 0),
    }
    zeigeOnline()
    await userEvent.click(await screen.findByRole('button', { name: 'Tisch aufmachen' }))
    expect(rufe.create).toHaveBeenCalledWith('Thomas', STANDARD_REGELN, true)
    await screen.findByText('Du bist dran – wähl ein Feld')
    const ziel = meer('Meer von Lena')
    expect(ziel.querySelectorAll('[data-schiff]')).toHaveLength(0)
    expect(feldIn(meer('Deine Flotte'), 55).dataset['ergebnis']).toBe('wasser')

    server.stand = { ...server.stand, sicht: sichtFuer(schiesse(p, 9)!, 0) }
    await userEvent.click(feldIn(ziel, 9))
    expect(rufe.schiessen).toHaveBeenCalledWith('m1', 9)
    await waitFor(() => expect(feldIn(ziel, 9).dataset['ergebnis']).toBe('wasser'))
  })
})
