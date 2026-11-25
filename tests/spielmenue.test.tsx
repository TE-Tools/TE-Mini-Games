/**
 * Die Startbildschirme der Würfel-, Karten- und Brettspiele
 * (src/components/spielmenue): Kopfbild, Bilanz aus den Ergebnissen auf
 * dem Gerät, und „Weiterspielen“ nur, wo wirklich eine Partie liegt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { db, GUEST_USER_ID, type LocalGameResult } from '@/offline'
import { SprachProvider } from '@/i18n/SprachProvider'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import { SPEICHER_SCHLUESSEL } from '@/games/schach'
import { erstellePartie, loeschePartie, speicherePartie } from '@/games/schuetzenopoly'
import { SpielHero, SpielMenue, StatsLeiste } from '@/components/spielmenue'
import {
  berechneStatistik,
  istSieg,
  LEERE_STATISTIK,
  statistikChips,
  tageSeit,
} from '@/components/spielmenue/statistik'

vi.mock('@/services/spielername', () => ({
  spielerNameOderDu: vi.fn(async () => 'Du'),
  ermittleSpielerName: vi.fn(async () => 'Du'),
  istEchterName: () => false,
}))
vi.mock('@/services/sound', () => ({
  spiele: vi.fn(),
  vibriere: vi.fn(),
  tonAn: () => false,
  setzeTon: vi.fn(),
}))
vi.mock('@/pages/play/schach/partieBuchen', () => ({ buchePartie: vi.fn() }))

const { MauMauPage } = await import('@/pages/play/MauMauPage')
const { SchachPage } = await import('@/pages/play/SchachPage')
const { SchuetzenopolyPage } = await import('@/pages/play/SchuetzenopolyPage')
const { TexasHoldemPage } = await import('@/pages/play/TexasHoldemPage')

const TAG = 86_400_000

function ergebnis(
  gameId: string,
  score: number,
  alterMs: number,
  resultData: Record<string, unknown>,
): LocalGameResult {
  return {
    id: crypto.randomUUID(),
    userId: GUEST_USER_ID,
    gameId,
    level: 1,
    score,
    xp: 5,
    resultData,
    isPersonalRecord: false,
    stars: 0,
    createdAt: new Date(Date.now() - alterMs).toISOString(),
    synced: 1,
  }
}

function zeige(ui: React.ReactElement, sprache: 'de' | 'en' = 'de') {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  await db.gameResults.clear()
  await loeschePartie()
})

/* ------------------------------------------------------------ Rechnen */

describe('Die Bilanz', () => {
  it('ist ohne Partie leer', () => {
    expect(berechneStatistik([])).toEqual(LEERE_STATISTIK)
  })

  it('zählt Partien, Siege, Bestwert und die Serie von der letzten Partie an', () => {
    const s = berechneStatistik([
      ergebnis('kniffel', 210, 1 * TAG, { gewonnen: true }),
      ergebnis('kniffel', 287, 2 * TAG, { gewonnen: true }),
      ergebnis('kniffel', 150, 3 * TAG, { gewonnen: false }),
      ergebnis('kniffel', 240, 4 * TAG, { gewonnen: true }),
    ])
    expect(s.partien).toBe(4)
    expect(s.siege).toBe(3)
    expect(s.bestwert).toBe(287)
    // Die beiden neuesten gewonnen, dann eine Niederlage: zwei in Folge.
    expect(s.serie).toBe(2)
  })

  it('erkennt den Schachsieg am Ausgang -- ein Remis zählt nicht', () => {
    expect(istSieg({ resultData: { ausgang: 'sieg' } })).toBe(true)
    expect(istSieg({ resultData: { ausgang: 'remis' } })).toBe(false)
    expect(istSieg({ resultData: {} })).toBe(false)
  })

  it('zählt Kalendertage, nicht 24-Stunden-Blöcke', () => {
    const jetzt = new Date(2026, 10, 25, 0, 30).getTime()
    expect(tageSeit(new Date(2026, 10, 25, 0, 5).getTime(), jetzt)).toBe(0)
    expect(tageSeit(new Date(2026, 10, 24, 23, 50).getTime(), jetzt)).toBe(1)
    expect(tageSeit(new Date(2026, 10, 20, 12, 0).getTime(), jetzt)).toBe(5)
  })

  it('zeigt nur Chips mit Wert, höchstens vier', () => {
    expect(statistikChips(de, LEERE_STATISTIK, true)).toEqual([])

    const jetzt = Date.now()
    const verloren = statistikChips(
      de,
      { partien: 2, siege: 0, bestwert: 40, serie: 0, zuletzt: jetzt - TAG },
      true,
      jetzt,
    )
    expect(verloren.map((c) => c.id)).toEqual(['bestwert', 'zuletzt', 'partien'])
    expect(verloren.map((c) => c.text)).toEqual(['Bestwert 40', 'Zuletzt gestern', '2 Partien'])

    const voll = statistikChips(
      en,
      { partien: 12, siege: 9, bestwert: 1287, serie: 3, zuletzt: jetzt },
      false,
      jetzt,
    )
    expect(voll.map((c) => c.text)).toEqual([
      '3 wins in a row',
      '9 wins',
      'Last played today',
      '12 games',
    ])
  })
})

