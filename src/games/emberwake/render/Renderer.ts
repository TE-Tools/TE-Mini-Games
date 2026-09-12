import * as THREE from 'three'
import { createLogger } from '@/games/emberwake/core/Logger'
import type { QualitySettings } from '@/games/emberwake/platform/Capabilities'

/**
 * WebGL-Renderer mit Qualitätsstufen und dynamischer Anpassung
 * (PERFORMANCE.md §4). Kontextverlust wird abgefangen (MOBILE.md §5).
 */
const log = createLogger('render')

export class Renderer {
  readonly gl: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  quality: QualitySettings
  contextLost = false

  private lowFpsTime = 0
  private downgrades = 0
  onContextLost: (() => void) | null = null
  onContextRestored: (() => void) | null = null
  onQualityChanged: ((q: QualitySettings) => void) | null = null

  constructor(canvas: HTMLCanvasElement, quality: QualitySettings) {
    this.canvas = canvas
    this.quality = { ...quality }
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    })
    this.gl.shadowMap.enabled = quality.shadows
    this.gl.shadowMap.type = THREE.PCFShadowMap
    this.applyPixelRatio()

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      log.warn('WebGL-Kontext verloren')
      this.onContextLost?.()
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false
      log.info('WebGL-Kontext wiederhergestellt')
      this.onContextRestored?.()
    })
  }

  private applyPixelRatio(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap)
    this.gl.setPixelRatio(ratio)
  }

  resize(width: number, height: number): void {
    this.gl.setSize(width, height, false)
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.contextLost) return
    this.gl.render(scene, camera)
  }

  /**
   * Fällt die Bildrate über 3 Sekunden unter den Zielwert, wird
   * schrittweise heruntergestuft — zuerst Pixelverhältnis, dann Schatten.
   * Nie der Spielinhalt.
   */
  observeFrame(frameDt: number): void {
    const fps = 1 / Math.max(frameDt, 1e-3)
    if (fps < 26) {
      this.lowFpsTime += frameDt
      if (this.lowFpsTime > 3 && this.downgrades < 3) {
        this.lowFpsTime = 0
        this.downgrade()
      }
    } else {
      this.lowFpsTime = Math.max(0, this.lowFpsTime - frameDt * 0.5)
    }
  }

  private downgrade(): void {
    this.downgrades++
    if (this.quality.pixelRatioCap > 1) {
      this.quality.pixelRatioCap = Math.max(1, this.quality.pixelRatioCap - 0.5)
      this.applyPixelRatio()
      log.warn(`Leistung: Pixelverhältnis auf ${this.quality.pixelRatioCap}`)
    } else if (this.quality.particleBudget > 60) {
      this.quality.particleBudget = 60
      log.warn('Leistung: Partikel reduziert')
    } else if (this.quality.shadows) {
      this.quality.shadows = false
      this.gl.shadowMap.enabled = false
      log.warn('Leistung: Schatten aus')
    }
    this.onQualityChanged?.(this.quality)
  }

  get info(): { calls: number; triangles: number } {
    return { calls: this.gl.info.render.calls, triangles: this.gl.info.render.triangles }
  }

  dispose(): void {
    this.gl.dispose()
  }
}
