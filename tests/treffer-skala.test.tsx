/** Die Treffer-Skala der perfekten Sekunde. */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { TrefferSkala } from '@/pages/play/sekunde/TrefferSkala'

const marke = (zeit: number) => {
  const { container, unmount } = render(
    <TrefferSkala zeit={zeit} ziel={1.5} toleranz={0.1} zuFrueh="zu früh" zuSpaet="zu spät" />,
  )
  const wert = Number(container.querySelector('[data-marke]')!.getAttribute('data-marke'))
  unmount()
  return wert
}

describe('Treffer-Skala', () => {
  it('genau getroffen steht die Marke in der Mitte, zu früh links, zu spät rechts', () => {
    expect(marke(1.5)).toBe(0.5)
    expect(marke(1.4)).toBeCloseTo(0.5 - 1 / 6, 3)
    expect(marke(1.6)).toBeCloseTo(0.5 + 1 / 6, 3)
  })

  it('weit daneben bleibt die Marke am Rand, statt aus der Skala zu laufen', () => {
    expect(marke(0.2)).toBe(0)
    expect(marke(9)).toBe(1)
  })

  it('der grüne Bereich ist so breit wie die Toleranz nach beiden Seiten', () => {
    const { container } = render(
      <TrefferSkala zeit={1.5} ziel={1.5} toleranz={0.1} zuFrueh="a" zuSpaet="b" />,
    )
    const band = container.querySelector<HTMLElement>('[class*="band"]')!
    expect(parseFloat(band.style.width)).toBeCloseTo(100 / 3, 1)
    expect(parseFloat(band.style.left)).toBeCloseTo(100 / 3, 1)
  })
})
