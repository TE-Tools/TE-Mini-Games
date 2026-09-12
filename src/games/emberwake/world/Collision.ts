import type { Vec2 } from '@/games/emberwake/core/math'

/**
 * Kollision ohne Physik-Engine (ARCHITECTURE.md §2).
 *
 * Statische Hindernisse (Bäume, Felsen, Gebäude) sind Kreise in einem
 * räumlichen Gitter. Bewegliche Kreise werden aus ihnen herausgedrückt.
 * Das ist alles, was ein Survival-Spiel in dieser Perspektive braucht —
 * und es kostet einen Bruchteil einer echten Physik-Engine.
 */
export interface StaticCircle {
  x: number
  z: number
  r: number
}

export class SpatialHash {
  private readonly cells = new Map<number, StaticCircle[]>()
  private readonly cellSize: number
  private readonly cols: number
  private readonly half: number

  constructor(size: number, cellSize = 6) {
    this.cellSize = cellSize
    this.half = size / 2
    this.cols = Math.ceil(size / cellSize) + 2
  }

  private key(cx: number, cz: number): number {
    return cz * this.cols + cx
  }

  private cellOf(v: number): number {
    return Math.floor((v + this.half) / this.cellSize) + 1
  }

  insert(c: StaticCircle): void {
    const x0 = this.cellOf(c.x - c.r)
    const x1 = this.cellOf(c.x + c.r)
    const z0 = this.cellOf(c.z - c.r)
    const z1 = this.cellOf(c.z + c.r)
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cz)
        let bucket = this.cells.get(k)
        if (!bucket) {
          bucket = []
          this.cells.set(k, bucket)
        }
        bucket.push(c)
      }
    }
  }

  clear(): void {
    this.cells.clear()
  }

  /**
   * Drückt einen Kreis aus allen überlappenden statischen Kreisen heraus.
   * Verändert `pos` in place. Gibt zurück, ob eine Korrektur stattfand.
   */
  resolve(pos: Vec2, radius: number): boolean {
    let corrected = false
    const x0 = this.cellOf(pos.x - radius)
    const x1 = this.cellOf(pos.x + radius)
    const z0 = this.cellOf(pos.z - radius)
    const z1 = this.cellOf(pos.z + radius)

    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.cells.get(this.key(cx, cz))
        if (!bucket) continue
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i]!
          const dx = pos.x - c.x
          const dz = pos.z - c.z
          const minD = radius + c.r
          const d2 = dx * dx + dz * dz
          if (d2 >= minD * minD) continue
          const d = Math.sqrt(d2)
          if (d < 1e-5) {
            pos.x += minD
          } else {
            const push = (minD - d) / d
            pos.x += dx * push
            pos.z += dz * push
          }
          corrected = true
        }
      }
    }

    // Weltgrenzen
    const limit = this.half - 1.5
    if (pos.x < -limit) {
      pos.x = -limit
      corrected = true
    }
    if (pos.x > limit) {
      pos.x = limit
      corrected = true
    }
    if (pos.z < -limit) {
      pos.z = -limit
      corrected = true
    }
    if (pos.z > limit) {
      pos.z = limit
      corrected = true
    }

    return corrected
  }

  /** Prüft, ob ein Kreis frei von statischen Hindernissen ist. */
  isFree(x: number, z: number, radius: number): boolean {
    const x0 = this.cellOf(x - radius)
    const x1 = this.cellOf(x + radius)
    const z0 = this.cellOf(z - radius)
    const z1 = this.cellOf(z + radius)
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.cells.get(this.key(cx, cz))
        if (!bucket) continue
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i]!
          const dx = x - c.x
          const dz = z - c.z
          const minD = radius + c.r
          if (dx * dx + dz * dz < minD * minD) return false
        }
      }
    }
    return true
  }
}

/** Abstand eines Punktes von einer Strecke a→b. */
export function distToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const vx = bx - ax
  const vz = bz - az
  const wx = px - ax
  const wz = pz - az
  const len2 = vx * vx + vz * vz
  let t = len2 > 0 ? (wx * vx + wz * vz) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const cx = ax + vx * t - px
  const cz = az + vz * t - pz
  return Math.sqrt(cx * cx + cz * cz)
}
