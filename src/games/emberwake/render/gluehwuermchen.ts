import * as THREE from 'three'
import { Rng } from '@/games/emberwake/core/Rng'
import { glow } from './atmosphere'

/**
 * Glühwürmchen in der Dämmerung und nachts (27.11.2026).
 *
 * Rein Stimmung: Sie schweben in einem Kreis um den Spieler, jedes auf
 * einer eigenen langsamen Bahn, und glimmen einzeln auf und ab. Ein
 * Points-Objekt, ein Draw Call; am Tag unsichtbar und ohne Arbeit. Die
 * Simulation weiß nichts von ihnen.
 */
const RADIUS = 13

interface Hoehe {
  heightAt(x: number, z: number): number
}

export class Gluehwuermchen {
  readonly points: THREE.Points
  private readonly pos: Float32Array
  private readonly farbe: Float32Array
  private readonly basis: Float32Array
  private readonly phase: Float32Array
  private readonly material: THREE.PointsMaterial

  constructor(private readonly anzahl: number) {
    const rng = new Rng(0xf1e5)
    this.pos = new Float32Array(Math.max(1, anzahl) * 3)
    this.farbe = new Float32Array(Math.max(1, anzahl) * 3)
    this.basis = new Float32Array(Math.max(1, anzahl) * 2)
    this.phase = new Float32Array(Math.max(1, anzahl) * 2)
    for (let i = 0; i < anzahl; i++) {
      const a = rng.angle()
      const r = RADIUS * Math.sqrt(rng.next())
      this.basis[i * 2] = Math.cos(a) * r
      this.basis[i * 2 + 1] = Math.sin(a) * r
      this.phase[i * 2] = rng.next() * 100
      this.phase[i * 2 + 1] = 0.6 + rng.next() * 0.9
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.farbe, 3))
    this.material = new THREE.PointsMaterial({
      map: glow(),
      size: 0.22,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
    this.points.visible = false
  }

  /** `nacht`: 0 am Tag, 1 in tiefer Nacht. */
  update(zeit: number, px: number, pz: number, nacht: number, boden: Hoehe): void {
    const sichtbar = this.anzahl > 0 && nacht > 0.35
    this.points.visible = sichtbar
    if (!sichtbar) return
    const staerke = Math.min(1, (nacht - 0.35) / 0.35)
    for (let i = 0; i < this.anzahl; i++) {
      const ph = this.phase[i * 2]!
      const tempo = this.phase[i * 2 + 1]!
      const t = zeit * tempo * 0.25 + ph
      // Die Basis wandert mit dem Spieler; wer zu weit hinten liegt, springt nach vorn.
      let bx = this.basis[i * 2]!
      let bz = this.basis[i * 2 + 1]!
      const rx = ((((bx - px + RADIUS) % (2 * RADIUS)) + 2 * RADIUS) % (2 * RADIUS)) - RADIUS
      const rz = ((((bz - pz + RADIUS) % (2 * RADIUS)) + 2 * RADIUS) % (2 * RADIUS)) - RADIUS
      bx = px + rx
      bz = pz + rz
      const x = bx + Math.sin(t * 1.3) * 1.2
      const z = bz + Math.cos(t * 0.9) * 1.2
      this.pos[i * 3] = x
      this.pos[i * 3 + 1] = boden.heightAt(x, z) + 0.6 + Math.sin(t * 2.1) * 0.35 + 0.4
      this.pos[i * 3 + 2] = z
      const glimmen = Math.max(0, Math.sin(zeit * tempo * 2.4 + ph * 7)) ** 3
      const k = glimmen * staerke * 1.6
      this.farbe[i * 3] = 0.75 * k
      this.farbe[i * 3 + 1] = 1.0 * k
      this.farbe[i * 3 + 2] = 0.35 * k
    }
    ;(this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.material.dispose()
  }
}
