/**
 * Die Spielengine – ein Schritt Spielzeit, rein rechnerisch.
 *
 * Kein React, kein Canvas, kein `window`. Die Anzeige ruft `laufe(stand,
 * eingabe, dt)` mit der vergangenen Zeit auf und zeichnet danach, was
 * herauskommt. Dadurch lässt sich jedes Level im Test durchspielen, ohne
 * dass ein Browser läuft -- und genau das tut tests/trapbound.test.ts mit
 * den aufgezeichneten Lösungen.
 *
 * Die Zeit wird immer in feste Schritte zerlegt (siehe physik.ts). Ein
 * Ruckler im Browser darf nicht dazu führen, dass die Figur durch eine Wand
 * rutscht oder ein Sprung höher wird.
 */

import {
  bewege,
  neuerKoerper,
  rechteck,
  ueberlappt,
  PHYSIK,
  SCHRITT,
  type Feste,
  type Koerper,
} from './physik'
import {
  bewegeObjekt,
  feld,
  istFest,
  istGefahr,
  neuerStand,
  wendeAn,
  type ObjektStand,
} from './fallen'
import { BILD_HOEHE, BILD_BREITE, type Aktion, type Eingabe, type LevelDaten } from './types'

/** Was in diesem Schritt passiert ist -- die Anzeige macht Ton und Staub daraus. */
export type Ereignis =
  'sprung' | 'landung' | 'tod' | 'geschafft' | 'falle' | 'feder' | 'teleport' | 'kristall' | 'knopf'

export interface Spielstand {
  level: LevelDaten
  koerper: Koerper
  staende: ObjektStand[]
  /** Gesamtzeit im Level, in Sekunden. */
  zeit: number
  phase: 'laeuft' | 'tot' | 'geschafft'
  /** Wie lange die Figur schon tot bzw. im Ziel ist. */
  endeZeit: number
  /** 1 = normal, -1 = kopfüber. */
  schwerkraft: number
  /** 1 = normal, -1 = links/rechts vertauscht. */
  umkehr: number
  sprungkraft: number
  /** Eingesammelter Kristall dieses Versuchs. */
  kristall: boolean
  /** Restdauer des Bildschirmwackelns. */
  beben: number
  /** Aktionen, die später ausgeführt werden. */
  wartend: { aktion: Aktion; rest: number }[]
  ereignisse: Ereignis[]
  /** Zum Zeichnen: Stellen, an denen etwas zerplatzt ist. */
  funken: { x: number; y: number; t: number; farbe: string }[]
}

export function starte(level: LevelDaten): Spielstand {
  return {
    level,
    koerper: neuerKoerper(level.start.x, level.start.y),
    staende: level.objekte.map((o) => neuerStand(o)),
    zeit: 0,
    phase: 'laeuft',
    endeZeit: 0,
    schwerkraft: level.schwerkraft ?? 1,
    umkehr: 1,
    sprungkraft: 1,
    kristall: false,
    beben: 0,
    wartend: [],
    ereignisse: [],
    funken: [],
  }
}

function objektMitId(level: LevelDaten, id: string): number {
  return level.objekte.findIndex((o) => o.id === id)
}

/** Eine Aktion ausführen – entweder auf ein Objekt oder auf die Spielregeln. */
function fuehreAus(s: Spielstand, a: Aktion): void {
  switch (a.tu) {
    case 'schwerkraft':
      s.schwerkraft = a.wert ?? -s.schwerkraft
      s.beben = Math.max(s.beben, 0.25)
      s.ereignisse.push('falle')
      return
    case 'umkehren':
      s.umkehr = a.wert ?? -s.umkehr
      s.ereignisse.push('falle')
      return
    case 'sprungkraft':
      s.sprungkraft = a.wert ?? 1
      s.ereignisse.push('falle')
      return
    case 'toeten':
      toete(s)
      return
    case 'beben':
      s.beben = Math.max(s.beben, a.wert ?? 0.4)
      return
    default:
      break
  }
  if (!a.ziel) return
  // Mehrere Objekte dürfen dieselbe Kennung tragen -- so fährt eine ganze
  // Stachelreihe mit einer Aktion aus.
  for (let i = 0; i < s.level.objekte.length; i++) {
    if (s.level.objekte[i]!.id !== a.ziel) continue
    wendeAn(s.level.objekte[i]!, s.staende[i]!, a)
    if (a.tu === 'weg' || a.tu === 'fallen') s.ereignisse.push('falle')
  }
  void objektMitId
}

function loese(s: Spielstand, aktionen: Aktion[] | undefined): void {
  if (!aktionen) return
  for (const a of aktionen) {
    if (a.nach && a.nach > 0) s.wartend.push({ aktion: a, rest: a.nach })
    else fuehreAus(s, a)
  }
}

function toete(s: Spielstand): void {
  if (s.phase !== 'laeuft') return
  s.phase = 'tot'
  s.endeZeit = 0
  s.beben = Math.max(s.beben, 0.3)
  s.ereignisse.push('tod')
  const k = s.koerper
  for (let i = 0; i < 14; i++) {
    s.funken.push({
      x: k.x + PHYSIK.breite / 2,
      y: k.y + PHYSIK.hoehe / 2,
      t: 0.5 + (i % 5) * 0.06,
      farbe: i % 3 === 0 ? '#ffffff' : '#ff5d5d',
    })
  }
}

