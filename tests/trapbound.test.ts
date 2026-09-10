/**
 * TRAPBOUND nachgerechnet.
 *
 * Das Wichtigste zuerst: Jedes Level ist zu schaffen. Dafür bringt jedes
 * Level eine aufgezeichnete Lösung mit, die hier abgespielt wird. Wer ein
 * Level ändert und die Lösung nicht, merkt es sofort.
 *
 * Danach die Physik im Einzelnen. In einem Fallenspiel darf der Spieler
 * durch das Spiel sterben, aber niemals durch die Steuerung -- deshalb ist
 * jede Eigenschaft, auf die man sich beim Springen verlässt, hier
 * festgeschrieben.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { bewege, neuerKoerper, PHYSIK, type Feste } from '@/games/trapbound/physik'
import { laufe, starte } from '@/games/trapbound/engine'
import { spieleLoesung } from '@/games/trapbound/loesung'
import { alleLevel, levelDaten, LEVEL_ANZAHL, WELTEN, abschnittVon } from '@/games/trapbound/levels'
import { erzeugeLevel } from '@/games/trapbound/levels/erzeugt'
import { LEVEL_PRO_WELT } from '@/games/trapbound/welten'
import {
  leseStand,
  levelStand,
  istOffen,
  merkeTod,
  merkeAbschluss,
  setzeEinstellungen,
  kristalle,
  geschaffte,
  todeGesamt,
  loescheStand,
} from '@/games/trapbound/fortschritt'
import { trapboundGame } from '@/games/trapbound/definition'
import { BILD_BREITE, BILD_HOEHE, type Eingabe, type LevelDaten } from '@/games/trapbound/types'

const NICHTS: Eingabe = { links: false, rechts: false, sprung: false }
const TAKT = 1 / 60

/** Einen Stand n Bilder lang mit derselben Eingabe laufen lassen. */
function bilder(start: ReturnType<typeof starte>, e: Eingabe, n: number) {
  let s = start
  for (let i = 0; i < n; i++) s = laufe(s, e, TAKT)
  return s
}

const boden: Feste[] = [{ x: 0, y: 240, b: 480, h: 30, index: 0 }]
const normal = { umkehr: 1, schwerkraft: 1, sprungkraft: 1 }

