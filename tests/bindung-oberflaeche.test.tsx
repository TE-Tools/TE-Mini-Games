/** Bindung in der Oberfläche: die Karte „Heute" und die Feierschicht. */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import { getOrCreateGuestProfile, updateStreak } from '@/offline/profile'
import { HomePage } from '@/pages/HomePage'
import { FeierSchicht, FEIER_DAUER_MS } from '@/components/feier/FeierSchicht'
import { meldeFeiern } from '@/progression/feier'
import { aufgabenFuerTag, zugEintragen } from '@/progression/tagesaufgaben'
import { schreibeTagesstand } from '@/progression/tagesaufgabenSpeicher'
import { todayKey } from '@/progression/daily'

function zeige(sprache: 'de' | 'en') {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </SprachProvider>,
  )
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
})

/** Die erste Aufgabe des Tages zur Hälfte (oder ganz) erledigt. */
function ersteAufgabeAngefangen() {
  const [erste] = aufgabenFuerTag(todayKey())
  const w = zugEintragen(
    null,
    { gameId: erste!.gameId!, level: 1, sterne: 0, neuesLevel: false },
    todayKey(),
  )
  schreibeTagesstand('guest', w.stand)
  return erste!
}

describe('Startseite: Heute', () => {
  it('zeigt die drei Tagesaufgaben mit Stand und Serie -- auf Deutsch', async () => {
    await getOrCreateGuestProfile()
    await updateStreak('guest', 4, todayKey())
    const erste = ersteAufgabeAngefangen()
    zeige('de')

    const karte = await screen.findByRole('region', { name: 'Tagesaufgaben' })
    expect(within(karte).getByRole('heading', { name: 'Heute' })).toBeInTheDocument()
    expect(within(karte).getAllByRole('progressbar')).toHaveLength(3)
    expect(
      await within(karte).findByText('4 Tage in Folge – heute schon gespielt ✓'),
    ).toBeInTheDocument()
    // Die erste Aufgabe führt in ihr Spiel.
    const links = within(karte).getAllByRole('link')
    expect(links[0]!.getAttribute('href')).toBe(`/play/${erste.gameId}`)
    expect(
      within(links[0]!).getByText(erste.ziel === 1 ? 'Geschafft' : `1 von ${erste.ziel}`),
    ).toBeInTheDocument()
    expect(within(karte).getByText('Alle drei geschafft: +40 XP extra')).toBeInTheDocument()
  })

  it('erinnert freundlich, wenn die Serie gestern zuletzt zählte -- auf Englisch', async () => {
    const d = new Date()
    const gestern = todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
    await getOrCreateGuestProfile()
    await updateStreak('guest', 3, gestern)
    zeige('en')

    const karte = await screen.findByRole('region', { name: 'Daily missions' })
    expect(within(karte).getByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(
      await within(karte).findByText('3 days in a row – one round today keeps your streak going'),
    ).toBeInTheDocument()
    expect(within(karte).getByText('All three done: +40 bonus XP')).toBeInTheDocument()
  })
})

describe('Feierschicht', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('zeigt Feiern nacheinander und lässt sich wegtippen', async () => {
    localStorage.setItem('te-sprache', 'de')
    render(
      <SprachProvider>
        <FeierSchicht />
      </SprachProvider>,
    )
    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      meldeFeiern([
        { art: 'abzeichen', id: 'perfectionist' },
        { art: 'aufstieg', level: 5 },
      ])
    })
    expect(await screen.findByText('Neues Abzeichen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(await screen.findByText('Level aufgestiegen!')).toBeInTheDocument()
    expect(screen.getByText('Du bist jetzt Level 5.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('geht nach ein paar Sekunden von selbst', () => {
    vi.useFakeTimers()
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <FeierSchicht />
      </SprachProvider>,
    )
    act(() => {
      meldeFeiern([{ art: 'alleAufgaben', xp: 40 }])
    })
    expect(screen.getByText('All daily missions done')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(FEIER_DAUER_MS + 10)
    })
    expect(screen.queryByText('All daily missions done')).toBeNull()
  })
})
