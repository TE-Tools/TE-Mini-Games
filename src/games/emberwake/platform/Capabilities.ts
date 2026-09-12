import { createLogger } from '@/games/emberwake/core/Logger'

/**
 * Geräteklasse und Qualitätsstufe (PERFORMANCE.md §4).
 * Wird beim Start ermittelt; die dynamische Anpassung im Renderer
 * kann die Stufe später noch senken.
 */
export type QualityTier = 'low' | 'medium' | 'high'

export interface QualitySettings {
  tier: QualityTier
  pixelRatioCap: number
  shadows: boolean
  shadowMapSize: number
  drawDistance: number
  particleBudget: number
  grassDensity: number
  antialias: boolean
}

export interface Capabilities {
  isTouch: boolean
  isIOS: boolean
  isStandalone: boolean
  hasVibration: boolean
  memoryGb: number | null
  cores: number
  gpu: string
  suggestedTier: QualityTier
}

const log = createLogger('caps')

export const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: {
    tier: 'low',
    pixelRatioCap: 1.0,
    shadows: false,
    shadowMapSize: 512,
    drawDistance: 60,
    particleBudget: 60,
    grassDensity: 0,
    antialias: false,
  },
  medium: {
    tier: 'medium',
    pixelRatioCap: 1.5,
    shadows: true,
    shadowMapSize: 512,
    drawDistance: 90,
    particleBudget: 120,
    grassDensity: 0.5,
    antialias: false,
  },
  high: {
    tier: 'high',
    pixelRatioCap: 2.0,
    shadows: true,
    shadowMapSize: 1024,
    drawDistance: 120,
    particleBudget: 200,
    grassDensity: 1,
    antialias: true,
  },
}

export function detectCapabilities(): Capabilities {
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  const memoryGb = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null
  const cores = navigator.hardwareConcurrency ?? 4
  const gpu = probeGpu()

  let tier: QualityTier = 'medium'
  const lowGpu = /Mali-4|Mali-T[67]|Adreno \(TM\) [345]\d\d|PowerVR|SwiftShader|llvmpipe/i.test(gpu)
  const highGpu =
    /Apple|Adreno \(TM\) [67]\d\d|Mali-G7[0-9]|Mali-G[89]|Xclipse|RTX|GeForce|Radeon/i.test(gpu)

  if (lowGpu || (memoryGb !== null && memoryGb <= 3) || cores <= 4) tier = 'low'
  else if (highGpu && (memoryGb === null || memoryGb >= 6)) tier = 'high'

  // iOS meldet weder Speicher noch GPU-Kennung genau — konservativ mittel, aktuelle Geräte hoch.
  if (isIOS) tier = /iPhone OS 1[0-4]_/.test(ua) ? 'low' : 'medium'

  const caps: Capabilities = {
    isTouch,
    isIOS,
    isStandalone,
    hasVibration: typeof navigator.vibrate === 'function',
    memoryGb,
    cores,
    gpu,
    suggestedTier: tier,
  }
  log.info('Geräteklasse ermittelt', caps)
  return caps
}

function probeGpu(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return 'kein WebGL'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info
      ? (gl.getParameter(info.UNMASKED_RENDERER_WEBGL) as string)
      : (gl.getParameter(gl.RENDERER) as string)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return renderer
  } catch {
    return 'unbekannt'
  }
}