describe('Die Steuerung', () => {
  it('lässt die Figur auf dem Boden stehen, ohne dass sie durchsackt', () => {
    const k = neuerKoerper(40, 223)
    for (let i = 0; i < 240; i++) bewege(k, { ...NICHTS, ...normal }, boden, 1 / 240)
    expect(k.y).toBe(223)
    expect(k.amBoden).toBe(true)
  })

  it('beschleunigt und begrenzt das Tempo', () => {
    const k = neuerKoerper(40, 223)
    for (let i = 0; i < 240; i++) {
      bewege(k, { links: false, rechts: true, sprung: false, ...normal }, boden, 1 / 240)
    }
    expect(k.vx).toBeCloseTo(PHYSIK.tempo, 5)
    expect(k.blick).toBe(1)
  })

  it('springt hoch genug für drei Felder und landet wieder', () => {
    const k = neuerKoerper(40, 223)
    let hoechster = 223
    for (let i = 0; i < 240; i++) {
      bewege(k, { links: false, rechts: false, sprung: true, ...normal }, boden, 1 / 240)
      hoechster = Math.min(hoechster, k.y)
    }
    // 410 Anfangsgeschwindigkeit bei 1400 Schwerkraft sind rund 60 Einheiten.
    expect(223 - hoechster).toBeGreaterThan(52)
    expect(223 - hoechster).toBeLessThan(66)
    for (let i = 0; i < 240; i++) bewege(k, { ...NICHTS, ...normal }, boden, 1 / 240)
    expect(k.y).toBe(223)
  })

  it('macht aus einem kurzen Tastendruck einen niedrigen Sprung', () => {
    const hoehe = (haltebilder: number) => {
      const k = neuerKoerper(40, 223)
      let top = 223
      for (let i = 0; i < 240; i++) {
        const sprung = i < haltebilder
        bewege(k, { links: false, rechts: false, sprung, ...normal }, boden, 1 / 240)
        top = Math.min(top, k.y)
      }
      return 223 - top
    }
    expect(hoehe(6)).toBeLessThan(hoehe(240) * 0.75)
    expect(hoehe(6)).toBeGreaterThan(10)
  })

  it('gibt nach der Kante noch einen Wimpernschlag zum Springen (Kojotenzeit)', () => {
    const kante: Feste[] = [{ x: 0, y: 240, b: 100, h: 30, index: 0 }]
    const k = neuerKoerper(80, 223)
    // Über die Kante hinauslaufen …
    for (let i = 0; i < 60; i++) {
      bewege(k, { links: false, rechts: true, sprung: false, ...normal }, kante, 1 / 240)
    }
    expect(k.amBoden).toBe(false)
    // … und kurz danach springen: Das muss noch gehen.
    const r = bewege(k, { links: false, rechts: true, sprung: true, ...normal }, kante, 1 / 240)
    expect(r.gesprungen).toBe(true)
  })

  it('merkt sich einen zu früh gedrückten Sprung bis zur Landung (Sprungpuffer)', () => {
    const k = neuerKoerper(40, 180)
    k.vy = 200
    let gesprungen = false
    for (let i = 0; i < 60 && !gesprungen; i++) {
      const r = bewege(k, { links: false, rechts: false, sprung: true, ...normal }, boden, 1 / 240)
      gesprungen = r.gesprungen
    }
    expect(gesprungen).toBe(true)
  })

  it('lässt niemanden durch eine Wand rutschen, auch nicht bei vollem Tempo', () => {
    const wand: Feste[] = [
      { x: 0, y: 240, b: 480, h: 30, index: 0 },
      { x: 200, y: 180, b: 20, h: 60, index: 1 },
    ]
    const k = neuerKoerper(40, 223)
    for (let i = 0; i < 480; i++) {
      bewege(k, { links: false, rechts: true, sprung: false, ...normal }, wand, 1 / 240)
    }
    expect(k.x + PHYSIK.breite).toBeLessThanOrEqual(200.001)
  })

  it('rechnet unabhängig von der Bildrate gleich', () => {
    const l = levelDaten(1)
    let schnell = starte(l)
    for (let i = 0; i < 240; i++) schnell = laufe(schnell, { ...NICHTS, rechts: true }, 1 / 240)
    let langsam = starte(l)
    for (let i = 0; i < 30; i++) langsam = laufe(langsam, { ...NICHTS, rechts: true }, 1 / 30)
    expect(Math.abs(schnell.koerper.x - langsam.koerper.x)).toBeLessThan(1)
  })
})

