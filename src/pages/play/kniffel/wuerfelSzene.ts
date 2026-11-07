/**
 * Die fünf Kniffelwürfel in 3D.
 *
 * Die Szene zeigt nur, was die Seite ihr sagt: welche Augen, welche
 * gehalten, welche gerade fallen. Sie würfelt nicht selbst -- das Ergebnis
 * steht fest, bevor die Animation beginnt, und die Animation landet genau
 * darauf. Zufällig ist nur, wie der Würfel taumelt.
 *
 * Über der Leinwand liegen die echten Knöpfe der Würfelreihe, unsichtbar,
 * aber anklickbar und vorlesbar. Die Szene muss deshalb nichts treffen:
 * Die Würfel stehen genau unter ihren Knöpfen, mehr nicht.
 *
 * Gezeichnet wird nur, solange sich etwas bewegt. Ein ruhender Tisch
 * kostet kein einziges Bild.
 */

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { wuerfelSeite } from '@/components/drei/texturen'
import { WUERFEL_FARBEN } from '@/components/designs/designs'
import type { WuerfelDesignId } from '@/services/sammlung'

/*
 * Welche Seite des Würfels welche Zahl trägt, und wie man sie nach oben
 * dreht. Gegenüberliegende Seiten ergeben sieben, wie bei jedem echten
 * Würfel. Die Reihenfolge der Materialien folgt Three.js' Box:
 * +x, -x, +y, -y, +z, -z.
 */
const SEITEN_AUGEN = [3, 4, 1, 6, 2, 5]

const NACH_OBEN: Record<number, THREE.Euler> = {
  1: new THREE.Euler(0, 0, 0),
  6: new THREE.Euler(Math.PI, 0, 0),
  2: new THREE.Euler(-Math.PI / 2, 0, 0),
  5: new THREE.Euler(Math.PI / 2, 0, 0),
  3: new THREE.Euler(0, 0, Math.PI / 2),
  4: new THREE.Euler(0, 0, -Math.PI / 2),
}

const WEISS = new THREE.Color(0xffffff)
/** Ein gehaltener Würfel wird warm getönt -- wie der goldene Rand in 2D. */
const GOLD = new THREE.Color(0xffe2a0)

const GROESSE = 0.8
const ANHEBEN = 0.32

interface Wurf {
  start: number
  dauer: number
  achse: THREE.Vector3
  drehung: number
  vonX: number
  vonZ: number
  hoehe: number
}

interface Wuerfel {
  mesh: THREE.Mesh
  materialien: THREE.MeshStandardMaterial[]
  augen: number
  gehalten: boolean
  ziel: THREE.Quaternion
  /** Wie weit angehoben (0 bis 1), läuft dem Ziel weich nach. */
  hub: number
  /** Wie groß gerade (0 bis 1) -- vor dem ersten Wurf sind die Würfel weg. */
  zeigen: number
  wurf: Wurf | null
  basisX: number
}

export interface WuerfelSzene {
  /**
   * Neuer Stand. `rollen[i]` heißt: Würfel i ist gerade frisch gefallen und
   * soll taumelnd auf seinem Wert landen.
   */
  setze: (
    augen: readonly number[],
    gehalten: readonly boolean[],
    rollen: readonly boolean[],
  ) => void
  /** Abstand der Würfel als Vielfaches ihrer Breite (aus dem Raster der Knöpfe). */
  setzeAbstand: (teilung: number) => void
  dispose: () => void
}

/** Wie lange ein Wurf höchstens taumelt -- für die Seite, die darauf wartet. */
export const WURF_DAUER_MS = 900

