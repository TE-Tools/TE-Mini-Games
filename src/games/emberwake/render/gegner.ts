import * as THREE from 'three'
import type { EnemyDef, EnemyId } from '@/games/emberwake/data/schema/types'
import { Rng } from '@/games/emberwake/core/Rng'
import { glow } from './atmosphere'
import { fest, schattenMaterial, type Schatten } from './schatten'

/**
 * Die Stillen als Gestalten (27.11.2026, vorher ein schwarzer Klumpen mit
 * zwei Punkten).
 *
 * Jeder Typ hat eine Absicht (docs/AI.md §6), und jetzt auch einen Umriss,
 * an dem man sie von oben erkennt:
 *
 * - **Schleicher**: gebeugt unter einem zerrissenen Umhang, Kapuze ohne
 *   Gesicht, lange Arme mit Krallen, die fast am Boden schleifen.
 * - **Hetzer**: geduckter Läufer, weit vorgebeugt, mit Rückenstacheln,
 *   vier Augen und langen Krallenarmen -- schnell, und so sieht er aus.
 * - **Brecher**: ein Koloss mit Steinplatten auf den Schultern und Fäusten
 *   wie Felsbrocken, glühend rissig -- er will den Kern zerschlagen.
 * - **Nachtmahr**: schwebt, ohne Beine, das Gewand weht in Fetzen, eine
 *   Krone aus Hörnern, die Arme ausgebreitet.
 *
 * Alles ohne Modelldatei; vorn ist +x, die Schultern liegen auf z, wie
 * bei der Spielfigur. `animiere` bewegt Glieder nach Weg, Tempo und
 * Angriff -- GameView rechnet nur die Werte aus.
 */
export interface GegnerAnimation {
  zeit: number
  /** Zurückgelegter Weg in Metern -- treibt den Schritt. */
  schritt: number
  /** Tempo in m/s. */
  tempo: number
  /** Angriff, 1 beim Ausholen, fällt auf 0. */
  angriff: number
}

export interface GegnerModell {
  typ: EnemyId
  group: THREE.Group
  schatten: Schatten
  augenMaterial: THREE.MeshBasicMaterial
  hofMaterial: THREE.SpriteMaterial
  animiere(a: GegnerAnimation): void
}

/* ---------------------------------------------------------------- Teile */

interface Werkzeug {
  teil(geo: THREE.BufferGeometry, flattern?: number): THREE.Mesh
  glied(
    laenge: number,
    r0: number,
    r1: number,
  ): { pivot: THREE.Group; ende: THREE.Group; mesh: THREE.Mesh }
}

function werkzeug(s: Schatten): Werkzeug {
  const teil = (geo: THREE.BufferGeometry, flattern = 0): THREE.Mesh => {
    if (!geo.attributes.flattern) fest(geo, flattern)
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, s.material)
    m.castShadow = true
    return m
  }
  const glied = (laenge: number, r0: number, r1: number) => {
    const pivot = new THREE.Group()
    const geo = new THREE.CapsuleGeometry(r0, Math.max(0.01, laenge - r0 * 2), 5, 10)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (laenge / 2 - pos.getY(i)) / laenge))
      const k = 1 + (r1 / r0 - 1) * t
      pos.setX(i, pos.getX(i) * k)
      pos.setZ(i, pos.getZ(i) * k)
    }
    geo.translate(0, -laenge / 2, 0)
    const mesh = teil(geo)
    pivot.add(mesh)
    const ende = new THREE.Group()
    ende.position.y = -laenge
    pivot.add(ende)
    return { pivot, ende, mesh }
  }
  return { teil, glied }
}

/**
 * Ein Umhang aus einem gedrehten Profil ([Radius, Höhe] von unten), unten
 * zerfetzt und nach vorn geneigt. Die Fetzen hängen an ganzzahligen
 * Frequenzen des Winkels, damit die Naht hinten nicht aufreißt.
 */
