/**
 * Online: Was die Seite aus dem zeigt, was der Server schickt.
 *
 * Der Server schickt bei Mau-Mau bewusst nicht den Spielzustand, sondern
 * nur die eigene Sicht: die eigene Hand ganz, von den anderen die Anzahl
 * (Migration 023). Diese Tests halten fest, dass die Seite damit
 * auskommt -- und dass sie nichts anzeigt, was gar nicht da ist.
 *
 * Die Regeln selbst prüft tests/maumau.test.ts, und dass die SQL-Fassung
 * dieselben Regeln rechnet, prüft scripts/pruefe-sql-regeln.mjs gegen ein
 * echtes Postgres. Hier geht es um die Oberfläche.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { aktiveRegeln } from '@/games/maumau'
import type { MauOnlineState } from '@/services/maumauOnline'

const server = vi.hoisted(() => ({
  stand: null as MauOnlineState | null,
  gelegt: [] as { karte: string; wunsch: string | null }[],
  gezogen: 0,
  mau: 0,
  gestartet: 0,
  regeln: [] as { art: string; hausregeln: unknown }[],
  wecken: null as null | (() => void),
}))

vi.mock('@/services/maumauOnline', () => ({
  isMauMauOnlineAvailable: true,
  createMauMauMatch: vi.fn(async () => ({ match_id: 'm1', code: 'ABCDE' })),
  joinMauMauMatch: vi.fn(async () => 'm1'),
  leaveMauMauMatch: vi.fn(async () => {}),
  startMauMauMatch: vi.fn(async () => {
    server.gestartet++
  }),
  setzeMauRegeln: vi.fn(async (_id: string, art: string, hausregeln: unknown) => {
    server.regeln.push({ art, hausregeln })
  }),
  legenOnline: vi.fn(async (_id: string, karte: string, wunsch?: string | null) => {
    server.gelegt.push({ karte, wunsch: wunsch ?? null })
  }),
  ziehenOnline: vi.fn(async () => {
    server.gezogen++
  }),
  behaltenOnline: vi.fn(async () => {}),
  mauSagenOnline: vi.fn(async () => {
    server.mau++
  }),
  herzschlagMauMau: vi.fn(async () => {}),
  fetchMeineMauMauRunden: vi.fn(async () => []),
  fetchOeffentlicheMauMauRaeume: vi.fn(async () => []),
  fetchOeffentlicheLetzteKarteRaeume: vi.fn(async () => []),
  /*
   * Jeder Abruf gibt eine eigene Kopie -- so wie der echte Dienst, der
   * JSON vom Server auspackt. Gäbe das Doppel immer dasselbe Objekt
   * zurück, würde React gar nicht neu rechnen, und jeder Test über
   * „was passiert beim zweiten Abruf" wäre still erfolgreich.
   */
  fetchMauMauState: vi.fn(async () => (server.stand ? structuredClone(server.stand) : null)),
  subscribeToMauMauMatch: (_id: string, beiAenderung: () => void) => {
    server.wecken = beiAenderung
    return () => {
      server.wecken = null
    }
  },
}))

const buchung = vi.hoisted(() => ({
  aufrufe: [] as { spiel: string; platz: number; eigenePunkte: number; fremdePunkte: number }[],
}))

