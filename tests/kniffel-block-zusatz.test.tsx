/**
 * Der Zusatzkniffel im Block.
 *
 * Die Regel steht in tests/kniffel-regeln.test.ts, der Ablauf in
 * tests/kniffel.test.ts. Hier geht es um die Zeile im Block -- und darum,
 * dass die Spalte aufgeht: Wer nachrechnet, soll auf dieselbe Endsumme
 * kommen wie das Spiel. Genau das ginge schief, wenn der Bonus in der
 * Endsumme stünde, aber in keiner Zwischensumme.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  KATEGORIE_IDS,
  KNIFFEL_PUNKTE,
  ZUSATZ_KNIFFEL_PUNKTE,
  bonus,
  gesamtpunkte,
  leererBlock,
  obenSumme,
  type Block,
} from '@/games/kniffel'
import { Kniffelblock } from '@/pages/play/kniffel/Kniffelblock'

function spalte(block: Block) {
  return [{ id: 'p0', name: 'Ich', block, ichSelbst: true, amZug: false }]
}

function zeige(block: Block) {
  render(
    <Kniffelblock spalten={spalte(block)} wuerfel={[]} eintragbar={false} onEintragen={() => {}} />,
  )
}

/** Die Zahl in der Zeile mit diesem Namen. */
function wertIn(name: string | RegExp): string {
  const zeile = screen.getByRole('row', { name: new RegExp(name) })
  const zellen = zeile.querySelectorAll('td')
  return zellen[zellen.length - 1]?.textContent?.trim() ?? ''
}

describe('Zusatzkniffel im Block', () => {
  it('zeigt einen Strich, solange es keinen gab', () => {
    zeige(leererBlock())
    expect(wertIn('Zusatzkniffel')).toBe('–')
  })

  it('zeigt die Punkte und bei mehreren die Anzahl', () => {
    zeige({ ...leererBlock(), kniffel: KNIFFEL_PUNKTE, zusatzkniffel: 300 })
    expect(wertIn('Zusatzkniffel')).toMatch(/\+300/)
    expect(wertIn('Zusatzkniffel')).toMatch(/3×/)
  })

  it('nennt die Regel, auch wenn noch keiner kam', () => {
    zeige(leererBlock())
    expect(screen.getByText(new RegExp(`${ZUSATZ_KNIFFEL_PUNKTE} Punkte`))).toBeInTheDocument()
  })

  it('rechnet die Spalte auf: oben + Bonus + unten = Gesamt', () => {
    // Ein voller Block mit zwei Zusatzkniffeln.
    const block = {} as Block
    for (const id of KATEGORIE_IDS) block[id] = 3
    block.kniffel = KNIFFEL_PUNKTE
    block.zusatzkniffel = 2 * ZUSATZ_KNIFFEL_PUNKTE
    zeige(block)

    const zahlen = screen.getAllByRole('row', { name: /Zwischensumme/ })
    const untenZeile = zahlen[zahlen.length - 1]!
    const untenGezeigt = Number(untenZeile.querySelectorAll('td')[0]?.textContent)
    const obenGezeigt = Number(zahlen[0]!.querySelectorAll('td')[0]?.textContent)
    expect(obenGezeigt).toBe(obenSumme(block))

    // Die untere Zwischensumme enthält den Bonus -- wie auf dem Papier.
    expect(obenGezeigt + bonus(block) + untenGezeigt).toBe(gesamtpunkte(block))
    expect(screen.getByText(String(gesamtpunkte(block)))).toBeInTheDocument()
  })
})
