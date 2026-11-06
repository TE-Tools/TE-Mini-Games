/**
 * Die lokale Schützenrunde in beiden Sprachen: Vorraum und erste Nacht.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { SchuetzenrundePage } from '@/pages/play/SchuetzenrundePage'
import { renderAufDeutsch } from './aufDeutsch'

const seite = (
  <MemoryRouter>
    <SchuetzenrundePage />
  </MemoryRouter>
)

describe('Schützenrunde – Seite', () => {
  it('zeigt den Vorraum auf Deutsch und startet eine Runde', async () => {
    renderAufDeutsch(seite)
    expect(screen.getByRole('heading', { name: 'Schützenrunde' })).toBeDefined()
    expect(screen.getByDisplayValue('Du')).toBeDefined()
    expect(screen.getByText(/Zwei Saboteure · 8–16 Mitglieder möglich/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Jäger/ })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Runde starten' }))
    expect(await screen.findByText('Nacht 1')).toBeDefined()
    expect(screen.getByText(/Die Bruderschaft trifft sich – 8 Mitglieder/)).toBeDefined()
  })

  it('zeigt den Vorraum und die erste Nacht auf Englisch', async () => {
    localStorage.setItem('te-sprache', 'en')
    render(<SprachProvider>{seite}</SprachProvider>)
    expect(screen.getByRole('heading', { name: 'Marksmen Round' })).toBeDefined()
    expect(screen.getByDisplayValue('You')).toBeDefined()
    expect(screen.getByText(/Two saboteurs · 8–16 members possible/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Rifles/ })).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Start round' }))
    expect(await screen.findByText('Night 1')).toBeDefined()
    expect(
      screen.getByText('The Brotherhood is meeting – 8 members, two saboteurs among you.'),
    ).toBeDefined()
    expect(screen.getByText(/· (Brotherhood|Saboteurs)$/)).toBeDefined()
    expect(screen.queryByText(/Nacht|Bruderschaft|Mitglieder/)).toBeNull()
  })
})
