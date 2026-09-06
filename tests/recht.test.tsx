/**
 * Impressum und Datenschutzerklärung.
 *
 * Thomas am 06.09.2026: "dann baue bitte ein Impressum und Datenschutz ein,
 * te-alltagshelfer.org hat das ja auch schon."
 *
 * Die Pflichtangaben selbst prüft dieser Test nur oberflächlich -- ob eine
 * Anschrift juristisch genügt, entscheidet kein Test. Was er festhält, ist das,
 * was beim Umbauen leicht kaputtgeht und niemandem auffällt:
 *
 *  - Die Seiten müssen von der Startseite aus erreichbar sein. Eine
 *    Datenschutzerklärung, die nur existiert, erfüllt ihren Zweck nicht.
 *  - Sie müssen die Dienste nennen, die WIRKLICH benutzt werden. Die Erklärung
 *    des Familienplaners zu übernehmen wäre bequem gewesen und falsch: Sie
 *    beschreibt Firebase, WebUntis und Push -- nichts davon kommt hier vor.
 */
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { ImpressumPage } from '@/pages/recht/ImpressumPage'
import { DatenschutzPage } from '@/pages/recht/DatenschutzPage'

const zeige = (seite: React.ReactElement) =>
  render(<MemoryRouter>{seite}</MemoryRouter>)

describe('Impressum', () => {
  it('nennt Anbieter, Anschrift und Kontakt', () => {
    // Ueber den Textinhalt statt getByText: Die Anschrift steht in einem
    // Absatz, der wiederum in einem Kasten liegt -- beide "enthalten" sie,
    // und getByText beschwert sich dann ueber mehrere Treffer.
    const { container } = zeige(<ImpressumPage />)
    const text = container.textContent ?? ''
    for (const angabe of ['TE-Alltagshelfer', 'Thomas Elsen', 'Holbeinstraße 6', '41470 Neuss']) {
      expect(text, `${angabe} fehlt`).toContain(angabe)
    }
    expect(screen.getByRole('link', { name: /te-alltagshelfer@outlook\.de/ }).getAttribute('href'))
      .toBe('mailto:te-alltagshelfer@outlook.de')
  })

  it('nennt die Pflichtangaben nach DDG und MStV', () => {
    zeige(<ImpressumPage />)
    expect(screen.getByText(/§ 5 DDG/)).toBeTruthy()
    expect(screen.getByText(/§ 18 Abs. 2 MStV/)).toBeTruthy()
    expect(screen.getByText(/§ 19 UStG/)).toBeTruthy()
  })

  it('sagt, dass eine Spende nichts freischaltet', () => {
    zeige(<ImpressumPage />)
    expect(screen.getByText(/begründet keinen\s+Vertrag/)).toBeTruthy()
  })
})

describe('Datenschutzerklärung', () => {
  it('nennt die Dienste, die diese App wirklich benutzt', () => {
    zeige(<DatenschutzPage />)
    for (const dienst of ['Supabase', 'Cloudflare', 'PayPal']) {
      expect(screen.getAllByText(new RegExp(dienst)).length).toBeGreaterThan(0)
    }
  })

  it('nennt KEINE Dienste aus dem Familienplaner', () => {
    // Genau der Fehler, der beim Abschreiben passiert wäre.
    const { container } = zeige(<DatenschutzPage />)
    const text = container.textContent ?? ''
    for (const fremd of ['Firebase', 'Firestore', 'WebUntis', 'EmailJS', 'Google Analytics']) {
      expect(text, `${fremd} kommt in dieser App nicht vor`).not.toContain(fremd)
    }
  })

  it('sagt, dass es ohne Konto beim Gerät bleibt', () => {
    const { container } = zeige(<DatenschutzPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('Ohne Konto bleibt alles auf deinem Gerät')
  })

  it('erklärt, was in der Rangliste öffentlich ist und wie man da rauskommt', () => {
    const { container } = zeige(<DatenschutzPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('Benutzername')
    expect(text).toMatch(/Wer keinen Benutzernamen hat, taucht dort\s+nicht auf/)
  })

  it('nennt die Aufsichtsbehörde und die Betroffenenrechte', () => {
    zeige(<DatenschutzPage />)
    expect(screen.getByRole('link', { name: /ldi\.nrw\.de/ })).toBeTruthy()
    expect(screen.getByText(/Art\. 15 DSGVO/)).toBeTruthy()
  })

  it('behauptet kein Tracking, das es nicht gibt — und keins, das es gibt', () => {
    const { container } = zeige(<DatenschutzPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('kein Tracking')
    expect(text).toContain('Cookies setzen wir nicht')
  })
})

describe('Erreichbarkeit von der Startseite', () => {
  it('verlinkt beide Seiten im Fuß', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Impressum' }).getAttribute('href')).toBe('/impressum')
    expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/datenschutz')
  })

  it('die beiden Seiten verlinken einander', () => {
    zeige(<ImpressumPage />)
    expect(screen.getByRole('link', { name: 'Datenschutzerklärung' }).getAttribute('href'))
      .toBe('/datenschutz')
    screen.getByRole('link', { name: '← Zurück' })
  })
})