describe('Die Fallen', () => {
  it('lässt eine Bruchplatte erst nach kurzer Zeit nachgeben', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'bruch', x: 0, y: 240, b: 120, h: 30, verzoegerung: 0.3 },
        { typ: 'ziel', x: 300, y: 208, b: 22, h: 32 },
      ],
    }
    let s = bilder(starte(l), NICHTS, 6)
    expect(s.staende[0]!.aktiv).toBe(true)
    s = bilder(s, NICHTS, 24)
    expect(s.staende[0]!.aktiv).toBe(false)
  })

  it('tötet, wer einen Stachel berührt', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'stachel', x: 90, y: 228, b: 40, h: 12 },
      ],
    }
    const s = bilder(starte(l), { ...NICHTS, rechts: true }, 60)
    expect(s.phase).toBe('tot')
  })

  it('lässt einen versteckten Stachel erst nach dem Auslöser töten', () => {
    const bau = (): LevelDaten => ({
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'stachel', id: 'z', x: 200, y: 228, b: 40, h: 12, versteckt: true },
        {
          typ: 'zone',
          x: 120,
          y: 200,
          b: 10,
          h: 40,
          einmal: true,
          loest: [{ tu: 'zeigen', ziel: 'z' }],
        },
      ],
    })
    // Ohne Auslöser läuft man einfach darüber -- der Stachel ist nicht da.
    const ohne = bau()
    ohne.objekte.splice(2, 1)
    expect(bilder(starte(ohne), { ...NICHTS, rechts: true }, 180).phase).toBe('laeuft')
    // Mit Auslöser fährt er aus und tötet.
    expect(bilder(starte(bau()), { ...NICHTS, rechts: true }, 180).phase).toBe('tot')
  })

  it('führt verzögerte Aktionen erst nach der Wartezeit aus', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'block', id: 'weg', x: 100, y: 180, b: 40, h: 12 },
        {
          typ: 'zone',
          x: 41,
          y: 200,
          b: 10,
          h: 40,
          einmal: true,
          loest: [{ tu: 'weg', ziel: 'weg', nach: 0.5 }],
        },
      ],
    }
    let s = bilder(starte(l), { ...NICHTS, rechts: true }, 6)
    expect(s.staende[1]!.aktiv).toBe(true)
    s = bilder(s, NICHTS, 40)
    expect(s.staende[1]!.aktiv).toBe(false)
  })

  it('dreht die Schwerkraft um und lässt die Figur zur Decke fallen', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'block', x: 0, y: 0, b: 480, h: 20 },
        {
          typ: 'zone',
          x: 41,
          y: 200,
          b: 10,
          h: 40,
          einmal: true,
          loest: [{ tu: 'schwerkraft', wert: -1 }],
        },
      ],
    }
    const s = bilder(starte(l), { ...NICHTS, rechts: true }, 90)
    expect(s.schwerkraft).toBe(-1)
    expect(s.koerper.y).toBe(20)
    expect(s.koerper.amBoden).toBe(true)
  })

  it('vertauscht auf Wunsch links und rechts', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 200, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        {
          typ: 'zone',
          x: 201,
          y: 200,
          b: 10,
          h: 40,
          einmal: true,
          loest: [{ tu: 'umkehren' }],
        },
      ],
    }
    const s = bilder(starte(l), { ...NICHTS, rechts: true }, 60)
    expect(s.umkehr).toBe(-1)
    expect(s.koerper.x).toBeLessThan(200)
  })

  it('schleudert eine Feder nach oben, höher als ein Sprung', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'feder', x: 100, y: 240, b: 30, h: 14, kraft: 700 },
      ],
    }
    let s = starte(l)
    let top = 223
    for (let i = 0; i < 120; i++) {
      s = laufe(s, { ...NICHTS, rechts: true }, TAKT)
      top = Math.min(top, s.koerper.y)
    }
    expect(223 - top).toBeGreaterThan(120)
  })

  it('versetzt ein Teleporter die Figur', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'teleport', x: 90, y: 214, b: 24, h: 26, nach: { x: 400, y: 100 } },
      ],
    }
    let s = starte(l)
    let versetzt = false
    for (let i = 0; i < 60 && !versetzt; i++) {
      s = laufe(s, { ...NICHTS, rechts: true }, TAKT)
      versetzt = s.ereignisse.includes('teleport')
    }
    expect(versetzt).toBe(true)
    expect(s.koerper.x).toBeCloseTo(400, 0)
    expect(s.koerper.y).toBeCloseTo(100, 0)
  })

  it('nimmt eine fahrende Plattform die Figur mit', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 200 },
      objekte: [{ typ: 'beweger', x: 30, y: 220, b: 60, h: 12, weg: { dx: 120, dy: 0, dauer: 2 } }],
    }
    const s = bilder(starte(l), NICHTS, 60)
    expect(s.koerper.amBoden).toBe(true)
    expect(s.koerper.x).toBeGreaterThan(45)
  })

  it('erschlägt ein herabstürzender Block, wer darunter steht', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'fall', id: 'b', x: 34, y: 40, b: 40, h: 40, toedlich: true },
        {
          typ: 'zone',
          x: 41,
          y: 200,
          b: 8,
          h: 40,
          einmal: true,
          loest: [{ tu: 'fallen', ziel: 'b' }],
        },
      ],
    }
    const s = bilder(starte(l), NICHTS, 60)
    expect(s.phase).toBe('tot')
  })

  it('ist ein Ausgang mit Falle tödlich, ein echter nicht', () => {
    const bau = (falle: boolean): LevelDaten => ({
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'ziel', x: 90, y: 208, b: 22, h: 32, falle },
      ],
    })
    expect(bilder(starte(bau(true)), { ...NICHTS, rechts: true }, 90).phase).toBe('tot')
    expect(bilder(starte(bau(false)), { ...NICHTS, rechts: true }, 90).phase).toBe('geschafft')
  })

  it('weicht ein fliehender Ausgang aus, bleibt danach aber erreichbar', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 223 },
      objekte: [
        { typ: 'block', x: 0, y: 240, b: 480, h: 30 },
        { typ: 'ziel', x: 200, y: 208, b: 22, h: 32, flieht: { dx: 90, dy: 0 } },
      ],
    }
    let s = bilder(starte(l), { ...NICHTS, rechts: true }, 90)
    expect(s.staende[1]!.ox).toBe(90)
    expect(s.phase).toBe('laeuft')
    s = bilder(s, { ...NICHTS, rechts: true }, 120)
    expect(s.phase).toBe('geschafft')
  })

  it('stirbt, wer aus dem Bild fällt', () => {
    const l: LevelDaten = {
      nr: 99,
      welt: 1,
      abschnitt: 1,
      name: 'Test',
      idee: 'Test',
      start: { x: 40, y: 100 },
      objekte: [{ typ: 'ziel', x: 400, y: 208, b: 22, h: 32 }],
    }
    expect(bilder(starte(l), NICHTS, 120).phase).toBe('tot')
  })
})

