/**
 * Die Physik – bewusst klein, bewusst berechenbar.
 *
 * Ein Fallenspiel lebt davon, dass jeder Tod die Schuld des Spielers ist.
 * Deshalb hier keine Federn, keine Reibung mit Sonderfällen und kein
 * kontinuierliches Kollisionsmodell, das bei hohen Geschwindigkeiten anders
 * rechnet als bei niedrigen. Stattdessen:
 *
 *   - fester Zeitschritt (die Engine zerlegt jede Bildlaufzeit darin),
 *   - erst waagerecht bewegen und lösen, dann senkrecht,
 *   - rechteckige Körper, ganzzahlige Überlappungen.
 *
 * Dazu die zwei Kniffe, die gute Plattformer ausmachen und ohne die sich
 * jede Steuerung schwammig anfühlt:
 *
 *   KOJOTENZEIT   Wer gerade von der Kante gefallen ist, darf noch ein
 *                 Wimpernschlag lang springen.
 *   SPRUNGPUFFER  Wer kurz VOR der Landung drückt, springt beim Aufsetzen.
 *
 * Beides zusammen sorgt dafür, dass ein Sprung dann kommt, wenn der Spieler
 * ihn wollte -- und nicht dann, wenn die Zahlen zufällig passen.
 */

import type { Eingabe, Rechteck } from './types'

/** Fester Rechenschritt. 240 Hz ist fein genug, dass nichts durchrutscht. */
export const SCHRITT = 1 / 240

export const PHYSIK = {
  /** Fallbeschleunigung in Einheiten je Sekunde². */
  schwerkraft: 1400,
  /** Schneller fällt niemand -- sonst rutscht man durch dünne Böden. */
  maxFall: 620,
  /** Höchstgeschwindigkeit beim Laufen. */
  tempo: 138,
  /** Wie schnell man auf Tempo kommt (Boden / Luft). */
  antriebBoden: 1100,
  antriebLuft: 750,
  /** Wie schnell man wieder steht. */
  bremseBoden: 1400,
  bremseLuft: 320,
  /** Anfangsgeschwindigkeit eines Sprungs. */
  sprung: 410,
  /** Loslassen kappt den Sprung -- daraus entsteht die Höhensteuerung. */
  sprungKappen: 0.42,
  /** Wie lange man nach der Kante noch springen darf. */
  kojote: 0.09,
  /** Wie lange ein zu früher Sprungwunsch gemerkt wird. */
  puffer: 0.11,
  /** Maße der Spielfigur. */
  breite: 11,
  hoehe: 17,
} as const

export interface Koerper {
  x: number
  y: number
  vx: number
  vy: number
  amBoden: boolean
  /** Kopf gerade an einer Decke. */
  amKopf: boolean
  /** Blickrichtung: -1 links, 1 rechts. */
  blick: number
  /** Restliche Kojotenzeit. */
  kojote: number
  /** Restlicher Sprungpuffer. */
  puffer: number
  /** Solange gedrückt gehalten wird, steigt der Sprung weiter. */
  imSprung: boolean
  /** Auf welchem festen Objekt man steht (Index) -- für Bruchplatten. */
  bodenIndex: number
}

export function neuerKoerper(x: number, y: number): Koerper {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    amBoden: false,
    amKopf: false,
    blick: 1,
    kojote: 0,
    puffer: 0,
    imSprung: false,
    bodenIndex: -1,
  }
}

export function rechteck(k: Koerper): Rechteck {
  return { x: k.x, y: k.y, b: PHYSIK.breite, h: PHYSIK.hoehe }
}

