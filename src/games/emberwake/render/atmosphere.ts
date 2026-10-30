import * as THREE from 'three'
import { Rng } from '@/games/emberwake/core/Rng'

/**
 * Himmel, Sterne und Lichthöfe (30.10.2026).
 *
 * Alles prozedural und ohne Bilddatei (PERFORMANCE.md §3.1): Der Himmel
 * ist eine Kuppel mit Farbverlauf im Shader, die Sterne sind ein einziges
 * Points-Objekt, der Lichthof ist eine 64×64-Leinwand -- zusammen drei
 * Draw Calls und ein paar Kilobyte Speicher.
 */

let glowTexture: THREE.CanvasTexture | null = null

/** Ein weicher, runder Lichtfleck -- für Funken und Lichthöfe. Einmal je Seite. */
export function glow(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.18)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  glowTexture = new THREE.CanvasTexture(c)
  glowTexture.colorSpace = THREE.SRGBColorSpace
  return glowTexture
}

/**
 * Die Himmelskuppel. Oben die Himmelsfarbe, zum Horizont hin die
 * Nebelfarbe -- so verschwimmt der Rand des Geländes nahtlos im Himmel,
 * statt vor einer flachen Farbwand zu enden.
 */
export class Sky {
  readonly mesh: THREE.Mesh
  readonly stars: THREE.Points
  private readonly material: THREE.ShaderMaterial
  private readonly starMaterial: THREE.PointsMaterial

  constructor() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        oben: { value: new THREE.Color() },
        horizont: { value: new THREE.Color() },
        glut: { value: new THREE.Color(0xff8a4a) },
        glutStaerke: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 oben;
        uniform vec3 horizont;
        uniform vec3 glut;
        uniform float glutStaerke;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 farbe = mix(horizont, oben, pow(h, 0.55));
          // Ein warmer Saum am Horizont in der Dämmerung.
          farbe += glut * glutStaerke * pow(1.0 - h, 6.0);
          gl_FragColor = vec4(farbe, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 12), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -10

    // Sterne nur auf der oberen Halbkugel, fest ausgewürfelt.
    const rng = new Rng(0x57a2)
    const anzahl = 320
    const pos = new Float32Array(anzahl * 3)
    for (let i = 0; i < anzahl; i++) {
      const a = rng.angle()
      const y = 0.15 + rng.next() * 0.85
      const r = Math.sqrt(1 - y * y)
      pos[i * 3] = Math.cos(a) * r * 190
      pos[i * 3 + 1] = y * 190
      pos[i * 3 + 2] = Math.sin(a) * r * 190
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.starMaterial = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      map: glow(),
      color: 0xdfe8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
    })
    this.stars = new THREE.Points(geo, this.starMaterial)
    this.stars.frustumCulled = false
    this.stars.renderOrder = -9
  }

  /** Farben setzen und die Kuppel mit der Kamera mitführen. */
  update(oben: THREE.Color, horizont: THREE.Color, sun: number, x: number, z: number): void {
    const u = this.material.uniforms
    ;(u.oben!.value as THREE.Color).copy(oben)
    ;(u.horizont!.value as THREE.Color).copy(horizont)
    // Dämmerung: am stärksten, wenn die Sonne halb steht.
    u.glutStaerke!.value = Math.max(0, 1 - Math.abs(sun - 0.45) * 3) * 0.35
    this.mesh.position.set(x, 0, z)
    this.stars.position.set(x, 0, z)
    this.starMaterial.opacity = Math.max(0, 1 - sun * 2.2) * 0.9
    this.stars.visible = this.starMaterial.opacity > 0.01
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
    this.stars.geometry.dispose()
    this.starMaterial.dispose()
  }
}

/** Ein Lichthof: weicher, additiver Schein um eine Lichtquelle. */
export function halo(farbe: number): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow(),
      color: farbe,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  sprite.renderOrder = 5
  return sprite
}
