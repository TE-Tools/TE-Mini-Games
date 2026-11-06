/**
 * Sprache: Erkennung, Umschalten, Beständigkeit, Vollständigkeit.
 *
 * TypeScript hält die beiden Wörterbücher schon in Form -- ein
 * fehlender englischer Schlüssel ist ein roter Build. Was TypeScript
 * nicht sieht: ob eine Textfunktion in der Übersetzung zur festen
 * Zeichenkette geworden ist (dann fehlt der eingesetzte Wert), ob
 * jemand die deutsche Fassung einfach kopiert hat, und ob ein Text leer
 * geblieben ist. Genau das prüft der Vergleich unten.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import { sprachenWahlAusUmgebung } from '@/i18n/sprache'
import { SprachProvider } from '@/i18n/SprachProvider'
import { SprachKnopf } from '@/i18n/SprachKnopf'
import { useText } from '@/i18n/sprache'

type Knoten = Record<string, unknown>

/** Läuft beide Wörterbücher parallel ab und sammelt, was nicht passt. */
function vergleiche(a: Knoten, b: Knoten, pfad = ''): string[] {
  const mangel: string[] = []
  for (const schluessel of Object.keys(a)) {
    const hier = pfad ? `${pfad}.${schluessel}` : schluessel
    const links = a[schluessel]
    const rechts = b[schluessel]
    if (typeof links !== typeof rechts) {
      mangel.push(`${hier}: ${typeof links} gegen ${typeof rechts}`)
      continue
    }
    if (typeof links === 'object' && links !== null) {
      mangel.push(...vergleiche(links as Knoten, rechts as Knoten, hier))
    } else if (typeof links === 'function') {
      if (
        (links as (...a: never[]) => unknown).length !==
        (rechts as (...a: never[]) => unknown).length
      ) {
        mangel.push(`${hier}: verschieden viele Werte eingesetzt`)
      }
    } else if (typeof links === 'string') {
      if (rechts === '') mangel.push(`${hier}: leer`)
    }
  }
  return mangel
}

describe('Wörterbücher', () => {
  it('haben dieselbe Form und keine leeren Texte', () => {
    expect(vergleiche(de as Knoten, en as Knoten)).toEqual([])
  })

  it('haben keine überzähligen englischen Schlüssel', () => {
    expect(vergleiche(en as Knoten, de as Knoten)).toEqual([])
  })

  it('übersetzen die Spielnamen wirklich, statt sie zu kopieren', () => {
    // Eigennamen bleiben gleich -- die anderen nicht. Ohne diese Liste
    // wäre ein vergessener Name als "schon richtig" durchgegangen.
    const eigennamen = new Set([
      'sudoku',
      'bienen-flow',
      'squishy-dumplings',
      'trapbound',
      'emberwake',
      'kniffel',
      'maumau',
      'texas-holdem',
      'schuetzenopoly',
    ])
    const unuebersetzt = Object.keys(de.spiele).filter(
      (k) =>
        !eigennamen.has(k) &&
        de.spiele[k as keyof typeof de.spiele] === en.spiele[k as keyof typeof en.spiele],
    )
    expect(unuebersetzt).toEqual([])
  })
})

describe('Sprache der Umgebung', () => {
  it('nimmt Deutsch, wenn das Gerät Deutsch kann', () => {
    expect(sprachenWahlAusUmgebung(['de-DE', 'en-US'])).toBe('de')
    expect(sprachenWahlAusUmgebung(['en-US', 'de'])).toBe('de')
    expect(sprachenWahlAusUmgebung(['de'])).toBe('de')
  })

  it('nimmt sonst Englisch', () => {
    expect(sprachenWahlAusUmgebung(['en-US'])).toBe('en')
    expect(sprachenWahlAusUmgebung(['fr-FR', 'it'])).toBe('en')
  })

  it('nimmt Deutsch, wenn das Gerät nichts sagt', () => {
    expect(sprachenWahlAusUmgebung([])).toBe('de')
  })
})

function Probe() {
  const t = useText()
  return <p>{t.start.titel}</p>
}

describe('Der Umschalter', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('wechselt die Sprache und merkt sich die Wahl', async () => {
    localStorage.setItem('te-sprache', 'de')
    render(
      <SprachProvider>
        <SprachKnopf />
        <Probe />
      </SprachProvider>,
    )
    expect(screen.getByText(de.start.titel)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: de.sprache.wechselZu }))

    expect(screen.getByText(en.start.titel)).toBeInTheDocument()
    expect(localStorage.getItem('te-sprache')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('zeigt die Sprache, in die er wechselt -- nicht die aktuelle', () => {
    localStorage.setItem('te-sprache', 'de')
    render(
      <SprachProvider>
        <SprachKnopf />
      </SprachProvider>,
    )
    // Wer Deutsch liest, soll "EN" sehen. Umgekehrt klickt man versehentlich.
    expect(screen.getByRole('button')).toHaveTextContent('EN')
  })
})
