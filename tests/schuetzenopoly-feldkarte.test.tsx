/**
 * Die Besitzkarte: Steht wirklich alles darauf?
 *
 * Thomas am 23.09.2026: "das heißt, man soll alle Infos sehen können auf
 * der Karte." Vorher war die Entscheidung (kaufen oder nicht) in einer
 * Leiste unter dem Brett und die Gebührenstaffel in einem Dialog daneben --
 * man entschied über etwas, das man gerade nicht sah.
 *
 * Der Test hält beides fest: dass die Karte die vollständige Auskunft gibt,
 * und dass die Entscheidung auf ihr getroffen wird.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeldKarte } from '@/pages/play/schuetzenopoly/FeldKarte'
import {
  AUSBAU_NAMEN,
  BRETT,
  baukosten,
  erstellePartie,
  grundstueck,
  kaufpreis,
} from '@/games/schuetzenopoly'

function partie() {
  return erstellePartie({
    spieler: [
      { name: 'Du', typ: 'mensch' },
      { name: 'Rechner', typ: 'ki', kiStufe: 'normal' },
    ],
    rundenLimit: 20,
  })
}

/** Das erste kaufbare Grundstück auf dem Brett. */
const grundstueckFeld = BRETT.find((f) => f.typ === 'grundstueck')!

describe('Die Besitzkarte', () => {
  it('zeigt die ganze Gebührenstaffel, den Kaufpreis und die Ausbaukosten', () => {
    const zustand = partie()
    render(<FeldKarte feld={grundstueckFeld} zustand={zustand} onSchliessen={() => {}} />)

    // Alle fünf Ausbaustufen mit ihrem Namen.
    for (const name of AUSBAU_NAMEN) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    // Und die beiden Zahlen, um die es beim Kaufen geht.
    const id = grundstueckFeld.grundstueckId!
    expect(screen.getByText(kaufpreis(id).toLocaleString('de-DE'))).toBeInTheDocument()
    expect(screen.getByText(baukosten(id).toLocaleString('de-DE'))).toBeInTheDocument()
    expect(screen.getByText(/Noch frei/)).toBeInTheDocument()
  })

  it('nennt Stadt, Veranstaltung und den Fakt dazu', () => {
    const zustand = partie()
    render(<FeldKarte feld={grundstueckFeld} zustand={zustand} onSchliessen={() => {}} />)
    const g = grundstueck(grundstueckFeld.grundstueckId!)!
    expect(screen.getByRole('heading', { name: g.stadt })).toBeInTheDocument()
    expect(screen.getByText(g.veranstaltung)).toBeInTheDocument()
    // Der recherchierte Satz gehört zum Spiel: Wer spielt, soll nebenbei
    // etwas über die Feste erfahren.
    expect(screen.getByText(g.fakt)).toBeInTheDocument()
    // Und die Überschrift über der Staffel, damit "Grundstück" nicht zweimal
    // etwas anderes heißt (Stufe null oben, Kaufpreis unten).
    expect(screen.getByText('Standgeld')).toBeInTheDocument()
    expect(screen.getByText('Kaufpreis')).toBeInTheDocument()
  })

  it('trägt die Entscheidung selbst – kaufen oder stehen lassen', async () => {
    const zustand = partie()
    const gekauft = vi.fn()
    render(
      <FeldKarte
        feld={grundstueckFeld}
        zustand={zustand}
        aktionen={
          <button type="button" onClick={gekauft}>
            Kaufen
          </button>
        }
        onSchliessen={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Kaufen' }))
    expect(gekauft).toHaveBeenCalledOnce()
    // Mit Aktionen heißt der Abbruch anders -- die Karte wird weggelegt,
    // nicht ein Dialog geschlossen.
    expect(screen.getByRole('button', { name: 'Karte weglegen' })).toBeInTheDocument()
  })

  it('schließt sich mit der Escape-Taste', async () => {
    const zustand = partie()
    const zu = vi.fn()
    render(<FeldKarte feld={grundstueckFeld} zustand={zustand} onSchliessen={zu} />)
    await userEvent.keyboard('{Escape}')
    expect(zu).toHaveBeenCalled()
  })

  it('erklärt auch die Felder ohne Besitzer', () => {
    const zustand = partie()
    const strafbank = BRETT.find((f) => f.typ === 'zur_strafbank')!
    render(<FeldKarte feld={strafbank} zustand={zustand} onSchliessen={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveTextContent(/Strafbank/)
    // Ohne Aktionen steht dort der schlichte Knopf.
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument()
  })
})
