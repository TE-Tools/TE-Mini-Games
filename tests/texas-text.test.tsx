/**
 * Texas Hold'em zweisprachig.
 *
 * Engine und Server schreiben das Protokoll deutsch; die Seite liest jede
 * Zeile und sagt sie mit dem Wörterbuch neu (src/pages/play/texas/texasText.ts).
 * Zwei Dinge müssen dabei stimmen:
 *
 *   - Auf Deutsch kommt genau die Zeile der Engine heraus. Sonst hätte die
 *     Übersetzung das Deutsche verändert, ohne dass es jemand merkt.
 *   - Auf Englisch bleibt keine deutsche Zeile stehen.
 *
 * Dazu werden echte Partien durchgespielt statt Zeilen von Hand
 * hinzuschreiben -- so fällt auch eine Zeile auf, die erst später dazukommt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  HandKlasse,
  erstellePartie,
  handTextMit,
  handle,
  kiAktion,
  naechsteHand,
  type TexasZustand,
} from '@/games/texas-holdem'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import { SprachProvider } from '@/i18n/SprachProvider'
import { handSatz, protokollZeile } from '@/pages/play/texas/texasText'

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
}))

const { TexasHoldemPage } = await import('@/pages/play/TexasHoldemPage')

/** Spielt Partien durch und sammelt jede Zeile, die je im Protokoll stand. */
function protokollZeilen(): string[] {
  const zeilen = new Set<string>()
  for (let seed = 1; seed <= 12; seed++) {
    let st: TexasZustand = erstellePartie({
      seed,
      startChips: 300,
      spieler: [
        { name: 'Thomas', mensch: true },
        { name: 'Ida', mensch: false, kiStufe: 'schwer' },
        { name: 'Bruno', mensch: false, kiStufe: 'leicht' },
        { name: 'Lotte', mensch: false, kiStufe: 'normal' },
      ],
    })
    for (let schritt = 0; schritt < 600 && st.phase !== 'ende'; schritt++) {
      for (const z of st.protokoll) zeilen.add(z)
      if (st.ergebnis) zeilen.add(st.ergebnis.text)
      st = st.phase === 'showdown' ? naechsteHand(st) : handle(st, kiAktion(st))
    }
    for (const z of st.protokoll) zeilen.add(z)
  }
  return [...zeilen]
}

describe('Das Protokoll in beiden Sprachen', () => {
  const zeilen = protokollZeilen()

  it('hat genug verschiedene Zeilen, um etwas zu prüfen', () => {
    const arten = ['wirfst weg', 'wirft weg', 'gewinnt', ' mit ', 'Flop: ', 'River: ', 'zahlen']
    for (const art of arten) expect(zeilen.some((z) => z.includes(art))).toBe(true)
  })

  it('ergibt auf Deutsch genau die Zeile der Engine', () => {
    const anders = zeilen.filter((z) => protokollZeile(de, z) !== z)
    expect(anders).toEqual([])
  })

  it('lässt auf Englisch keine deutsche Zeile stehen', () => {
    const deutsch =
      /\b(Du|und|mit|gewinnt|gewinnst|wirft|wirfst|schiebt|schiebst|geht|gehst|setzt|erhöht|erhöhst|zahlen|raus|Platz|einem|einer|Paar|Paaren|hoch)\b|[BD][♠♥♦♣]/
    const uebrig = zeilen.map((z) => protokollZeile(en, z)).filter((z) => deutsch.test(z))
    expect(uebrig).toEqual([])
  })

  it('übersetzt die einzelnen Zeilenarten', () => {
    expect(protokollZeile(en, 'Hand 3 · Blinds 10/20 · Du und Ida zahlen')).toBe(
      'Hand 3 · Blinds 10/20 · You and Ida post the blinds',
    )
    expect(protokollZeile(en, 'Flop: B♠ D♥ 10♦')).toBe('Flop: J♠ Q♥ 10♦')
    expect(protokollZeile(en, 'Du gehst mit 40')).toBe('You call 40')
    expect(protokollZeile(en, 'Ida erhöht auf 120')).toBe('Ida raises to 120')
    expect(protokollZeile(en, 'lena gewinnt 200 mit einem Full House, Damen über Siebenen')).toBe(
      'lena wins 200 with a full house, queens full of sevens',
    )
    expect(protokollZeile(en, 'Du gewinnst 30 · Ida gewinnt 30')).toBe('You win 30 · Ida wins 30')
    expect(protokollZeile(en, 'Bruno ist raus (Platz 4)')).toBe('Bruno is out (place 4)')
  })

  it('lässt eine Zeile, die es nicht kennt, wie sie ist', () => {
    expect(protokollZeile(en, 'Etwas ganz anderes')).toBe('Etwas ganz anderes')
  })
})

