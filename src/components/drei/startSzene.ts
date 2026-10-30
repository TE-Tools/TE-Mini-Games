/**
 * Die schwebenden Spielsachen im Kopf der Startseite.
 *
 * Zwei Würfel, eine Karte, eine Münze und ein violetter Stein treiben an
 * den Rändern, langsam und jeder in seinem Takt. Die Mitte bleibt frei --
 * dort stehen Marke und Begrüßung, und die sollen lesbar bleiben.
 *
 * Gezeichnet wird nur, solange die Bühne zu sehen ist und der Tab vorne
 * liegt. Wer nach unten zu den Kacheln scrollt, kostet keinen Akku mehr.
 */

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { kartenRueckseite, kartenSeite, wuerfelSeite } from './texturen'

interface Schwebend {
  objekt: THREE.Object3D
  /** Platz als Anteil der halben sichtbaren Breite bzw. Höhe. */
  ax: number
  ay: number
  z: number
  phase: number
  tempo: number
  dreh: THREE.Vector3
}

export interface StartSzene {
  dispose: () => void
}

export function starteStartSzene(
  leinwand: HTMLCanvasElement,
  beiErstemBild: () => void,
): StartSzene {
  const renderer = new THREE.WebGLRenderer({
    canvas: leinwand,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const szene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const umgebung = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  szene.environment = umgebung
  pmrem.dispose()

  const kamera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
  kamera.position.set(0, 0, 7)

  const licht = new THREE.DirectionalLight(0xffffff, 1.4)
  licht.position.set(3, 5, 6)
  szene.add(licht)

  const entsorgen: { dispose: () => void }[] = [umgebung]

  /* ------------------------------------------------------- Die Teile */

  const wuerfelGeo = new RoundedBoxGeometry(1, 1, 1, 4, 0.16)
  const wuerfelMat = [3, 4, 1, 6, 2, 5].map((n) => {
    const map = wuerfelSeite(n)
    entsorgen.push(map)
    return new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0 })
  })
  entsorgen.push(wuerfelGeo, ...wuerfelMat)

  const kartenGeo = new RoundedBoxGeometry(1.1, 1.55, 0.04, 2, 0.02)
  const vorne = kartenSeite()
  const hinten = kartenRueckseite()
  const weiss = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  const kartenMat = [
    weiss,
    weiss,
    weiss,
    weiss,
    new THREE.MeshStandardMaterial({ map: vorne, roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ map: hinten, roughness: 0.45 }),
  ]
  entsorgen.push(kartenGeo, vorne, hinten, ...kartenMat)

  const muenzGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 40)
  const muenzMat = new THREE.MeshStandardMaterial({
    color: 0xd4a017,
    metalness: 0.9,
    roughness: 0.28,
  })
  entsorgen.push(muenzGeo, muenzMat)

  const steinGeo = new THREE.IcosahedronGeometry(0.55, 0)
  const steinMat = new THREE.MeshPhysicalMaterial({
    color: 0x6d4ae8,
    roughness: 0.15,
    metalness: 0.1,
    clearcoat: 1,
    flatShading: true,
  })
  entsorgen.push(steinGeo, steinMat)

  const teile: Schwebend[] = []
  const neu = (
    objekt: THREE.Object3D,
    ax: number,
    ay: number,
    z: number,
    groesse: number,
  ): void => {
    objekt.scale.setScalar(groesse)
    szene.add(objekt)
    teile.push({
      objekt,
      ax,
      ay,
      z,
      phase: Math.random() * Math.PI * 2,
      tempo: 0.6 + Math.random() * 0.5,
      dreh: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(0.25 + Math.random() * 0.2),
    })
    objekt.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
  }

  // Links und rechts der Begrüßung, nie über dem Logo oder den Knöpfen im Kopf.
  neu(new THREE.Mesh(wuerfelGeo, wuerfelMat), -0.84, -0.12, 0, 0.85)
  neu(new THREE.Mesh(wuerfelGeo, wuerfelMat), 0.8, -0.72, -1, 0.7)
  neu(new THREE.Mesh(kartenGeo, kartenMat), 0.86, 0.12, -0.4, 0.9)
  neu(new THREE.Mesh(muenzGeo, muenzMat), -0.86, -0.95, -0.8, 0.7)
  neu(new THREE.Mesh(steinGeo, steinMat), -0.42, 0.9, -2.5, 0.6)

  /* ----------------------------------------------------- Größe, Maus */

  let breite = 1
  let hoehe = 1
  const groesse = () => {
    breite = Math.max(1, leinwand.clientWidth)
    hoehe = Math.max(1, leinwand.clientHeight)
    renderer.setSize(breite, hoehe, false)
    kamera.aspect = breite / hoehe
    kamera.updateProjectionMatrix()
  }
  groesse()
  const beobachter = new ResizeObserver(groesse)
  beobachter.observe(leinwand)

  // Die Maus (oder der Finger) zieht die Kamera ein wenig mit -- Tiefe,
  // die man spürt, ohne dass etwas zu tun ist.
  const ziel = new THREE.Vector2()
  const blick = new THREE.Vector2()
  const zeiger = (e: PointerEvent) => {
    ziel.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
  }
  window.addEventListener('pointermove', zeiger, { passive: true })

  /* ------------------------------------------------------- Schleife */

  let laeuft = false
  let sichtbar = true
  let erstesBild = true
  let rahmen = 0
  const uhr = new THREE.Clock()

  const bild = () => {
    rahmen = 0
    if (!laeuft) return
    const dt = Math.min(uhr.getDelta(), 0.05)
    const t = uhr.elapsedTime

    blick.lerp(ziel, 0.04)
    kamera.position.x = blick.x * 0.35
    kamera.position.y = -blick.y * 0.25
    kamera.lookAt(0, 0, 0)

    // Halbe sichtbare Breite und Höhe auf der Ebene z = 0.
    const halbH = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2)) * kamera.position.z
    const halbB = halbH * kamera.aspect

    for (const s of teile) {
      const o = s.objekt
      o.position.set(
        s.ax * halbB + Math.sin(t * 0.4 * s.tempo + s.phase) * 0.08,
        s.ay * halbH + Math.sin(t * 0.9 * s.tempo + s.phase) * 0.14,
        s.z,
      )
      o.rotation.x += s.dreh.x * dt
      o.rotation.y += s.dreh.y * dt
      o.rotation.z += s.dreh.z * dt
    }

    renderer.render(szene, kamera)
    if (erstesBild) {
      erstesBild = false
      beiErstemBild()
    }
    rahmen = requestAnimationFrame(bild)
  }

  const pruefe = () => {
    const soll = sichtbar && document.visibilityState === 'visible'
    if (soll && !laeuft) {
      laeuft = true
      uhr.getDelta()
      rahmen = requestAnimationFrame(bild)
    } else if (!soll && laeuft) {
      laeuft = false
      cancelAnimationFrame(rahmen)
    }
  }

  const sicht = new IntersectionObserver((eintraege) => {
    sichtbar = eintraege.some((e) => e.isIntersecting)
    pruefe()
  })
  sicht.observe(leinwand)
  document.addEventListener('visibilitychange', pruefe)
  pruefe()

  return {
    dispose: () => {
      laeuft = false
      cancelAnimationFrame(rahmen)
      sicht.disconnect()
      beobachter.disconnect()
      document.removeEventListener('visibilitychange', pruefe)
      window.removeEventListener('pointermove', zeiger)
      for (const e of entsorgen) e.dispose()
      renderer.dispose()
    },
  }
}