describe('Die Level', () => {
  const alle = alleLevel()

  it('bringt hundert Level in fünf Welten zu je zwanzig', () => {
    expect(alle).toHaveLength(100)
    expect(LEVEL_ANZAHL).toBe(100)
    expect(WELTEN).toHaveLength(5)
    for (const w of WELTEN) {
      expect(w.abschnitte).toHaveLength(2)
      expect(w.abschnitte.flatMap((a) => a.level)).toHaveLength(20)
    }
    // Jede Levelnummer kommt genau einmal auf der Karte vor.
    const aufDerKarte = WELTEN.flatMap((w) => w.abschnitte.flatMap((a) => a.level))
    expect(aufDerKarte).toHaveLength(100)
    expect(new Set(aufDerKarte).size).toBe(100)
  })

  it('führt die Welten der Reihe nach ein', () => {
    // Welt 1 kennt keine Förderbänder, Welt 2 keine Teleporter, und die
    // vertauschte Steuerung gibt es erst in Welt 4.
    const typenBis = (welt: number) =>
      new Set(alle.filter((l) => l.welt <= welt).flatMap((l) => l.objekte.map((o) => o.typ)))
    expect(typenBis(1).has('teleport')).toBe(true) // Level 8 hat einen
    const umkehrAb = alle.find((l) => l.idee.includes('umkehr'))?.welt ?? 0
    expect(umkehrAb).toBeGreaterThanOrEqual(4)
    const bandAb = alle.find((l) => l.idee.includes('band'))?.welt ?? 0
    expect(bandAb).toBeGreaterThanOrEqual(2)
  })

  it('gibt jedem Level Nummer, Namen, Idee und einen Ausgang', () => {
    const nummern = new Set<number>()
    for (const l of alle) {
      expect(l.name.length).toBeGreaterThan(2)
      expect(l.idee.length).toBeGreaterThan(10)
      expect(nummern.has(l.nr)).toBe(false)
      nummern.add(l.nr)
      const ausgaenge = l.objekte.filter((o) => o.typ === 'ziel' && !o.falle)
      expect(`Level ${l.nr}: ${ausgaenge.length} echte Ausgänge`).toBe(
        `Level ${l.nr}: 1 echte Ausgänge`,
      )
      expect(abschnittVon(l.nr).welt.nr).toBe(l.welt)
    }
  })

  it('setzt die Figur auf festen Boden und ins Bild', () => {
    for (const l of alle) {
      expect(l.start.x).toBeGreaterThanOrEqual(0)
      expect(l.start.x).toBeLessThan(l.breite ?? BILD_BREITE)
      expect(l.start.y).toBeGreaterThanOrEqual(0)
      expect(l.start.y).toBeLessThan(l.hoehe ?? BILD_HOEHE)
      // Wer beim Start sofort in einem Stachel steht, hat keine Chance.
      const s = starte(l)
      expect(`Level ${l.nr}: ${s.phase}`).toBe(`Level ${l.nr}: laeuft`)
      const nachEinerSekunde = bilder(s, NICHTS, 60)
      expect(`Level ${l.nr} nach 1s: ${nachEinerSekunde.phase}`).toBe(
        `Level ${l.nr} nach 1s: laeuft`,
      )
    }
  })

  it('hält jedes Objekt im Bild', () => {
    for (const l of alle) {
      for (const o of l.objekte) {
        expect(o.x).toBeGreaterThanOrEqual(-20)
        expect(o.y).toBeGreaterThanOrEqual(-20)
        expect(o.x + o.b).toBeLessThanOrEqual((l.breite ?? BILD_BREITE) + 20)
      }
    }
  })

  it('führt die Fallen nach und nach ein', () => {
    // Die ersten drei Level bringen keine Falle -- erst laufen und springen.
    const fallen = new Set(['bruch', 'fall', 'stachel', 'saege', 'teleport'])
    for (const l of alle.slice(0, 3)) {
      expect(`Level ${l.nr}`).toBe(
        l.objekte.some((o) => fallen.has(o.typ) || o.flieht || o.falle)
          ? `Level ${l.nr} hat schon eine Falle`
          : `Level ${l.nr}`,
      )
    }
    // Und später gibt es sie reichlich.
    const spaet = alle.slice(3).flatMap((l) => l.objekte.map((o) => o.typ))
    expect(new Set(spaet).size).toBeGreaterThanOrEqual(7)
  })

  /**
   * Am 10.09.2026 sahen die erzeugten Level fast alle gleich aus: Der Platz
   * wurde gleichmäßig auf drei Abschnitte verteilt, jeder bekam 114 Punkte,
   * und damit fielen dreizehn der sechzehn Bausteine an ihrem Mindestmaß
   * durch. Level 47 im Turm bestand aus Weg, Stacheln, Weg. Der Test unten
   * hätte das gemerkt, die Lösbarkeitsprüfung nicht -- die war zufrieden.
   */
  it('baut die erzeugten Level aus dem ganzen Vorrat ihrer Welt', () => {
    const teile = (nr: number) =>
      erzeugeLevel(nr)
        .idee.replace('Aus Bausteinen: ', '')
        .replace(/\.$/, '')
        .split(' + ')
        .map((t) => t.trim())

    // Über alle erzeugten Level: reichlich verschiedene Bausteine.
    const alleTeile = new Set<string>()
    for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) for (const t of teile(nr)) alleTeile.add(t)
    expect(alleTeile.size).toBeGreaterThanOrEqual(14)

    // Und auch innerhalb einer einzelnen Welt darf es nicht eintönig werden.
    for (let welt = 2; welt <= 5; welt++) {
      const inWelt = new Set<string>()
      const von = (welt - 1) * LEVEL_PRO_WELT + 1
      for (let nr = Math.max(11, von); nr <= welt * LEVEL_PRO_WELT; nr++) {
        for (const t of teile(nr)) inWelt.add(t)
      }
      expect(`Welt ${welt}: ${inWelt.size}`).toBe(
        inWelt.size >= 8 ? `Welt ${welt}: ${inWelt.size}` : `Welt ${welt}: mindestens 8`,
      )
    }
  })

  it('gibt jedem erzeugten Level etwas, das wirklich aufhält', () => {
    // Decke, Knopftür, unsichtbarer Steg, Band, Feder und Teleport lassen
    // sich mit gehaltener Taste durchlaufen. Ein Level, das nur daraus
    // besteht, wäre keins -- deshalb ist der erste Baustein immer eine
    // Falle, an der Draufloslaufen endet.
    const harmlos = new Set(['decke', 'knopftuer', 'unsichtbar', 'band', 'feder', 'teleport'])
    const ohne: number[] = []
    for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) {
      const teile = erzeugeLevel(nr)
        .idee.replace('Aus Bausteinen: ', '')
        .replace(/\.$/, '')
        .split(' + ')
        .map((t) => t.trim())
      if (!teile.some((t) => !harmlos.has(t) && t !== 'weg' && !t.includes('Ausgang')))
        ohne.push(nr)
    }
    expect(ohne).toEqual([])
  })

  it('versteckt mindestens einen Kristall, aber nie auf dem Weg zum Ausgang', () => {
    const mitKristall = alle.filter((l) => l.objekte.some((o) => o.typ === 'kristall'))
    expect(mitKristall.length).toBeGreaterThanOrEqual(1)
    // Die hinterlegte Lösung ist der kürzeste Weg -- sie darf ihn nicht
    // einsammeln, sonst wäre er kein Geheimnis.
    const aufDemWeg = mitKristall.filter((l) => spieleLoesung(l).stand.kristall).map((l) => l.nr)
    expect(aufDemWeg).toEqual([])
  })
})

