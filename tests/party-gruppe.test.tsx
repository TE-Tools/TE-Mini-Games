/**
 * Die Einstellungen der Partyspiele: Mitspieler als Kärtchen, die gemerkte
 * Runde (für alle Partyspiele gemeinsam) und die Kategorie als Blatt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import { FindeDenImposterPage } from '@/pages/play/FindeDenImposterPage'
import { WortbombePage } from '@/pages/play/WortbombePage'
import { StadtLandFlussPage } from '@/pages/play/StadtLandFlussPage'
import { WerWuerdeEherPage } from '@/pages/play/WerWuerdeEherPage'
import { RueckwaertsPage } from '@/pages/play/RueckwaertsPage'
import { ScharadePage } from '@/pages/play/ScharadePage'
import { GRUPPE_SCHLUESSEL, ladeGruppe, merkeGruppe } from '@/components/party/gruppe'
import {
  kaertchen,
  kategorieKnopf,
  kategorieWert,
  namensFeld,
  namenTippen,
  spielerSetzen,
} from './partyHelfer'

function inSprache(sprache: 'de' | 'en', ui: ReactElement) {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

const gemerkt = () => JSON.parse(localStorage.getItem(GRUPPE_SCHLUESSEL) ?? 'null') as unknown

beforeEach(() => {
  localStorage.clear()
})

describe('Mitspieler als Kärtchen', () => {
  it('beim allerersten Mal stehen die Vorbelegungen des Spiels da', () => {
    const { unmount } = inSprache('de', <ScharadePage />)
    expect(kaertchen()).toEqual(['Thomas', 'Marina', 'Phillip', 'Sonja'])
    unmount()
    // Rückwärts hat seine eigene, kürzere Vorbelegung.
    inSprache('de', <RueckwaertsPage />)
    expect(kaertchen()).toEqual(['Thomas', 'Marina', 'Phillip'])
  })

  it('nimmt heraus und hinzu -- per Enter, per Knopf und mehrere auf einmal', () => {
    inSprache('de', <ScharadePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Marina entfernen' }))
    expect(kaertchen()).toEqual(['Thomas', 'Phillip', 'Sonja'])

    namenTippen('Lena')
    expect(kaertchen()).toEqual(['Thomas', 'Phillip', 'Sonja', 'Lena'])
    expect(namensFeld().value).toBe('')

    fireEvent.change(namensFeld(), { target: { value: '  Ida  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Hinzufügen/ }))
    expect(kaertchen()).toEqual(['Thomas', 'Phillip', 'Sonja', 'Lena', 'Ida'])

    namenTippen('Anna, Ben; Carla')
    expect(kaertchen()).toEqual([
      'Thomas',
      'Phillip',
      'Sonja',
      'Lena',
      'Ida',
      'Anna',
      'Ben',
      'Carla',
    ])
  })

  it('der Knopf ist aus, solange das Feld leer ist', () => {
    inSprache('de', <ScharadePage />)
    expect(screen.getByRole('button', { name: /Hinzufügen/ })).toBeDisabled()
    fireEvent.change(namensFeld(), { target: { value: 'Lena' } })
    expect(screen.getByRole('button', { name: /Hinzufügen/ })).toBeEnabled()
  })

  it('weist einen doppelten Namen freundlich ab, egal ob groß oder klein', () => {
    inSprache('de', <ScharadePage />)
    namenTippen('thomas')
    expect(kaertchen()).toEqual(['Thomas', 'Marina', 'Phillip', 'Sonja'])
    expect(screen.getByText('thomas ist schon dabei')).toBeInTheDocument()
    // Der abgewiesene Name bleibt im Feld stehen, zum Ändern.
    expect(namensFeld().value).toBe('thomas')
  })

  it('am Maximum nimmt das Feld nichts mehr an', () => {
    inSprache('de', <WortbombePage />)
    spielerSetzen(Array.from({ length: 14 }, (_, i) => `P${i + 1}`))
    expect(kaertchen()).toHaveLength(12)
    expect(kaertchen().at(-1)).toBe('P12')
    expect(namensFeld()).toBeDisabled()
    expect(
      screen.getAllByText('Voll besetzt – mehr als 12 passen nicht in eine Runde').length,
    ).toBeGreaterThan(0)
    expect(screen.getByText('12 von 12')).toBeInTheDocument()
  })

  it('unter dem Minimum steht ein Hinweis', () => {
    inSprache('de', <WerWuerdeEherPage />)
    spielerSetzen(['Anna'])
    expect(screen.getByText('Noch 2 Personen – ab 3 geht’s los')).toBeInTheDocument()
    namenTippen('Ben')
    expect(screen.getByText('Noch eine Person – ab 3 geht’s los')).toBeInTheDocument()
    namenTippen('Carla')
    expect(screen.queryByText(/geht’s los/)).toBeNull()
  })

  it('gibt den Engines genau die Namen der Kärtchen', () => {
    inSprache('de', <ScharadePage />)
    spielerSetzen(['Anna', 'Ben'])
    fireEvent.click(screen.getByRole('button', { name: /Losspielen/ }))
    expect(screen.getByText(/^(Anna|Ben)$/)).toBeInTheDocument()
    expect(screen.queryByText(/Thomas/)).toBeNull()
  })
})

describe('Die gemerkte Runde', () => {
  it('gilt für alle Partyspiele: einmal eingetippt, im nächsten Spiel schon da', () => {
    const { unmount } = inSprache('de', <FindeDenImposterPage />)
    spielerSetzen(['Anna', 'Ben', 'Carla'])
    // Gemerkt wird erst, wenn eine Partie wirklich losgeht.
    expect(gemerkt()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Am einen Gerät spielen/ }))
    expect(gemerkt()).toEqual(['Anna', 'Ben', 'Carla'])
    unmount()

    inSprache('de', <WortbombePage />)
    expect(kaertchen()).toEqual(['Anna', 'Ben', 'Carla'])
    // Gleiche Runde wie gemerkt -- nichts anzubieten.
    expect(screen.queryByRole('button', { name: /Letzte Runde/ })).toBeNull()
  })

  it('bietet die letzte Runde an, sobald die jetzige davon abweicht', () => {
    merkeGruppe(['Thomas', 'Marina', 'Phillip', 'Sonja'])
    inSprache('de', <StadtLandFlussPage />)
    expect(screen.queryByRole('button', { name: /Letzte Runde/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Phillip entfernen' }))
    namenTippen('Lena')
    const angebot = screen.getByRole('button', {
      name: 'Letzte Runde: Thomas, Marina, Phillip, Sonja – übernehmen',
    })
    fireEvent.click(angebot)
    expect(kaertchen()).toEqual(['Thomas', 'Marina', 'Phillip', 'Sonja'])
    expect(screen.queryByRole('button', { name: /Letzte Runde/ })).toBeNull()
  })

  it('nach einem Start ist die neue Runde die gemerkte', () => {
    merkeGruppe(['Anna', 'Ben'])
    inSprache('de', <ScharadePage />)
    spielerSetzen(['Lena', 'Ida'])
    expect(screen.getByRole('button', { name: /Letzte Runde: Anna, Ben/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Losspielen/ }))
    expect(gemerkt()).toEqual(['Lena', 'Ida'])
  })

  it('ein Start, den die Engine ablehnt, merkt nichts', () => {
    merkeGruppe(['Anna', 'Ben', 'Carla'])
    inSprache('de', <WerWuerdeEherPage />)
    spielerSetzen(['Lena', 'Ida'])
    fireEvent.click(screen.getByRole('button', { name: /Losspielen/ }))
    expect(screen.getByText('Mindestens 3 Spieler nötig')).toBeInTheDocument()
    expect(gemerkt()).toEqual(['Anna', 'Ben', 'Carla'])
  })

  it('auf Englisch', () => {
    merkeGruppe(['Anna', 'Ben', 'Carla'])
    inSprache('en', <WortbombePage />)
    expect(screen.getByRole('list', { name: 'Players' })).toBeInTheDocument()
    expect(
      screen.getByText('This device remembers the group – for every party game.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ben' }))
    expect(
      screen.getByRole('button', { name: 'Last round: Anna, Ben, Carla – use again' }),
    ).toBeInTheDocument()
    namenTippen('anna')
    expect(screen.getByText('anna is already in')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument()
    expect(screen.getByText('2 of 12')).toBeInTheDocument()
    expect(screen.queryByText(/Letzte Runde|übernehmen|entfernen|Hinzufügen/)).toBeNull()
  })

  it('übersteht Unsinn im Speicher und einen Speicher, der nicht will', () => {
    localStorage.setItem(GRUPPE_SCHLUESSEL, '{kaputt')
    expect(ladeGruppe()).toBeNull()
    localStorage.setItem(GRUPPE_SCHLUESSEL, JSON.stringify(['  Anna ', 3, '', 'Ben']))
    expect(ladeGruppe()).toEqual(['Anna', 'Ben'])
    localStorage.setItem(GRUPPE_SCHLUESSEL, JSON.stringify([]))
    expect(ladeGruppe()).toBeNull()

    const lesen = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    const schreiben = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    try {
      expect(ladeGruppe()).toBeNull()
      expect(() => merkeGruppe(['Anna'])).not.toThrow()
    } finally {
      lesen.mockRestore()
      schreiben.mockRestore()
    }
  })
})

describe('Kategorie als Blatt', () => {
  it('öffnet, wählt per Tipp und schließt; Escape schließt ohne Änderung', () => {
    inSprache('de', <ScharadePage />)
    expect(kategorieKnopf()).toHaveAccessibleName('Kategorie Tiere')
    fireEvent.click(kategorieKnopf())
    const blatt = screen.getByRole('dialog', { name: 'Kategorie' })
    expect(within(blatt).getByRole('radio', { name: /Tiere/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.keyDown(blatt, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(kategorieWert()).toBe('tiere')

    fireEvent.click(kategorieKnopf())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /Musik/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(kategorieWert()).toBe('musik')
  })

  it('Pfeiltasten wandern, ohne das Blatt zu schließen', () => {
    inSprache('de', <ScharadePage />)
    fireEvent.click(kategorieKnopf())
    const blatt = screen.getByRole('dialog')
    fireEvent.keyDown(within(blatt).getByRole('radio', { name: /Tiere/ }), { key: 'ArrowRight' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(kategorieWert()).toBe('essen')
    fireEvent.click(within(blatt).getByRole('button', { name: 'Fertig' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
