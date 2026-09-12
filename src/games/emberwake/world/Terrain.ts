import { Rng } from '@/games/emberwake/core/Rng'
import { lerp, smoothstep } from '@/games/emberwake/core/math'

/**
 * Höhenfeld aus seeded Value-Noise.
 *
 * Die Simulation ist 2,5D — sie braucht vom Terrain nur `heightAt`.
 * Das Rendering tastet dieselbe Funktion für sein Mesh ab, damit
 * Spielfiguren exakt auf dem sichtbaren Boden stehen.
 */
export class Terrain {
  private readonly grid: Float32Array
  private readonly gridSize: number
  private readonly cell: number

  constructor(
    readonly size: number,
    readonly elevation: number,
    seed: number,
    /** Radius um das Lager, der flach gehalten wird. */
    private readonly flatRadius = 9,
  ) {
    const rng = new Rng(seed)
    this.cell = 11
    this.gridSize = Math.ceil(size / this.cell) + 3
    this.grid = new Float32Array(this.gridSize * this.gridSize)
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng.next()
  }

  /** Höhe an Weltkoordinate (x, z). Lager liegt bei (0, 0). */
  heightAt(x: number, z: number): number {
    const half = this.size / 2
    const h1 = this.noise((x + half) / this.cell, (z + half) / this.cell)
    const h2 = this.noise(
      (x + half) / (this.cell * 0.45) + 17.3,
      (z + half) / (this.cell * 0.45) + 9.1,
    )
    let h = (h1 - 0.5) * 2 * this.elevation + (h2 - 0.5) * this.elevation * 0.35

    // Lager flach halten, damit Bauplätze und Kampf lesbar bleiben.
    const d = Math.sqrt(x * x + z * z)
    h *= smoothstep(this.flatRadius * 0.6, this.flatRadius * 1.8, d)
    return h
  }

  private noise(u: number, v: number): number {
    const x0 = Math.floor(u)
    const z0 = Math.floor(v)
    const fx = u - x0
    const fz = v - z0
    const sx = fx * fx * (3 - 2 * fx)
    const sz = fz * fz * (3 - 2 * fz)

    const a = this.sample(x0, z0)
    const b = this.sample(x0 + 1, z0)
    const c = this.sample(x0, z0 + 1)
    const d = this.sample(x0 + 1, z0 + 1)

    return lerp(lerp(a, b, sx), lerp(c, d, sx), sz)
  }

  private sample(ix: number, iz: number): number {
    const n = this.gridSize
    const x = ((ix % n) + n) % n
    const z = ((iz % n) + n) % n
    return this.grid[z * n + x]!
  }
}
