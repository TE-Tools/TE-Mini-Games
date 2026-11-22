/** Scharade: Begriffe fliegen weg -- nach oben bei Richtig, zur Seite beim Weiter. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderAufDeutsch as render } from './aufDeutsch'
import type * as Ton from '@/services/sound'

const ton = vi.hoisted(() => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/services/sound', async (original) => ({ ...(await original<typeof Ton>()), ...ton }))

const { ScharadePage } = await import('@/pages/play/ScharadePage')

beforeEach(() => {
  vi.useFakeTimers()
  for (const f of Object.values(ton)) f.mockClear()
})
afterEach(() => vi.useRealTimers())

const begriff = () => document.querySelector('[class*="wordBox"]:not([aria-hidden]) p')!.textContent
const fliegt = () => document.querySelector('[aria-hidden="true"][class*="weg"]')

function losGehts() {
  fireEvent.click(screen.getByRole('button', { name: /Los geht/ }))
}

describe('Scharade: Karten fliegen', () => {
  it('Richtig: der alte Begriff fliegt nach oben, mit +1 und Ton', () => {
    render(
      <MemoryRouter>
        <ScharadePage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Losspielen' }))
    losGehts()
    const erster = begriff()
    expect(fliegt()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Richtig/ }))
    expect(fliegt()!.className).toMatch(/wegRichtig/)
    expect(fliegt()!.textContent).toBe(erster)
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(ton.spiele).toHaveBeenCalledWith('treffer')

    const zweiter = begriff()
    fireEvent.click(screen.getByRole('button', { name: /Weiter/ }))
    expect(fliegt()!.className).toMatch(/wegWeiter/)
    expect(fliegt()!.textContent).toBe(zweiter)
    expect(screen.queryByText('+1')).toBeNull()
  })

  it('beim nächsten Zug fliegt nicht noch einmal der alte Begriff weg', () => {
    render(
      <MemoryRouter>
        <ScharadePage />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Losspielen' }))
    losGehts()
    fireEvent.click(screen.getByRole('button', { name: /Richtig/ }))
    act(() => vi.advanceTimersByTime(61_000))
    // Zeit um -- weiter zur nächsten Person, bis wieder ein Begriff dasteht.
    for (let i = 0; i < 3 && !screen.queryByRole('button', { name: /Los geht/ }); i++) {
      const weiter = screen
        .queryAllByRole('button')
        .find((b) => /Weiter|Nächste/.test(b.textContent ?? ''))
      if (weiter) fireEvent.click(weiter)
    }
    losGehts()
    expect(fliegt()).toBeNull()
  })
})
