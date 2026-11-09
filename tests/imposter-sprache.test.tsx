/**
 * Finde den Imposter in beiden Sprachen.
 *
 * Das Spielmodul bleibt deutsch (Modi, Chaos-Regeln, Fehlermeldungen,
 * Wörter); übersetzt wird erst beim Anzeigen. Englische Wörter und
 * Kategorien sind eigene Listen (`en-`), siehe tests/imposter-englisch.test.ts.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import { CHAOS_RULES, MODES } from '@/games/finde-den-imposter'
import { FindeDenImposterPage } from '@/pages/play/FindeDenImposterPage'
import { ImposterCategoriesEditor } from '@/pages/play/ImposterCategoriesEditor'
import { chaosRegel, meldungText, modusName, modusText } from '@/pages/play/imposter/imposterText'

function inSprache(sprache: 'de' | 'en', ui: ReactElement) {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

describe('Finde den Imposter: Wörterbuch', () => {
  it('führt auf Deutsch genau die Namen und Texte des Spielmoduls', () => {
    for (const m of MODES) {
      expect(modusName(de, m.id)).toBe(m.label)
      expect(modusText(de, m.id)).toBe(m.description)
    }
    for (const r of CHAOS_RULES) expect(chaosRegel(de, r.id)).toBe(r.label)
  })

  it('übersetzt jeden Modus und jede Chaos-Regel', () => {
    for (const m of MODES) {
      // „Chaos" heißt auf Englisch genauso.
      if (m.id !== 'chaos') expect(modusName(en, m.id)).not.toBe(m.label)
      expect(modusText(en, m.id)).not.toBe(m.description)
    }
    for (const r of CHAOS_RULES) expect(chaosRegel(en, r.id)).not.toBe(r.label)
    // Unbekannte Kennungen von online bleiben stehen statt leer.
    expect(chaosRegel(en, 'neu')).toBe('neu')
  })

  it('übersetzt die Meldungen der Engine über ihr Muster', () => {
    expect(meldungText(en, 'Mindestens 3 Spieler nötig')).toBe('At least 3 players needed')
    expect(meldungText(en, 'Name doppelt: Lena')).toBe('Duplicate name: Lena')
    expect(meldungText(en, '„Duell" braucht mindestens 6 Mitspielende')).toBe(
      '"Duel" needs at least 6 players',
    )
    expect(meldungText(en, 'Namenloser Eintrag: braucht einen Namen und mindestens 8 Wörter')).toBe(
      'Unnamed entry: needs a name and at least 8 words',
    )
    expect(meldungText(de, 'Name doppelt: Lena')).toBe('Name doppelt: Lena')
    expect(meldungText(en, 'Etwas ganz anderes')).toBe('Etwas ganz anderes')
  })
})

describe('Finde den Imposter auf dem Bildschirm', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('zeigt das Setup auf Englisch', () => {
    inSprache('en', <FindeDenImposterPage />)
    expect(screen.getByRole('heading', { name: /Find the Imposter/ })).toBeInTheDocument()
    expect(screen.getByText('4 players · 1 imposter by default')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Classic' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Duel (6+)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play on one device' })).toBeInTheDocument()
    expect(screen.queryByText(/Am einen Gerät/)).toBeNull()
  })

  it('spielt auf Englisch bis zur Diskussion', () => {
    inSprache('en', <FindeDenImposterPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    for (let i = 0; i < 4; i++) {
      expect(screen.getByText('Pass the device to')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /show my secret/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Got it – next' }))
    }
    expect(screen.getByText('Starting now')).toBeInTheDocument()
    expect(screen.getByText(/^Discussion · Round 1/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guess the imposter' }))
    expect(screen.getByRole('heading', { name: 'Who is the imposter?' })).toBeInTheDocument()
  })

  it('übersetzt Fehler der Engine beim Start', () => {
    inSprache('en', <FindeDenImposterPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Lena\nLena\nTom' } })
    fireEvent.click(screen.getByRole('button', { name: 'Play on one device' }))
    expect(screen.getByText('Duplicate name: Lena')).toBeInTheDocument()
  })

  it('bleibt auf Deutsch deutsch', () => {
    inSprache('de', <FindeDenImposterPage />)
    expect(screen.getByText('4 Spieler · standardmäßig 1 Imposter')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Klassisch' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Am einen Gerät spielen' })).toBeInTheDocument()
  })

  it('zeigt den Kategorie-Editor auf Englisch', () => {
    inSprache(
      'en',
      <ImposterCategoriesEditor categories={[]} onChanged={() => {}} onClose={() => {}} />,
    )
    expect(screen.getByText('No category of your own yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create category' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })
})
