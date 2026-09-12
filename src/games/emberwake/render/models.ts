import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Rng } from '@/games/emberwake/core/Rng'

/**
 * Prozedurale Low-Poly-Modelle mit Vertex-Farben.
 * Keine Texturen, keine Modelldateien (ARCHITECTURE.md §6).
 * Jede Funktion liefert EINE Geometrie — damit ein Typ ein Draw Call bleibt.
 */

const color = new THREE.Color()

function paint(
  geo: THREE.BufferGeometry,
  hex: number,
  jitter = 0,
  rng?: Rng,
): THREE.BufferGeometry {
  const count = geo.attributes.position!.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    color.setHex(hex)
    if (jitter > 0 && rng) {
      const j = 1 + (rng.next() - 0.5) * jitter
      color.multiplyScalar(j)
    }
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

function jitterVertices(geo: THREE.BufferGeometry, amount: number, rng: Rng): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng.next() - 0.5) * amount,
      pos.getY(i) + (rng.next() - 0.5) * amount,
      pos.getZ(i) + (rng.next() - 0.5) * amount,
    )
  }
  pos.needsUpdate = true
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nonIndexed = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const merged = mergeGeometries(nonIndexed, false)
  if (!merged) throw new Error('mergeGeometries fehlgeschlagen')
  merged.computeVertexNormals()
  for (const p of nonIndexed) p.dispose()
  return merged
}

/** Vertex-Farben-Material — alle Modelle teilen sich diese Instanz. */
export function vertexMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
}

// ---------------------------------------------------------------------------

export function treeGeometry(
  trunkColor: number,
  canopyColor: number,
  canopyDark: number,
  variant: number,
): THREE.BufferGeometry {
  const rng = new Rng(1000 + variant)
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 5, 1)
  trunk.translate(0, 0.8, 0)
  paint(trunk, trunkColor, 0.15, rng)

  const parts: THREE.BufferGeometry[] = [trunk]
  const tiers = 2 + variant
  for (let i = 0; i < tiers; i++) {
    const t = i / Math.max(1, tiers - 1)
    const radius = 1.25 - t * 0.55
    const height = 1.5 - t * 0.3
    const cone = new THREE.ConeGeometry(radius, height, 6, 1)
    cone.translate(0, 1.5 + i * 0.85, 0)
    jitterVertices(cone, 0.12, rng)
    paint(cone, i % 2 === 0 ? canopyColor : canopyDark, 0.18, rng)
    parts.push(cone)
  }
  return merge(parts)
}

export function rockGeometry(rockColor: number, variant: number): THREE.BufferGeometry {
  const rng = new Rng(2000 + variant)
  const geo = new THREE.DodecahedronGeometry(0.7, 0)
  jitterVertices(geo, 0.28, rng)
  geo.scale(1, 0.65 + rng.next() * 0.3, 1)
  geo.translate(0, 0.3, 0)
  paint(geo, rockColor, 0.22, rng)
  return merge([geo])
}

/** Zunderholz: ein Stapel gebleichter Äste. */
export function woodNodeGeometry(): THREE.BufferGeometry {
  const rng = new Rng(3001)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const log = new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5, 1)
    log.rotateZ(Math.PI / 2)
    log.rotateY(rng.range(-0.5, 0.5))
    log.translate(rng.range(-0.15, 0.15), 0.1 + i * 0.16, rng.range(-0.15, 0.15))
    paint(log, 0xb8895a, 0.2, rng)
    parts.push(log)
  }
  return merge(parts)
}

/** Kernstein: kleine Gruppe grauer Brocken mit heller Ader. */
export function stoneNodeGeometry(): THREE.BufferGeometry {
  const rng = new Rng(3002)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 3; i++) {
    const s = 0.3 + rng.next() * 0.2
    const rock = new THREE.DodecahedronGeometry(s, 0)
    jitterVertices(rock, 0.1, rng)
    rock.translate(rng.range(-0.3, 0.3), s * 0.7, rng.range(-0.3, 0.3))
    paint(rock, i === 0 ? 0xa9b0bf : 0x7d8493, 0.15, rng)
    parts.push(rock)
  }
  return merge(parts)
}

