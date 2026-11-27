import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/**
 * Farbabstimmung wie im Kino (27.11.2026), nach den Tonwerten im fertigen
 * Bild: etwas mehr Kontrast in den Mitten, Schatten leicht ins Blaugrüne,
 * Lichter leicht ins Warme, ein Hauch mehr Sättigung und ein feines,
 * bewegtes Korn. Das Korn verdeckt auch die Stufen im Nachthimmel.
 */
const FILMLOOK = {
  uniforms: { tDiffuse: { value: null }, zeit: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float zeit;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // Sanfte S-Kurve um die Mitte.
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);
      // Teilgetönt: Schatten kühl, Lichter warm.
      c += vec3(-0.012, 0.004, 0.022) * (1.0 - smoothstep(0.0, 0.45, l));
      c += vec3(0.03, 0.012, -0.022) * smoothstep(0.55, 1.0, l);
      // Sättigung.
      c = mix(vec3(l), c, 1.08);
      // Korn.
      float n = fract(sin(dot(vUv * 913.0 + zeit, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) * 0.025;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
}

/**
 * Nachbearbeitung: das Leuchten um helle Lichter (PERFORMANCE.md §4: nur
 * Stufe HOCH). Wird per dynamischem Import geladen -- auf NIEDRIG und
 * MITTEL kommt dieses Modul gar nicht erst ins Netz (§5).
 *
 * Die Schwelle liegt hoch: Es leuchten nur Glut, Laterne, Kernkristall und
 * Gegneraugen, nicht der Schnee am Tag. Gerendert wird das Leuchten in
 * halber Auflösung -- es ist weich, da fallen fehlende Pixel nicht auf.
 */
export interface Post {
  render(): void
  setSize(width: number, height: number, pixelRatio: number): void
  dispose(): void
}

export function createPost(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  multisample: boolean,
): Post {
  const size = gl.getSize(new THREE.Vector2())
  const ratio = gl.getPixelRatio()
  // HalfFloat, damit Lichter über 1,0 hell bleiben und das Leuchten speisen;
  // Multisampling ersetzt das Kantenglätten, das der Renderer selbst nicht
  // mehr macht, sobald in ein Zwischenbild gezeichnet wird.
  const target = new THREE.WebGLRenderTarget(size.x * ratio, size.y * ratio, {
    type: THREE.HalfFloatType,
    samples: multisample ? 4 : 0,
  })
  const composer = new EffectComposer(gl, target)
  composer.setPixelRatio(ratio)
  composer.setSize(size.x, size.y)

  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.7, 0.55, 0.82)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const film = new ShaderPass(FILMLOOK)
  composer.addPass(film)

  return {
    render: () => {
      ;(film.uniforms.zeit as { value: number }).value = performance.now() / 1000
      composer.render()
    },
    setSize: (width, height, pixelRatio) => {
      composer.setPixelRatio(pixelRatio)
      composer.setSize(width, height)
      bloom.resolution.set(width / 2, height / 2)
    },
    dispose: () => {
      bloom.dispose()
      composer.dispose()
      target.dispose()
    },
  }
}
