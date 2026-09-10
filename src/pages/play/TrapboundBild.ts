/**
 * Das Zeichnen von Trapbound.
 *
 * Reines Canvas, keine Spiellogik: Was hier passiert, verändert nie den
 * Spielstand. Dadurch bleibt die Engine testbar, und der Anblick lässt sich
 * ändern, ohne dass jemand am Spiel schraubt.
 *
 * Stil: dunkler Grund, helle Kanten, Fallen in warnendem Rot. Alles ist
 * gezeichnet -- keine Bilddateien, damit die App klein bleibt und offline
 * funktioniert.
 */

import { feld, istFest } from '@/games/trapbound'
import type { Spielstand } from '@/games/trapbound'
import { BILD_BREITE, BILD_HOEHE } from '@/games/trapbound'
import { PHYSIK } from '@/games/trapbound'
import type { Welt } from '@/games/trapbound'

export interface ZeichenOptionen {
  welt: Welt
  /** Bildschirmwackeln erlaubt. */
  beben: boolean
  /** Laufende Gesamtzeit für Animationen. */
  uhr: number
}

/** Ein Zackenband für Stacheln und Sägen. */
function zacken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  nachOben: boolean,
): void {
  const n = Math.max(2, Math.round(b / 8))
  const s = b / n
  ctx.beginPath()
  ctx.moveTo(x, nachOben ? y + h : y)
  for (let i = 0; i < n; i++) {
    ctx.lineTo(x + i * s + s / 2, nachOben ? y : y + h)
    ctx.lineTo(x + (i + 1) * s, nachOben ? y + h : y)
  }
  ctx.closePath()
  ctx.fill()
}

