/**
 * Haptik über die Vibration-API (MOBILE.md §6).
 * iOS Safari unterstützt sie nicht — jede Vibration hat deshalb im Spiel
 * ein optisches und akustisches Gegenstück.
 */
export type HapticPattern = 'gather' | 'hit' | 'hurt' | 'coreLow' | 'death' | 'ui'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  gather: 10,
  hit: 20,
  hurt: 40,
  coreLow: [30, 50, 30],
  death: 200,
  ui: 8,
}

export class Haptics {
  enabled = true
  readonly supported: boolean

  constructor() {
    this.supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  }

  play(pattern: HapticPattern): void {
    if (!this.enabled || !this.supported) return
    try {
      navigator.vibrate(PATTERNS[pattern])
    } catch {
      /* ignorieren */
    }
  }
}