/**
 * Ein Bildlauf.
 *
 * `dt` wird auf 1/15 Sekunde gedeckelt: Wer den Tab wegklickt und
 * zurückkommt, soll nicht durch den halben Level teleportiert werden.
 */
export function laufe(alt: Spielstand, eingabe: Eingabe, dt: number): Spielstand {
  const s: Spielstand = { ...alt, ereignisse: [], funken: alt.funken.slice() }
  let rest = Math.min(dt, 1 / 15)
  // Der Rest wird bei 1 Mikrosekunde abgeschnitten. Ohne diese Schwelle
  // blieb nach vier Schritten zu 1/240 ein Krümel von 10^-18 Sekunden übrig,
  // und der lief als eigener Schritt durch: Die Schwerkraft schob die Figur
  // um 10^-17 Einheiten nach unten -- zu wenig für eine Überlappung, also
  // meldete die Physik "steht nicht auf dem Boden". Sprünge gingen dadurch
  // scheinbar zufällig verloren.
  while (rest > 1e-6) {
    const h = Math.min(SCHRITT, rest)
    einSchritt(s, eingabe, h)
    rest -= h
  }
  s.funken = s.funken.map((f) => ({ ...f, t: f.t - dt, y: f.y - dt * 18 })).filter((f) => f.t > 0)
  s.beben = Math.max(0, s.beben - dt)
  return s
}

