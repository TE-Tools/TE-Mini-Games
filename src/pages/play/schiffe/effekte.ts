/**
 * Rakete, Fontäne, Explosion -- gezeichnet auf einer Leinwand über der
 * ganzen Seite.
 *
 * Thomas wollte, dass man sieht, wie „eine Rakete rüber ins andere Feld
 * fliegt und dann entweder eine Wasserfontäne hochgeht oder man eine
 * Explosion sieht". Das steht hier, und nur hier: ein kleines
 * Partikelsystem mit `requestAnimationFrame`, das läuft, solange etwas zu
 * sehen ist, und danach schläft.
 *
 * Was hier NICHT steht: was der Schuss ergibt. Das entscheidet die Engine
 * (oder online der Server) vorher; die Rakete trägt das Ergebnis nur hin --
 * als Wert oder als Versprechen, das spätestens beim Einschlag eingelöst
 * sein muss. Erst beim Einschlag meldet sie es zurück (`onEinschlag`), und
 * erst dann zeigt die Seite es an.
 *
 * Auf dem Handy flüssig: Weiche Kreise werden einmal als kleine Bilder
 * vorgezeichnet und dann nur noch gestempelt, höchstens zweifache
 * Pixeldichte, eine Obergrenze für Partikel. Bei `prefers-reduced-motion`,
 * im Sparmodus (`data-sparsam`) und ohne Leinwand (jsdom in den Tests) gibt
 * es keine Rakete, nur eine kurze Pause und dann das Ergebnis.
 */

import type { Schuss } from '@/games/schiffe-versenken'

export interface Punkt {
  x: number
  y: number
}

export interface Abschuss {
  /** Woher die Rakete kommt -- Seitenkoordinaten (wie getBoundingClientRect). */
  von: Punkt
  /** Mitte des Zielfelds. */
  nach: Punkt
  /** Kantenlänge eines Feldes in Pixeln: Danach richtet sich die Größe von allem. */
  zelle: number
  /**
   * Das Ergebnis -- schon da (Engine) oder unterwegs (Server). null heißt:
   * Der Schuss kam nicht an; die Rakete verpufft.
   */
  ergebnis: Schuss | null | Promise<Schuss | null>
  /** Die Mitten der Felder des versenkten Schiffs -- erst beim Einschlag gefragt. */
  schiffFelder?: (schuss: Schuss) => Punkt[]
  /** Im Moment des Einschlags: jetzt darf die Seite das Ergebnis zeigen. */
  onEinschlag: (schuss: Schuss | null) => void
  /** Dieses Element wackelt bei einem Treffer. */
  wackeln?: HTMLElement | null
  /** Gegnerische Rakete: kommt von oben herab statt im Bogen hinüber. */
  vonOben?: boolean
  /** Klänge -- von außen, damit diese Datei ohne Ton testbar bleibt. */
  klang?: (art: 'start' | 'wasser' | 'treffer' | 'versenkt') => void
}

export interface Effekte {
  /** Feuert eine Rakete. Das Versprechen löst sich, wenn das Brett wieder Eingaben annehmen soll. */
  feuere(a: Abschuss): Promise<void>
  /** Zeichnet nur noch schlicht (keine Rakete) -- z. B. wenn der Sparmodus angeht. */
  readonly schlicht: boolean
  beende(): void
}

/* ------------------------------------------------------------ Partikel */

type Art =
  'rauch' | 'dunst' | 'feuer' | 'glut' | 'tropfen' | 'gischt' | 'truemmer' | 'ring' | 'blitz'

interface Partikel {
  art: Art
  x: number
  y: number
  vx: number
  vy: number
  /** Radius bzw. Länge. */
  r: number
  /** Wachstum des Radius je Sekunde. */
  dr: number
  /** Schwerkraft in Pixeln je Sekunde². */
  g: number
  /** Luftwiderstand (0 = keiner, 1 = steht sofort). */
  reibung: number
  alter: number
  leben: number
  alpha: number
  drehung: number
  drall: number
  /** Startverzögerung in Sekunden. */
  warte: number
  /** Wasser: verschwindet, wenn es fallend diese Höhe erreicht (die Meeresoberfläche). */
  boden?: number
}