function umhang(
  profil: [number, number][],
  rng: Rng,
  opt: { fetzen: number; neigung: number; tiefe?: number; breite?: number; wehen?: number },
): THREE.BufferGeometry {
  const geo = new THREE.LatheGeometry(
    profil.map(([r, y]) => new THREE.Vector2(r, y)),
    26,
  )
  const pos = geo.attributes.position as THREE.BufferAttribute
  const unten = profil[0]![1]
  const oben = profil[profil.length - 1]![1]
  const p1 = rng.next() * 6
  const p2 = rng.next() * 6
  const flattern = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    let y = pos.getY(i)
    const a = Math.atan2(z, x)
    const amUnteren = 1 - Math.min(1, (y - unten) / ((oben - unten) * 0.3 + 0.001))
    if (amUnteren > 0) {
      const zacke =
        (0.5 + 0.5 * Math.sin(a * 7 + p1)) * (0.6 + 0.4 * Math.sin(a * 3 + p2)) +
        0.25 * Math.max(0, Math.sin(a * 13 + p2 * 2))
      y += zacke * opt.fetzen * amUnteren
    }
    const t = (y - unten) / (oben - unten)
    flattern[i] = Math.max(0, 1 - t / 0.6) * (opt.wehen ?? 1)
    pos.setXYZ(i, x * (opt.tiefe ?? 0.85) + (y - unten) * opt.neigung, y, z * (opt.breite ?? 1.2))
  }
  geo.setAttribute('flattern', new THREE.BufferAttribute(flattern, 1))
  return geo
}

/** Kapuze: eine Kugel, vorn offen. Dahinter liegt Dunkelheit. */
function kapuze(radius: number): THREE.BufferGeometry {
  // phi = PI ist vorn (+x); dort bleibt eine Öffnung.
  const offen = 1.0
  const geo = new THREE.SphereGeometry(
    radius,
    16,
    12,
    Math.PI + offen,
    Math.PI * 2 - offen * 2,
    0,
    Math.PI * 0.82,
  )
  geo.scale(1.1, 1.15, 1)
  return geo
}

function kralle(laenge: number, dicke: number): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(dicke, laenge, 5)
  geo.translate(0, -laenge / 2, 0)
  return geo
}

function augen(
  gruppe: THREE.Object3D,
  material: THREE.MeshBasicMaterial,
  hof: THREE.SpriteMaterial,
  orte: [number, number, number, number][],
): void {
  for (const [x, y, z, r] of orte) {
    const auge = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), material)
    auge.position.set(x, y, z)
    const schein = new THREE.Sprite(hof)
    schein.scale.setScalar(r * 9)
    schein.position.set(x + 0.02, y, z)
    schein.renderOrder = 5
    gruppe.add(auge, schein)
  }
}

/* --------------------------------------------------------------- Typen */

function schleicher(w: Werkzeug, k: THREE.Group, rng: Rng): void {
  const mantel = w.teil(
    umhang(
      [
        [0.42, 0.0],
        [0.37, 0.25],
        [0.3, 0.6],
        [0.27, 0.88],
        [0.25, 1.02],
        [0.17, 1.16],
        [0.05, 1.22],
      ],
      rng,
      { fetzen: 0.24, neigung: 0.32 },
    ),
  )
  const huelle = w.teil(kapuze(0.17), 0.15)
  huelle.position.set(0.42, 1.2, 0)
  huelle.rotation.z = -0.35
  const leere = w.teil(new THREE.SphereGeometry(0.13, 10, 8))
  leere.position.set(0.38, 1.18, 0)
  k.add(mantel, huelle, leere)

  const arme = [1, -1].map((s) => {
    const ober = w.glied(0.42, 0.075, 0.06)
    ober.pivot.position.set(0.3, 1.02, s * 0.25)
    const unter = w.glied(0.44, 0.06, 0.035)
    ober.ende.add(unter.pivot)
    for (let i = 0; i < 3; i++) {
      const c = w.teil(kralle(0.15, 0.014))
      c.position.set(0.01, -0.02, (i - 1) * 0.025)
      c.rotation.z = 0.35 + i * 0.05
      c.rotation.x = (i - 1) * 0.25
      unter.ende.add(c)
    }
    k.add(ober.pivot)
    return { ober: ober.pivot, unter: unter.pivot, s }
  })

  k.userData.animiere = (z: GegnerAnimation) => {
    const kraft = Math.min(1, z.tempo / 1.7)
    const takt = z.schritt * 3.2
    k.position.y = Math.abs(Math.sin(takt)) * 0.04 * kraft + Math.sin(z.zeit * 1.4) * 0.015
    k.rotation.x = Math.sin(takt) * 0.06 * kraft
    k.position.x = z.angriff * 0.3
    for (const arm of arme) {
      const schwung = Math.sin(takt + (arm.s > 0 ? 0 : Math.PI)) * 0.3 * kraft
      arm.ober.rotation.z = 0.5 + schwung + z.angriff * 1.3
      arm.ober.rotation.x = arm.s * (0.1 + z.angriff * 0.2)
      arm.unter.rotation.z = 0.3 + z.angriff * 0.4 + Math.sin(z.zeit * 2 + arm.s) * 0.05
    }
  }
}

