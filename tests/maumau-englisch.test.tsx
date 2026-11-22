/**
 * Mau-Mau und Letzte Karte auf Englisch.
 *
 * Die Engine und der Server schreiben deutsch -- Farben als `herz`, der
 * Bube als 'B', das Protokoll als „Lena legt 7♥". Übersetzt wird erst
 * beim Anzeigen. Diese Tests halten fest, dass auf Englisch davon nichts
 * Deutsches mehr durchkommt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import type { Karte } from '@/games/maumau'
import { karteVorlesen, kurzUebersetzen, protokollZeile } from '@/pages/play/maumau/kartenText'

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

const { MauMauPage } = await import('@/pages/play/MauMauPage')
const { OeffentlicheRaeume } = await import('@/pages/play/OeffentlicheRaeume')

function aufEnglisch(ui: ReactElement) {
  localStorage.setItem('te-sprache', 'en')
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

describe('Mau-Mau auf Englisch', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('erklärt das Menü auf Englisch', () => {
    aufEnglisch(<MauMauPage spiel="maumau" />)
    expect(screen.getByText(/The 7 sends two cards/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Against the computer/ })).toBeInTheDocument()
    expect(screen.queryByText(/Gegen den Rechner/)).toBeNull()
  })

  it('zeigt Spielart und Hausregeln von Letzte Karte auf Englisch', async () => {
    aufEnglisch(<MauMauPage spiel="letzte-karte" />)
    expect(screen.getByRole('heading', { name: 'Last Card' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Against the computer/ }))

    expect(screen.getByText('House rules')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Extreme' }))
    expect(screen.getByText(/penalty cards can be passed on/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+2 on +2' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Black on black' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zero swaps the hands' })).toBeInTheDocument()
  })

  it('deckt den Tisch auf Englisch', async () => {
    aufEnglisch(<MauMauPage spiel="maumau" />)
    await userEvent.click(screen.getByRole('button', { name: /Against the computer/ }))
    await userEvent.click(screen.getByRole('button', { name: /^1$/ }))
    await userEvent.click(screen.getByRole('button', { name: /Let's go/ }))

    const hand = await screen.findByRole('group', { name: 'Your cards' })
    const karten =
      within(hand).queryAllByRole('img').length + within(hand).queryAllByRole('button').length
    expect(karten).toBe(5)
    expect(screen.getByRole('button', { name: /^Draw pile, \d+ cards$/ })).toBeInTheDocument()
    // Die erste Protokollzeile: „Es liegt …" -- auf Englisch.
    const protokoll = screen.getByRole('list', { name: 'What happened so far' })
    expect(protokoll).toHaveTextContent(/Face up: /)
    expect(protokoll).not.toHaveTextContent(/Es liegt/)
    // Was gelegt werden darf, heisst „Play …", nie „… legen".
    for (const knopf of within(hand).queryAllByRole('button')) {
      expect(knopf.getAttribute('aria-label')).toMatch(/^Play /)
    }
  })

  it('zeigt die Liste der öffentlichen Räume auf Englisch', async () => {
    aufEnglisch(
      <OeffentlicheRaeume
        laden={async () => [
          {
            match_id: 'm1',
            code: 'ABCDE',
            host_name: 'Lena',
            size: 2,
            plaetze: 4,
            spieler: ['Lena', 'Ida'],
            created_at: '2026-11-06T10:00:00Z',
          },
        ]}
        onBeitreten={() => {}}
      />,
    )
    expect(await screen.findByText("Lena's room")).toBeInTheDocument()
    expect(screen.getByText(/2 people of 4 · Code ABCDE/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()
  })
})

describe('Karten und Protokoll übersetzen', () => {
  const karte = (k: Partial<Karte> & Pick<Karte, 'farbe' | 'text' | 'wirkung'>): Karte => ({
    id: 'x',
    punkte: 0,
    ...k,
  })

  it('liest Karten auf Englisch vor -- und auf Deutsch wie die Engine', () => {
    const bube = karte({ farbe: 'herz', text: 'B', wirkung: 'wunsch' })
    expect(karteVorlesen(en, bube)).toBe('Jack of Hearts (wild)')
    expect(karteVorlesen(de, bube)).toBe('Herz Farbwunsch')
    const ass = karte({ farbe: 'pik', text: 'A', wirkung: 'keine' })
    expect(karteVorlesen(en, ass)).toBe('Ace of Spades')
    expect(karteVorlesen(de, ass)).toBe('Pik A')
    expect(karteVorlesen(en, karte({ farbe: null, text: '+4', wirkung: 'zieh4' }))).toBe(
      'Black Draw four',
    )
    expect(karteVorlesen(en, karte({ farbe: 'gruen', text: '5', wirkung: 'keine' }))).toBe(
      'Green 5',
    )
  })

  it('übersetzt die Kurzform', () => {
    expect(kurzUebersetzen(en, 'B♥')).toBe('J♥')
    expect(kurzUebersetzen(en, '10♠')).toBe('10♠')
    expect(kurzUebersetzen(en, 'Grün +2')).toBe('Green +2')
    expect(kurzUebersetzen(en, 'Wunsch')).toBe('Wild')
    expect(kurzUebersetzen(en, '+4')).toBe('+4')
  })

  it('übersetzt jede Zeile, die Engine und Server schreiben', () => {
    const faelle: [string, string][] = [
      ['Es liegt 7♥', 'Face up: 7♥'],
      ['Du legst D♣', 'You play Q♣'],
      ['Lena legt Rot ⊘', 'Lena plays Red ⊘'],
      ['Du ziehst 2', 'You draw 2'],
      ['Lena zieht 4', 'Lena draws 4'],
      ['Du: Mau!', 'You: Mau!'],
      ['Lena: Mau!', 'Lena: Mau!'],
      ['Du hast Mau vergessen und ziehst 2', 'You forgot to say Mau and draw 2'],
      ['Lena hat Mau vergessen und zieht 2', 'Lena forgot to say Mau and draws 2'],
      ['Der Stapel wird neu gemischt', 'The draw pile is reshuffled'],
      ['Der Stapel ist leer', 'The draw pile is empty'],
      ['Niemand kann mehr legen', 'Nobody can play any more'],
      ['Die Hände wandern weiter', 'The hands move on'],
    ]
    for (const [zeile, englisch] of faelle) {
      expect(protokollZeile(en, zeile)).toBe(englisch)
      // Auf Deutsch kommt genau die Zeile wieder heraus.
      expect(protokollZeile(de, zeile)).toBe(zeile)
    }
    // Unbekanntes bleibt stehen, statt zu verschwinden.
    expect(protokollZeile(en, 'Etwas ganz anderes')).toBe('Etwas ganz anderes')
  })
})
