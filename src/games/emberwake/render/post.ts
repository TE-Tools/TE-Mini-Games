import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

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

  return {
    render: () => composer.render(),
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