function hetzer(w: Werkzeug, k: THREE.Group, rng: Rng): void {
  const rumpf = w.teil(new THREE.CapsuleGeometry(0.2, 0.5, 6, 14))
  rumpf.geometry.scale(1, 1, 0.85)
  rumpf.rotation.z = -1.05
  rumpf.position.set(0.12, 0.98, 0)
  k.add(rumpf)
  // Stacheln den Rücken entlang, nach hinten gekippt.
  for (let i = 0; i < 6; i++) {
    const t = i / 5
    const st = w.teil(new THREE.ConeGeometry(0.04 - t * 0.015, 0.22 - t * 0.08, 5))
    st.position.set(0.38 - t * 0.5, 1.15 - t * 0.25 + 0.02, 0)
    st.rotation.z = 0.7 + t * 0.3
    k.add(st)
  }
  const schaedel = w.teil(new THREE.SphereGeometry(0.13, 14, 10))
  schaedel.geometry.scale(1.6, 0.85, 0.85)
  schaedel.position.set(0.56, 1.14, 0)
  const kiefer = w.teil(new THREE.ConeGeometry(0.07, 0.24, 6))
  kiefer.rotation.z = -Math.PI / 2 - 0.25
  kiefer.position.set(0.68, 1.06, 0)
  k.add(schaedel, kiefer)
  // Fetzen am Rücken.
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.07, 0.5, 1, 4)
    g.translate(0, -0.25, 0)
    const p = g.attributes.position as THREE.BufferAttribute
    const f = new Float32Array(p.count)
    for (let j = 0; j < p.count; j++) f[j] = Math.min(1, -p.getY(j) / 0.5) * 1.6
    g.setAttribute('flattern', new THREE.BufferAttribute(f, 1))
    const band = w.teil(g)
    band.position.set(-0.1 - i * 0.06, 0.98 - i * 0.04, (i - 1) * 0.08)
    band.rotation.z = -0.9 - rng.next() * 0.3
    k.add(band)
  }

  const beine = [1, -1].map((s) => {
    const ober = w.glied(0.4, 0.09, 0.06)
    ober.pivot.position.set(-0.08, 0.8, s * 0.13)
    const unter = w.glied(0.44, 0.06, 0.032)
    ober.ende.add(unter.pivot)
    const fuss = w.teil(kralle(0.2, 0.035))
    fuss.rotation.z = Math.PI / 2 + 0.2
    fuss.position.set(0.04, 0, 0)
    unter.ende.add(fuss)
    k.add(ober.pivot)
    return { ober: ober.pivot, unter: unter.pivot, s }
  })
  const arme = [1, -1].map((s) => {
    const ober = w.glied(0.34, 0.065, 0.05)
    ober.pivot.position.set(0.42, 1.02, s * 0.19)
    const unter = w.glied(0.36, 0.05, 0.03)
    ober.ende.add(unter.pivot)
    for (let i = 0; i < 3; i++) {
      const c = w.teil(kralle(0.2, 0.013))
      c.position.set(0, -0.01, (i - 1) * 0.022)
      c.rotation.z = 0.5
      c.rotation.x = (i - 1) * 0.3
      unter.ende.add(c)
    }
    k.add(ober.pivot)
    return { ober: ober.pivot, unter: unter.pivot, s }
  })

  k.userData.animiere = (z: GegnerAnimation) => {
    const kraft = Math.min(1, z.tempo / 3)
    const takt = z.schritt * 2.6
    k.position.y = Math.abs(Math.sin(takt)) * 0.08 * kraft
    k.rotation.z = -0.08 * kraft - z.angriff * 0.25
    k.position.x = z.angriff * 0.35
    for (const b of beine) {
      const ph = takt + (b.s > 0 ? 0 : Math.PI)
      b.ober.rotation.z = 0.55 + Math.sin(ph) * 0.75 * kraft
      b.unter.rotation.z = -1.0 - Math.max(0, Math.cos(ph)) * 0.6 * kraft
    }
    for (const arm of arme) {
      const ph = takt + (arm.s > 0 ? Math.PI : 0)
      arm.ober.rotation.z = 0.9 + Math.sin(ph) * 0.45 * kraft + z.angriff * 0.8
      arm.ober.rotation.x = arm.s * 0.15
      arm.unter.rotation.z = 0.4 + z.angriff * 0.3
    }
  }
}

