/**
 * Die Online-Oberfläche gegen einen nachgebauten Server.
 *
 * Geprüft wird das, was den Online-Modus ausmacht: dass aus dem Zugbuch des
 * Servers ein richtiges Brett wird, dass nur der am Zug etwas anfassen kann,
 * und dass ein Knopfdruck als Aktion beim Server ankommt -- mit dem Sitz,
 * der danach dran ist.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { SchopolyOnlineState } from '@/services/schuetzenopolyOnline'
import {
  amZugSitz,
  wendeAn,
  zustandAus,
  type OnlineAktion,
  type ZugbuchEintrag,
} from '@/games/schuetzenopoly'

const server = vi.hoisted(() => ({ stand: null as SchopolyOnlineState | null }))
const rufe = vi.hoisted(() => ({
  create: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  join: vi.fn(async () => 'm1'),
  start: vi.fn(async () => {}),
  aktion: vi.fn(async () => 1),
  leave: vi.fn(async () => {}),
}))

vi.mock('@/services/schuetzenopolyOnline', () => ({
  isSchuetzenopolyOnlineAvailable: true,
  createSchopolyMatch: rufe.create,
  joinSchopolyMatch: rufe.join,
  leaveSchopolyMatch: rufe.leave,
  startSchopolyMatch: rufe.start,
  sendeAktion: rufe.aktion,
  fetchSchopolyState: vi.fn(async () => server.stand),
  fetchMySchopolyMatches: vi.fn(async () => []),
  fetchOeffentlicheSchopolyRaeume: vi.fn(async () => []),
  herzschlagSchopoly: vi.fn(async () => {}),
  subscribeToSchopolyMatch: () => () => {},
}))

vi.mock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => ({ id: 'u1' })) }))
vi.mock('@/services/spielername', () => ({
  ermittleSpielerName: async () => 'Thomas',
  istEchterName: () => true,
}))
vi.mock('@/services/sound', () => ({
  spiele: vi.fn(),
  vibriere: vi.fn(),
  tonAn: () => false,
  setzeTon: vi.fn(),
}))

const { SchuetzenopolyOnline } = await import('@/pages/play/SchuetzenopolyOnline')

function stand(over: Partial<SchopolyOnlineState['match']> = {}, zuege = []): SchopolyOnlineState {
  return {
    match: {
      id: 'm1',
      code: 'ABCDE',
      phase: 'spiel',
      seed: 20260924,
      runden_limit: 20,
      am_zug: 1,
      is_public: true,
      is_host: true,
      size: 2,
      zug_nr: zuege.length,
      ...over,
    },
    me: { seat: 1 },
    players: [
      { seat: 1, name: 'Thomas', is_you: true },
      { seat: 2, name: 'Lena', is_you: false },
    ],
    zuege,
  }
}

function zeige() {
  return render(
    <MemoryRouter>
      <SchuetzenopolyOnline eigenerName="Du" onZurueck={() => {}} />
    </MemoryRouter>,
  )
}

/**
 * Ein Zugbuch, an dessen Ende Sitz 2 am Zug ist.
 *
 * Es wird wirklich gespielt (immer das Naheliegende), weil "wer ist dran"
 * aus den Regeln folgt: Ein Pasch etwa lässt denselben Spieler noch einmal.
 */
function bisLenaDranIst(): ZugbuchEintrag[] {
  const buch: ZugbuchEintrag[] = []
  let s = zustandAus({ seed: 20260924, namen: ['Thomas', 'Lena'], rundenLimit: 20, zugbuch: [] })
  const tu = (aktion: OnlineAktion) => {
    const e = { nr: buch.length + 1, seat: amZugSitz(s), aktion }
    buch.push(e)
    s = wendeAn(s, e)
  }
  for (let i = 0; i < 40 && amZugSitz(s) === 1; i++) {
    if (s.offenesMinispiel) tu({ art: 'minispiel', medaille: 'bronze' })
    else if (s.offeneKarte) tu({ art: 'karte' })
    else if (s.offeneWahl) tu({ art: 'wahl_weiter' })
    else if (s.kaufAngebot) tu({ art: 'ablehnen' })
    else if (s.phase === 'wuerfeln') tu({ art: 'wuerfeln' })
    else if (s.phase === 'bewegen') tu({ art: 'ankommen' })
    else tu({ art: 'zug_ende' })
  }
  return buch
}

