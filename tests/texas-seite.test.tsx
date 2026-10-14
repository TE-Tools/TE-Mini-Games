/**
 * Die Pokerseite: Kommt ein Mensch von „Los geht's" bis zu einer
 * Entscheidung, und zeigt sie dabei die Wahrheit an?
 *
 * Die Regeln stehen in der Engine und werden dort geprüft. Hier geht es
 * nur um das, was die Seite daraus macht: dass sie nicht mehr Knöpfe
 * anbietet, als erlaubt ist, dass die eigenen Karten offen und die der
 * Gegner verdeckt liegen, und dass der Topf stimmt.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const { TexasHoldemPage } = await import('@/pages/play/TexasHoldemPage')

/**
 * Wartet, bis ich an der Reihe bin.
 *
 * Dazwischen kann eine ganze Hand vergehen: Wirft der Rechner vor dem
 * Flop weg, gewinne ich die Blinds, ohne eine Entscheidung getroffen zu
 * haben -- dann steht da „Nächste Hand" statt der Einsatzleiste.
 */
async function binDran(): Promise<HTMLElement> {
  for (let versuch = 0; versuch < 12; versuch++) {
    const leiste = screen.queryByRole('button', { name: 'Wegwerfen' })
    if (leiste) return leiste
    const weiter = screen.queryByRole('button', { name: 'Nächste Hand' })
    if (weiter) await userEvent.click(weiter)
    else await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('Ich bin nicht an die Reihe gekommen')
}

async function anDenTisch(gegner = 1) {
  render(
    <MemoryRouter>
      <TexasHoldemPage />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: /Turnier gegen den Rechner/ }))
  await userEvent.click(screen.getByRole('button', { name: String(gegner) }))
  await userEvent.click(screen.getByRole('button', { name: /Los geht/ }))
}

describe('Vom Menü an den Tisch', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('sagt im Menü, dass mit Spielgeld gespielt wird', () => {
    render(
      <MemoryRouter>
        <TexasHoldemPage />
      </MemoryRouter>,
    )
    // Der Satz ist keine Zierde: Er ist der Unterschied zwischen einem
    // Kartenspiel und einem Glücksspielangebot.
    expect(screen.getByText(/nichts zu kaufen und nichts zu gewinnen/)).toBeInTheDocument()
  })

  it('deckt die eigenen Karten auf und die der Gegner nicht', async () => {
    await anDenTisch(1)

    const meine = await screen.findByLabelText('Deine Karten')
    const offen = within(meine).getAllByRole('img')
    expect(offen).toHaveLength(2)
    for (const karte of offen) {
      expect(karte.getAttribute('aria-label')).not.toBe('verdeckte Karte')
    }

    // Die Karten des Gegners liegen verdeckt -- auch im DOM steht nur
    // „verdeckte Karte", damit sie niemand ausliest.
    const verdeckte = screen.getAllByLabelText('verdeckte Karte')
    expect(verdeckte.length).toBeGreaterThanOrEqual(2)
  })

  it('zeigt den Topf aus den Blinds und fünf leere Plätze', async () => {
    await anDenTisch(1)
    // Heads-up: 10 und 20 liegen vor dem ersten Zug im Topf.
    expect(await screen.findByText('30')).toBeInTheDocument()
    expect(screen.getByText('im Topf')).toBeInTheDocument()
    const mitte = screen.getByLabelText('Tischmitte')
    expect(within(mitte).getByText(/Hand 1 · Blinds 10\/20/)).toBeInTheDocument()
    // Fünf Plätze für die Gemeinschaftskarten, alle noch leer.
    const board = screen.getByLabelText('Gemeinschaftskarten')
    expect(within(board).queryAllByRole('img')).toHaveLength(0)
    expect(board.childElementCount).toBe(5)
  })

  it('bietet nur an, was erlaubt ist', async () => {
    await anDenTisch(1)
    await binDran()

    // Entweder fehlt etwas zum Mitgehen, oder es ist frei -- beides
    // zugleich darf die Leiste nie anbieten.
    const mitgehen = screen.queryByRole('button', { name: /Mitgehen/ })
    const schieben = screen.queryByRole('button', { name: 'Schieben' })
    expect(Boolean(mitgehen) !== Boolean(schieben)).toBe(true)
    expect(screen.getByRole('button', { name: 'Wegwerfen' })).toBeEnabled()
  })

  it('führt vom Erhöhen-Knopf zum Schieberegler und zurück', async () => {
    await anDenTisch(1)
    await binDran()
    const erhoehen = screen.getByRole('button', { name: /^(Erhöhen|Setzen)$/ })
    expect(erhoehen).toBeEnabled()

    await userEvent.click(erhoehen)
    // Ein verrutschter All-in ist nicht zurückzunehmen -- deshalb liegt
    // das Erhöhen hinter einem zweiten Schritt, mit einem Weg zurück.
    expect(screen.getByLabelText('Einsatz wählen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Erhöhen auf \d+/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByLabelText('Einsatz wählen')).not.toBeInTheDocument()
  })

  it('beendet die Hand, wenn ich wegwerfe, und bietet die nächste an', async () => {
    await anDenTisch(1)
    const weg = await binDran()
    await userEvent.click(weg)

    expect(
      await screen.findByRole('button', { name: 'Nächste Hand' }, { timeout: 6000 }),
    ).toBeInTheDocument()
    // Wer alle anderen zum Wegwerfen bringt, gewinnt ohne zu zeigen --
    // die Ansage steht gut sichtbar über den eigenen Karten.
    const ansage = screen.getByRole('status')
    expect(ansage.textContent).toMatch(/gewinnt \d+/)
    expect(ansage.textContent).not.toMatch(/mit /)
  })
})
