import * as THREE from 'three'
import { Rng } from '@/games/emberwake/core/Rng'

/**
 * Gepoolte Partikel als ein einziges Points-Objekt — ein Draw Call.
 * Budget kommt aus der Qualitätsstufe (PERFORMANCE.md §4).
 * Rein visuell, deshalb darf hier ein eigener RNG laufen.
 */
export class Particles {
  readonly points: THREE.Points
  private readonly positions: Float32Array
  private readonly colors: Float32Array
  private readonly velocities: Float32Array
  private readonly life: Float32Array
  private readonly maxLife: Float32Array
  private readonly geometry: THREE.BufferGeometry
  private readonly material: THREE.PointsMaterial
  private readonly rng = new Rng(0xc0ffee)
  private cursor = 0
  private readonly color = new THREE.Color()

  constructor(readonly capacity: number) {
    this.positions = new Float32Array(capacity * 3)
    this.colors = new Float32Array(capacity * 3)
    this.velocities = new Float32Array(capacity * 3)
    this.life = new Float32Array(capacity)
    this.maxLife = new Float32Array(capacity)

    this.geometry = new THREE.BufferGeometry()
    const pos = new THREE.BufferAttribute(this.positions, 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    const col = new THREE.BufferAttribute(this.colors, 3)
    col.setUsage(THREE.DynamicDrawUsage)
    this.geometry.setAttribute('position', pos)
    this.geometry.setAttribute('color', col)
    this.geometry.setDrawRange(0, capacity)

    this.material = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false

    // Alle Partikel weit unter den Boden, damit sie unsichtbar starten
    for (let i = 0; i < capacity; i++) this.positions[i * 3 + 1] = -100
  }

  burst(
    x: number,
    y: number,
    z: number,
    hex: number,
    count: number,
    speed = 1.8,
    lifeSeconds = 0.6,
    upward = 1.5,
  ): void {
    this.color.setHex(hex)
    for (let n = 0; n < count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.capacity
      const a = this.rng.angle()
      const s = speed * (0.4 + this.rng.next() * 0.8)
      this.positions[i * 3] = x + (this.rng.next() - 0.5) * 0.3
      this.positions[i * 3 + 1] = y + this.rng.next() * 0.3
      this.positions[i * 3 + 2] = z + (this.rng.next() - 0.5) * 0.3
      this.velocities[i * 3] = Math.cos(a) * s
      this.velocities[i * 3 + 1] = upward * (0.6 + this.rng.next())
      this.velocities[i * 3 + 2] = Math.sin(a) * s
      const l = lifeSeconds * (0.6 + this.rng.next() * 0.7)
      this.life[i] = l
      this.maxLife[i] = l
      const bright = 0.8 + this.rng.next() * 0.4
      this.colors[i * 3] = this.color.r * bright
      this.colors[i * 3 + 1] = this.color.g * bright
      this.colors[i * 3 + 2] = this.color.b * bright
    }
  }

  /** Sanft aufsteigende Glut um einen Punkt (Kern, Laterne). */
  ember(x: number, y: number, z: number, hex: number, radius: number): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.capacity
    const a = this.rng.angle()
    const r = radius * Math.sqrt(this.rng.next())
    this.positions[i * 3] = x + Math.cos(a) * r
    this.positions[i * 3 + 1] = y
    this.positions[i * 3 + 2] = z + Math.sin(a) * r
    this.velocities[i * 3] = (this.rng.next() - 0.5) * 0.3
    this.velocities[i * 3 + 1] = 0.6 + this.rng.next() * 0.6
    this.velocities[i * 3 + 2] = (this.rng.next() - 0.5) * 0.3
    const l = 1.2 + this.rng.next()
    this.life[i] = l
    this.maxLife[i] = l
    this.color.setHex(hex)
    this.colors[i * 3] = this.color.r
    this.colors[i * 3 + 1] = this.color.g
    this.colors[i * 3 + 2] = this.color.b
  }

  update(dt: number): void {
    const p = this.positions
    const v = this.velocities
    const c = this.colors
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i]! <= 0) continue
      this.life[i]! -= dt
      if (this.life[i]! <= 0) {
        p[i * 3 + 1] = -100
        continue
      }
      v[i * 3 + 1]! -= 2.2 * dt
      p[i * 3]! += v[i * 3]! * dt
      p[i * 3 + 1]! += v[i * 3 + 1]! * dt
      p[i * 3 + 2]! += v[i * 3 + 2]! * dt
      const fade = this.life[i]! / this.maxLife[i]!
      const k = fade < 0.35 ? fade / 0.35 : 1
      // Ausblenden über die Farbe (additiv → dunkel = unsichtbar)
      if (k < 1) {
        c[i * 3]! *= 1 - dt * 6
        c[i * 3 + 1]! *= 1 - dt * 6
        c[i * 3 + 2]! *= 1 - dt * 6
      }
    }
    ;(this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
