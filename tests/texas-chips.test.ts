/**
 * Wie ein Betrag zu Jetons wird.
 *
 * Thomas am 14.10.2026: „einen schönen Tisch, dass man an einem Poker
 * Tisch spielt und Geld in die Mitte schmeißt."
 *
 * Gezeichnet wird, was auf dem Tisch läge: grosse Scheiben zuerst. Die
 * Zahl daneben sagt die Wahrheit; der Stapel sagt sie auf einen Blick.
 */
import { describe, it, expect } from 'vitest'
import { CHIP_WERTE, chipStueckelung } from '@/pages/play/texas/chipStueckelung'

describe('Jetons stückeln', () => {
  it('nimmt die grossen Scheiben zuerst', () => {
    expect(chipStueckelung(1000)).toEqual([1000])
    expect(chipStueckelung(1125)).toEqual([1000, 100, 25])
    expect(chipStueckelung(30)).toEqual([25, 5])
  })

  it('zeigt höchstens so viele Scheiben, wie Platz ist', () => {
    // 980 wären sonst neun Scheiben -- auf einem Platz von sechzehn
    // Punkten wäre das ein Fleck, kein Stapel.
    const stapel = chipStueckelung(980, 4)
    expect(stapel).toHaveLength(4)
    expect(stapel).toEqual([500, 100, 100, 100])
  })

  it('zeigt bei kleinen Beträgen wenigstens eine Scheibe', () => {
    expect(chipStueckelung(1)).toEqual([1])
    expect(chipStueckelung(4)).toEqual([1, 1, 1, 1])
  })

  it('zeigt bei null nichts', () => {
    expect(chipStueckelung(0)).toEqual([])
    expect(chipStueckelung(-5)).toEqual([])
  })

  it('kennt nur die üblichen Werte, absteigend', () => {
    expect([...CHIP_WERTE]).toEqual([1000, 500, 100, 25, 5, 1])
    for (const wert of chipStueckelung(1234, 10)) expect(CHIP_WERTE).toContain(wert)
  })
})