describe('Die Namen der Hände', () => {
  it('sind auf Deutsch dieselben wie in wertung.ts', () => {
    const klassen = [
      HandKlasse.HoheKarte,
      HandKlasse.Paar,
      HandKlasse.ZweiPaare,
      HandKlasse.Drilling,
      HandKlasse.Strasse,
      HandKlasse.Flush,
      HandKlasse.FullHouse,
      HandKlasse.Vierling,
      HandKlasse.StraightFlush,
    ]
    for (const klasse of klassen) {
      for (let a = 2; a <= 14; a++) {
        for (let b = 2; b <= 14; b++) {
          const h = { klasse, werte: [a, b], karten: [] }
          expect(handSatz(de, h)).toBe(handTextMit(h))
        }
      }
    }
  })

  it('heissen auf Englisch wie am Pokertisch', () => {
    expect(handSatz(en, { klasse: HandKlasse.StraightFlush, werte: [14] })).toBe('a royal flush')
    expect(handSatz(en, { klasse: HandKlasse.ZweiPaare, werte: [12, 7] })).toBe(
      'two pair, queens and sevens',
    )
    expect(handSatz(en, { klasse: HandKlasse.Paar, werte: [13] })).toBe('a pair of kings')
    expect(handSatz(en, { klasse: HandKlasse.HoheKarte, werte: [14] })).toBe('ace high')
  })
})

describe('Die Seite auf Englisch', () => {
  beforeEach(() => {
    localStorage.setItem('te-sprache', 'en')
  })

  function seite() {
    render(
      <SprachProvider>
        <MemoryRouter>
          <TexasHoldemPage />
        </MemoryRouter>
      </SprachProvider>,
    )
  }

  it('sagt auch auf Englisch, dass mit Spielgeld gespielt wird', () => {
    seite()
    expect(
      screen.getByText(
        'This is played with play money. There is nothing to buy and nothing to win.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Tournament against the computer/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Spielgeld/)).toBeNull()
  })

  it('zeigt am Tisch englische Knöpfe und Beschriftungen', async () => {
    seite()
    await userEvent.click(screen.getByRole('button', { name: /Tournament against the computer/ }))
    expect(screen.getByText('How many opponents?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Hard' }))
    expect(screen.getByText('Calculates closely, puts on pressure and bluffs.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '1' }))
    await userEvent.click(screen.getByRole('button', { name: /Let's go/ }))

    expect(await screen.findByRole('group', { name: 'Your cards' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Community cards' })).toBeInTheDocument()
    expect(screen.getByText('in the pot')).toBeInTheDocument()
    expect(screen.getAllByText(/Hand 1 · Blinds/).length).toBeGreaterThan(0)
    // Die erste Zeile im Protokoll: wer die Blinds zahlt.
    expect(await screen.findByText(/post the blinds/)).toBeInTheDocument()
    expect(screen.queryByText(/zahlen|im Topf|Deine Karten/)).toBeNull()

    // Bis ich dran bin -- dann bietet die Leiste englische Knöpfe an. Wirft
    // der Rechner vorher weg, steht dort erst „Next hand".
    let fold: HTMLElement | null = null
    for (let versuch = 0; versuch < 12 && !fold; versuch++) {
      fold = screen.queryByRole('button', { name: 'Fold' })
      if (fold) break
      const weiter = screen.queryByRole('button', { name: 'Next hand' })
      if (weiter) await userEvent.click(weiter)
      else await new Promise((r) => setTimeout(r, 400))
    }
    expect(fold).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Wegwerfen' })).toBeNull()
    expect(screen.getByRole('button', { name: /^(Check|Call)/ })).toBeInTheDocument()
  })
})
