/** Wer würde eher?: Das Ergebnis wird ausgezählt -- Balken nacheinander, dann die Krone. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderAufDeutsch } from './aufDeutsch'
import type * as Ton from '@/services/sound'

const ton = vi.hoisted(() => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/services/sound', async (original) => ({ ...(await original<typeof Ton>()), ...ton }))

const { Auszaehlung, BALKEN_ABSTAND_MS } = await import('@/pages/play/party/Auszaehlung')
const { WerWuerdeEherPage } = await import('@/pages/play/WerWuerdeEherPage')

beforeEach(() => {
  vi.useFakeTimers()
  ton.spiele.mockClear()
})
afterEach(() => vi.useRealTimers())

const zeilen = [
  { id: 'p1', label: 'Thomas', stimmen: 1 },
  { id: 'p2', label: 'Marina', stimmen: 3 },
  { id: 'p3', label: 'Sonja', stimmen: 0 },
]

describe('Auszählung', () => {
  it('tickt je Balken einmal und jubelt erst am Ende -- bei einem klaren Sieger', () => {
    render(<Auszaehlung zeilen={zeilen} sieger={['p2']} ueberschrift="Marina – ganz klar" />)
    act(() => vi.advanceTimersByTime(BALKEN_ABSTAND_MS * 2 + 200))
    expect(ton.spiele.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick'])
    act(() => vi.advanceTimersByTime(BALKEN_ABSTAND_MS * 2))
    expect(ton.spiele.mock.calls.map((c) => c[0])).toEqual(['tick', 'tick', 'tick', 'erfolg'])
  })

  it('die Krone bekommt nur der Sieger, die Reihenfolge bleibt die Sitzordnung', () => {
    render(<Auszaehlung zeilen={zeilen} sieger={['p2']} ueberschrift="Marina – ganz klar" />)
    const reihen = screen.getAllByRole('listitem')
    expect(reihen.map((r) => r.textContent)).toEqual(['TThomas1', 'M👑Marina3', 'SSonja0'])
    expect(reihen[1]).toHaveAttribute('data-sieger')
    expect(document.querySelectorAll('[data-sieger]')).toHaveLength(1)
  })

  it('bei Gleichstand: keine Krone und kein Jubel', () => {
    render(<Auszaehlung zeilen={zeilen} sieger={['p1', 'p2']} ueberschrift="Unentschieden" />)
    act(() => vi.advanceTimersByTime(BALKEN_ABSTAND_MS * 10))
    expect(screen.queryByText('👑')).toBeNull()
    expect(ton.spiele).not.toHaveBeenCalledWith('erfolg')
    expect(ton.spiele).toHaveBeenLastCalledWith('knopf')
  })

  it('wer vor dem Ende weggeht, hört nichts mehr', () => {
    const { unmount } = render(
      <Auszaehlung zeilen={zeilen} sieger={['p2']} ueberschrift="Marina – ganz klar" />,
    )
    unmount()
    act(() => vi.advanceTimersByTime(BALKEN_ABSTAND_MS * 10))
    expect(ton.spiele).not.toHaveBeenCalled()
  })
})

describe('Wer würde eher?: Ergebnis auf der Seite', () => {
  it('alle stimmen für Ben -- Ben bekommt die Krone, die Überschrift nennt ihn', () => {
    renderAufDeutsch(
      <MemoryRouter>
        <WerWuerdeEherPage />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Anna\nBen\nCarla' } })
    // Nur Personenfragen -- dann wird für Mitspieler gestimmt.
    fireEvent.click(screen.getByRole('button', { name: /Was wäre dir lieber/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Losspielen' }))
    for (const name of ['Anna', 'Ben', 'Carla']) {
      fireEvent.click(screen.getByRole('button', { name: `Ich bin ${name}` }))
      fireEvent.click(screen.getByRole('button', { name: /^Ben/ }))
    }
    expect(screen.getByRole('heading', { name: 'Ben – ganz klar' })).toBeInTheDocument()
    const sieger = document.querySelector('[data-sieger]')!
    expect(sieger.textContent).toBe('B👑Ben3')
  })
})