describe('Zu schaffen', () => {
  it('lässt sich jedes Level mit der hinterlegten Lösung durchspielen', () => {
    const gescheitert: string[] = []
    for (const l of alleLevel()) {
      const r = spieleLoesung(l)
      if (!r.geschafft) gescheitert.push(`Level ${l.nr} (${l.name}): ${r.grund}`)
    }
    expect(gescheitert).toEqual([])
  }, 60_000)

  it('braucht dafür nirgends länger als eine halbe Minute', () => {
    for (const l of alleLevel()) {
      const r = spieleLoesung(l)
      expect(`Level ${l.nr}: ${r.zeit < 30}`).toBe(`Level ${l.nr}: true`)
    }
  }, 60_000)

  it('bringt jemanden um, der einfach nur nach rechts rennt – ab Level 4', () => {
    // Das ist die Messung zum Wesen des Spiels: Die ersten Level sind
    // harmlos, danach reicht Draufloslaufen nicht mehr.
    const stumpf = (l: LevelDaten) => {
      let s = starte(l)
      for (let i = 0; i < 60 * 12 && s.phase === 'laeuft'; i++) {
        s = laufe(s, { links: false, rechts: true, sprung: false }, TAKT)
      }
      return s.phase
    }
    expect(stumpf(levelDaten(1))).toBe('geschafft')
    const spaeter = [4, 5, 6, 7, 8, 9, 10].map((n) => stumpf(levelDaten(n)))
    expect(spaeter.every((p) => p !== 'geschafft')).toBe(true)
  }, 60_000)

  it('lässt auch in den erzeugten Welten kaum jemanden blind durchlaufen', () => {
    // Dieselbe Messung über alle hundert Level: Wer nur die Taste nach
    // rechts hält, darf höchstens in den ganz frühen Leveln ankommen.
    let durch = 0
    for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) {
      let s = starte(levelDaten(nr))
      for (let i = 0; i < 60 * 14 && s.phase === 'laeuft'; i++) {
        s = laufe(s, { links: false, rechts: true, sprung: false }, TAKT)
      }
      if (s.phase === 'geschafft') durch++
    }
    expect(durch / (LEVEL_ANZAHL - 10)).toBeLessThan(0.1)
  }, 120_000)
})