vi.mock('@/pages/play/maumau/partieBuchen', () => ({
  buchePartie: vi.fn(async () => null),
  bucheOnlinePartie: vi.fn(
    async (
      spiel: string,
      _partieId: string,
      spieler: { is_you: boolean; platz: number | null; punkte: number }[],
    ) => {
      const ich = spieler.find((p) => p.is_you)!
      buchung.aufrufe.push({
        spiel,
        platz: ich.platz!,
        eigenePunkte: ich.punkte,
        fremdePunkte: spieler.filter((p) => !p.is_you).reduce((n, p) => n + p.punkte, 0),
      })
      return null
    },
  ),
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

const { MauMauOnline } = await import('@/pages/play/MauMauOnline')
const dienst = await import('@/services/maumauOnline')

/** Wie oft der Stand bisher geholt wurde -- aus dem Testdoppel selbst. */
const abrufe = () => vi.mocked(dienst.fetchMauMauState).mock.calls.length

const K = {
  herz7: { id: 'herz-7', farbe: 'herz', text: '7', wirkung: 'zieh2' as const, punkte: 7 },
  herz10: { id: 'herz-10', farbe: 'herz', text: '10', wirkung: 'keine' as const, punkte: 10 },
  pikA: { id: 'pik-A', farbe: 'pik', text: 'A', wirkung: 'keine' as const, punkte: 11 },
  herzB: { id: 'herz-B', farbe: 'herz', text: 'B', wirkung: 'wunsch' as const, punkte: 20 },
  karo9: { id: 'karo-9', farbe: 'karo', text: '9', wirkung: 'richtung' as const, punkte: 9 },
}

function runde(
  teil: Partial<MauOnlineState['match']> = {},
  me: Partial<MauOnlineState['me']> = {},
) {
  const stand: MauOnlineState = {
    match: {
      id: 'm1',
      code: 'ABCDE',
      spiel: 'maumau',
      phase: 'spiel',
      regeln: aktiveRegeln('klassisch'),
      is_host: true,
      is_public: false,
      size: 2,
      am_zug: 1,
      richtung: 1,
      oberste: K.herz10,
      wunsch: null,
      strafe: 0,
      stapel: 17,
      ablage: 2,
      letzter_leger: 2,
      sieger: null,
      protokoll: ['lena legt 10♥'],
      ...teil,
    },
    me: { seat: 1, hand: [K.herz7, K.pikA, K.karo9], mau: false, gezogene: null, ...me },
    players: [
      {
        seat: 1,
        name: 'thomas',
        is_you: true,
        karten: 3,
        mau: false,
        platz: null,
        hand: null,
        punkte: 27,
      },
      {
        seat: 2,
        name: 'lena',
        is_you: false,
        karten: 4,
        mau: false,
        platz: null,
        hand: null,
        punkte: 0,
      },
    ],
  }
  return stand
}

/** Wie viele verdeckte Karten liegen beim Gegner. */
const verdeckte = () => document.querySelectorAll('[aria-label="verdeckte Karte"]').length

async function amTisch() {
  render(
    <MemoryRouter>
      <MauMauOnline spiel="maumau" onZurueck={() => {}} />
    </MemoryRouter>,
  )
  await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
  await screen.findByRole('group', { name: 'Tischmitte' })
}

describe('Mau-Mau online', () => {
  beforeEach(() => {
    server.stand = runde()
    server.gelegt = []
    server.gezogen = 0
    server.mau = 0
    server.gestartet = 0
    server.regeln = []
    server.wecken = null
  })

  it('baut die fremde Hand allein aus der Anzahl', async () => {
    await amTisch()
    expect(screen.getByText('4 Karten')).toBeInTheDocument()

    /*
     * Von lena kommen vier verdeckte Karten -- und von mir drei offene.
     * Dass die fremden verdeckt sind, ist hier keine Entscheidung der
     * Oberfläche: Es kommen gar keine fremden Karten an. Die Zusage
     * selbst steht in der Migration und wird dort gemessen
     * (supabase/migrations/pruefung/023_kartenspiele_online.pruefung.sql).
     */
    // Über die Rolle sind die fremden Karten nicht zu finden, und das ist
    // richtig: Der Stapel beim Gegner ist aria-hidden, weil die Zahl
    // daneben schon alles sagt. Gezählt wird deshalb im DOM.
    expect(verdeckte()).toBe(4)
    expect(screen.getByRole('group', { name: 'Deine Karten' }).children).toHaveLength(3)

    // Und bei mehr als fünf Karten wird der Stapel nicht breiter.
    server.stand = runde()
    server.stand.players[1]!.karten = 9
    server.wecken?.()
    await waitFor(() => expect(screen.getByText('9 Karten')).toBeInTheDocument())
    expect(verdeckte()).toBe(5)
  })

  it('legt die angetippte Karte und schickt den Wunsch mit', async () => {
    server.stand = runde({}, { hand: [K.herzB, K.pikA] })
    await amTisch()
    await userEvent.click(screen.getByRole('button', { name: 'Herz Farbwunsch legen' }))
    // Der Bube wünscht sich eine Farbe: erst fragen, dann legen.
    await userEvent.click(await screen.findByRole('button', { name: 'Karo' }))
    expect(server.gelegt).toEqual([{ karte: 'herz-B', wunsch: 'karo' }])
  })

  it('lässt eine Karte, die nicht passt, nicht legen', async () => {
    // Oberste ist Herz 10, in der Hand liegt Pik Ass -- weder Farbe noch
    // Aufdruck passen. Eine Karte, die nicht liegen darf, ist in dieser
    // Oberfläche kein gesperrter Knopf, sondern gar keiner: Sie lässt
    // sich nicht antippen, auch nicht versehentlich.
    await amTisch()
    expect(screen.getByRole('img', { name: 'Pik A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pik A legen' })).toBeNull()
    // Die Sieben passt (Herz auf Herz) und ist einer.
    expect(screen.getByRole('button', { name: 'Herz Zwei ziehen legen' })).toBeInTheDocument()
  })

  it('zieht vom Stapel und zeigt, wie viele noch liegen', async () => {
    await amTisch()
    await userEvent.click(screen.getByRole('button', { name: 'Nachziehstapel, 17 Karten' }))
    expect(server.gezogen).toBe(1)
  })

  it('bietet Mau erst bei der vorletzten Karte', async () => {
    await amTisch()
    expect(screen.queryByRole('button', { name: 'Mau!' })).toBeNull()

    server.stand = runde({}, { hand: [K.herz7, K.pikA] })
    server.wecken?.()
    await userEvent.click(await screen.findByRole('button', { name: 'Mau!' }))
    expect(server.mau).toBe(1)
  })

  it('sperrt alles, solange ein anderer am Zug ist', async () => {
    server.stand = runde({ am_zug: 2 })
    await amTisch()
    expect(screen.getByText(/lena ist dran/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nachziehstapel/ })).toBeDisabled()
    // Keine einzige Handkarte ist antippbar, solange lena dran ist.
    expect(screen.queryByRole('button', { name: / legen$/ })).toBeNull()
  })

  it('zeigt die offene Strafe und lässt nur kontern, wenn der Tisch das erlaubt', async () => {
    // Strafe 2 offen, keine Konterregel: Auch die eigene Sieben darf nicht.
    server.stand = runde({ oberste: K.herz7, strafe: 2 })
    await amTisch()
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Herz Zwei ziehen legen' })).toBeNull()

    // Mit „7 auf 7" liegt dieselbe Karte plötzlich richtig.
    server.stand = runde({
      oberste: K.herz7,
      strafe: 2,
      regeln: aktiveRegeln('klassisch', { konter: { zweiAufZwei: true } }),
    })
    server.wecken?.()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Herz Zwei ziehen legen' })).toBeInTheDocument(),
    )
  })

  it('zeigt im Warteraum den Code und startet erst ab zwei', async () => {
    server.stand = runde({ phase: 'lobby', am_zug: null, size: 1 })
    server.stand.players = [server.stand.players[0]!]
    render(
      <MemoryRouter>
        <MauMauOnline spiel="maumau" onZurueck={() => {}} />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
    expect(await screen.findByText('ABCDE')).toBeInTheDocument()
    const knopf = await screen.findByRole('button', { name: /Es fehlt noch jemand/ })
    expect(knopf).toBeDisabled()

    server.stand = runde({ phase: 'lobby', am_zug: null })
    server.wecken?.()
    await userEvent.click(await screen.findByRole('button', { name: /Runde starten/ }))
    expect(server.gestartet).toBe(1)
  })

  it('lässt die Hausregeln nur den Gastgeber ändern', async () => {
    server.stand = runde({ phase: 'lobby', am_zug: null, is_host: false })
    render(
      <MemoryRouter>
        <MauMauOnline spiel="maumau" onZurueck={() => {}} />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
    // Erst abwarten, bis der Warteraum steht: Im Vorraum gibt es die
    // Schalter auch, und dort sind sie zu Recht offen.
    await screen.findByText('ABCDE')
    expect(screen.getByRole('button', { name: '7 auf 7' })).toBeDisabled()
    // Und starten darf er auch nicht.
    expect(screen.queryByRole('button', { name: /Runde starten/ })).toBeNull()
  })

  it('zeigt am Ende den Endstand mit Plätzen und Punkten', async () => {
    const stand = runde({ phase: 'ende', am_zug: null, sieger: 2 })
    stand.players[0]!.platz = 2
    stand.players[0]!.karten = 3
    stand.players[0]!.punkte = 27
    stand.players[1]!.platz = 1
    stand.players[1]!.karten = 0
    server.stand = stand
    render(
      <MemoryRouter>
        <MauMauOnline spiel="maumau" onZurueck={() => {}} />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
    expect(await screen.findByText(/Platz 2 von 2/)).toBeInTheDocument()
    expect(screen.getByText('alle abgelegt')).toBeInTheDocument()
    expect(screen.getByText(/3 Karten · 27 Punkte/)).toBeInTheDocument()
  })
})

/**
 * Der Weg von „Offene Spiele" hierher: Dort steht ein Raum, man tippt
 * „Beitreten", und die Seite öffnet sich mit ?raum=CODE. Dann darf nicht
 * das Menü stehen -- sonst hat man beigetreten und sitzt doch nicht drin.
 */
describe('Beitreten über ?raum=CODE', () => {
  beforeEach(() => {
    server.stand = runde({ phase: 'lobby', am_zug: null })
    server.wecken = null
  })

  it('geht direkt in den Online-Teil und tritt bei', async () => {
    const { MauMauPage } = await import('@/pages/play/MauMauPage')
    window.history.replaceState({}, '', '/spielen/maumau?raum=ABCDE')
    render(
      <MemoryRouter>
        <MauMauPage spiel="maumau" />
      </MemoryRouter>,
    )
    // Kein Menü, kein Zwischenklick: der Warteraum.
    expect(await screen.findByText('ABCDE')).toBeInTheDocument()
    window.history.replaceState({}, '', '/')
  })
})

/**
 * Das Ergebnis muss einmal in den Verlauf -- nicht einmal je Abruf.
 *
 * Der Stand kommt alle vier Sekunden und zusätzlich bei jeder Regung im
 * Raum. Am Endstand sieht jeder dieser Abrufe dieselbe beendete Partie.
 */
describe('Online-Ergebnis verbuchen', () => {
  it('verbucht die beendete Runde genau einmal', async () => {
    const stand = runde({ phase: 'ende', am_zug: null, sieger: 1 })
    stand.players[0]!.platz = 1
    stand.players[0]!.karten = 0
    stand.players[0]!.punkte = 0
    stand.players[1]!.platz = 2
    stand.players[1]!.punkte = 31
    server.stand = stand
    buchung.aufrufe = []

    render(
      <MemoryRouter>
        <MauMauOnline spiel="maumau" onZurueck={() => {}} />
      </MemoryRouter>,
    )
    await userEvent.click(await screen.findByRole('button', { name: /Tisch eröffnen/ }))
    await screen.findByText(/Gewonnen/)

    /*
     * Noch zwei Abrufe mit demselben Endstand. Gewartet wird darauf, dass
     * sie DURCH sind -- nicht auf „die Zahl ist eins". Ein waitFor auf die
     * Zahl wäre schon beim ersten Mal zufrieden und hätte eine zweite
     * Buchung danach gar nicht gesehen; ohne diese Schleife war der Test
     * auch dann grün, wenn die Sperre fehlte.
     */
    const vorher = abrufe()
    server.wecken?.()
    server.wecken?.()
    await waitFor(() => expect(abrufe()).toBeGreaterThan(vorher + 1))
    await waitFor(() => expect(screen.getByText(/Gewonnen/)).toBeInTheDocument())
    expect(buchung.aufrufe).toHaveLength(1)
    expect(buchung.aufrufe[0]).toEqual({
      spiel: 'maumau',
      platz: 1,
      eigenePunkte: 0,
      fremdePunkte: 31,
    })
  })
})
