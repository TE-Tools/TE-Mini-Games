/**
 * Online: Was die Seite aus dem zeigt, was der Server schickt.
 *
 * Beim Hold'em schickt der Server bewusst nicht den Spielzustand, sondern
 * nur die eigene Sicht: die eigenen zwei Karten, von den anderen nichts --
 * und beim Showdown nur die Karten derer, die mitgegangen sind
 * (Migration 024). Diese Tests halten fest, dass die Seite damit
 * auskommt.
 *
 * Wertung, Setzrunden und Nebenpots prüft scripts/pruefe-texas-sql.mjs
 * gegen ein echtes Postgres; Rechte und Sichtbarkeit prüft
 * supabase/migrations/pruefung/024_texas_online.pruefung.sql. Hier geht es
 * um die Oberfläche.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { kartenAus } from '@/games/texas-holdem'
import type { TexasOnlineState } from '@/services/texasOnline'

const server = vi.hoisted(() => ({
  stand: null as TexasOnlineState | null,
  aktionen: [] as unknown[],
  weiter: 0,
  gestartet: 0,
  wecken: null as null | (() => void),
}))

vi.mock('@/services/texasOnline', () => ({
  isTexasOnlineAvailable: true,
  aufbauAusConfig: () => ({ start_chips: 1000, haende_je_stufe: 8, blinds: [] }),
  createTexasMatch: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  joinTexasMatch: vi.fn(async () => 'm1'),
  leaveTexasMatch: vi.fn(async () => {}),
  startTexasMatch: vi.fn(async () => {
    server.gestartet++
  }),
  handelnOnline: vi.fn(async (_id: string, aktion: unknown) => {
    server.aktionen.push(aktion)
  }),
  naechsteHandOnline: vi.fn(async () => {
    server.weiter++
  }),
  herzschlagTexas: vi.fn(async () => {}),
  fetchMeineTexasRunden: vi.fn(async () => []),
  fetchOeffentlicheTexasRaeume: vi.fn(async () => []),
  // Jeder Abruf gibt eine eigene Kopie -- so wie der echte Dienst.
  fetchTexasState: vi.fn(async () => (server.stand ? structuredClone(server.stand) : null)),
  subscribeToTexasMatch: (_id: string, beiAenderung: () => void) => {
    server.wecken = beiAenderung
    return () => {
      server.wecken = null
    }
  },
}))

vi.mock('@/pages/play/texas/partieBuchen', () => ({
  buchePartie: vi.fn(async () => null),
  bucheOnlinePartie: vi.fn(async () => null),
}))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'u1' })),
  getMyUsername: vi.fn(async () => 'thomas'),
}))

vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: vi.fn(async () => 'thomas'),
  istEchterName: () => true,
  spielerNameOderDu: vi.fn(async () => 'thomas'),
}))

const { TexasHoldemOnline } = await import('@/pages/play/TexasHoldemOnline')

function runde(
  teil: Partial<TexasOnlineState['match']> = {},
  me: Partial<TexasOnlineState['me']> = {},
): TexasOnlineState {
  return {
    match: {
      id: 'm1',
      code: 'ABCDE',
      phase: 'spiel',
      is_host: true,
      is_public: false,
      size: 3,
      aufbau: { start_chips: 1000, haende_je_stufe: 8, blinds: [{ klein: 10, gross: 20 }] },
      runde: 'flop',
      hand_nr: 3,
      blind_stufe: 0,
      blinds: { klein: 10, gross: 20 },
      board: kartenAus('Ah Kd 7s'),
      pot: 120,
      hoechster: 40,
      am_zug: 1,
      dealer: 3,
      sieger: null,
      ergebnis: null,
      protokoll: ['Lena geht mit 40'],
      ...teil,
    },
    me: {
      seat: 1,
      karten: kartenAus('As 7h'),
      moeglichkeiten: {
        folden: true,
        schieben: false,
        mitgehen: 40,
        erhoehen: { min: 80, max: 960 },
      },
      ...me,
    },
    players: [
      {
        seat: 1,
        name: 'thomas',
        is_you: true,
        chips: 960,
        einsatz: 0,
        gesamt: 40,
        status: 'aktiv',
        gehandelt: false,
        platz: null,
        karten: kartenAus('As 7h'),
      },
      {
        seat: 2,
        name: 'lena',
        is_you: false,
        chips: 920,
        einsatz: 40,
        gesamt: 80,
        status: 'aktiv',
        gehandelt: true,
        platz: null,
        karten: null,
      },
      {
        seat: 3,
        name: 'kai',
        is_you: false,
        chips: 1000,
        einsatz: 0,
        gesamt: 0,
        status: 'gefoldet',
        gehandelt: true,
        platz: null,
        karten: null,
      },
    ],
  }
}

/** Verdeckte Karten liegen aria-hidden im Gegnerkästchen -- im DOM zählen. */
const verdeckte = () => document.querySelectorAll('[aria-label="verdeckte Karte"]').length

async function amTisch() {
  render(
    <MemoryRouter>
      <TexasHoldemOnline onZurueck={() => {}} />
    </MemoryRouter>,
  )
  await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
  await screen.findByRole('group', { name: 'Tischmitte' })
}