describe('Der Fortschritt', () => {
  beforeEach(() => {
    loescheStand()
  })

  it('beginnt mit einem offenen Level', () => {
    const s = leseStand()
    expect(s.freigeschaltet).toBe(1)
    expect(istOffen(1, s)).toBe(true)
    expect(istOffen(2, s)).toBe(false)
  })

  it('schaltet nach einem Abschluss das nächste Level frei', () => {
    merkeAbschluss({ nr: 1, tode: 3, zeit: 12.5, kristall: false })
    const s = leseStand()
    expect(s.freigeschaltet).toBe(2)
    expect(levelStand(1, s).fertig).toBe(true)
    expect(levelStand(1, s).besteTode).toBe(3)
    expect(levelStand(1, s).besteZeit).toBeCloseTo(12.5, 5)
  })

  it('merkt sich die beste Leistung, nicht die letzte', () => {
    merkeAbschluss({ nr: 1, tode: 3, zeit: 12.5, kristall: false })
    merkeAbschluss({ nr: 1, tode: 9, zeit: 30, kristall: true })
    const l = levelStand(1)
    expect(l.besteTode).toBe(3)
    expect(l.besteZeit).toBeCloseTo(12.5, 5)
    // Ein einmal gefundener Kristall bleibt gefunden.
    expect(l.kristall).toBe(true)
  })

  it('zählt Tode mit, auch ohne Abschluss', () => {
    merkeTod(2)
    merkeTod(2)
    merkeTod(3)
    expect(levelStand(2).tode).toBe(2)
    expect(todeGesamt()).toBe(3)
    expect(geschaffte()).toBe(0)
  })

  it('zählt gefundene Kristalle', () => {
    merkeAbschluss({ nr: 8, tode: 0, zeit: 9, kristall: true })
    expect(kristalle()).toBe(1)
    expect(geschaffte()).toBe(1)
  })

  it('behält Einstellungen', () => {
    setzeEinstellungen({ beben: false, lautstaerke: 0.3 })
    const s = leseStand()
    expect(s.einstellungen.beben).toBe(false)
    expect(s.einstellungen.lautstaerke).toBeCloseTo(0.3, 5)
    expect(s.einstellungen.ton).toBe(true)
  })

  it('überlebt kaputte Daten im Speicher', () => {
    localStorage.setItem('trapbound:stand', '{kein json')
    expect(leseStand().freigeschaltet).toBe(1)
  })
})

