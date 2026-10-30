import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PlayerModel } from './models'

/**
 * Der Träger, so menschlich wie es ohne Modelldatei geht (30.10.2026).
 *
 * Thomas: "es soll wirklich echt aussehen, auch die Menschen." Die alte
 * Figur bestand aus sechseckigen Zylindern mit flachen Flächen. Diese hier
 * ist gedreht und gerundet statt gestückelt: Rumpf und Mantel aus einem
 * Profil gedreht (Lathe), Glieder als Kapseln, ein Kopf mit Gesicht --
 * Nase, Augen, Brauen, Ohren, Haar. Dazu Materialien, die sich wie Stoff,
 * Haut, Leder und Metall verhalten.
 *
 * Weiterhin keine Texturen und keine Modelldatei (PERFORMANCE.md §3.1, §5):
 * Alles entsteht hier im Code, ein paar tausend Dreiecke für die eine
 * Figur, die man die ganze Zeit ansieht.
 *
 * Achsen wie zuvor: vorn ist +x, die Schultern liegen auf z. Glieder
 * drehen um z (vor/zurück), wie GameView sie animiert.
 */

/** Höhe der Hüfte: Dort sitzt der Drehpunkt des Oberkörpers. */
export const HUEFTE = 0.86

function stoff(farbe: number, rauheit = 0.95): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: farbe, roughness: rauheit, metalness: 0 })
}

/** Ein Glied: Kapsel, die vom Drehpunkt nach unten hängt. */
function glied(
  material: THREE.Material,
  laenge: number,
  radius: number,
  unten = radius,
): { pivot: THREE.Group; mesh: THREE.Mesh } {
  const pivot = new THREE.Group()
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, laenge - radius * 2), 6, 12)
  // Zum Ende hin schlanker -- wie Oberarm zu Ellbogen, Wade zu Knöchel.
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const t = (laenge / 2 - pos.getY(i)) / laenge
    const k = 1 + (unten / radius - 1) * Math.min(1, Math.max(0, t))
    pos.setX(i, pos.getX(i) * k)
    pos.setZ(i, pos.getZ(i) * k)
  }
  geo.translate(0, -laenge / 2, 0)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  pivot.add(mesh)
  return { pivot, mesh }
}