describe('Texas Hold’em online', () => {
  beforeEach(() => {
    server.stand = runde()
    server.aktionen = []
    server.weiter = 0
    server.gestartet = 0
    server.wecken = null
  })

  it('kommt damit zurecht, dass fremde Karten als null ankommen', async () => {
    await amTisch()
    // Zwei eigene, offen: A♠ und 7♥.
    const meine = screen.getByRole('group', { name: 'Deine Karten' })
    expect(meine.textContent).toContain('A')
    expect(meine.textContent).toContain('7')
    // Von den beiden Gegnern je zwei Rückseiten.
    expect(verdeckte()).toBe(4)

    /*
     * Was dieser Test NICHT zeigt: dass fremde Karten verdeckt bleiben.
     * Das kann er nicht -- die Oberfläche bekommt sie gar nicht, also hat
     * sie nichts zu verbergen. Nachgemessen: Setzt man alle Karten dieser
     * Seite auf „offen", bleibt der Test grün, weil für `null` ohnehin nur
     * eine Rückseite entsteht.
     *
     * Die Zusage selbst steht in der Migration und wird dort gemessen
     * (supabase/migrations/pruefung/024_texas_online.pruefung.sql, mit
     * absichtlich eingebautem Leck geprüft). Hier wird geprüft, dass die
     * Seite mit `null` umgehen kann, statt zwei leere Plätze oder einen
     * Absturz zu zeigen.
     */
  })

  it('zeigt Topf, Blinds und das Board', async () => {
    await amTisch()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText(/Hand 3 · Blinds 10\/20/)).toBeInTheDocument()
    const board = screen.getByRole('group', { name: 'Gemeinschaftskarten' })
    expect(board.textContent).toContain('K')
  })

  it('schickt die Aktionen, die der Server anbietet', async () => {
    await amTisch()
    await userEvent.click(screen.getByRole('button', { name: /Mitgehen/ }))
    expect(server.aktionen).toEqual([{ art: 'mitgehen' }])
  })

  it('bietet gar nichts an, wenn ein anderer am Zug ist', async () => {
    server.stand = runde(
      { am_zug: 2 },
      {
        moeglichkeiten: { folden: false, schieben: false, mitgehen: null, erhoehen: null },
      },
    )
    await amTisch()
    expect(screen.getByText(/lena ist dran/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mitgehen/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Wegwerfen|Folden/ })).toBeNull()
  })

  it('deckt beim Showdown nur auf, was der Server schickt – und benennt die Hand', async () => {
    const stand = runde({
      runde: 'showdown',
      board: kartenAs(),
      ergebnis: {
        anteile: [{ seat: 2, betrag: 200, hand: { klasse: 7, werte: [13, 7] } }],
        gezeigt: true,
        board: kartenAs(),
      },
    })
    // Lena ist mitgegangen und zeigt; Kai hat weggeworfen und zeigt nicht.
    stand.players[1]!.karten = kartenAus('Kh Kc')
    server.stand = stand
    await amTisch()

    /*
     * Der Satz steht nicht im Server-Ergebnis: Der schickt nur „Platz 2
     * bekommt 200". Wie das Blatt heisst, rechnet die Seite mit
     * besteHand() aus den offenen Karten -- so steht die deutsche Beugung
     * nur einmal im Projekt.
     */
    expect(await screen.findByText(/lena gewinnt 200 mit einem Full House/)).toBeInTheDocument()
    // Kai zeigt weiterhin nichts: zwei Rückseiten.
    expect(verdeckte()).toBe(2)
  })

  it('lässt jeden am Tisch die nächste Hand auslösen', async () => {
    server.stand = runde({
      runde: 'showdown',
      is_host: false,
      ergebnis: { anteile: [{ seat: 1, betrag: 120, hand: null }], gezeigt: false, board: [] },
    })
    await amTisch()
    await userEvent.click(screen.getByRole('button', { name: 'Nächste Hand' }))
    expect(server.weiter).toBe(1)
  })

  it('zeigt im Warteraum den Code und startet erst ab zwei', async () => {
    const stand = runde({ phase: 'lobby', am_zug: null, dealer: null, size: 1 })
    stand.players = [stand.players[0]!]
    server.stand = stand
    render(
      <MemoryRouter>
        <TexasHoldemOnline onZurueck={() => {}} />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
    expect(await screen.findByText('ABCDE')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Es fehlt noch jemand/ })).toBeDisabled()

    server.stand = runde({ phase: 'lobby', am_zug: null, dealer: null })
    server.wecken?.()
    await userEvent.click(await screen.findByRole('button', { name: /Turnier starten/ }))
    expect(server.gestartet).toBe(1)
  })

  it('sagt einem Ausgeschiedenen, dass die anderen weiterspielen', async () => {
    const stand = runde(
      { am_zug: 2 },
      {
        moeglichkeiten: { folden: false, schieben: false, mitgehen: null, erhoehen: null },
      },
    )
    stand.players[0]!.status = 'raus'
    stand.players[0]!.platz = 3
    stand.players[0]!.chips = 0
    server.stand = stand
    await amTisch()
    expect(
      screen.getByText(/Du bist ausgeschieden – die anderen spielen weiter/),
    ).toBeInTheDocument()
  })

  it('zeigt am Ende den Endstand nach Plätzen', async () => {
    const stand = runde({ phase: 'ende', runde: 'ende', am_zug: null, sieger: 2 })
    stand.players[0]!.platz = 2
    stand.players[0]!.chips = 0
    stand.players[1]!.platz = 1
    stand.players[1]!.chips = 3000
    stand.players[2]!.platz = 3
    stand.players[2]!.chips = 0
    server.stand = stand
    render(
      <MemoryRouter>
        <TexasHoldemOnline onZurueck={() => {}} />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
    expect(await screen.findByText(/Platz 2 von 3/)).toBeInTheDocument()
    expect(screen.getByText('3000 Chips')).toBeInTheDocument()
    expect(screen.getByText(/3 Hände gespielt/)).toBeInTheDocument()
  })
})

/** Ein Board, auf dem Lenas Könige ein Full House ergeben. */
function kartenAs() {
  return kartenAus('Kd 7s 7d 2c 9h')
}
