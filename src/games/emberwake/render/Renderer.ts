import * as THREE from 'three'
import { createLogger } from '@/games/emberwake/core/Logger'
import type { QualitySettings } from '@/games/emberwake/platform/Capabilities'
import type { Post } from './post'

/**
 * WebGL-Renderer mit Qualitätsstufen und dynamischer Anpassung
 * (PERFORMANCE.md §4). Kontextverlust wird abgefangen (MOBILE.md §5).
 *
 * Seit 30.10.2026 mit Filmlook (ACES-Tonwerte) auf allen Stufen und dem
 * Leuchten (Bloom) auf HOCH. Das Leuchten lädt erst, wenn es gebraucht
 * wird, und fällt bei der dynamischen Anpassung als Zweites weg -- nach
 * dem Pixelverhältnis, vor den Partikeln.
 */
const log = createLogger('render')

export class Renderer {
  readonly gl: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  quality: QualitySettings
  contextLost = false

  private lowFpsTime = 0
  private downgrades = 0
  private width = 1
  private height = 1
  private post: Post | null = null
  private postLaedt = false
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
    // Filmischer Kontrast: Lichter laufen weich aus, statt hart auszubrennen.
    this.gl.toneMapping = THREE.ACESFilmicToneMapping
    this.gl.toneMappingExposure = 1.35
    this.applyPixelRatio()

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      log.warn('WebGL-Kontext verloren')
      this.onContextLost?.()
    })
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false
      // Die Zwischenbilder der Nachbearbeitung sind mit dem Kontext weg.
      this.verwerfePost()
      log.info('WebGL-Kontext wiederhergestellt')
      this.onContextRestored?.()
    })
  }

  private applyPixelRatio(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap)
    this.gl.setPixelRatio(ratio)
    this.post?.setSize(this.width, this.height, ratio)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.gl.setSize(width, height, false)
    this.post?.setSize(width, height, this.gl.getPixelRatio())
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.contextLost) return
    if (this.quality.bloom) {
      if (!this.post && !this.postLaedt) this.ladePost(scene, camera)
    } else if (this.post) {
      this.verwerfePost()
    }
    if (this.post) this.post.render()
    else this.gl.render(scene, camera)
  }

  private ladePost(scene: THREE.Scene, camera: THREE.Camera): void {
    this.postLaedt = true
    void import('./post')
      .then(({ createPost }) => {
        this.postLaedt = false
        if (!this.quality.bloom || this.contextLost || this.post) return
        this.post = createPost(this.gl, scene, camera, this.quality.antialias)
        this.post.setSize(this.width, this.height, this.gl.getPixelRatio())
      })
      .catch((err) => {
        this.postLaedt = false
        // Ohne Leuchten geht es auch -- nicht noch einmal versuchen.
        this.quality.bloom = false
        log.warn('Nachbearbeitung nicht verfügbar', err)
      })
  }

  private verwerfePost(): void {
    this.post?.dispose()
    this.post = null
  }

  /**
   * Fällt die Bildrate über 3 Sekunden unter den Zielwert, wird
   * schrittweise heruntergestuft — zuerst Pixelverhältnis, dann das
   * Leuchten, dann Partikel, dann Schatten. Nie der Spielinhalt.
   */
  observeFrame(frameDt: number): void {
    const fps = 1 / Math.max(frameDt, 1e-3)
    if (fps < 26) {
      this.lowFpsTime += frameDt
      if (this.lowFpsTime > 3 && this.downgrades < 4) {
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
    } else if (this.quality.bloom) {
      this.quality.bloom = false
      this.verwerfePost()
      log.warn('Leistung: Leuchten aus')
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
    this.verwerfePost()
    this.gl.dispose()
  }
}