function brecher(w: Werkzeug, k: THREE.Group, rng: Rng): void {
  const rumpf = w.teil(
    umhang(
      [
        [0.21, 0.52],
        [0.25, 0.66],
        [0.29, 0.82],
        [0.39, 1.0],
        [0.47, 1.14],
        [0.41, 1.26],
        [0.18, 1.34],
        [0.02, 1.35],
      ],
      rng,
      // Breit in den Schultern, schmal in der Hüfte: ein Keil, kein Ei.
      { fetzen: 0, neigung: 0.32, tiefe: 0.85, breite: 1.5, wehen: 0 },
    ),
  )
  const kopf = w.teil(new THREE.SphereGeometry(0.12, 12, 10))
  kopf.geometry.scale(1.1, 0.9, 1)
  kopf.position.set(0.42, 1.28, 0)
  const stirn = w.teil(new THREE.BoxGeometry(0.1, 0.05, 0.22))
  stirn.position.set(0.5, 1.33, 0)
  k.add(rumpf, kopf, stirn)
  // Steinplatten auf Schultern und Rücken.
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.DodecahedronGeometry(0.11 + rng.next() * 0.06, 0)
      const p = g.attributes.position as THREE.BufferAttribute
      for (let j = 0; j < p.count; j++) {
        p.setXYZ(j, p.getX(j) * (1 + rng.next() * 0.3), p.getY(j) * 0.7, p.getZ(j))
      }
      const platte = w.teil(g)
      platte.position.set(0.2 - i * 0.14, 1.3 - i * 0.04, s * (0.36 + i * 0.03))
      platte.rotation.set(rng.next(), rng.next(), s * 0.4)
      k.add(platte)
    }
  }
  for (let i = 0; i < 4; i++) {
    const zacke = w.teil(new THREE.ConeGeometry(0.06, 0.26, 5))
    zacke.position.set(-0.05 - i * 0.1, 1.32 - i * 0.12, (rng.next() - 0.5) * 0.2)
    zacke.rotation.z = 0.9
    k.add(zacke)
  }

  const arme = [1, -1].map((s) => {
    const ober = w.glied(0.46, 0.13, 0.1)
    ober.pivot.position.set(0.24, 1.15, s * 0.5)
    const unter = w.glied(0.5, 0.11, 0.15)
    ober.ende.add(unter.pivot)
    const faust = w.teil(new THREE.DodecahedronGeometry(0.17, 1))
    faust.position.y = -0.02
    unter.ende.add(faust)
    k.add(ober.pivot)
    return { ober: ober.pivot, unter: unter.pivot, s }
  })
  const beine = [1, -1].map((s) => {
    const ober = w.glied(0.3, 0.13, 0.11)
    ober.pivot.position.set(0.05, 0.6, s * 0.2)
    const unter = w.glied(0.3, 0.11, 0.1)
    ober.ende.add(unter.pivot)
    const fuss = w.teil(new THREE.BoxGeometry(0.3, 0.1, 0.18))
    fuss.position.set(0.07, -0.02, 0)
    unter.ende.add(fuss)
    k.add(ober.pivot)
    return { ober: ober.pivot, unter: unter.pivot, s }
  })

  k.userData.animiere = (z: GegnerAnimation) => {
    const kraft = Math.min(1, z.tempo / 1.3)
    const takt = z.schritt * 2.4
    k.position.y = Math.abs(Math.sin(takt)) * 0.05 * kraft + Math.sin(z.zeit * 1.1) * 0.01
    k.rotation.x = Math.sin(takt) * 0.08 * kraft
    // Ausholen über den Kopf, dann Niederschlagen.
    const hieb = Math.sin(Math.min(1, z.angriff) * Math.PI)
    for (const arm of arme) {
      const ph = takt + (arm.s > 0 ? Math.PI : 0)
      arm.ober.rotation.z = 0.2 + Math.sin(ph) * 0.3 * kraft - hieb * 2.6
      arm.ober.rotation.x = arm.s * (0.12 - hieb * 0.1)
      arm.unter.rotation.z = 0.35 + hieb * 0.4
    }
    for (const b of beine) {
      const ph = takt + (b.s > 0 ? 0 : Math.PI)
      b.ober.rotation.z = Math.sin(ph) * 0.45 * kraft
      b.unter.rotation.z = -Math.max(0, Math.sin(ph)) * 0.4 * kraft
    }
  }
}

