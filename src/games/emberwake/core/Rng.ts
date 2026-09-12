/**
 * Deterministischer Zufallsgenerator (mulberry32).
 *
 * Die gesamte Simulation zieht ihren Zufall ausschließlich hier —
 * niemals aus Math.random(). Gleicher Seed + gleiche Eingaben ergibt
 * exakt gleichen Spielablauf. Das ist die Grundlage für die
 * Balancing-Simulation und automatisierte Level-Tests.
 * Siehe docs/ARCHITECTURE.md §3.1.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9
  }

  /** Gleichverteilte Zahl in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Gleichverteilte Zahl in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** Ganzzahl in [min, max] (beide einschließlich). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Wahr mit Wahrscheinlichkeit p. */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** Zufälliges Element eines nicht-leeren Arrays. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!
  }

  /** Gewichtete Auswahl. weights[i] gehört zu items[i]. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    let total = 0
    for (let i = 0; i < weights.length; i++) total += weights[i]!
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]!
      if (r <= 0) return items[i]!
    }
    return items[items.length - 1]!
  }

  /** Winkel in [0, 2π). */
  angle(): number {
    return this.next() * Math.PI * 2
  }

  /**
   * Abgeleiteter Generator für ein Teilsystem. So kann z. B. die
   * Weltgenerierung ihre Zufallsfolge behalten, auch wenn die KI
   * mehr oder weniger Zufall zieht.
   */
  fork(label: string): Rng {
    return new Rng((this.state ^ Rng.hash(label)) >>> 0)
  }

  /** FNV-1a — stabile Hash-Funktion für Strings, auch für Prüfsummen. */
  static hash(input: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
  }
}
