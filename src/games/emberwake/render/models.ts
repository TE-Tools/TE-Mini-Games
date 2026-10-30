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

/**
 * Vertex-Farben-Material — alle Modelle teilen sich diese Instanz.
 *
 * Ab Stufe MITTEL physikalisch beleuchtet (30.10.2026): Licht fällt weicher
 * über die Kanten, und Laterne und Kern färben die Flächen glaubwürdiger.
 * Auf NIEDRIG bleibt es beim günstigen Lambert -- gleiche Farben, weniger
 * Rechenarbeit je Pixel.
 */
export function vertexMaterial(
  hochwertig = false,
): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
  if (hochwertig) {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.88,
      metalness: 0,
    })
  }
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
}

// ---------------------------------------------------------------------------

/**
 * Licht von oben, Schatten von unten -- in die Vertex-Farben gebacken.
 *
 * Ohne das sehen Bäume und Felsen überall gleich hell aus, als klebten sie
 * auf dem Boden. Echte Umgebungsverdeckung kostet einen eigenen Durchgang;
 * diese hier kostet beim Laden einmal eine Schleife und dann nichts mehr.
 */
function tiefe(geo: THREE.BufferGeometry, unten: number, oben: number, dunkel = 0.5): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = geo.attributes.color as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - unten) / Math.max(0.01, oben - unten)))
    const k = dunkel + (1.08 - dunkel) * Math.sqrt(t)
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k)
  }
}

/** Eine Tannenetage: Kegel, dessen Rand herabhängt wie schwere Zweige. */
function etage(radius: number, hoehe: number, y: number, rng: Rng): THREE.BufferGeometry {
  const cone = new THREE.ConeGeometry(radius, hoehe, 11, 3, true)
  const pos = cone.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const vy = pos.getY(i)
    const r = Math.hypot(pos.getX(i), pos.getZ(i)) / radius
    // Aussen sacken die Zweige ab, und jeder Zweig ist anders lang.
    const zacke = 1 + (rng.next() - 0.5) * 0.28 * r
    pos.setXYZ(i, pos.getX(i) * zacke, vy - r * r * 0.22, pos.getZ(i) * zacke)
  }
  cone.translate(0, y, 0)
  return cone
}

export function treeGeometry(
  trunkColor: number,
  canopyColor: number,
  canopyDark: number,
  variant: number,
): THREE.BufferGeometry {
  const rng = new Rng(1000 + variant)
  const parts: THREE.BufferGeometry[] = []

  // Stamm mit Wurzelansatz: unten breiter, leicht schief gewachsen.
  const trunk = new THREE.CylinderGeometry(0.11, 0.2, 2.4, 9, 4)
  trunk.translate(0, 1.2, 0)
  const tp = trunk.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i)
    const fuss = y < 0.25 ? 1 + (0.25 - y) * 1.6 : 1
    tp.setXYZ(i, tp.getX(i) * fuss + y * y * 0.012, y, tp.getZ(i) * fuss)
  }
  paint(trunk, trunkColor, 0.18, rng)
  tiefe(trunk, 0, 2.4, 0.75)
  parts.push(trunk)

  if (variant === 2) {
    // Laubbaum: ein paar Äste, darüber eine Krone aus Blattballen.
    for (let i = 0; i < 3; i++) {
      const ast = new THREE.CylinderGeometry(0.035, 0.06, 0.9, 6)
      ast.translate(0, 0.45, 0)
      ast.rotateZ(0.7 + rng.next() * 0.3)
      ast.rotateY((i / 3) * Math.PI * 2 + rng.next())
      ast.translate(0, 1.6 + i * 0.25, 0)
      paint(ast, trunkColor, 0.15, rng)
      parts.push(ast)
    }
    for (let i = 0; i < 7; i++) {
      const r = 0.55 + rng.next() * 0.35
      const ballen = new THREE.IcosahedronGeometry(r, 2)
      jitterVertices(ballen, 0.09, rng)
      const a = rng.angle()
      const d = i === 0 ? 0 : 0.45 + rng.next() * 0.35
      const y = 2.6 + (i === 0 ? 0.55 : rng.next() * 0.7)
      ballen.translate(Math.cos(a) * d, y, Math.sin(a) * d)
      paint(ballen, i % 2 === 0 ? canopyColor : canopyDark, 0.16, rng)
      tiefe(ballen, 1.9, 3.9, 0.45)
      parts.push(ballen)
    }
    return merge(parts)
  }

  // Nadelbaum: Etagen, die nach oben schmaler werden.
  const etagen = 4 + variant
  for (let i = 0; i < etagen; i++) {
    const t = i / (etagen - 1)
    const radius = 1.35 - t * 0.95
    const hoehe = 1.25 - t * 0.35
    const kegel = etage(radius, hoehe, 1.45 + i * (2.2 / etagen) + t * 0.3, rng)
    paint(kegel, i % 2 === 0 ? canopyColor : canopyDark, 0.14, rng)
    // Innen und unten dunkel, an den Spitzen hell -- wie Licht im Wald.
    tiefe(kegel, 0.9, 4.4, 0.42)
    parts.push(kegel)
  }
  return merge(parts)
}