function nachtmahr(w: Werkzeug, k: THREE.Group, rng: Rng): void {
  const gewand = w.teil(
    umhang(
      [
        [0.5, 0.0],
        [0.42, 0.3],
        [0.32, 0.7],
        [0.28, 1.0],
        [0.3, 1.24],
        [0.2, 1.42],
        [0.06, 1.48],
      ],
      rng,
      { fetzen: 0.4, neigung: 0.12, wehen: 1.8 },
    ),
  )
  gewand.position.y = 0.2
  const huelle = w.teil(kapuze(0.2), 0.1)
  huelle.position.set(0.25, 1.72, 0)
  huelle.rotation.z = -0.15
  const leere = w.teil(new THREE.SphereGeometry(0.16, 10, 8))
  leere.position.set(0.21, 1.7, 0)
  k.add(gewand, huelle, leere)
  // Krone aus Hörnern, nach hinten geschwungen.
  for (let i = 0; i < 5; i++) {
    const a = ((i - 2) / 2) * 1.1
    const horn = w.teil(new THREE.ConeGeometry(0.035, 0.36 - Math.abs(i - 2) * 0.06, 6))
    horn.position.set(0.18 + Math.cos(a) * 0.04, 1.93, Math.sin(a) * 0.17)
    horn.rotation.set(Math.sin(a) * 0.6, 0, 0.55)
    k.add(horn)
  }
  const arme = [1, -1].map((s) => {
    const ober = w.glied(0.48, 0.05, 0.038)
    ober.pivot.position.set(0.15, 1.58, s * 0.3)
    const unter = w.glied(0.52, 0.038, 0.024)
    ober.ende.add(unter.pivot)
    // Ärmelfetzen, die vom Unterarm wehen.
    const g = new THREE.PlaneGeometry(0.16, 0.4, 1, 4)
    g.translate(0, -0.2, 0)
    const p = g.attributes.position as THREE.BufferAttribute
    const f = new Float32Array(p.count)
    for (let j = 0; j < p.count; j++) f[j] = Math.min(1, -p.getY(j) / 0.4) * 1.5
    g.setAttribute('flattern', new THREE.BufferAttribute(f, 1))
    const fetzen = w.teil(g)
    fetzen.rotation.y = Math.PI / 2
    fetzen.position.set(-0.03, -0.05, 0)
    unter.pivot.add(fetzen)
    for (let i = 0; i < 4; i++) {
      const c = w.teil(kralle(0.26, 0.012))
      c.position.set(0, -0.01, (i - 1.5) * 0.02)
      c.rotation.z = 0.25
      c.rotation.x = (i - 1.5) * 0.18
      unter.ende.add(c)
    }
    k.add(ober.pivot)
    return { ober: ober.pivot, unter: unter.pivot, s }
  })

  k.userData.animiere = (z: GegnerAnimation) => {
    k.position.y = 0.12 + Math.sin(z.zeit * 1.6) * 0.08
    k.rotation.z = -Math.min(1, z.tempo / 2.4) * 0.12 - z.angriff * 0.2
    k.position.x = z.angriff * 0.3
    for (const arm of arme) {
      const welle = Math.sin(z.zeit * 1.3 + arm.s) * 0.15
      arm.ober.rotation.z = 0.7 + welle + z.angriff * 1.1
      arm.ober.rotation.x = arm.s * (0.55 - z.angriff * 0.4)
      arm.unter.rotation.z = 0.5 + Math.sin(z.zeit * 1.9 + arm.s) * 0.1
    }
  }
}