/** Nahrung: ein Busch mit hellen Beeren. */
export function foodNodeGeometry(): THREE.BufferGeometry {
  const rng = new Rng(3003)
  const bush = new THREE.IcosahedronGeometry(0.5, 0)
  jitterVertices(bush, 0.12, rng)
  bush.translate(0, 0.45, 0)
  paint(bush, 0x4f7a4a, 0.2, rng)
  const parts: THREE.BufferGeometry[] = [bush]
  for (let i = 0; i < 6; i++) {
    const berry = new THREE.IcosahedronGeometry(0.07, 0)
    const a = rng.angle()
    berry.translate(Math.cos(a) * 0.42, 0.45 + rng.range(-0.25, 0.3), Math.sin(a) * 0.42)
    paint(berry, 0xd9e07a)
    parts.push(berry)
  }
  return merge(parts)
}

export function genericNodeGeometry(hex: number): THREE.BufferGeometry {
  const rng = new Rng(3009)
  const geo = new THREE.OctahedronGeometry(0.35, 0)
  geo.translate(0, 0.45, 0)
  paint(geo, hex, 0.1, rng)
  return merge([geo])
}

/** Der Spieler: Träger mit Mantel. Einzelne Meshes, damit sie animiert werden können. */
export interface PlayerModel {
  group: THREE.Group
  body: THREE.Mesh
  head: THREE.Mesh
  lantern: THREE.Mesh
  arm: THREE.Mesh
  lanternMaterial: THREE.MeshBasicMaterial
}

export function playerModel(): PlayerModel {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color: 0x6b6f8a, flatShading: true })
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8b79a, flatShading: true })
  const coat = new THREE.MeshLambertMaterial({ color: 0x3f4763, flatShading: true })

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.15, 6, 1), coat)
  body.geometry.translate(0, 0.575, 0)
  body.position.y = 0.05
  body.castShadow = true

  const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.35, 6), mat)
  shoulders.position.y = 1.1

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), skin)
  head.position.y = 1.5
  head.castShadow = true

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 6, 1), coat)
  hood.position.y = 1.72

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.62, 5), coat)
  arm.geometry.translate(0, -0.31, 0)
  arm.position.set(0.38, 1.15, 0.08)
  arm.rotation.z = 0.5

  const lanternMaterial = new THREE.MeshBasicMaterial({ color: 0xffb35c })
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), lanternMaterial)
  lantern.position.set(0, -0.72, 0)
  arm.add(lantern)

  group.add(body, shoulders, head, hood, arm)
  return { group, body, head, lantern, arm, lanternMaterial }
}

export interface EnemyModel {
  group: THREE.Group
  body: THREE.Mesh
  bodyMaterial: THREE.MeshLambertMaterial
  eyeMaterial: THREE.MeshBasicMaterial
  eyes: THREE.Group
}

/** Ein Stiller: dunkle, kantige Silhouette mit leuchtenden Augen. */
export function enemyModel(): EnemyModel {
  const group = new THREE.Group()
  const bodyMaterial = new THREE.MeshLambertMaterial({
    color: 0x1a1d2a,
    flatShading: true,
    transparent: true,
    opacity: 1,
  })
  const rng = new Rng(4444)
  const geo = new THREE.IcosahedronGeometry(0.55, 0)
  jitterVertices(geo, 0.22, rng)
  geo.scale(1, 1.6, 1)
  geo.translate(0, 0.9, 0)
  const body = new THREE.Mesh(geo, bodyMaterial)
  body.castShadow = true

  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fb3ff,
    transparent: true,
    opacity: 1,
  })
  const eyes = new THREE.Group()
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), eyeMaterial)
    eye.position.set(0.32, 1.25, side * 0.16)
    eyes.add(eye)
  }

  group.add(body, eyes)
  return { group, body, bodyMaterial, eyeMaterial, eyes }
}