function einSchritt(s: Spielstand, eingabe: Eingabe, dt: number): void {
  s.zeit += dt

  // Wartende Aktionen fällig machen.
  if (s.wartend.length > 0) {
    const noch: { aktion: Aktion; rest: number }[] = []
    for (const w of s.wartend) {
      const rest = w.rest - dt
      if (rest <= 0) fuehreAus(s, w.aktion)
      else noch.push({ aktion: w.aktion, rest })
    }
    s.wartend = noch
  }

  // Objekte bewegen. Der Versatz wird gemerkt, damit Plattformen die Figur
  // mitnehmen können.
  const versatz: { dx: number; dy: number }[] = []
  for (let i = 0; i < s.level.objekte.length; i++) {
    versatz.push(bewegeObjekt(s.level.objekte[i]!, s.staende[i]!, dt))
    const st = s.staende[i]!
    // Was aus dem Bild gefallen ist, ist weg.
    if (st.faellt && s.level.objekte[i]!.y + st.oy > (s.level.hoehe ?? BILD_HOEHE) + 40) {
      st.aktiv = false
    }
  }

  if (s.phase !== 'laeuft') {
    s.endeZeit += dt
    return
  }

  // Feste Körper einsammeln.
  const festen: Feste[] = []
  for (let i = 0; i < s.level.objekte.length; i++) {
    const o = s.level.objekte[i]!
    const st = s.staende[i]!
    if (!istFest(o, st)) continue
    const f = feld(o, st)
    festen.push({ ...f, index: i, dx: versatz[i]!.dx, dy: versatz[i]!.dy, schub: o.schub })
  }

  /*
   * Bewegte Blöcke schieben die Figur, statt sie zu quetschen.
   *
   * Ohne diesen Schritt kam es zu einem hässlichen Fehler: Ein aufsteigender
   * Aufzug schob sich um einen Bruchteil in die Figur hinein; die
   * waagerechte Auflösung sah die Überlappung, hielt sie für eine Wand und
   * setzte die Figur seitlich neben den Aufzug -- mitten über den Abgrund.
   * Wer bewegt wird, wird jetzt in Bewegungsrichtung herausgesetzt.
   */
  for (const f of festen) {
    const dx = f.dx ?? 0
    const dy = f.dy ?? 0
    if (dx === 0 && dy === 0) continue
    if (!ueberlappt(rechteck(s.koerper), f)) continue
    s.koerper.x += dx
    s.koerper.y += dy
    if (!ueberlappt(rechteck(s.koerper), f)) continue
    if (dy < 0) {
      s.koerper.y = f.y - PHYSIK.hoehe
      if (s.koerper.vy > 0) s.koerper.vy = 0
    } else if (dy > 0) {
      s.koerper.y = f.y + f.h
      if (s.koerper.vy < 0) s.koerper.vy = 0
    } else if (dx > 0) {
      s.koerper.x = f.x + f.b
    } else {
      s.koerper.x = f.x - PHYSIK.breite
    }
  }

  const vorher = { x: s.koerper.x, y: s.koerper.y }
  const r = bewege(
    s.koerper,
    {
      ...eingabe,
      umkehr: s.umkehr,
      schwerkraft: s.schwerkraft,
      sprungkraft: s.sprungkraft,
    },
    festen,
    dt,
  )
  if (r.gesprungen) s.ereignisse.push('sprung')
  if (r.gelandet) s.ereignisse.push('landung')

  const spieler = rechteck(s.koerper)

  // Aus dem Bild gefallen.
  const hoehe = s.level.hoehe ?? BILD_HOEHE
  const breite = s.level.breite ?? BILD_BREITE
  if (
    s.koerper.y > hoehe + 24 ||
    s.koerper.y < -60 ||
    s.koerper.x < -40 ||
    s.koerper.x > breite + 40
  ) {
    toete(s)
    return
  }

  // Wer auf einer Bruch- oder Fallplatte steht, stößt sie an.
  if (s.koerper.bodenIndex >= 0) {
    const i = s.koerper.bodenIndex
    const o = s.level.objekte[i]!
    const st = s.staende[i]!
    if ((o.typ === 'bruch' || o.typ === 'fall') && st.zerfall < 0 && !st.faellt && st.aktiv) {
      st.zerfall = o.verzoegerung ?? 0.35
      if (!st.ausgeloest) {
        st.ausgeloest = true
        loese(s, o.loest)
      }
    }
  }

  /*
   * Federn und Knöpfe wirken über die Fußsohle, nicht über den Bodenindex.
   *
   * Eine Feder liegt bündig im Boden -- sonst stünde sie als zwölf Pixel
   * hohe Wand im Weg, und man liefe dagegen statt darauf. Welcher der beiden
   * Blöcke die Auflösung gewinnt, hinge dann an der Reihenfolge in den
   * Leveldaten; deshalb wird hier gemessen, ob die Sohle auf der Feder steht.
   */
  if (s.koerper.amBoden) {
    for (let i = 0; i < s.level.objekte.length; i++) {
      const o = s.level.objekte[i]!
      const st = s.staende[i]!
      if ((o.typ !== 'feder' && o.typ !== 'knopf') || !st.aktiv || !st.sichtbar) continue
      const f = feld(o, st)
      if (spieler.x >= f.x + f.b || spieler.x + spieler.b <= f.x) continue
      const sohle = s.schwerkraft > 0 ? spieler.y + spieler.h : spieler.y
      const kante = s.schwerkraft > 0 ? f.y : f.y + f.h
      if (Math.abs(sohle - kante) > 1.5) continue
      if (o.typ === 'knopf') {
        if (st.ausgeloest) continue
        st.ausgeloest = true
        st.offen = true
        s.ereignisse.push('knopf')
        loese(s, o.loest)
        continue
      }
      s.koerper.vy = -(o.kraft ?? 640) * s.schwerkraft
      s.koerper.amBoden = false
      s.koerper.imSprung = false
      s.ereignisse.push('feder')
      if (!st.ausgeloest) {
        st.ausgeloest = true
        loese(s, o.loest)
      }
      break
    }
  }

  // Alles, was Berührung braucht.
  for (let i = 0; i < s.level.objekte.length; i++) {
    const o = s.level.objekte[i]!
    const st = s.staende[i]!
    if (!st.aktiv) continue
    const f = feld(o, st)

    // Ein Ausgang, der ausweicht, tut das schon aus der Nähe -- und danach
    // ist er ein ganz normaler Ausgang. Ohne diesen zweiten Teil war er nie
    // zu erreichen: Die Prüfung sprang jedes Mal über ihn hinweg.
    if (o.typ === 'ziel' && o.flieht && st.sichtbar && !st.ausgeloest) {
      const mitteX = f.x + f.b / 2
      const mitteY = f.y + f.h / 2
      const nah =
        Math.abs(mitteX - (spieler.x + spieler.b / 2)) < 46 &&
        Math.abs(mitteY - (spieler.y + spieler.h / 2)) < 40
      if (nah) {
        st.ausgeloest = true
        st.ox += o.flieht.dx
        st.oy += o.flieht.dy
        s.ereignisse.push('falle')
        loese(s, o.loest)
        continue
      }
    }

    if (!ueberlappt(spieler, f)) continue

    // Geheime Plattformen zeigen sich beim ersten Anfassen.
    if (o.geheim && !st.sichtbar) st.sichtbar = true

    if (istGefahr(o, st)) {
      toete(s)
      return
    }

    switch (o.typ) {
      case 'zone':
        if (!st.ausgeloest || !o.einmal) {
          if (!st.ausgeloest) {
            st.ausgeloest = true
            loese(s, o.loest)
          }
        }
        break
      case 'teleport':
        if (o.nach) {
          s.koerper.x = o.nach.x
          s.koerper.y = o.nach.y
          s.koerper.vx = 0
          s.koerper.vy = 0
          s.ereignisse.push('teleport')
          if (!st.ausgeloest) {
            st.ausgeloest = true
            loese(s, o.loest)
          }
          return
        }
        break
      case 'kristall':
        if (st.sichtbar) {
          st.aktiv = false
          s.kristall = true
          s.ereignisse.push('kristall')
        }
        break
      case 'ziel':
        if (st.sichtbar && !o.falle) {
          s.phase = 'geschafft'
          s.endeZeit = 0
          s.ereignisse.push('geschafft')
          return
        }
        break
      default:
        break
    }
  }

  void vorher
}

/** Die Figur steht still und nichts bewegt sich mehr. */
export function istFertig(s: Spielstand): boolean {
  return s.phase !== 'laeuft'
}