/* -------------------------------------------------------------- Aufbau */

const AUGEN: Record<EnemyId, [number, number, number, number][]> = {
  schleicher: [
    [0.5, 1.19, 0.05, 0.022],
    [0.5, 1.19, -0.05, 0.022],
  ],
  hetzer: [
    [0.72, 1.16, 0.06, 0.02],
    [0.72, 1.16, -0.06, 0.02],
    [0.68, 1.21, 0.085, 0.014],
    [0.68, 1.21, -0.085, 0.014],
  ],
  brecher: [
    [0.52, 1.29, 0.05, 0.022],
    [0.52, 1.29, -0.05, 0.022],
  ],
  nachtmahr: [
    [0.36, 1.71, 0.06, 0.026],
    [0.36, 1.71, -0.06, 0.026],
    [0.37, 1.79, 0, 0.018],
  ],
}

/** Wie stark die Adern leuchten -- der Brecher glüht, der Schleicher kaum. */
const RISS: Record<EnemyId, number> = {
  schleicher: 0.45,
  hetzer: 0.7,
  brecher: 1.2,
  nachtmahr: 0.9,
}

export function gegnerModell(def: EnemyDef): GegnerModell {
  const schatten = schattenMaterial(def.color, def.eyeColor, RISS[def.id])
  const w = werkzeug(schatten)
  const group = new THREE.Group()
  const koerper = new THREE.Group()
  group.add(koerper)
  const rng = new Rng(4444 + def.id.length * 17)

  switch (def.id) {
    case 'schleicher':
      schleicher(w, koerper, rng)
      break
    case 'hetzer':
      hetzer(w, koerper, rng)
      // Der Hetzer ist im Spiel klein skaliert (0,85) -- als Tier soll er trotzdem Masse haben.
      koerper.scale.setScalar(1.15)
      break
    case 'brecher':
      brecher(w, koerper, rng)
      break
    case 'nachtmahr':
      nachtmahr(w, koerper, rng)
      break
  }

  const augenMaterial = new THREE.MeshBasicMaterial({ color: def.eyeColor })
  augenMaterial.color.multiplyScalar(2.2)
  augenMaterial.toneMapped = false
  const hofMaterial = new THREE.SpriteMaterial({
    map: glow(),
    color: def.eyeColor,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  augen(koerper, augenMaterial, hofMaterial, AUGEN[def.id])

  const bewege = koerper.userData.animiere as (a: GegnerAnimation) => void
  return {
    typ: def.id,
    group,
    schatten,
    augenMaterial,
    hofMaterial,
    animiere: (a) => {
      schatten.zeit.value = a.zeit
      bewege(a)
    },
  }
}
