/**
 * Familienrunde, Tagesziel und Rangliste im Gewand der Party-Einstellungen:
 * Kärtchen und Chips speisen die Familienrunde, das Tagesziel zählt nach dem
 * Versuch bis Mitternacht, die Rangliste nennt die Spiele beim Namen.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import { saveDailyAttempt } from '@/offline/daily'
import { getDailyChallenge } from '@/progression/daily'
import { GRUPPE_SCHLUESSEL } from '@/components/party/gruppe'
import { FamilyPage } from '@/pages/family/FamilyPage'
import { DailyPage } from '@/pages/daily/DailyPage'
import { bisMitternacht } from '@/pages/daily/countdown'
import { LeaderboardPage } from '@/pages/leaderboard/LeaderboardPage'
import { kaertchen, spielerSetzen } from './partyHelfer'

function inSprache(sprache: 'de' | 'en', ui: ReactElement) {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  await db.delete()
  await db.open()
})

describe('Familienrunde', () => {
  it('die Kärtchen und die Spielwahl landen in der Sitzung', async () => {
    inSprache('de', <FamilyPage />)
    expect(kaertchen()).toEqual(['Thomas', 'Marina', 'Phillip', 'Sonja'])

    spielerSetzen(['Oma', 'Opa', 'Lea'])
    const spiele = screen.getByRole('radiogroup', { name: 'Spiel' })
    fireEvent.click(within(spiele).getByRole('radio', { name: /Was fehlt\?/ }))
    expect(within(spiele).getByRole('radio', { name: /Was fehlt\?/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Runde starten/ }))

    expect(await screen.findByText('Spieler 1 von 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ich bin bereit' })).toBeInTheDocument()
    const [sitzung] = await db.familySessions.toArray()
    expect(sitzung?.playerNames).toEqual(['Oma', 'Opa', 'Lea'])
    expect(sitzung?.gameId).toBe('what-is-missing')
    // Gemerkt wie bei den Partyspielen -- dieselbe Runde für alle.
    expect(JSON.parse(localStorage.getItem(GRUPPE_SCHLUESSEL) ?? 'null')).toEqual([
      'Oma',
      'Opa',
      'Lea',
    ])
  })

  it('mit einer Person startet nichts, und es steht auf Deutsch da, warum', async () => {
    inSprache('de', <FamilyPage />)
    spielerSetzen(['Oma'])
    fireEvent.click(screen.getByRole('button', { name: /Runde starten/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mindestens 2 Spieler nötig')
    expect(await db.familySessions.count()).toBe(0)
  })
})

describe('Tagesziel', () => {
  it('rechnet bis zur nächsten Mitternacht nach Ortszeit, aufgerundet', () => {
    expect(bisMitternacht(new Date(2026, 10, 26, 18, 30, 0))).toBe('05:30')
    expect(bisMitternacht(new Date(2026, 10, 26, 18, 29, 30))).toBe('05:31')
    expect(bisMitternacht(new Date(2026, 10, 26, 23, 59, 30))).toBe('00:01')
    expect(bisMitternacht(new Date(2026, 10, 26, 0, 0, 0))).toBe('24:00')
  })

  it('heißt auf Deutsch Tagesziel und zeigt vor dem Versuch keine Uhr', async () => {
    inSprache('de', <DailyPage />)
    expect(await screen.findByRole('button', { name: /Jetzt spielen/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Tagesziel' })).toBeInTheDocument()
    expect(screen.getByText('Noch offen')).toBeInTheDocument()
    expect(screen.queryByTestId('tagesziel-countdown')).not.toBeInTheDocument()
  })

  it('nach dem Versuch: erledigt, das Ergebnis und wann das nächste kommt', async () => {
    await saveDailyAttempt(getDailyChallenge(), 1234, { actualTime: 3.04, targetTime: 3 })
    inSprache('de', <DailyPage />)
    expect(await screen.findByText('Heute schon gespielt')).toBeInTheDocument()
    expect(screen.getByText('1234 Punkte')).toBeInTheDocument()
    expect(screen.getByText(/Erledigt/)).toBeInTheDocument()
    expect(screen.getByTestId('tagesziel-countdown')).toHaveTextContent(
      /^⏳ Nächstes Tagesziel in \d\d:\d\d$/,
    )
    expect(screen.queryByRole('button', { name: /Jetzt spielen/ })).not.toBeInTheDocument()
  })

  it('auf Englisch ebenso', async () => {
    await saveDailyAttempt(getDailyChallenge(), 50, {})
    inSprache('en', <DailyPage />)
    expect(await screen.findByTestId('tagesziel-countdown')).toHaveTextContent(
      /Next challenge in \d\d:\d\d/,
    )
  })
})

describe('Rangliste', () => {
  const spielChips = () =>
    within(screen.getByRole('radiogroup', { name: /Spiel wählen|Choose a game/ }))
      .getAllByRole('radio')
      // Ohne das Bild davor (aria-hidden) -- so, wie ein Vorlesegerät es nennt.
      .map((r) => {
        const kopie = r.cloneNode(true) as HTMLElement
        kopie.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove())
        return kopie.textContent?.trim()
      })

  it('nennt die Spiele beim Namen statt fünfmal „Global“', async () => {
    inSprache('de', <LeaderboardPage />)
    const ansicht = screen.getByRole('radiogroup', { name: 'Ansicht' })
    expect(
      within(ansicht)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Alle Spiele', 'Meine Rekorde', 'Je Spiel'])
    expect(screen.queryByText(/Global/)).not.toBeInTheDocument()

    fireEvent.click(within(ansicht).getByRole('radio', { name: 'Je Spiel' }))
    expect(spielChips()).toEqual([
      'Perfekte Sekunde',
      'Was fehlt?',
      'Schützenrunde',
      'Reihenfolge',
      'Kopfrechnen',
    ])
    fireEvent.click(screen.getByRole('radio', { name: /Kopfrechnen/ }))
    expect(
      await screen.findByRole('heading', { level: 2, name: /Kopfrechnen – Bestenliste/ }),
    ).toBeInTheDocument()

    // Zurück zu „Alle“ und wieder „Je Spiel“: dasselbe Spiel wie eben.
    fireEvent.click(within(ansicht).getByRole('radio', { name: 'Alle Spiele' }))
    fireEvent.click(within(ansicht).getByRole('radio', { name: 'Je Spiel' }))
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Kopfrechnen/ })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    )
  })

  it('auf Englisch die englischen Namen', () => {
    inSprache('en', <LeaderboardPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'By game' }))
    expect(spielChips()).toEqual([
      'Perfect Second',
      "What's missing?",
      'Marksmen',
      'Order',
      'Mental Maths',
    ])
  })
})
