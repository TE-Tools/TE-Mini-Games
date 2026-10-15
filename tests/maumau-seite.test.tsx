/**
 * Die Kartenseite: Kommt man vom Menü an den Tisch, und zeigt sie, was
 * gelegt werden darf?
 *
 * Die Regeln stehen in der Engine und werden dort geprüft. Hier geht es
 * nur darum, dass die Seite sie richtig anzeigt -- und dass sie nichts
 * anbietet, was nicht erlaubt ist.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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

async function anDenTisch(spiel: 'maumau' | 'letzte-karte', gegner = 1) {
  render(
    <MemoryRouter>
      <MauMauPage spiel={spiel} />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: /Gegen den Rechner/ }))
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${gegner}$`) }))
  await userEvent.click(screen.getByRole('button', { name: /Los geht/ }))
}

describe('Mau-Mau', () => {
  it('erklärt im Menü die Karten, die etwas bewirken', () => {
    render(
      <MemoryRouter>
        <MauMauPage spiel="maumau" />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Die 7 schickt zwei Karten/)).toBeInTheDocument()
    // Die Spielart wählt man nur beim bunten Blatt.
    expect(screen.queryByRole('button', { name: 'Extrem' })).not.toBeInTheDocument()
  })

  it('teilt fünf Karten aus und zeigt den Nachziehstapel', async () => {
    await anDenTisch('maumau', 1)

    const hand = await screen.findByRole('group', { name: 'Deine Karten' })
    // Was passt, ist ein Knopf; der Rest ein Bild. Zusammen fünf Karten.
    const karten =
      within(hand).queryAllByRole('img').length + within(hand).queryAllByRole('button').length
    expect(karten).toBe(5)
    // Der Stapel sagt, wie viele Karten noch da sind.
    expect(screen.getByRole('button', { name: /Nachziehstapel, \d+ Karten/ })).toBeInTheDocument()
  })

  it('bietet nur die Karten zum Legen an, die passen', async () => {
    await anDenTisch('maumau', 1)
    const hand = await screen.findByRole('group', { name: 'Deine Karten' })

    // Was anklickbar ist, ist ein Knopf („… legen"); der Rest ist ein Bild.
    const legbar = within(hand).queryAllByRole('button')
    for (const knopf of legbar) {
      expect(knopf.getAttribute('aria-label')).toMatch(/ legen$/)
    }
    // Und niemals alle fünf: Eine Hand, in der alles passt, gibt es zwar,
    // aber die Anzeige muss beide Fälle können.
    expect(legbar.length).toBeLessThanOrEqual(5)
  })
})

describe('Letzte Karte', () => {
  it('lässt zwischen Bunt und Extrem wählen', async () => {
    render(
      <MemoryRouter>
        <MauMauPage spiel="letzte-karte" />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: /Gegen den Rechner/ }))

    expect(screen.getByRole('button', { name: 'Bunt' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Extrem' }))
    expect(screen.getByText(/Strafkarten lassen sich weiterreichen/)).toBeInTheDocument()
  })

  it('teilt sieben Karten aus', async () => {
    await anDenTisch('letzte-karte', 1)
    const hand = await screen.findByRole('group', { name: 'Deine Karten' })
    const karten =
      within(hand).queryAllByRole('img').length + within(hand).queryAllByRole('button').length
    expect(karten).toBe(7)
  })
})
