/**
 * Die kleinen Spiele und Randseiten auf Englisch (Teil 8d).
 *
 * Wortlisten und Fragen bleiben deutsch (Inhalt, siehe
 * docs/design/zweisprachig/README.md) -- alles drumherum nicht. Die
 * Engines werfen deutsche Sätze; die Seiten übersetzen sie beim Rendern.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import { OBJECT_CATALOG } from '@/games/what-is-missing/objects'
import { WerWuerdeEherPage } from '@/pages/play/WerWuerdeEherPage'
import { WortbombePage } from '@/pages/play/WortbombePage'
import { ScharadePage } from '@/pages/play/ScharadePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { partyFehler } from '@/pages/play/partyFehler'

function inSprache(sprache: 'de' | 'en', ui: ReactElement) {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

describe('Kleine Spiele auf Englisch', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('Wer würde eher: Einstellungen und Startfehler auf Englisch', async () => {
    inSprache('en', <WerWuerdeEherPage />)
    expect(screen.getByRole('heading', { name: /Who would rather\?/ })).toBeInTheDocument()
    expect(screen.getByText('Players (3–12)')).toBeInTheDocument()
    expect(screen.getByText('Who would most likely…?')).toBeInTheDocument()
    expect(screen.queryByText(/Wer würde am ehesten/)).toBeNull()

    // Zwei Namen sind zu wenig -- die Engine wirft deutsch, angezeigt wird Englisch.
    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), 'Anna{enter}Ben')
    await userEvent.click(screen.getByRole('button', { name: 'Start playing' }))
    expect(screen.getByText('At least 3 players needed')).toBeInTheDocument()
    expect(screen.queryByText(/Mindestens/)).toBeNull()
  })

  it('Wer würde eher: Weitergeben und Abstimmen', async () => {
    inSprache('en', <WerWuerdeEherPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Start playing' }))
    expect(screen.getByText('Pass the device to')).toBeInTheDocument()
    expect(screen.getByText(/Question 1 of/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'I am Thomas' }))
    expect(screen.getByText(/for Thomas only/)).toBeInTheDocument()
  })

  it('Wortbombe: Stufen und Spielerzahl auf Englisch', () => {
    inSprache('en', <WortbombePage />)
    expect(screen.getByRole('heading', { name: /Word Bomb/ })).toBeInTheDocument()
    for (const stufe of ['Easy', 'Medium', 'Hard']) {
      expect(screen.getByRole('button', { name: stufe })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Light the fuse' })).toBeInTheDocument()
    expect(screen.queryByText(/Zünden|Leben je Person/)).toBeNull()
  })

  it('Scharade: Einstellungen und erster Zug auf Englisch', async () => {
    inSprache('en', <ScharadePage />)
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText(/shared with “Find the Imposter”/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start playing' }))
    expect(screen.getByText(/60 seconds\. Act it out/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Let’s go' }))
    expect(screen.getByRole('button', { name: '✓ Got it' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↷ Skip' })).toBeInTheDocument()
  })

  it('Seite nicht gefunden: in beiden Sprachen', () => {
    const { unmount } = inSprache('en', <NotFoundPage />)
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'To the home screen' })).toBeInTheDocument()
    unmount()
    inSprache('de', <NotFoundPage />)
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zur Startseite' })).toBeInTheDocument()
  })
})

describe('Startfehler der Partyspiele', () => {
  it('erkennt die Sätze der Engines', () => {
    expect(partyFehler(en, 'Mindestens 2 Spieler nötig')).toBe('At least 2 players needed')
    expect(partyFehler(en, 'Maximal 12 Spieler')).toBe('At most 12 players')
    expect(partyFehler(en, 'Name doppelt: Anna')).toBe('Duplicate name: Anna')
    expect(partyFehler(en, 'Start fehlgeschlagen')).toBe('Could not start')
    expect(partyFehler(en, 'X', { X: 'Y' })).toBe('Y')
  })

  it('lässt auf Deutsch den Satz der Engine stehen', () => {
    for (const satz of ['Mindestens 3 Spieler nötig', 'Maximal 12 Spieler', 'Name doppelt: Ben']) {
      expect(partyFehler(de, satz)).toBe(satz)
    }
  })

  it('lässt einen unbekannten Satz stehen statt ihn zu leeren', () => {
    expect(partyFehler(en, 'Etwas ganz anderes')).toBe('Etwas ganz anderes')
  })
})

describe('Was fehlt? – Objektnamen', () => {
  it('hat für jedes Objekt einen Namen in beiden Sprachen', () => {
    const deNamen = de.wasFehlt.objekte as Record<string, string>
    const enNamen = en.wasFehlt.objekte as Record<string, string>
    for (const obj of OBJECT_CATALOG) {
      // Der deutsche Eintrag ist genau der Name aus dem Katalog.
      expect(deNamen[obj.id]).toBe(obj.label)
      expect(enNamen[obj.id]).toBeTruthy()
    }
    expect(Object.keys(deNamen)).toHaveLength(OBJECT_CATALOG.length)
  })
})
