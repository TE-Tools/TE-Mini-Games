/** Die Sterne am Ende einer Runde: voll und leer, nacheinander, mit Ton. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

const ton = vi.hoisted(() => ({ spiele: vi.fn() }))
vi.mock('@/services/sound', () => ton)

const { Sterne, STERN_ABSTAND_MS } = await import('@/components/sterne/Sterne')

beforeEach(() => {
  vi.useFakeTimers()
  ton.spiele.mockClear()
})
afterEach(() => vi.useRealTimers())

describe('Sterne', () => {
  it('drei von fünf: drei volle, zwei leere, vorgelesen als Satz', () => {
    render(<Sterne anzahl={3} label="3 von 5 Sternen" />)
    expect(screen.getByRole('img', { name: '3 von 5 Sternen' })).toBeInTheDocument()
    expect(document.querySelectorAll('svg[data-voll]')).toHaveLength(3)
    expect(document.querySelectorAll('svg')).toHaveLength(5)
  })

  it('jeder volle Stern kommt etwas später als der vorige, jeder mit einem Ton', () => {
    render(<Sterne anzahl={3} label="x" />)
    const verzoegerung = [...document.querySelectorAll<SVGElement>('svg[data-voll]')].map((s) =>
      parseInt(s.style.animationDelay, 10),
    )
    expect(verzoegerung[1]! - verzoegerung[0]!).toBe(STERN_ABSTAND_MS)
    expect(verzoegerung[2]! - verzoegerung[1]!).toBe(STERN_ABSTAND_MS)
    expect(ton.spiele).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(250))
    expect(ton.spiele).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(2 * STERN_ABSTAND_MS))
    expect(ton.spiele).toHaveBeenCalledTimes(3)
    expect(ton.spiele).toHaveBeenCalledWith('muenze')
  })

  it('ohne Stern kein Ton', () => {
    render(<Sterne anzahl={0} label="0 von 5 Sternen" />)
    act(() => vi.advanceTimersByTime(3000))
    expect(ton.spiele).not.toHaveBeenCalled()
    expect(document.querySelectorAll('svg[data-voll]')).toHaveLength(0)
  })
})