/** Tisch aufmachen und drin sein. */
async function machAuf() {
  zeige()
  await userEvent.click(await screen.findByRole('button', { name: /Tisch aufmachen/ }))
}

beforeEach(() => {
  for (const fn of Object.values(rufe)) fn.mockClear()
  server.stand = stand()
})

describe('Schützenopoly online', () => {
  it('macht einen Tisch auf und zeigt im Vorraum den Code und die Runde', async () => {
    server.stand = stand({ phase: 'lobby', seed: null })
    await machAuf()
    expect(rufe.create).toHaveBeenCalled()

    expect(await screen.findByText('ABCDE')).toBeInTheDocument()
    expect(screen.getByText('Thomas')).toBeInTheDocument()
    expect(screen.getByText('Lena')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Partie starten/ }))
    expect(rufe.start).toHaveBeenCalledWith('m1', 20)
  })

  it('baut aus dem Zugbuch ein Brett und lässt mich ziehen, wenn ich dran bin', async () => {
    await machAuf()

    // Das Brett steht -- gerechnet aus Startwert und Zugbuch, nicht vom Server geholt.
    expect(await screen.findByRole('group', { name: 'Spielbrett' })).toBeInTheDocument()
    const wuerfeln = await screen.findByRole('button', { name: /Würfeln/ })

    await userEvent.click(wuerfeln)
    // Die Absicht geht als Aktion an den Server, mit dem Sitz, der danach dran
    // ist -- nach dem Wurf zieht derselbe Spieler weiter.
    expect(rufe.aktion).toHaveBeenCalledWith('m1', { art: 'wuerfeln' }, 1, false)
  })

  it('lässt mich nichts anfassen, wenn ein anderer dran ist', async () => {
    // Wer dran ist, sagt das Zugbuch -- nicht die Spalte auf dem Server.
    // Also wird hier wirklich gespielt, bis Lena an der Reihe ist.
    server.stand = stand({ am_zug: 2 }, bisLenaDranIst() as never)
    await machAuf()

    expect(await screen.findByText(/Lena ist am Zug/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Würfeln/ })).toBeNull()
  })

  it('zeigt den Stand, den das Zugbuch ergibt – bis hin zum gekauften Feld', async () => {
    // Würfeln, ankommen, kaufen: Danach hat Thomas weniger Geld als zu Beginn
    // und ein Feld mehr. Gerechnet wird das hier, nicht auf dem Server.
    server.stand = stand({ am_zug: 1 }, [
      { nr: 1, seat: 1, aktion: { art: 'wuerfeln' } },
      { nr: 2, seat: 1, aktion: { art: 'ankommen' } },
      { nr: 3, seat: 1, aktion: { art: 'kaufen' } },
    ] as never)
    await machAuf()

    const leiste = await screen.findByRole('list', { name: 'Mitspieler' })
    await waitFor(() => expect(leiste).toHaveTextContent('1 Felder'))
    // Lena hat nichts gekauft und nichts bezahlt.
    expect(leiste).toHaveTextContent('0 Felder')
  })

  it('bietet ohne Konto die Anmeldung an', async () => {
    vi.resetModules()
    vi.doMock('@/auth/authService', () => ({ getCurrentUser: vi.fn(async () => null) }))
    const mod = await import('@/pages/play/SchuetzenopolyOnline')
    render(
      <MemoryRouter>
        <mod.SchuetzenopolyOnline eigenerName="Du" onZurueck={() => {}} />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: 'Anmelden' })).toBeInTheDocument()
  })
})