/* ---------------------------------------------------------- Bausteine */

describe('Kopfbild und Bilanzleiste', () => {
  it('zeigen ohne Daten eine Zeile für die erste Runde -- auf Deutsch', async () => {
    zeige(
      <SpielMenue spiel="kniffel">
        <SpielHero spiel="kniffel">
          <p>Erklärung</p>
        </SpielHero>
        <StatsLeiste spiel="kniffel" />
      </SpielMenue>,
    )
    expect(screen.getByTestId('spiel-hero')).toHaveTextContent(de.spielMenue.slogan.kniffel)
    expect(await screen.findByText(/deine erste Runde wartet/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Deine Bilanz' })).toBeNull()
  })

  it('zeigen ohne Daten eine Zeile für die erste Runde -- auf Englisch', async () => {
    zeige(
      <SpielMenue spiel="schach">
        <SpielHero spiel="schach" />
        <StatsLeiste spiel="schach" />
      </SpielMenue>,
      'en',
    )
    expect(screen.getByTestId('spiel-hero')).toHaveTextContent(en.spielMenue.slogan.schach)
    expect(await screen.findByText(/your first round is waiting/)).toBeInTheDocument()
    expect(screen.queryByText(/erste Runde/)).toBeNull()
  })

  it('zeigen mit Daten die eigene Bilanz -- nur die dieses Spiels', async () => {
    await db.gameResults.bulkPut([
      ergebnis('kniffel', 287, 1000, { gewonnen: true }),
      ergebnis('kniffel', 190, TAG, { gewonnen: true }),
      ergebnis('kniffel', 120, 2 * TAG, { gewonnen: false }),
      // Ein anderes Spiel zählt hier nicht mit.
      ergebnis('maumau', 999, 1000, { gewonnen: true }),
    ])
    zeige(<StatsLeiste spiel="kniffel" />)
    const leiste = await screen.findByRole('list', { name: 'Deine Bilanz' })
    const chips = within(leiste)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(chips).toEqual(['🔥2 Siege in Folge', '🏆2 Siege', '⭐Bestwert 287', '🕒Zuletzt heute'])
    expect(screen.queryByText(/erste Runde/)).toBeNull()
  })

  it('zeigt die Bilanz auf Englisch', async () => {
    await db.gameResults.bulkPut([ergebnis('texas-holdem', 420, 3 * TAG, { gewonnen: true })])
    zeige(<StatsLeiste spiel="texas-holdem" />, 'en')
    const leiste = await screen.findByRole('list', { name: 'Your record' })
    expect(leiste).toHaveTextContent('1 win')
    expect(leiste).toHaveTextContent('Best 420')
    expect(leiste).toHaveTextContent('Last played 3 days ago')
  })
})

/* -------------------------------------------------------------- Seiten */

describe('Die Spielmenüs', () => {
  it('Mau-Mau zeigt Kopfbild, Bilanz und die Moduskarten', async () => {
    await db.gameResults.bulkPut([ergebnis('maumau', 60, 1000, { gewonnen: true })])
    zeige(<MauMauPage spiel="maumau" />)
    expect(screen.getByTestId('spiel-hero')).toHaveTextContent(/Küchentisch/)
    expect(await screen.findByRole('list', { name: 'Deine Bilanz' })).toHaveTextContent('1 Sieg')
    expect(screen.getByRole('button', { name: /Gegen den Rechner/ })).toHaveTextContent('Spielen')
    expect(screen.getByRole('button', { name: /Online mit anderen/ })).toBeInTheDocument()
    // Kein gespeicherter Stand bei Mau-Mau -- also auch kein Weiterspielen.
    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Zum Menü' })).toBeInTheDocument()
  })

  it('Letzte Karte hat ihr eigenes Kopfbild und ihren eigenen Satz', () => {
    zeige(<MauMauPage spiel="letzte-karte" />, 'en')
    expect(screen.getByTestId('spiel-hero')).toHaveTextContent(en.spielMenue.slogan['letzte-karte'])
    expect(screen.getByRole('button', { name: /Against the computer/ })).toBeInTheDocument()
  })

  it('Texas behält den Satz zum Spielgeld sichtbar im Menü', () => {
    zeige(<TexasHoldemPage />)
    expect(screen.getByText(/nichts zu kaufen und nichts zu gewinnen/)).toBeVisible()
    expect(screen.getByRole('button', { name: /Turnier gegen den Rechner/ })).toBeInTheDocument()
  })

  it('Schach bietet Weiterspielen nur an, wenn eine Partie gespeichert ist', async () => {
    zeige(<SchachPage />)
    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Partie starten' })).toBeInTheDocument()
  })

  it('Schach zeigt die gespeicherte Partie als Weiterspielen ganz oben', () => {
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({
        stufe: 'mittel',
        farbe: 'w',
        zuege: ['e2e4', 'e7e5'],
        seed: 1,
        partieId: 'p1',
      }),
    )
    zeige(<SchachPage />)
    const weiter = screen.getByRole('button', { name: /Weiterspielen/ })
    expect(weiter).toHaveTextContent('Partie fortsetzen – Mittel, 2 Züge')
    // Vor allen anderen Wahlen.
    const knoepfe = screen.getAllByRole('button')
    expect(knoepfe.indexOf(weiter)).toBeLessThan(
      knoepfe.indexOf(screen.getByRole('button', { name: 'Leicht' })),
    )
  })

  it('Schützenopoly bietet ohne gespeicherte Partie kein Weiterspielen an', async () => {
    zeige(<SchuetzenopolyPage />)
    expect(await screen.findByRole('button', { name: /Neue Partie/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Weiterspielen/ })).toBeNull()
  })

  it('Schützenopoly zeigt eine gespeicherte Partie als Weiterspielen -- auch auf Englisch', async () => {
    await speicherePartie(
      erstellePartie({
        spieler: [
          { name: 'Du', typ: 'mensch' },
          { name: 'Rechner', typ: 'ki', kiStufe: 'normal' },
        ],
        rundenLimit: 20,
      }),
    )
    zeige(<SchuetzenopolyPage />, 'en')
    const weiter = await screen.findByRole('button', { name: /Continue/ })
    expect(weiter).toHaveTextContent('Continue game · round 1')
    expect(screen.getByRole('button', { name: /New game/ })).toBeInTheDocument()
    expect(screen.queryByText(/Weiterspielen|Partie fortsetzen/)).toBeNull()
  })
})