export function ueberlappt(a: Rechteck, b: Rechteck): boolean {
  return a.x < b.x + b.b && a.x + a.b > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Ein fester Körper, gegen den die Figur stößt. */
export interface Feste extends Rechteck {
  index: number
  /** Eigenbewegung dieses Blocks in diesem Schritt -- er nimmt die Figur mit. */
  dx?: number
  dy?: number
  /** Förderband. */
  schub?: number
}

export interface SchrittEingabe extends Eingabe {
  /** 1 = normal, -1 = links und rechts vertauscht. */
  umkehr: number
  /** 1 = normal, -1 = kopfüber. */
  schwerkraft: number
  /** Faktor auf die Sprungkraft. */
  sprungkraft: number
}

/**
 * Ein Rechenschritt.
 *
 * Gibt zurück, ob in diesem Schritt gesprungen bzw. gelandet wurde -- die
 * Engine macht daraus Töne und Staubwölkchen.
 */
export function bewege(
  k: Koerper,
  e: SchrittEingabe,
  festen: Feste[],
  dt: number,
): { gesprungen: boolean; gelandet: boolean } {
  const richtung = (e.rechts ? 1 : 0) - (e.links ? 1 : 0)
  const wunsch = richtung * e.umkehr
  if (wunsch !== 0) k.blick = wunsch

  // Waagerecht: beschleunigen, bremsen, begrenzen.
  const antrieb = k.amBoden ? PHYSIK.antriebBoden : PHYSIK.antriebLuft
  const bremse = k.amBoden ? PHYSIK.bremseBoden : PHYSIK.bremseLuft
  if (wunsch !== 0) {
    k.vx += wunsch * antrieb * dt
    k.vx = Math.max(-PHYSIK.tempo, Math.min(PHYSIK.tempo, k.vx))
  } else if (k.vx !== 0) {
    const ab = bremse * dt
    k.vx = k.vx > 0 ? Math.max(0, k.vx - ab) : Math.min(0, k.vx + ab)
  }

  // Sprung: Puffer und Kojotenzeit auffrischen.
  k.puffer = Math.max(0, k.puffer - dt)
  k.kojote = Math.max(0, k.kojote - dt)
  if (e.sprung) k.puffer = PHYSIK.puffer

  let gesprungen = false
  if (k.puffer > 0 && k.kojote > 0) {
    k.vy = -PHYSIK.sprung * e.sprungkraft * e.schwerkraft
    k.amBoden = false
    k.kojote = 0
    k.puffer = 0
    k.imSprung = true
    gesprungen = true
  }
  // Loslassen kappt den Steigflug -- so lassen sich hohe und flache Sprünge
  // steuern, ohne dass es zwei Tasten braucht.
  if (!e.sprung && k.imSprung) {
    const steigt = e.schwerkraft > 0 ? k.vy < 0 : k.vy > 0
    if (steigt) k.vy *= PHYSIK.sprungKappen
    k.imSprung = false
  }

  k.vy += PHYSIK.schwerkraft * e.schwerkraft * dt
  // Die Grenze gilt nur fürs Fallen. Symmetrisch angewandt hat sie den
  // Federn die Kraft genommen: Ein Sprungbrett mit 760 wurde auf 620
  // gestutzt und trug plötzlich nur noch halb so hoch.
  const faellt = k.vy * e.schwerkraft
  if (faellt > PHYSIK.maxFall) k.vy = PHYSIK.maxFall * e.schwerkraft

  const warAmBoden = k.amBoden
  k.amBoden = false
  k.amKopf = false
  k.bodenIndex = -1

  /*
   * Waagerecht bewegen und auflösen.
   *
   * Die Richtung wird VOR der Schleife gemerkt: Sobald die erste Wand die
   * Geschwindigkeit auf null setzt, wüsste die zweite sonst nicht mehr, aus
   * welcher Richtung die Figur kam -- sie bliebe stecken.
   */
  const hinX = Math.sign(k.vx)
  k.x += k.vx * dt
  for (const f of festen) {
    if (!ueberlappt(rechteck(k), f)) continue
    if (hinX > 0) k.x = f.x - PHYSIK.breite
    else if (hinX < 0) k.x = f.x + f.b
    else k.x = k.x < f.x ? f.x - PHYSIK.breite : f.x + f.b
    k.vx = 0
  }

  // Senkrecht bewegen und auflösen -- ebenfalls mit gemerkter Richtung.
  const hinY = Math.sign(k.vy)
  k.y += k.vy * dt
  for (const f of festen) {
    if (!ueberlappt(rechteck(k), f)) continue
    if (hinY > 0) {
      k.y = f.y - PHYSIK.hoehe
      k.vy = 0
      if (e.schwerkraft > 0) {
        k.amBoden = true
        k.bodenIndex = f.index
        if (f.dx) k.x += f.dx
        if (f.schub) k.x += f.schub * dt
      } else {
        k.amKopf = true
      }
    } else if (hinY < 0) {
      k.y = f.y + f.h
      k.vy = 0
      if (e.schwerkraft < 0) {
        k.amBoden = true
        k.bodenIndex = f.index
        if (f.dx) k.x += f.dx
        if (f.schub) k.x += f.schub * dt
      } else {
        k.amKopf = true
      }
    }
  }

  if (k.amBoden) {
    k.kojote = PHYSIK.kojote
    k.imSprung = false
  }

  return { gesprungen, gelandet: k.amBoden && !warAmBoden }
}