export function zeichne(
  ctx: CanvasRenderingContext2D,
  stand: Spielstand,
  opt: ZeichenOptionen,
): void {
  const p = opt.welt.palette
  const breite = stand.level.breite ?? BILD_BREITE
  const hoehe = stand.level.hoehe ?? BILD_HOEHE

  ctx.save()
  if (opt.beben && stand.beben > 0) {
    const kraft = stand.beben * 5
    ctx.translate((Math.sin(opt.uhr * 61) * kraft) | 0, (Math.cos(opt.uhr * 77) * kraft) | 0)
  }

  // Grund und Ferne.
  const grund = ctx.createLinearGradient(0, 0, 0, hoehe)
  grund.addColorStop(0, p.ferne)
  grund.addColorStop(1, p.hintergrund)
  ctx.fillStyle = grund
  ctx.fillRect(-20, -20, breite + 40, hoehe + 40)

  ctx.fillStyle = p.boden
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 7; i++) {
    const x = 30 + i * 72
    const h = 26 + ((i * 53) % 34)
    ctx.beginPath()
    ctx.moveTo(x - 12, 0)
    ctx.lineTo(x + 12, 0)
    ctx.lineTo(x, h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // Objekte.
  for (let i = 0; i < stand.level.objekte.length; i++) {
    const o = stand.level.objekte[i]!
    const st = stand.staende[i]!
    if (!st.aktiv) continue
    const f = feld(o, st)

    if (!st.sichtbar && !o.geheim) continue
    if (!st.sichtbar && o.geheim) continue

    switch (o.typ) {
      case 'block':
      case 'bruch':
      case 'fall':
      case 'beweger': {
        const bruechig = o.typ === 'bruch' || o.typ === 'fall'
        ctx.fillStyle = p.boden
        if (st.zittert > 0) {
          // Kurz vor dem Wegbrechen flackert die Platte.
          ctx.fillStyle = Math.floor(opt.uhr * 22) % 2 === 0 ? p.gefahr : p.boden
        }
        const wackel = st.zittert > 0 ? Math.sin(opt.uhr * 60) * 1.2 : 0
        ctx.fillRect(f.x + wackel, f.y, f.b, f.h)
        ctx.fillStyle = p.bodenKante
        ctx.fillRect(f.x + wackel, f.y, f.b, 3)
        if (bruechig) {
          // Risse als leiser Hinweis -- fair bleibt das Spiel nur, wenn man
          // es beim zweiten Mal sehen kann.
          ctx.strokeStyle = p.hintergrund
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let k = 1; k < 3; k++) {
            const x = f.x + (f.b / 3) * k + wackel
            ctx.moveTo(x, f.y + 3)
            ctx.lineTo(x - 3, f.y + f.h)
          }
          ctx.stroke()
        }
        if (o.typ === 'beweger') {
          ctx.fillStyle = p.akzent
          ctx.fillRect(f.x + f.b / 2 - 6 + wackel, f.y + 5, 12, 2)
        }
        break
      }
      case 'feder': {
        ctx.fillStyle = p.akzent
        ctx.fillRect(f.x, f.y, f.b, 4)
        ctx.fillStyle = p.bodenKante
        for (let k = 0; k < 3; k++) {
          ctx.fillRect(f.x + 3 + k * (f.b / 3), f.y + 4, f.b / 3 - 4, 3)
        }
        break
      }
      case 'stachel': {
        ctx.fillStyle = p.gefahr
        zacken(ctx, f.x, f.y, f.b, f.h, true)
        break
      }
      case 'saege': {
        const m = { x: f.x + f.b / 2, y: f.y + f.h / 2 }
        ctx.save()
        ctx.translate(m.x, m.y)
        ctx.rotate(opt.uhr * 9)
        ctx.fillStyle = p.gefahr
        ctx.beginPath()
        for (let k = 0; k < 8; k++) {
          const w = (k / 8) * Math.PI * 2
          const r = k % 2 === 0 ? f.b / 2 : f.b / 3.4
          ctx.lineTo(Math.cos(w) * r, Math.sin(w) * r)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = p.hintergrund
        ctx.beginPath()
        ctx.arc(0, 0, f.b / 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        break
      }
      case 'tuer': {
        ctx.fillStyle = st.offen ? p.boden : p.bodenKante
        ctx.globalAlpha = st.offen ? 0.35 : 1
        ctx.fillRect(f.x, f.y, f.b, f.h)
        ctx.globalAlpha = 1
        break
      }
      case 'knopf': {
        ctx.fillStyle = st.ausgeloest ? p.akzent : p.gefahr
        ctx.fillRect(f.x, f.y + (st.ausgeloest ? 3 : 0), f.b, f.h - (st.ausgeloest ? 3 : 0))
        break
      }
      case 'teleport': {
        const puls = 0.6 + Math.sin(opt.uhr * 6) * 0.25
        ctx.strokeStyle = p.akzent
        ctx.lineWidth = 2
        ctx.globalAlpha = puls
        ctx.beginPath()
        ctx.ellipse(f.x + f.b / 2, f.y + f.h / 2, f.b / 2, f.h / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = puls * 0.35
        ctx.fillStyle = p.akzent
        ctx.fill()
        ctx.globalAlpha = 1
        break
      }
      case 'kristall': {
        const schweb = Math.sin(opt.uhr * 3) * 2
        ctx.fillStyle = p.akzent
        ctx.beginPath()
        ctx.moveTo(f.x + f.b / 2, f.y + schweb)
        ctx.lineTo(f.x + f.b, f.y + f.h / 2 + schweb)
        ctx.lineTo(f.x + f.b / 2, f.y + f.h + schweb)
        ctx.lineTo(f.x, f.y + f.h / 2 + schweb)
        ctx.closePath()
        ctx.fill()
        break
      }
      case 'ziel': {
        const rahmen = o.falle ? p.gefahr : p.akzent
        ctx.fillStyle = p.hintergrund
        ctx.fillRect(f.x, f.y, f.b, f.h)
        ctx.strokeStyle = rahmen
        ctx.lineWidth = 2
        ctx.strokeRect(f.x + 1, f.y + 1, f.b - 2, f.h - 2)
        const schein = 0.35 + Math.sin(opt.uhr * 4) * 0.2
        ctx.globalAlpha = schein
        ctx.fillStyle = rahmen
        ctx.fillRect(f.x + 3, f.y + 3, f.b - 6, f.h - 6)
        ctx.globalAlpha = 1
        ctx.fillStyle = rahmen
        ctx.fillRect(f.x + f.b - 7, f.y + f.h / 2 - 1, 3, 3)
        break
      }
      case 'schild': {
        ctx.fillStyle = p.boden
        ctx.fillRect(f.x, f.y, f.b, f.h)
        ctx.fillStyle = p.bodenKante
        ctx.fillRect(f.x + f.b / 2 - 1, f.y + f.h, 2, 8)
        ctx.fillStyle = p.akzent
        ctx.font = 'bold 8px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(o.text ?? '', f.x + f.b / 2, f.y + f.h / 2 + 1)
        ctx.textAlign = 'left'
        break
      }
      default:
        break
    }
    void istFest
  }

  // Die Spielfigur: eine schlanke Silhouette mit einem Auge. Wenig Striche,
  // damit sie auf dem Handy noch zu erkennen ist.
  const k = stand.koerper
  if (stand.phase !== 'tot') {
    const kopfUnten = stand.schwerkraft < 0
    ctx.save()
    ctx.translate(k.x + PHYSIK.breite / 2, k.y + PHYSIK.hoehe / 2)
    if (kopfUnten) ctx.scale(1, -1)
    const lauf = k.amBoden && Math.abs(k.vx) > 8 ? Math.sin(opt.uhr * 18) * 1.6 : 0
    ctx.fillStyle = '#f4f1ff'
    ctx.beginPath()
    ctx.roundRect(-PHYSIK.breite / 2, -PHYSIK.hoehe / 2 + 3, PHYSIK.breite, PHYSIK.hoehe - 3, 3)
    ctx.fill()
    ctx.fillStyle = '#f4f1ff'
    ctx.beginPath()
    ctx.arc(0, -PHYSIK.hoehe / 2 + 3, 4.4, 0, Math.PI * 2)
    ctx.fill()
    // Beine
    ctx.fillStyle = p.hintergrund
    ctx.fillRect(-3.4 + lauf, PHYSIK.hoehe / 2 - 4, 2.4, 4)
    ctx.fillRect(1 - lauf, PHYSIK.hoehe / 2 - 4, 2.4, 4)
    // Auge in Blickrichtung
    ctx.fillStyle = p.hintergrund
    ctx.beginPath()
    ctx.arc(k.blick * 1.6, -PHYSIK.hoehe / 2 + 3, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Ein feiner Rahmen um das Spielfeld: Auf einem hochkant gehaltenen
  // Telefon bleibt oben und unten Platz übrig, und ohne Rahmen schwebt das
  // Bild darin, statt eine Bühne zu sein.
  ctx.strokeStyle = p.bodenKante
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, breite - 1, hoehe - 1)
  ctx.globalAlpha = 1

  // Funken.
  for (const f of stand.funken) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.t * 2))
    ctx.fillStyle = f.farbe
    ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3)
  }
  ctx.globalAlpha = 1

  ctx.restore()
}