/** `design`: nur Aussehen (services/sammlung.ts) -- Farbe von Fläche und Augen. */
export function starteWuerfelSzene(
  leinwand: HTMLCanvasElement,
  design: WuerfelDesignId = 'standard',
): WuerfelSzene {
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap

  const szene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const umgebung = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  szene.environment = umgebung
  szene.environmentIntensity = 0.8
  pmrem.dispose()

  const kamera = new THREE.PerspectiveCamera(28, 1, 0.1, 60)

  const sonne = new THREE.DirectionalLight(0xffffff, 1.6)
  sonne.position.set(-2.5, 7, 3.5)
  sonne.castShadow = true
  sonne.shadow.mapSize.set(1024, 1024)
  sonne.shadow.camera.left = -4
  sonne.shadow.camera.right = 4
  sonne.shadow.camera.top = 3
  sonne.shadow.camera.bottom = -3
  sonne.shadow.radius = 6
  sonne.shadow.bias = -0.0005
  szene.add(sonne)

  // Der Boden ist unsichtbar bis auf den Schatten -- der Filz darunter ist
  // CSS. Er ist nur so groß wie das Brett, sonst fiele der Schatten eines
  // hüpfenden Würfels neben den Filz auf die helle Seite.
  const bodenGeo = new THREE.PlaneGeometry(1, 1)
  const bodenMat = new THREE.ShadowMaterial({ opacity: 0.28 })
  const boden = new THREE.Mesh(bodenGeo, bodenMat)
  boden.rotation.x = -Math.PI / 2
  boden.receiveShadow = true
  szene.add(boden)

  const geo = new RoundedBoxGeometry(1, 1, 1, 5, 0.17)
  const farben = design === 'standard' ? undefined : WUERFEL_FARBEN[design]
  const texturen = SEITEN_AUGEN.map((n) => wuerfelSeite(n, farben))

  let teilung = 1.15

  const wuerfel: Wuerfel[] = Array.from({ length: 5 }, (_, i) => {
    const materialien = texturen.map(
      (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.32, metalness: 0 }),
    )
    const mesh = new THREE.Mesh(geo, materialien)
    mesh.castShadow = true
    mesh.scale.setScalar(0.0001)
    szene.add(mesh)
    return {
      mesh,
      materialien,
      augen: 0,
      gehalten: false,
      ziel: new THREE.Quaternion(),
      hub: 0,
      zeigen: 0,
      wurf: null,
      basisX: (i - 2) * teilung,
    }
  })

  /* ------------------------------------------------------- Kamera */

  // Schräg von oben, etwa wie man am Tisch auf die Würfel schaut. Die
  // Entfernung wird so gewählt, dass die Reihe genau die Leinwand füllt --
  // dann steht jeder Würfel unter seinem Knopf.
  // Steil genug, dass die obere Seite -- die zählt -- die größte ist.
  const NEIGUNG = THREE.MathUtils.degToRad(68)
  const kameraStellen = () => {
    const halbB = 2.5 * teilung
    boden.scale.set(5 * teilung, 1.5, 1)
    const halbFov = THREE.MathUtils.degToRad(kamera.fov / 2)
    const abstand = halbB / (Math.tan(halbFov) * kamera.aspect)
    kamera.position.set(0, GROESSE / 2 + Math.sin(NEIGUNG) * abstand, Math.cos(NEIGUNG) * abstand)
    kamera.lookAt(0, GROESSE / 2, 0)
    kamera.updateProjectionMatrix()
  }

  const groesse = () => {
    const b = Math.max(1, leinwand.clientWidth)
    const h = Math.max(1, leinwand.clientHeight)
    renderer.setSize(b, h, false)
    kamera.aspect = b / h
    kameraStellen()
    anstossen()
  }

  /* ------------------------------------------------------ Schleife */

  let rahmen = 0
  const uhr = new THREE.Clock()
  const hilfsQ = new THREE.Quaternion()

  const anstossen = () => {
    if (rahmen === 0) {
      uhr.getDelta()
      rahmen = requestAnimationFrame(bild)
    }
  }

  const bild = () => {
    rahmen = 0
    const dt = Math.min(uhr.getDelta(), 0.05)
    const jetzt = performance.now()
    let bewegt = false

    for (const w of wuerfel) {
      const sollZeigen = w.augen > 0 ? 1 : 0
      const sollHub = w.gehalten ? 1 : 0
      // Weich nachlaufen, unabhängig von der Bildrate.
      const k = 1 - Math.exp(-dt * 14)
      w.zeigen += (sollZeigen - w.zeigen) * k
      w.hub += (sollHub - w.hub) * k
      if (Math.abs(sollZeigen - w.zeigen) < 0.002) w.zeigen = sollZeigen
      if (Math.abs(sollHub - w.hub) < 0.002) w.hub = sollHub
      if (w.zeigen !== sollZeigen || w.hub !== sollHub) bewegt = true

      // Gold blendet mit dem Anheben ein.
      for (const m of w.materialien) m.color.copy(WEISS).lerp(GOLD, w.hub)

      let x = w.basisX
      let y = GROESSE / 2 + w.hub * ANHEBEN
      let z = 0
      w.mesh.quaternion.copy(w.ziel)

      if (w.wurf) {
        const t = Math.max(0, Math.min(1, (jetzt - w.wurf.start) / w.wurf.dauer))
        const sanft = 1 - Math.pow(1 - t, 3)
        // Zwei, drei Hüpfer, die kleiner werden, bis er liegt.
        y += w.wurf.hoehe * Math.pow(1 - t, 2) * Math.abs(Math.cos(t * Math.PI * 2.5))
        x += w.wurf.vonX * (1 - sanft)
        z += w.wurf.vonZ * (1 - sanft)
        hilfsQ.setFromAxisAngle(w.wurf.achse, w.wurf.drehung * (1 - sanft))
        w.mesh.quaternion.multiply(hilfsQ)
        if (t >= 1) w.wurf = null
        bewegt = true
      }

      w.mesh.position.set(x, y, z)
      w.mesh.scale.setScalar(Math.max(0.0001, w.zeigen * GROESSE))
    }

    renderer.render(szene, kamera)
    if (bewegt) {
      rahmen = requestAnimationFrame(bild)
    }
  }

  const beobachter = new ResizeObserver(groesse)
  beobachter.observe(leinwand)
  groesse()

  /* -------------------------------------------------------- Außen */

  const zielDrehung = (augen: number): THREE.Quaternion => {
    const basis = new THREE.Quaternion().setFromEuler(NACH_OBEN[augen] ?? NACH_OBEN[1]!)
    // Ein wenig schief liegen sie immer -- in Reih und Glied sähen sie gemalt aus.
    const schief = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (Math.random() - 0.5) * 0.5,
    )
    return schief.multiply(basis)
  }

  return {
    setze: (augen, gehalten, rollen) => {
      const jetzt = performance.now()
      wuerfel.forEach((w, i) => {
        const neueAugen = augen[i] ?? 0
        const rollt = (rollen[i] ?? false) && neueAugen > 0
        if (neueAugen !== w.augen || rollt) {
          if (neueAugen > 0) w.ziel.copy(zielDrehung(neueAugen))
        }
        if (rollt) {
          w.wurf = {
            start: jetzt + Math.random() * 90,
            dauer: 620 + Math.random() * 220,
            achse: new THREE.Vector3(
              Math.random() - 0.5,
              Math.random() - 0.5,
              Math.random() - 0.5,
            ).normalize(),
            drehung: Math.PI * (3 + Math.random() * 2) * (Math.random() < 0.5 ? -1 : 1),
            vonX: (Math.random() - 0.5) * 0.8,
            vonZ: 0.5 + Math.random() * 0.5,
            hoehe: 1.1 + Math.random() * 0.4,
          }
          // Wer noch gar nicht da war, fällt nicht aus dem Nichts heraus,
          // sondern ist schon in der Luft sichtbar.
          if (w.zeigen === 0) w.zeigen = 0.6
        }
        w.augen = neueAugen
        w.gehalten = (gehalten[i] ?? false) && neueAugen > 0
      })
      anstossen()
    },

    setzeAbstand: (neu) => {
      if (Math.abs(neu - teilung) < 0.001) return
      teilung = neu
      wuerfel.forEach((w, i) => (w.basisX = (i - 2) * teilung))
      kameraStellen()
      anstossen()
    },

    dispose: () => {
      cancelAnimationFrame(rahmen)
      rahmen = 0
      beobachter.disconnect()
      geo.dispose()
      bodenGeo.dispose()
      bodenMat.dispose()
      for (const t of texturen) t.dispose()
      for (const w of wuerfel) for (const m of w.materialien) m.dispose()
      umgebung.dispose()
      renderer.dispose()
    },
  }
}
