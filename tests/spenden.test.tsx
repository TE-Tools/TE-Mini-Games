/**
 * Der Spenden-Verweis auf der Startseite.
 *
 * Thomas am 06.09.2026: "kannst du bei den mini spielen Hauptseite ein spenden
 * button Paypal einführen. paypal.me/ThomasElsen"
 *
 * Zwei Dinge sind daran wichtiger als das Aussehen:
 *
 *  - Ein Verweis, der ein neues Fenster oeffnet, braucht rel="noopener".
 *    Ohne das bekommt die geoeffnete Seite ueber window.opener einen Griff auf
 *    das Fenster der App und kann es umleiten. Bei einer Zahlungsseite ist das
 *    die Sorte Luecke, die man nicht offen laesst.
 *  - Die Adresse muss stimmen. Ein Tippfehler im Empfaengernamen schickt Geld
 *    an eine fremde Person, und das faellt niemandem auf.
 */
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'

function startseite() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('Spenden auf der Startseite', () => {
  it('führt genau zu paypal.me/ThomasElsen', () => {
    startseite()
    const verweis = screen.getByRole('link', { name: /Spenden über PayPal/ })
    expect(verweis.getAttribute('href')).toBe('https://paypal.me/ThomasElsen')
  })

  it('öffnet ein neues Fenster, ohne der Zielseite Zugriff zu geben', () => {
    startseite()
    const verweis = screen.getByRole('link', { name: /Spenden über PayPal/ })
    expect(verweis.getAttribute('target')).toBe('_blank')
    const rel = verweis.getAttribute('rel') ?? ''
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
  })

  it('sagt vorher, dass es die App verlässt', () => {
    startseite()
    expect(screen.getByText(/Öffnet PayPal in einem neuen Fenster/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Spenden über PayPal/ }).textContent).toContain('PayPal')
  })

  it('bindet kein fremdes Skript ein', () => {
    // Ein PayPal-Widget braeuchte fremdes JavaScript und brächte Nachverfolgung
    // mit. Fuer paypal.me genuegt ein Verweis -- das soll so bleiben.
    const { container } = startseite()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
  })

  it('steht unter den Spielen, nicht zwischen ihnen', () => {
    const { container } = startseite()
    const kacheln = container.querySelector('nav')
    const spende = container.querySelector('footer')
    expect(kacheln).toBeTruthy()
    expect(spende).toBeTruthy()
    // compareDocumentPosition: 4 = das andere Element folgt danach.
    expect(kacheln!.compareDocumentPosition(spende!) & 4).toBeTruthy()
  })
})
