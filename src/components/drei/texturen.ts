/**
 * Texturen für die 3D-Teile, im Browser gemalt.
 *
 * Wie bei den Tönen: keine Bilddateien, die geladen, lizenziert und offline
 * vorgehalten werden müssten. Eine Würfelseite ist ein Quadrat mit Punkten,
 * das malt eine Leinwand in Bruchteilen einer Millisekunde.
 *
 * Nur für Dateien, die ohnehin Three.js laden -- diese Datei selbst zieht
 * es mit hinein.
 */

import * as THREE from 'three'
import { AUGEN_PLAETZE } from '@/pages/play/kniffel/augen'

const GROESSE = 256

function leinwand(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = GROESSE
  c.height = GROESSE
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('2D-Kontext nicht verfügbar')
  return [c, ctx]
}

function alsTextur(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Eine Würfelseite mit `augen` Punkten (1 bis 6). Die Punkte sind leicht
 * eingesenkt gemalt -- ein Verlauf vom dunklen Rand zur noch dunkleren
 * Mitte --, sonst wirken sie wie aufgeklebt.
 */
export function wuerfelSeite(augen: number): THREE.CanvasTexture {
  const [c, ctx] = leinwand()
  ctx.fillStyle = '#fbf9f3'
  ctx.fillRect(0, 0, GROESSE, GROESSE)

  const plaetze = AUGEN_PLAETZE[augen] ?? []
  const raster = [0.25, 0.5, 0.75]
  const r = GROESSE * 0.085
  for (const p of plaetze) {
    const x = raster[p % 3]! * GROESSE
    const y = raster[Math.floor(p / 3)]! * GROESSE
    const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r)
    g.addColorStop(0, '#05070d')
    g.addColorStop(0.75, '#1a1f31')
    g.addColorStop(1, '#3a3f55')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return alsTextur(c)
}

/** Ein Kartenblatt: Herz-Ass, schlicht. Für die Startseite. */
export function kartenSeite(): THREE.CanvasTexture {
  const [c, ctx] = leinwand()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, GROESSE, GROESSE)
  ctx.fillStyle = '#c02b48'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${GROESSE * 0.16}px system-ui, sans-serif`
  ctx.fillText('A', GROESSE * 0.16, GROESSE * 0.14)
  ctx.font = `${GROESSE * 0.48}px system-ui, sans-serif`
  ctx.fillText('♥', GROESSE / 2, GROESSE * 0.54)
  return alsTextur(c)
}

/** Die Rückseite der Karte: Violett mit feinem Rautenmuster und Goldrand. */
export function kartenRueckseite(): THREE.CanvasTexture {
  const [c, ctx] = leinwand()
  ctx.fillStyle = '#5a3ce0'
  ctx.fillRect(0, 0, GROESSE, GROESSE)
  ctx.strokeStyle = 'rgb(255 255 255 / 0.18)'
  ctx.lineWidth = 3
  for (let i = -GROESSE; i < GROESSE * 2; i += 22) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + GROESSE, GROESSE)
    ctx.moveTo(i, GROESSE)
    ctx.lineTo(i + GROESSE, 0)
    ctx.stroke()
  }
  ctx.strokeStyle = '#e8b93a'
  ctx.lineWidth = 10
  ctx.strokeRect(14, 14, GROESSE - 28, GROESSE - 28)
  return alsTextur(c)
}