interface Flug {
  a: Abschuss
  p0: Punkt
  c: Punkt
  p1: Punkt
  dauer: number
  t0: number
  /** Ergebnis, sobald da (undefined: noch unterwegs). */
  ergebnis: Schuss | null | undefined
  eingeschlagen: boolean
  rauchUhr: number
  fertig: () => void
}

const MAX_PARTIKEL = 900

const zufall = (a: number, b: number) => a + Math.random() * (b - a)

function bezier(p0: Punkt, c: Punkt, p1: Punkt, t: number): Punkt {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  }
}

function tangente(p0: Punkt, c: Punkt, p1: Punkt, t: number): Punkt {
  return {
    x: 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x),
    y: 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y),
  }
}

/** Ein weicher Kreis als kleines Bild: innen `innen`, nach außen durchsichtig. */
function stempel(innen: string, mitte: string, gross = 64): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = gross
  const g = c.getContext('2d')!
  const verlauf = g.createRadialGradient(gross / 2, gross / 2, 0, gross / 2, gross / 2, gross / 2)
  verlauf.addColorStop(0, innen)
  verlauf.addColorStop(0.45, mitte)
  verlauf.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = verlauf
  g.fillRect(0, 0, gross, gross)
  return c
}

/** Darf hier richtig gezeichnet werden? */
export function sollSchlichtSein(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true
  // jsdom kennt keine Leinwand und schimpft, wenn man sie fragt.
  if (/jsdom/i.test(navigator.userAgent)) return true
  if (document.documentElement.hasAttribute('data-sparsam')) return true
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

const warte = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Schlicht: kein Flug, nur eine kurze Pause, dann das Ergebnis. */
async function schlichterSchuss(a: Abschuss): Promise<void> {
  a.klang?.('start')
  const [ergebnis] = await Promise.all([Promise.resolve(a.ergebnis).catch(() => null), warte(160)])
  a.onEinschlag(ergebnis)
  if (ergebnis) a.klang?.(ergebnis.ergebnis === 'wasser' ? 'wasser' : ergebnis.ergebnis)
  await warte(ergebnis?.ergebnis === 'versenkt' ? 450 : 200)
}

/**
 * Die Leinwand ist `leinwand` -- fest über der ganzen Seite, ohne
 * Mauszeiger. Ohne Leinwand (oder schlicht) geht alles den kurzen Weg.
 */
export function erstelleEffekte(leinwand: HTMLCanvasElement | null): Effekte {
  const schlicht = sollSchlichtSein()
  const ctx = !schlicht && leinwand ? leinwand.getContext('2d') : null
  if (!ctx || !leinwand) {
    return { feuere: schlichterSchuss, schlicht: true, beende: () => undefined }
  }
  const lw = leinwand
  const g = ctx

  const bilder = {
    rauchHell: stempel('rgba(236,240,244,0.95)', 'rgba(210,216,224,0.55)'),
    rauchDunkel: stempel('rgba(92,88,86,0.9)', 'rgba(110,104,100,0.45)'),
    wasser: stempel('rgba(255,255,255,1)', 'rgba(186,230,253,0.65)'),
    feuerWeiss: stempel('rgba(255,255,240,1)', 'rgba(255,236,150,0.8)'),
    feuerGelb: stempel('rgba(255,236,140,1)', 'rgba(255,170,40,0.75)'),
    feuerRot: stempel('rgba(255,140,40,1)', 'rgba(200,50,20,0.6)'),
    glut: stempel('rgba(255,250,220,1)', 'rgba(255,170,60,0.7)', 32),
  }

  let partikel: Partikel[] = []
  let fluege: Flug[] = []
  let laeuft = false
  let letzte = 0
  let dpr = 1
  let beendet = false

  function groesse() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    const b = window.innerWidth
    const h = window.innerHeight
    if (lw.width !== Math.round(b * dpr) || lw.height !== Math.round(h * dpr)) {
      lw.width = Math.round(b * dpr)
      lw.height = Math.round(h * dpr)
    }
  }

  function neu(p: Partial<Partikel> & Pick<Partikel, 'art' | 'x' | 'y' | 'leben'>) {
    if (partikel.length >= MAX_PARTIKEL) return
    partikel.push({
      vx: 0,
      vy: 0,
      r: 4,
      dr: 0,
      g: 0,
      reibung: 0,
      alter: 0,
      alpha: 1,
      drehung: 0,
      drall: 0,
      warte: 0,
      ...p,
    })
  }

  /* ------------------------------------------------------ Einschläge */

  function fontaene(x: number, y: number, s: number) {
    // Die Säule: dicht, steil, fällt in sich zusammen.
    for (let i = 0; i < 26; i++) {
      neu({
        art: 'gischt',
        boden: y + 0.1 * s,
        x: x + zufall(-0.12, 0.12) * s,
        y,
        vx: zufall(-0.3, 0.3) * s,
        vy: -zufall(8, 14) * s,
        r: zufall(0.2, 0.36) * s,
        dr: 0.45 * s,
        g: 17 * s,
        reibung: 0.45,
        leben: zufall(1, 1.45),
        warte: i * 0.01,
      })
    }
    // Tropfen: fliegen auseinander und fallen zurück.
    for (let i = 0; i < 70; i++) {
      const w = zufall(-Math.PI * 0.92, -Math.PI * 0.08)
      const v = zufall(2.5, 8.5) * s
      neu({
        art: 'tropfen',
        boden: y + zufall(-0.2, 0.35) * s,
        x: x + zufall(-0.15, 0.15) * s,
        y,
        vx: Math.cos(w) * v * 0.55,
        vy: Math.sin(w) * v,
        r: zufall(0.05, 0.11) * s,
        g: 16 * s,
        reibung: 0.15,
        leben: zufall(0.8, 1.4),
        warte: zufall(0, 0.12),
      })
    }
    // Gischt am Fuß und Wellenringe.
    for (let i = 0; i < 12; i++) {
      const w = zufall(0, Math.PI * 2)
      neu({
        art: 'dunst',
        x: x + Math.cos(w) * 0.2 * s,
        y: y + Math.sin(w) * 0.12 * s,
        vx: Math.cos(w) * zufall(0.8, 1.8) * s,
        vy: Math.sin(w) * zufall(0.4, 1) * s - 0.3 * s,
        r: zufall(0.3, 0.5) * s,
        dr: 1.4 * s,
        reibung: 1.6,
        leben: zufall(0.9, 1.5),
        alpha: 0.75,
      })
    }
    for (let i = 0; i < 3; i++) {
      neu({ art: 'ring', x, y, r: 0.25 * s, dr: 2.6 * s, leben: 1.3, warte: i * 0.22, alpha: 0.9 })
    }
  }

  function explosion(x: number, y: number, s: number, gross: boolean, verzug = 0) {
    const k = gross ? 1.45 : 1
    neu({ art: 'blitz', x, y, r: 3.4 * s * k, leben: 0.26, warte: verzug })
    neu({ art: 'ring', x, y, r: 0.3 * s, dr: 7 * s * k, leben: 0.45, warte: verzug, alpha: 0.85 })
    // Feuerball: viele glühende Bälle, die aufquellen und steigen.
    for (let i = 0; i < 26 * k; i++) {
      const w = zufall(0, Math.PI * 2)
      const v = zufall(0.4, 2.2) * s * k
      neu({
        art: 'feuer',
        x: x + Math.cos(w) * 0.1 * s,
        y: y + Math.sin(w) * 0.1 * s,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v - zufall(0.6, 1.6) * s,
        r: zufall(0.45, 0.85) * s * k,
        dr: zufall(0.8, 1.6) * s,
        reibung: 2.2,
        leben: zufall(0.45, 0.85),
        warte: verzug + zufall(0, 0.06),
      })
    }
    // Funken: schnell, hell, mit Schweif.
    for (let i = 0; i < 46 * k; i++) {
      const w = zufall(0, Math.PI * 2)
      const v = zufall(4, 11) * s * k
      neu({
        art: 'glut',
        x,
        y,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v - 2 * s,
        r: zufall(0.04, 0.08) * s,
        g: 9 * s,
        reibung: 1.4,
        leben: zufall(0.3, 0.7),
        warte: verzug,
      })
    }
    // Trümmer: dunkle Splitter, die sich drehen und fallen.
    for (let i = 0; i < 14 * k; i++) {
      const w = zufall(-Math.PI, 0)
      const v = zufall(3, 7.5) * s
      neu({
        art: 'truemmer',
        x,
        y,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v - 2 * s,
        r: zufall(0.07, 0.16) * s,
        g: 14 * s,
        reibung: 0.3,
        leben: zufall(0.7, 1.2),
        drehung: zufall(0, 6),
        drall: zufall(-14, 14),
        warte: verzug,
      })
    }
    // Rauch danach: dunkel, steigt, wird breit.
    for (let i = 0; i < 12 * k; i++) {
      neu({
        art: 'rauch',
        x: x + zufall(-0.3, 0.3) * s,
        y: y + zufall(-0.2, 0.2) * s,
        vx: zufall(-0.5, 0.5) * s,
        vy: -zufall(0.8, 1.8) * s,
        r: zufall(0.25, 0.45) * s,
        dr: zufall(0.55, 1.05) * s,
        reibung: 0.7,
        leben: zufall(1.1, 1.9),
        alpha: 0.72,
        warte: verzug + zufall(0.1, 0.3),
      })
    }
  }

  function verpuffen(x: number, y: number, s: number) {
    for (let i = 0; i < 10; i++) {
      neu({
        art: 'dunst',
        x,
        y,
        vx: zufall(-1, 1) * s,
        vy: zufall(-1, 0.3) * s,
        r: 0.3 * s,
        dr: s,
        reibung: 1.5,
        leben: 0.8,
        alpha: 0.6,
      })
    }
  }

  function wackle(el: HTMLElement | null | undefined, stark: boolean) {
    if (!el || typeof el.animate !== 'function') return
    const a = stark ? 7 : 4
    try {
      el.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: `translate(${-a}px, ${a * 0.6}px) rotate(-0.4deg)` },
          { transform: `translate(${a}px, ${-a * 0.4}px) rotate(0.4deg)` },
          { transform: `translate(${-a * 0.6}px, ${-a * 0.3}px)` },
          { transform: `translate(${a * 0.4}px, ${a * 0.3}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: stark ? 520 : 380, easing: 'ease-out' },
      )
    } catch {
      // Ohne Wackeln geht es auch.
    }
  }

  function einschlag(f: Flug, ergebnis: Schuss | null) {
    const { a, p1 } = f
    // Effekte bekommen eine Mindestgröße: Auf dem kleinen eigenen Meer
    // soll eine Explosion trotzdem eine Explosion sein.
    const s = Math.max(a.zelle, 30)
    if (!ergebnis) {
      verpuffen(p1.x, p1.y, s)
    } else if (ergebnis.ergebnis === 'wasser') {
      fontaene(p1.x, p1.y, s)
      a.klang?.('wasser')
    } else if (ergebnis.ergebnis === 'treffer') {
      explosion(p1.x, p1.y, s, false)
      wackle(a.wackeln, false)
      a.klang?.('treffer')
    } else {
      explosion(p1.x, p1.y, s, true)
      const felder = a.schiffFelder?.(ergebnis) ?? []
      felder.forEach((p, i) => explosion(p.x, p.y, s * 0.8, false, 0.18 + i * 0.11))
      wackle(a.wackeln, true)
      a.klang?.('versenkt')
    }
    a.onEinschlag(ergebnis)
  }

  /* ----------------------------------------------------- Die Schleife */

  function schritt(jetzt: number) {
    if (beendet) return
    const dt = Math.min(0.05, (jetzt - letzte) / 1000 || 0.016)
    letzte = jetzt
    groesse()
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, lw.width, lw.height)

    // Raketen bewegen, Rauch ausstoßen.
    for (const f of fluege) {
      if (f.eingeschlagen) continue
      const roh = Math.min(1, (jetzt - f.t0) / f.dauer)
      const t = roh < 1 ? roh * (0.55 + 0.45 * roh) : 1
      const p = bezier(f.p0, f.c, f.p1, t)
      const tan = tangente(f.p0, f.c, f.p1, Math.max(0.001, Math.min(0.999, t)))
      const laenge = Math.hypot(tan.x, tan.y) || 1
      const dir = { x: tan.x / laenge, y: tan.y / laenge }
      const s = Math.max(f.a.zelle, 26)
      f.rauchUhr += dt
      while (f.rauchUhr > 0.012) {
        f.rauchUhr -= 0.012
        neu({
          art: 'rauch',
          x: p.x - dir.x * s * 0.5 + zufall(-2, 2),
          y: p.y - dir.y * s * 0.5 + zufall(-2, 2),
          vx: -dir.x * s * 0.6 + zufall(-8, 8),
          vy: -dir.y * s * 0.6 + zufall(-8, 8) - 6,
          r: s * 0.12,
          dr: s * 0.75,
          reibung: 2.4,
          leben: zufall(0.55, 0.95),
          alpha: 0.55,
        })
        if (Math.random() < 0.35) {
          neu({
            art: 'glut',
            x: p.x - dir.x * s * 0.45,
            y: p.y - dir.y * s * 0.45,
            vx: -dir.x * s * 3 + zufall(-30, 30),
            vy: -dir.y * s * 3 + zufall(-30, 30),
            r: s * 0.04,
            g: 60,
            reibung: 2,
            leben: zufall(0.15, 0.35),
          })
        }
      }
      if (roh >= 1 && f.ergebnis !== undefined) {
        f.eingeschlagen = true
        einschlag(f, f.ergebnis)
        const nachlauf =
          f.ergebnis?.ergebnis === 'versenkt'
            ? 1100
            : f.ergebnis?.ergebnis === 'treffer'
              ? 650
              : 520
        setTimeout(f.fertig, nachlauf)
      }
    }

    // Partikel: erst Rauch und Wasser, darüber Feuer und Funken.
    const lebende: Partikel[] = []
    for (const p of partikel) {
      if (p.warte > 0) {
        p.warte -= dt
        lebende.push(p)
        continue
      }
      p.alter += dt
      if (p.alter >= p.leben) continue
      // Wasser fällt zurück ins Meer -- nicht darunter durch.
      if (p.boden !== undefined && p.vy > 0 && p.y > p.boden) continue
      const bremse = Math.max(0, 1 - p.reibung * dt)
      p.vx *= bremse
      p.vy = p.vy * bremse + p.g * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.r += p.dr * dt
      p.drehung += p.drall * dt
      lebende.push(p)
    }
    partikel = lebende

    zeichnePartikel(['ring', 'dunst', 'rauch', 'tropfen', 'truemmer', 'glut'], 'source-over')
    zeichnePartikel(['gischt', 'feuer', 'blitz'], 'lighter')

    for (const f of fluege) if (!f.eingeschlagen) zeichneRakete(f, jetzt)
    fluege = fluege.filter((f) => !f.eingeschlagen)

    if (partikel.length > 0 || fluege.length > 0) {
      requestAnimationFrame(schritt)
    } else {
      laeuft = false
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, lw.width, lw.height)
    }
  }

  function zeichnePartikel(arten: Art[], modus: GlobalCompositeOperation) {
    g.globalCompositeOperation = modus
    for (const p of partikel) {
      if (p.warte > 0 || !arten.includes(p.art)) continue
      const k = p.alter / p.leben
      switch (p.art) {
        case 'rauch':
        case 'dunst': {
          const bild = p.art === 'rauch' && p.alpha > 0.7 ? bilder.rauchDunkel : bilder.rauchHell
          g.globalAlpha = p.alpha * (1 - k) * Math.min(1, p.alter * 8)
          g.drawImage(bild, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
          break
        }
        case 'gischt':
          g.globalAlpha = 0.7 * (1 - k * k)
          g.drawImage(bilder.wasser, p.x - p.r, p.y - p.r * 1.6, p.r * 2, p.r * 3.2)
          break
        case 'tropfen': {
          g.globalAlpha = 0.95 * (1 - k * k)
          g.strokeStyle = k < 0.5 ? '#ffffff' : '#bae6fd'
          g.lineWidth = Math.max(1.2, p.r * 2)
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(p.x, p.y)
          g.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025)
          g.stroke()
          break
        }
        case 'truemmer':
          g.globalAlpha = 1 - k * k
          g.save()
          g.translate(p.x, p.y)
          g.rotate(p.drehung)
          g.fillStyle = k < 0.25 ? '#7c2d12' : '#292524'
          g.fillRect(-p.r, -p.r * 0.55, p.r * 2, p.r * 1.1)
          g.restore()
          break
        case 'ring':
          g.globalAlpha = p.alpha * (1 - k)
          g.strokeStyle = '#ffffff'
          g.lineWidth = Math.max(1, 3 * (1 - k))
          g.beginPath()
          g.ellipse(p.x, p.y, p.r, p.r * 0.72, 0, 0, Math.PI * 2)
          g.stroke()
          break
        case 'feuer': {
          const bild = k < 0.2 ? bilder.feuerWeiss : k < 0.55 ? bilder.feuerGelb : bilder.feuerRot
          g.globalAlpha = 1 - k * k
          g.drawImage(bild, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
          break
        }
        case 'glut': {
          g.globalAlpha = 1 - k
          g.strokeStyle = k < 0.35 ? '#fffbe6' : k < 0.7 ? '#fde047' : '#fb923c'
          g.lineWidth = Math.max(1, p.r * 2)
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(p.x, p.y)
          g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
          g.stroke()
          break
        }
        case 'blitz': {
          g.globalAlpha = 1 - k
          g.drawImage(bilder.feuerWeiss, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
          break
        }
      }
    }
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
  }

  /** Die Rakete: Rumpf, rote Spitze, Flossen, flackernde Flamme mit Glut. */
  function zeichneRakete(f: Flug, jetzt: number) {
    const roh = Math.min(1, (jetzt - f.t0) / f.dauer)
    const t = roh < 1 ? roh * (0.55 + 0.45 * roh) : 1
    const wartet = roh >= 1 // Ergebnis noch unterwegs: über dem Ziel kreisen.
    let p = bezier(f.p0, f.c, f.p1, t)
    let tan = tangente(f.p0, f.c, f.p1, Math.max(0.001, Math.min(0.999, t)))
    if (wartet) {
      const w = jetzt / 140
      p = { x: f.p1.x + Math.cos(w) * 4, y: f.p1.y - 10 + Math.sin(w) * 3 }
      tan = { x: 0.2, y: 1 }
    }
    const winkel = Math.atan2(tan.y, tan.x)
    // Im Bogen kommt sie dem Betrachter näher: in der Mitte größer.
    const s =
      Math.max(f.a.zelle, 26) * (f.a.vonOben ? 1.1 - 0.25 * t : 0.85 + 0.55 * Math.sin(Math.PI * t))
    const L = s * 0.95
    const B = s * 0.24

    g.save()
    g.translate(p.x, p.y)
    g.rotate(winkel)

    // Glut und Flamme (additiv), hinter dem Heck.
    g.globalCompositeOperation = 'lighter'
    const flacker = 0.75 + Math.random() * 0.5
    g.globalAlpha = 0.9
    g.drawImage(bilder.feuerGelb, -L * 0.75 - B * 1.6, -B * 1.6, B * 3.2, B * 3.2)
    const flamme = g.createLinearGradient(-L * 0.5, 0, -L * 0.5 - L * 0.75 * flacker, 0)
    flamme.addColorStop(0, 'rgba(255,255,230,1)')
    flamme.addColorStop(0.3, 'rgba(255,190,60,0.95)')
    flamme.addColorStop(1, 'rgba(255,80,20,0)')
    g.fillStyle = flamme
    g.beginPath()
    g.moveTo(-L * 0.48, -B * 0.42)
    g.quadraticCurveTo(-L * 0.5 - L * 0.4 * flacker, -B * 0.5, -L * 0.5 - L * 0.78 * flacker, 0)
    g.quadraticCurveTo(-L * 0.5 - L * 0.4 * flacker, B * 0.5, -L * 0.48, B * 0.42)
    g.closePath()
    g.fill()
    g.globalCompositeOperation = 'source-over'
    g.globalAlpha = 1

    // Flossen.
    g.fillStyle = '#b91c1c'
    g.beginPath()
    g.moveTo(-L * 0.32, -B * 0.5)
    g.lineTo(-L * 0.55, -B * 1.15)
    g.lineTo(-L * 0.52, -B * 0.5)
    g.closePath()
    g.moveTo(-L * 0.32, B * 0.5)
    g.lineTo(-L * 0.55, B * 1.15)
    g.lineTo(-L * 0.52, B * 0.5)
    g.closePath()
    g.fill()

    // Rumpf: hell, mit Schatten unten und Glanz oben.
    const rumpf = g.createLinearGradient(0, -B / 2, 0, B / 2)
    rumpf.addColorStop(0, '#ffffff')
    rumpf.addColorStop(0.45, '#e2e8f0')
    rumpf.addColorStop(1, '#94a3b8')
    g.fillStyle = rumpf
    g.beginPath()
    g.moveTo(-L * 0.5, -B / 2)
    g.lineTo(L * 0.22, -B / 2)
    g.quadraticCurveTo(L * 0.5, -B * 0.35, L * 0.52, 0)
    g.quadraticCurveTo(L * 0.5, B * 0.35, L * 0.22, B / 2)
    g.lineTo(-L * 0.5, B / 2)
    g.closePath()
    g.fill()
    // Spitze rot, ein Streifen in der Mitte.
    g.fillStyle = '#dc2626'
    g.beginPath()
    g.moveTo(L * 0.22, -B / 2)
    g.quadraticCurveTo(L * 0.5, -B * 0.35, L * 0.52, 0)
    g.quadraticCurveTo(L * 0.5, B * 0.35, L * 0.22, B / 2)
    g.closePath()
    g.fill()
    g.fillStyle = '#1e293b'
    g.fillRect(-L * 0.05, -B / 2, L * 0.06, B)
    g.restore()
  }

  function starte() {
    if (laeuft || beendet) return
    laeuft = true
    letzte = performance.now()
    requestAnimationFrame(schritt)
  }

  function feuere(a: Abschuss): Promise<void> {
    groesse()
    return new Promise<void>((fertig) => {
      const p0 = a.von
      const p1 = a.nach
      const abstand = Math.hypot(p1.x - p0.x, p1.y - p0.y)
      let c: Punkt
      let von = p0
      if (a.vonOben) {
        // Von oben herab, leicht schräg: als käme sie über den Horizont.
        von = { x: p1.x + zufall(-0.35, 0.35) * window.innerWidth, y: -40 }
        c = { x: (von.x + p1.x) / 2 + zufall(-60, 60), y: von.y + (p1.y - von.y) * 0.25 }
      } else {
        const hoehe = Math.max(140, abstand * 0.6)
        // Seitlich ausholen, damit man den Bogen auch sieht, wenn das Ziel genau darüber liegt.
        const seite = (p1.x >= p0.x ? 1 : -1) * Math.max(70, abstand * 0.3)
        c = { x: (p0.x + p1.x) / 2 + seite, y: Math.min(p0.y, p1.y) - hoehe * 0.8 }
      }
      const weg = Math.hypot(p1.x - von.x, p1.y - von.y)
      const flug: Flug = {
        a,
        p0: von,
        c,
        p1,
        dauer: Math.max(720, Math.min(1150, weg * 1.25)),
        t0: performance.now(),
        ergebnis: undefined,
        eingeschlagen: false,
        rauchUhr: 0,
        fertig,
      }
      Promise.resolve(a.ergebnis)
        .catch(() => null)
        .then((e) => {
          flug.ergebnis = e
        })
      // Startrauch und ein Funke am Abschuss.
      if (!a.vonOben) {
        const s = Math.max(a.zelle, 26)
        for (let i = 0; i < 10; i++) {
          neu({
            art: 'dunst',
            x: von.x,
            y: von.y,
            vx: zufall(-1.2, 1.2) * s,
            vy: zufall(-0.4, 0.8) * s,
            r: 0.25 * s,
            dr: 0.9 * s,
            reibung: 2,
            leben: zufall(0.6, 1),
            alpha: 0.7,
          })
        }
        neu({ art: 'blitz', x: von.x, y: von.y, r: s * 0.9, leben: 0.15 })
      }
      a.klang?.('start')
      fluege.push(flug)
      starte()
    })
  }

  return {
    feuere,
    schlicht: false,
    beende() {
      beendet = true
      partikel = []
      for (const f of fluege) f.fertig()
      fluege = []
    },
  }
}
