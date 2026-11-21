/**
 * Die Wortbombe auf dem Bildschirm: Bombe, Ticken, Knall.
 *
 * Das Ticken muss gleichmäßig bleiben -- würde es schneller, verriete es,
 * wann die Bombe hochgeht, und genau das soll niemand wissen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderAufDeutsch as render } from './aufDeutsch'

const ton = vi.hoisted(() => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/services/sound', () => ton)

const { WortbombePage } = await import('@/pages/play/WortbombePage')

beforeEach(() => {
  vi.useFakeTimers()
  ton.spiele.mockClear()
  ton.vibriere.mockClear()
})
afterEach(() => vi.useRealTimers())

function zuenden() {
  render(
    <MemoryRouter>
      <WortbombePage />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Zünden' }))
}

const ticks = () => ton.spiele.mock.calls.filter(([k]) => k === 'tick').length

describe('Wortbombe auf dem Bildschirm', () => {
  it('zeigt die Bombe und tickt im Sekundentakt, nicht schneller', () => {
    zuenden()
    expect(document.querySelector('svg circle[fill="url(#bombe-koerper)"]')).not.toBeNull()
    // Solange die Bombe tickt, ist niemand getroffen -- auch nicht, wer sie gerade hält.
    expect(document.querySelectorAll('li[class*="getroffen"]')).toHaveLength(0)
    act(() => vi.advanceTimersByTime(3000))
    expect(ticks()).toBe(3)
    // Auch kurz vor dem frühesten Knall (10 s) bleibt es bei einem Ticken je Sekunde.
    act(() => vi.advanceTimersByTime(6000))
    expect(ticks()).toBe(9)
  })

  it('beim Weiterreichen fliegt die Bombe neu herein', () => {
    zuenden()
    const vorher = document.querySelector('svg')!.parentElement!
    fireEvent.click(screen.getByRole('button', { name: /Gesagt/ }))
    expect(ton.spiele).toHaveBeenCalledWith('knopf')
    // Ein neuer Wurf ist ein neues Element -- so startet die Animation von vorn.
    expect(document.querySelector('svg')!.parentElement).not.toBe(vorher)
  })

  it('der Knall: Explosion, Ton, Rütteln, und der Getroffene leuchtet auf', () => {
    zuenden()
    act(() => vi.advanceTimersByTime(26000))
    expect(screen.getByText(/hatte sie!/)).toBeInTheDocument()
    expect(document.querySelector('polygon[fill="url(#knall-feuer)"]')).not.toBeNull()
    expect(ton.spiele).toHaveBeenCalledWith('knall')
    expect(ton.vibriere).toHaveBeenCalled()
    expect(document.querySelectorAll('li[class*="getroffen"]')).toHaveLength(1)
    // Nach dem Knall tickt nichts mehr.
    const jetzt = ticks()
    act(() => vi.advanceTimersByTime(3000))
    expect(ticks()).toBe(jetzt)
  })
})