export interface CoreModel {
  group: THREE.Group
  crystal: THREE.Mesh
  crystalMaterial: THREE.MeshBasicMaterial
  glowRing: THREE.Mesh
  glowMaterial: THREE.MeshBasicMaterial
  lightRing: THREE.Mesh
}

/** Der Kern: gefasster Kristall auf Steinsockel, Glut-Ring am Boden, Lichtradius-Ring. */
export function coreModel(): CoreModel {
  const group = new THREE.Group()
  const rng = new Rng(5555)

  const baseGeo = new THREE.CylinderGeometry(0.75, 0.95, 0.5, 7)
  jitterVertices(baseGeo, 0.06, rng)
  const base = new THREE.Mesh(
    baseGeo,
    new THREE.MeshLambertMaterial({ color: 0x4a4f5c, flatShading: true }),
  )
  base.position.y = 0.25
  base.receiveShadow = true

  const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0xff9a4d })
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crystalMaterial)
  crystal.position.y = 1.05

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff8f45,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const glowRing = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), glowMaterial)
  glowRing.rotation.x = -Math.PI / 2
  glowRing.position.y = 0.04

  const lightRing = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffb46a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  lightRing.rotation.x = -Math.PI / 2
  lightRing.position.y = 0.06

  group.add(base, crystal, glowRing, lightRing)
  return { group, crystal, crystalMaterial, glowRing, glowMaterial, lightRing }
}

/** Werkbank: Tisch mit Werkzeugen. */
export function workbenchGeometry(): THREE.BufferGeometry {
  const rng = new Rng(6001)
  const top = new THREE.BoxGeometry(1.4, 0.12, 0.7)
  top.translate(0, 0.8, 0)
  paint(top, 0x8a6a48, 0.1, rng)
  const parts = [top]
  for (const [x, z] of [
    [-0.6, -0.28],
    [0.6, -0.28],
    [-0.6, 0.28],
    [0.6, 0.28],
  ]) {
    const leg = new THREE.BoxGeometry(0.1, 0.8, 0.1)
    leg.translate(x!, 0.4, z!)
    paint(leg, 0x5c4630, 0.1, rng)
    parts.push(leg)
  }
  const anvil = new THREE.BoxGeometry(0.35, 0.22, 0.25)
  anvil.translate(0.3, 0.97, 0)
  paint(anvil, 0x6f7a8c)
  parts.push(anvil)
  return merge(parts)
}

/** Leerer Bauplatz: vier Pflöcke mit Schnur. */
export function slotMarkerGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const [x, z] of [
    [-0.7, -0.5],
    [0.7, -0.5],
    [-0.7, 0.5],
    [0.7, 0.5],
  ]) {
    const peg = new THREE.CylinderGeometry(0.04, 0.05, 0.5, 4)
    peg.translate(x!, 0.25, z!)
    paint(peg, 0x9a8a6a)
    parts.push(peg)
  }
  return merge(parts)
}

/** Geheimnis-Marker: alte Laterne. */
export function secretGeometry(): THREE.BufferGeometry {
  const rng = new Rng(7001)
  const post = new THREE.CylinderGeometry(0.05, 0.07, 1.6, 5)
  post.translate(0, 0.8, 0)
  paint(post, 0x3a3f4a, 0.1, rng)
  const cage = new THREE.OctahedronGeometry(0.22, 0)
  cage.translate(0.2, 1.55, 0)
  paint(cage, 0x8d94a3)
  const arm = new THREE.BoxGeometry(0.3, 0.05, 0.05)
  arm.translate(0.12, 1.72, 0)
  paint(arm, 0x3a3f4a)
  return merge([post, cage, arm])
}

export function stumpGeometry(): THREE.BufferGeometry {
  const rng = new Rng(8001)
  const geo = new THREE.CylinderGeometry(0.18, 0.24, 0.3, 6)
  geo.translate(0, 0.15, 0)
  paint(geo, 0x7a6248, 0.15, rng)
  return merge([geo])
}