/** Gedrehtes Profil: [Radius, Höhe] von unten nach oben. */
function gedreht(
  profil: [number, number][],
  material: THREE.Material,
  tiefe = 0.78,
  breite = 1.3,
): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    profil.map(([r, y]) => new THREE.Vector2(r, y)),
    20,
  )
  geo.scale(tiefe, 1, breite)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function menschModell(): PlayerModel {
  const haut = stoff(0xd8a487, 0.55)
  const mantel = stoff(0x3f4d68)
  const mantelDunkel = stoff(0x2c3549)
  const schal = stoff(0x8e3a2c)
  const hose = stoff(0x3a3b40)
  const leder = stoff(0x5a3e2a, 0.7)
  const stiefelLeder = stoff(0x2f241b, 0.65)
  const haar = stoff(0x3a2818, 0.8)
  const decke = stoff(0x6b5a3e)
  const metall = new THREE.MeshStandardMaterial({
    color: 0xa3abb6,
    roughness: 0.35,
    metalness: 0.85,
  })
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4 })

  const group = new THREE.Group()
  // Der Oberkörper dreht um die Hüfte, nicht um die Füsse.
  const torso = new THREE.Group()
  torso.position.y = HUEFTE
  const o = (y: number): number => y - HUEFTE

  // Rumpf: Becken, Taille, Brust, Schultern -- ein Profil.
  const body = gedreht(
    [
      [0.001, o(0.8)],
      [0.19, o(0.82)],
      [0.2, o(0.92)],
      [0.175, o(1.0)],
      [0.2, o(1.16)],
      [0.215, o(1.3)],
      [0.19, o(1.4)],
      [0.08, o(1.46)],
      [0.001, o(1.47)],
    ],
    mantel,
  )

  // Mantelsaum: weitet sich nach unten, reicht übers Knie.
  const saum = gedreht(
    [
      [0.24, o(0.5)],
      [0.215, o(0.68)],
      [0.2, o(0.86)],
    ],
    mantelDunkel,
    0.85,
    1.25,
  )
  ;(saum.material as THREE.Material).side = THREE.DoubleSide

  // Knopfleiste vorn.
  for (let i = 0; i < 4; i++) {
    const knopf = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), leder)
    knopf.position.set(0.168, o(0.98 + i * 0.1), 0)
    torso.add(knopf)
  }

  // Gürtel mit Schnalle und Tasche.
  const guertel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 24), leder)
  guertel.rotation.x = Math.PI / 2
  guertel.scale.set(0.82, 1.32, 1)
  guertel.position.y = o(0.93)
  const schnalle = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.06, 0.07, 2, 0.008), metall)
  schnalle.position.set(0.15, o(0.93), 0)
  const tasche = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.11, 0.1, 2, 0.02), leder)
  tasche.position.set(0.02, o(0.86), 0.24)

  // Schal um den Hals, ein Ende hängt vorn herab.
  const schalRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 8, 20), schal)
  schalRing.rotation.x = Math.PI / 2
  schalRing.position.y = o(1.45)
  const schalEnde = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.22, 0.08, 2, 0.012), schal)
  schalEnde.position.set(0.15, o(1.33), 0.05)
  schalEnde.rotation.z = -0.12

  // Kapuze, zurückgeschlagen im Nacken.
  const kapuze = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mantelDunkel)
  kapuze.scale.set(0.7, 0.6, 1.15)
  kapuze.position.set(-0.13, o(1.44), 0)

  // Kopf mit Gesicht.
  const kopf = new THREE.Group()
  kopf.position.y = o(1.62)
  const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 12), haut)
  hals.position.y = -0.1
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), haut)
  head.scale.set(1.0, 1.14, 0.86)
  head.castShadow = true
  const kinn = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), haut)
  kinn.scale.set(1, 0.8, 1.1)
  kinn.position.set(0.045, -0.075, 0)
  const nase = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), haut)
  nase.rotation.z = -Math.PI / 2 + 0.25
  nase.position.set(0.108, -0.005, 0)
  const ohren = [1, -1].map((s) => {
    const ohr = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), haut)
    ohr.scale.set(0.7, 1.3, 0.5)
    ohr.position.set(-0.005, 0, s * 0.09)
    return ohr
  })
  const augen = [1, -1].map((s) => {
    const auge = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), dunkel)
    auge.position.set(0.094, 0.02, s * 0.034)
    return auge
  })
  const brauen = [1, -1].map((s) => {
    const braue = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.01, 0.035, 1, 0.004), haar)
    braue.position.set(0.098, 0.045, s * 0.034)
    return braue
  })
  // Haar: eine Kappe, hinten tiefer als vorn.
  const haarGeo = new THREE.SphereGeometry(0.112, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56)
  haarGeo.rotateZ(0.35)
  const haarKappe = new THREE.Mesh(haarGeo, haar)
  haarKappe.scale.set(1.04, 1.12, 0.92)
  haarKappe.position.set(-0.012, 0.012, 0)
  haarKappe.castShadow = true
  kopf.add(hals, head, kinn, nase, ...ohren, ...augen, ...brauen, haarKappe)

  // Rucksack mit Riemen und aufgerollter Decke.
  const rucksack = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.34, 0.28, 3, 0.05), leder)
  rucksack.position.set(-0.27, o(1.15), 0)
  rucksack.castShadow = true
  const deckenRolle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 14), decke)
  deckenRolle.rotation.x = Math.PI / 2
  deckenRolle.position.set(-0.27, o(1.36), 0)
  const riemen = [1, -1].map((s) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 4, 16, Math.PI), leder)
    r.rotation.y = Math.PI / 2
    r.rotation.z = Math.PI / 2
    r.scale.set(1, 0.9, 0.55)
    r.position.set(-0.04, o(1.22), s * 0.12)
    return r
  })

  // Arme: Schulter, Ellbogen, Hand. Ärmel aus Mantelstoff mit Stulpe.
  const arm = (seite: number) => {
    const ober = glied(mantel, 0.3, 0.062, 0.05)
    ober.pivot.position.set(0, o(1.38), seite * 0.27)
    const unter = glied(mantel, 0.28, 0.05, 0.042)
    unter.pivot.position.y = -0.3
    ober.pivot.add(unter.pivot)
    const stulpe = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.014, 6, 14), mantelDunkel)
    stulpe.rotation.x = Math.PI / 2
    stulpe.position.y = -0.26
    const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.05, 4, 10), haut)
    hand.scale.set(0.75, 1, 1.05)
    hand.position.y = -0.33
    hand.castShadow = true
    const daumen = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.03, 3, 6), haut)
    daumen.position.set(0.025, -0.3, -seite * 0.025)
    daumen.rotation.z = -0.5
    unter.pivot.add(stulpe, hand, daumen)
    return { schulter: ober.pivot, ellbogen: unter.pivot, hand }
  }
  const links = arm(1)
  const rechts = arm(-1)

  // Beine: Hüfte, Knie, Stiefel mit Sohle.
  const beine: THREE.Group[] = []
  const knie: THREE.Group[] = []
  for (const seite of [1, -1]) {
    const ober = glied(hose, 0.42, 0.085, 0.065)
    ober.pivot.position.set(0, 0.84, seite * 0.11)
    const unter = glied(hose, 0.38, 0.062, 0.048)
    unter.pivot.position.y = -0.42
    ober.pivot.add(unter.pivot)
    const schaft = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.18, 14), stiefelLeder)
    schaft.position.y = -0.3
    const fuss = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.09, 0.11, 3, 0.035), stiefelLeder)
    fuss.position.set(0.045, -0.4, 0)
    fuss.castShadow = true
    const sohle = new THREE.Mesh(new RoundedBoxGeometry(0.25, 0.025, 0.115, 2, 0.01), dunkel)
    sohle.position.set(0.045, -0.445, 0)
    unter.pivot.add(schaft, fuss, sohle)
    beine.push(ober.pivot)
    knie.push(unter.pivot)
  }

  // Die Laterne in der linken Hand: Rahmen aus Metall, leuchtender Kern.
  const lanternMaterial = new THREE.MeshBasicMaterial({ color: 0xffb35c })
  const laterne = new THREE.Group()
  laterne.position.y = -0.38
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.11, 12),
    lanternMaterial,
  )
  lantern.position.y = -0.11
  const deckel = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.05, 12), metall)
  deckel.position.y = -0.035
  const boden = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 12), metall)
  boden.position.y = -0.175
  for (let i = 0; i < 4; i++) {
    const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4), metall)
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    stab.position.set(Math.cos(a) * 0.055, -0.11, Math.sin(a) * 0.055)
    laterne.add(stab)
  }
  const buegel = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.006, 6, 14, Math.PI), metall)
  buegel.position.y = 0
  laterne.add(lantern, deckel, boden, buegel)
  links.ellbogen.add(laterne)

  // Die Axt in der rechten Hand: Holzstiel, Stahlkopf mit Schneide.
  const axe = new THREE.Group()
  axe.position.y = -0.33
  const stiel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.46, 10), leder)
  stiel.geometry.translate(0, -0.2, 0)
  const form = new THREE.Shape()
  form.moveTo(0, -0.03)
  form.lineTo(0.06, -0.035)
  form.quadraticCurveTo(0.12, -0.09, 0.13, -0.11)
  form.quadraticCurveTo(0.11, 0, 0.13, 0.11)
  form.quadraticCurveTo(0.12, 0.09, 0.06, 0.035)
  form.lineTo(0, 0.03)
  form.lineTo(-0.03, 0.02)
  form.lineTo(-0.03, -0.02)
  form.closePath()
  const blattGeo = new THREE.ExtrudeGeometry(form, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.004,
    bevelSegments: 2,
  })
  blattGeo.translate(0, 0, -0.009)
  blattGeo.rotateZ(Math.PI / 2)
  blattGeo.rotateY(Math.PI / 2)
  blattGeo.translate(0, -0.38, 0.02)
  const blatt = new THREE.Mesh(blattGeo, metall)
  blatt.castShadow = true
  axe.add(stiel, blatt)
  axe.visible = false
  rechts.ellbogen.add(axe)

  torso.add(
    body,
    saum,
    guertel,
    schnalle,
    tasche,
    schalRing,
    schalEnde,
    kapuze,
    kopf,
    rucksack,
    deckenRolle,
    ...riemen,
    links.schulter,
    rechts.schulter,
  )
  group.add(torso, beine[0]!, beine[1]!)
  group.traverse((o3) => {
    if (o3 instanceof THREE.Mesh && o3.material !== lanternMaterial) o3.castShadow = true
  })

  return {
    group,
    torso,
    body,
    head,
    kopf,
    huefte: HUEFTE,
    arm: links.schulter,
    armRight: rechts.schulter,
    elbowRight: rechts.ellbogen,
    legLeft: beine[0]!,
    legRight: beine[1]!,
    kneeLeft: knie[0]!,
    kneeRight: knie[1]!,
    lantern,
    lanternMaterial,
    axe,
  }
}
