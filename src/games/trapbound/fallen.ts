/**
 * Das Fallensystem.
 *
 * Jede Falle ist ein Objekt aus den Leveldaten plus ein Stand, der sich
 * über die Zeit ändert. Was eine Falle tut, steht hier -- die Engine ruft
 * nur `bewegeObjekt`, fragt `istFest`/`istGefahr` und wendet Aktionen an.
 *
 * Dadurch lassen sich Fallen kombinieren, ohne dass jemand Code anfassen
 * muss: Eine Zone löst 'weg' auf einer Plattform aus, gleichzeitig 'zeigen'
 * auf Stacheln und mit einer Sekunde Verzögerung 'schwerkraft'. Genau daraus
 * entstehen die Situationen, bei denen der Spieler zweimal hinsieht.
 */

import type { Aktion, Objekt, Rechteck } from './types'

export interface ObjektStand {
  /** Überhaupt noch da. */
  aktiv: boolean
  /** Wird gezeichnet (versteckte Fallen und geheime Plattformen nicht). */
  sichtbar: boolean
  /** Eigenzeit für Wege. */
  t: number
  /** Versatz gegenüber der Grundposition. */
  ox: number
  oy: number
  /** Schon einmal ausgelöst. */
  ausgeloest: boolean
  /** Countdown einer Bruch- oder Fallplatte; -1 = nicht angestoßen. */
  zerfall: number
  /** Fällt gerade. */
  faellt: boolean
  vy: number
  /** Beweger unterwegs. */
  laeuft: boolean
  /** Tür offen. */
  offen: boolean
  /** Blinkt (kurz vor dem Zerbrechen). */
  zittert: number
}

export function neuerStand(o: Objekt): ObjektStand {
  return {
    aktiv: true,
    sichtbar: !o.versteckt && !o.geheim,
    t: o.weg?.start ?? 0,
    ox: 0,
    oy: 0,
    ausgeloest: false,
    zerfall: -1,
    faellt: false,
    vy: 0,
    laeuft: !(o.weg?.wartetAufAusloeser ?? false),
    offen: false,
    zittert: 0,
  }
}

/** Das Rechteck, das ein Objekt gerade wirklich einnimmt. */
export function feld(o: Objekt, s: ObjektStand): Rechteck {
  return { x: o.x + s.ox, y: o.y + s.oy, b: o.b, h: o.h }
}

/** Ob man dagegenstößt. */
export function istFest(o: Objekt, s: ObjektStand): boolean {
  if (!s.aktiv) return false
  switch (o.typ) {
    case 'block':
    case 'bruch':
    case 'fall':
    case 'beweger':
    case 'feder':
      // Versteckte Blöcke sind auch nicht fest -- sonst stößt man an Luft.
      return s.sichtbar || Boolean(o.geheim)
    case 'tuer':
      return !s.offen
    default:
      return false
  }
}

/** Ob Berührung tötet. */
export function istGefahr(o: Objekt, s: ObjektStand): boolean {
  if (!s.aktiv || !s.sichtbar) return false
  if (o.typ === 'stachel' || o.typ === 'saege') return true
  // Ein herabstürzender Block erschlägt, wer darunter steht. Liegt er erst
  // einmal, ist er nur noch eine Stufe -- sonst wäre er unfair.
  if (o.toedlich && s.faellt) return true
  return o.typ === 'ziel' && Boolean(o.falle)
}

/**
 * Ein Objekt einen Zeitschritt weiterbewegen.
 *
 * Wege laufen hin und zurück und halten an den Enden an, wenn `warte`
 * gesetzt ist. Ein Sinusverlauf wäre weicher, aber gleichmäßiges Tempo ist
 * vorhersagbar -- und Vorhersagbarkeit ist in diesem Spiel die halbe Miete.
 */
export function bewegeObjekt(o: Objekt, s: ObjektStand, dt: number): { dx: number; dy: number } {
  const vorherX = s.ox
  const vorherY = s.oy

  if (o.weg && s.laeuft && s.aktiv) {
    const warte = o.weg.warte ?? 0
    const runde = o.weg.einweg ? o.weg.dauer + warte : (o.weg.dauer + warte) * 2
    s.t = o.weg.einweg ? Math.min(runde, s.t + dt) : (s.t + dt) % runde
    const halbe = o.weg.dauer + warte
    let anteil: number
    if (s.t < o.weg.dauer) anteil = s.t / o.weg.dauer
    else if (s.t < halbe) anteil = 1
    else if (s.t < halbe + o.weg.dauer) anteil = 1 - (s.t - halbe) / o.weg.dauer
    else anteil = 0
    if (o.weg.einweg) anteil = Math.min(1, s.t / o.weg.dauer)
    s.ox = o.weg.dx * anteil
    s.oy = o.weg.dy * anteil
  }

  if (s.faellt) {
    s.vy += 900 * dt
    s.oy += s.vy * dt
  }

  if (s.zerfall > 0) {
    s.zerfall -= dt
    s.zittert = 1
    if (s.zerfall <= 0) {
      s.zerfall = -1
      s.zittert = 0
      if (o.typ === 'bruch') s.aktiv = false
      else s.faellt = true
    }
  }

  return { dx: s.ox - vorherX, dy: s.oy - vorherY }
}

/** Eine Aktion auf ein Objekt anwenden. */
export function wendeAn(o: Objekt, s: ObjektStand, a: Aktion): void {
  switch (a.tu) {
    case 'weg':
      s.aktiv = false
      break
    case 'zeigen':
      s.sichtbar = true
      s.aktiv = true
      break
    case 'fallen':
      if (o.typ === 'bruch') s.aktiv = false
      else {
        s.faellt = true
        s.sichtbar = true
      }
      break
    case 'oeffnen':
      s.offen = true
      break
    case 'schliessen':
      s.offen = false
      s.sichtbar = true
      break
    case 'los':
      s.laeuft = true
      break
    case 'stopp':
      s.laeuft = false
      break
    default:
      break
  }
}

/** Aktionen, die nicht ein Objekt, sondern die Spielregeln treffen. */
export function istRegelAktion(a: Aktion): boolean {
  return (
    a.tu === 'schwerkraft' ||
    a.tu === 'umkehren' ||
    a.tu === 'sprungkraft' ||
    a.tu === 'toeten' ||
    a.tu === 'beben'
  )
}
