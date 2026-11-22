/** Das Spielerbild bei der Übergabe in den Partyspielen. */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Spielerbild } from '@/pages/play/party/Spielerbild'
import { anfang, farbeFuer } from '@/pages/play/party/spielerFarbe'

describe('Spielerbild', () => {
  it('dieselbe Person hat immer dieselbe Farbe -- auch mit Leerzeichen oder großgeschrieben', () => {
    expect(farbeFuer('Marina')).toEqual(farbeFuer(' marina '))
    // Bei vier Leuten sollen nicht alle gleich aussehen.
    const farben = new Set(['Thomas', 'Marina', 'Phillip', 'Sonja'].map((n) => farbeFuer(n)[0]))
    expect(farben.size).toBeGreaterThan(1)
  })

  it('zeigt den ersten Buchstaben, auch wenn der Name mit einem Emoji beginnt', () => {
    expect(anfang('thomas')).toBe('T')
    expect(anfang('🎯 Lena')).toBe('L')
    expect(anfang('  Ömer')).toBe('Ö')
    expect(anfang('')).toBe('?')
    const { container } = render(<Spielerbild name="Sonja" />)
    expect(container.textContent).toBe('S')
    expect(container.firstElementChild!.getAttribute('style')).toContain('linear-gradient')
  })
})