describe('Die Wertung', () => {
  it('gibt nichts für ein nicht geschafftes Level', () => {
    expect(trapboundGame.calculateScore(3, { won: false })).toBe(0)
    expect(trapboundGame.calculateXP(3, 0)).toBe(0)
    expect(trapboundGame.calculateStars!(3, 0)).toBe(0)
  })

  it('belohnt wenige Tode, Tempo und den Kristall', () => {
    const roh = (tode: number, zeit: number, kristall = false) => ({
      won: true,
      tode,
      zeit,
      kristall,
    })
    expect(trapboundGame.calculateScore(3, roh(0, 10))).toBeGreaterThan(
      trapboundGame.calculateScore(3, roh(5, 10)),
    )
    expect(trapboundGame.calculateScore(3, roh(0, 10))).toBeGreaterThan(
      trapboundGame.calculateScore(3, roh(0, 25)),
    )
    expect(trapboundGame.calculateScore(3, roh(0, 10, true))).toBeGreaterThan(
      trapboundGame.calculateScore(3, roh(0, 10, false)),
    )
  })

  it('vergibt Sterne von eins bis fünf', () => {
    const sterne = [
      trapboundGame.calculateStars!(
        3,
        trapboundGame.calculateScore(3, { won: true, tode: 12, zeit: 40 }),
      ),
      trapboundGame.calculateStars!(
        3,
        trapboundGame.calculateScore(3, { won: true, tode: 0, zeit: 6, kristall: true }),
      ),
    ]
    expect(sterne[0]).toBeGreaterThanOrEqual(1)
    expect(sterne[1]).toBe(5)
  })

  it('ist im Spielverzeichnis eingetragen', () => {
    expect(trapboundGame.id).toBe('trapbound')
    expect(trapboundGame.maxLevel).toBe(LEVEL_ANZAHL)
    expect(trapboundGame.createLevel(4).name).toBe(levelDaten(4).name)
  })
})