export function rockGeometry(rockColor: number, variant: number): THREE.BufferGeometry {
  const rng = new Rng(2000 + variant)
  const geo = new THREE.IcosahedronGeometry(0.7, 2)
  jitterVertices(geo, 0.16, rng)
  // Grobe Bruchkanten: ein paar Flächen flach abschneiden.
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    if (pos.getX(i) > 0.45) pos.setX(i, 0.45 + (pos.getX(i) - 0.45) * 0.3)
    if (pos.getZ(i) < -0.4) pos.setZ(i, -0.4 + (pos.getZ(i) + 0.4) * 0.3)
  }
  geo.scale(1, 0.62 + rng.next() * 0.25, 1)
  geo.translate(0, 0.28, 0)
  paint(geo, rockColor, 0.2, rng)
  // Moos oben, Erde unten.
  geo.computeVertexNormals()
  const n = geo.attributes.normal as THREE.BufferAttribute
  const col = geo.attributes.color as THREE.BufferAttribute
  const moos = new THREE.Color(0x56664a)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i))
    if (n.getY(i) > 0.55) c.lerp(moos, (n.getY(i) - 0.55) * 1.4)
    col.setXYZ(i, c.r, c.g, c.b)
  }
  tiefe(geo, -0.1, 0.8, 0.45)
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

/**
 * Der Spieler: ein Träger mit Mantel, Kapuze, Rucksack -- und Gliedmaßen.
 *
 * Thomas am 27.09.2026: "die Figur echter machen." Vorher war es ein Kegel
 * mit einem Kopf darauf und einem einzigen Arm für die Laterne: Es lief
 * nichts, es schwang nichts, und beim Schlagen bewegte sich ein Stab.
 *
 * Jetzt hat sie Brustkorb, Becken, zwei Arme mit Ellbogen, zwei Beine mit
 * Knien und Füßen. Jedes Glied ist ein eigener Knoten mit seinem Drehpunkt
 * an der Schulter beziehungsweise Hüfte -- deshalb kann GameView damit einen
 * Schritt und einen Axthieb spielen, statt Teile zu verschieben.
 *
 * Seit dem 30.10.2026 baut figur.ts sie gerundet statt gestückelt, mit
 * Gesicht und Kleidung ("es soll wirklich echt aussehen"). Keine Texturen,
 * keine Modelldateien bleibt (ARCHITECTURE.md §6).
 */
export interface PlayerModel {
  group: THREE.Group
  /** Alles oberhalb der Hüfte -- kippt beim Schlagen nach vorn. */
  torso: THREE.Group
  body: THREE.Mesh
  head: THREE.Mesh
  /** Kopf samt Gesicht -- dreht sich gegen den Schritt, damit der Blick ruhig bleibt. */
  kopf: THREE.Group
  /** Höhe des Drehpunkts des Oberkörpers. */
  huefte: number
  /** Laternenarm (links). Dreht um die Schulter. */
  arm: THREE.Group
  /** Axtarm (rechts). Dreht um die Schulter. */
  armRight: THREE.Group
  /** Ellbogen des Axtarms -- knickt beim Ausholen. */
  elbowRight: THREE.Group
  legLeft: THREE.Group
  legRight: THREE.Group
  /** Knie. Knicken nur nach hinten, und nur im Rückschwung. */
  kneeLeft: THREE.Group
  kneeRight: THREE.Group
  lantern: THREE.Mesh
  lanternMaterial: THREE.MeshBasicMaterial
  /** Die Axt in der rechten Hand -- nur sichtbar, wenn man eine hat. */
  axe: THREE.Group
}

// Die Figur selbst steht seit dem 30.10.2026 in figur.ts (menschModell).

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
