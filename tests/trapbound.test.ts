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
import {
  istGemein,
  istAlptraum,
  GEMEIN_AB,
  HAERTER_AB,
  VIER_AB,
  WANDEL_ZIEL,
  schwierigkeit,
  zaehleWandel,
} from '@/games/trapbound/levels/erzeugt'
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

  it('bringt dreihundert Level in fünfzehn Welten zu je zwanzig', () => {
    expect(alle).toHaveLength(300)
    expect(LEVEL_ANZAHL).toBe(300)
    expect(WELTEN).toHaveLength(15)
    for (const w of WELTEN) {
      expect(w.abschnitte).toHaveLength(2)
      expect(w.abschnitte.flatMap((a) => a.level)).toHaveLength(20)
    }
    // Jede Levelnummer kommt genau einmal auf der Karte vor.
    const aufDerKarte = WELTEN.flatMap((w) => w.abschnitte.flatMap((a) => a.level))
    expect(aufDerKarte).toHaveLength(300)
    expect(new Set(aufDerKarte).size).toBe(300)
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
      levelDaten(nr)
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
  }, 120_000)

  it('gibt jedem erzeugten Level etwas, das wirklich aufhält', () => {
    // Decke, Knopftür, unsichtbarer Steg, Band, Feder und Teleport lassen
    // sich mit gehaltener Taste durchlaufen. Ein Level, das nur daraus
    // besteht, wäre keins -- deshalb ist der erste Baustein immer eine
    // Falle, an der Draufloslaufen endet.
    const harmlos = new Set(['decke', 'knopftuer', 'unsichtbar', 'band', 'feder', 'teleport'])
    const ohne: number[] = []
    for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) {
      const teile = levelDaten(nr)
        .idee.replace('Aus Bausteinen: ', '')
        .replace(/\.$/, '')
        .split(' + ')
        .map((t) => t.trim())
      if (!teile.some((t) => !harmlos.has(t) && t !== 'weg' && !t.includes('Ausgang')))
        ohne.push(nr)
    }
    expect(ohne).toEqual([])
  }, 120_000)

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

/**
 * Abwechslung und Gemeinheit.
 *
 * Thomas am 10.09.2026, nachdem er selbst gespielt hatte: "kontrolliere
 * bitte, dass nicht zu viele gleiche Level sind. Ich hatte grade im
 * Dreißigerbereich viele gleiche Level" -- und dazu der Wunsch nach
 * gemeinen Leveln ab fünfzig, "dass man das nicht beim ersten Mal schafft".
 *
 * Nachgemessen war die Klage berechtigt: 90 Level, aber nur 72 verschiedene
 * Bauarten; 29, 32 und 34 waren dreimal dasselbe. Beide Tests hier halten
 * fest, dass das nicht zurückkommt.
 */
describe('Abwechslung', () => {
  const bauart = (nr: number) =>
    [...levelDaten(nr).idee.replace('Aus Bausteinen: ', '').replace(/\.$/, '').split(' + ')]
      .sort()
      .join('+')

  /**
   * Bei dreihundert Leveln lässt sich "jede Bauart nur einmal" nicht mehr
   * halten: Auf einen Bildschirm passen zwei, selten drei Fallen, und mehr
   * als ein paar hundert Paarungen gibt der Vorrat nicht her. Was zählt, ist
   * der Abstand -- eine Wiederholung nach fünfzig Leveln erkennt niemand
   * wieder, eine nach dreien schon.
   */
  it('wiederholt eine Bauart frühestens nach fünfzig Leveln', () => {
    // Gemeine Level und Albträume fangen immer mit einer Jagd oder Wänden
    // an -- ihr Vorrat an Paarungen ist klein, deshalb gilt für sie ein
    // kleinerer Abstand. Für alle anderen bleibt es bei fünfzig.
    const eng = (nr: number) => istGemein(nr) || istAlptraum(nr)
    const zuletzt = new Map<string, number>()
    const zuNah: string[] = []
    for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) {
      const k = bauart(nr)
      const vorher = zuletzt.get(k)
      const mindestens = eng(nr) ? 6 : 50
      if (vorher !== undefined && nr - vorher < mindestens) zuNah.push(`${vorher} und ${nr}: ${k}`)
      zuletzt.set(k, nr)
    }
    expect(zuNah).toEqual([])
  }, 120_000)

  it('wiederholt keinen Baustein direkt im nächsten Level', () => {
    const zuNah: string[] = []
    for (let nr = 12; nr <= LEVEL_ANZAHL; nr++) {
      const a = new Set(bauart(nr - 1).split('+'))
      const b = bauart(nr).split('+')
      const gleich = b.filter((t) => a.has(t) && !t.includes('Ausgang'))
      // Ein gemeinsamer Baustein ist hinnehmbar, zwei wären dasselbe Level.
      // Bei zwei gemeinen Leveln nebeneinander ist der erste Baustein
      // zwangsläufig wieder eine Jagd oder eine Wand -- das zählt nicht.
      const beideGemein = istGemein(nr - 1) && istGemein(nr)
      const echte = beideGemein ? gleich.filter((t) => t !== 'jagd' && t !== 'waende') : gleich
      if (echte.length >= 2) zuNah.push(`${nr - 1}/${nr}: ${gleich.join(', ')}`)
    }
    expect(zuNah).toEqual([])
  }, 120_000)

  it('gibt zwei Leveln hintereinander nie denselben Namen', () => {
    const doppelt: string[] = []
    for (let nr = 12; nr <= LEVEL_ANZAHL; nr++) {
      const a = levelDaten(nr - 1).name
      const b = levelDaten(nr).name
      if (a === b) doppelt.push(`${nr - 1}/${nr}: ${a}`)
    }
    expect(doppelt).toEqual([])
  }, 120_000)
})

describe('Gemeine Level', () => {
  const gemeine: number[] = []
  const normale: number[] = []
  for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) (istGemein(nr) ? gemeine : normale).push(nr)

  it('fängt erst ab Level fünfzig damit an', () => {
    expect(gemeine.filter((nr) => nr < GEMEIN_AB)).toEqual([])
    expect(gemeine.length).toBeGreaterThanOrEqual(10)
  })

  it('setzt sie einzeln, nie zwei hintereinander', () => {
    const paare = gemeine.filter((nr) => gemeine.includes(nr + 1))
    expect(paare).toEqual([])
    // Und nicht zu selten: In den Leveln ab 50 mindestens jedes achte.
    const ab50 = LEVEL_ANZAHL - GEMEIN_AB + 1
    expect(gemeine.length / ab50).toBeGreaterThan(0.125)
  })

  it('lässt in jedem gemeinen Level etwas hinter einem her oder auf einen zu', () => {
    for (const nr of gemeine) {
      const idee = levelDaten(nr).idee
      const hatGemeinheit =
        idee.includes('jagd') || idee.includes('waende') || idee.includes('zuschnappender')
      expect(`Level ${nr}`).toBe(hatGemeinheit ? `Level ${nr}` : `Level ${nr} ist gar nicht gemein`)
    }
  })

  /**
   * Was kurz vor der Tür noch kommt.
   *
   * Zwei Dinge auf einmal: Stacheln fahren aus dem Boden, über die man
   * springen muss, und gleich danach kommt eine Wand von der Decke. Beides
   * wird hier gemessen -- wer nicht springt, kommt nicht durch, und wer
   * einen Moment überlegt, dem geht die Tür zu.
   */
  it('lässt vor der Tür weder Trödeln noch Durchmarschieren zu', () => {
    const letzterSprung = (l: LevelDaten) => {
      const ls = l.loesung ?? []
      for (let i = ls.length - 1; i >= 0; i--) if (ls[i]!.sprung) return i
      return -1
    }
    for (const nr of gemeine) {
      const l = levelDaten(nr)
      const i = letzterSprung(l)
      expect(`Level ${nr}`).toBe(i >= 0 ? `Level ${nr}` : `Level ${nr} hat gar keinen Sprung`)

      // Ohne den Sprung: in die Stacheln.
      const ohne = [...(l.loesung ?? [])]
      ohne[i] = { ...ohne[i]!, sprung: false }
      expect(`${nr} ohne Sprung`).toBe(
        spieleLoesung({ ...l, loesung: ohne }).geschafft
          ? `${nr} ohne Sprung kommt durch`
          : `${nr} ohne Sprung`,
      )

      // Mit einer halben Sekunde Bedenkzeit: Wand zu.
      const mit = [...(l.loesung ?? [])]
      mit.splice(i, 0, { dauer: 0.6 })
      expect(`${nr} mit Bedenkzeit`).toBe(
        spieleLoesung({ ...l, loesung: mit }).geschafft
          ? `${nr} mit Bedenkzeit kommt durch`
          : `${nr} mit Bedenkzeit`,
      )
    }
  }, 60_000)

  /**
   * Der eigentliche Beweis: Auf einem gemeinen Level darf man nicht zögern.
   *
   * Gemessen wird, wie lange die Figur an der ungünstigsten Stelle
   * stehenbleiben darf und es trotzdem noch schafft. Auf normalen Leveln ist
   * das reichlich (dort wartet meist eine Falle auf ihren Takt), auf
   * gemeinen praktisch nichts -- da läuft etwas hinterher oder eine Wand
   * geht zu.
   */
  it('verzeiht auf gemeinen Leveln kein Zögern, auf normalen schon', () => {
    const luft = (nr: number): number => {
      const l = levelDaten(nr)
      let schlimmste = 9
      for (const t of [0.3, 0.9, 1.6, 2.5]) {
        let erlaubt = 0
        for (const pause of [0.3, 1]) {
          if (spieleLoesung(l, { bei: t, dauer: pause }).geschafft) erlaubt = pause
          else break
        }
        schlimmste = Math.min(schlimmste, erlaubt)
      }
      return schlimmste
    }
    const mittel = (ns: number[]) => ns.reduce((a, n) => a + luft(n), 0) / ns.length
    const gemein = mittel(gemeine)
    const normal = mittel(normale.filter((n) => n % 7 === 0))
    expect(`gemein ${gemein.toFixed(2)}s`).toBe(
      gemein < 0.25 ? `gemein ${gemein.toFixed(2)}s` : `gemein zu gutmütig: ${gemein.toFixed(2)}s`,
    )
    expect(normal).toBeGreaterThan(gemein * 2)
  }, 120_000)
})

/**
 * Die zweite Hälfte, ab Level 101.
 *
 * Thomas am 10.09.2026: "Ab Level hunderteins noch mal um einige schwerer,
 * dass dann noch mehr Fallen kommen, andere Fallen. Das, was von der Decke
 * fällt oder zusammenbricht, dass man das vorher nicht sieht. Wirklich
 * einige schwerere Level, wo man wirklich zwanzig bis dreißig Versuche
 * mindestens brauchen muss."
 *
 * Was sich davon messen lässt, wird hier gemessen: wie viele Fallen ohne
 * Vorwarnung kommen und wie wenig Zeit zum Zögern bleibt. Wie oft jemand
 * wirklich stirbt, hängt am Menschen -- aber jede unangekündigte Falle
 * kostet mindestens einen Anlauf, und davon gibt es im Albtraum ein
 * Vielfaches der ersten Hälfte.
 */
describe('Die zweite Hälfte', () => {
  const blinde = (nr: number) =>
    levelDaten(nr).objekte.filter((o) => o.versteckt || o.heimlich).length
  const schnitt = (ns: number[]) => ns.reduce((a, n) => a + blinde(n), 0) / ns.length

  const alptraeume: number[] = []
  const spaeteNormale: number[] = []
  const fruehe: number[] = []
  for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) {
    if (istAlptraum(nr)) alptraeume.push(nr)
    else if (nr >= HAERTER_AB && !istGemein(nr)) spaeteNormale.push(nr)
    else if (nr < 101 && !istGemein(nr)) fruehe.push(nr)
  }

  it('lässt die ersten hundert Level in Ruhe', () => {
    // Die Erweiterung darf nichts an dem ändern, was schon gespielt wurde.
    expect(schwierigkeit(100)).toBeCloseTo(1, 5)
    expect(istAlptraum(100)).toBe(false)
    expect(schnitt(fruehe)).toBeLessThan(0.6)
  }, 120_000)

  it('setzt Albträume erst ab Level 101 und nie zwei nebeneinander', () => {
    expect(alptraeume.filter((nr) => nr < HAERTER_AB)).toEqual([])
    expect(alptraeume.length).toBeGreaterThanOrEqual(25)
    expect(alptraeume.filter((nr) => alptraeume.includes(nr + 1))).toEqual([])
  })

  it('bringt in der zweiten Hälfte deutlich mehr Fallen ohne Vorwarnung', () => {
    const frueh = schnitt(fruehe)
    const spaet = schnitt(spaeteNormale)
    const alp = schnitt(alptraeume)
    expect(spaet).toBeGreaterThan(frueh * 2)
    expect(alp).toBeGreaterThan(3)
    expect(alp).toBeGreaterThan(spaet)
  }, 120_000)

  it('gibt jedem Albtraum eine blinde Falle und etwas, das jagt', () => {
    const ohne: number[] = []
    for (const nr of alptraeume) {
      const idee = levelDaten(nr).idee
      const jagt = idee.includes('jagd') || idee.includes('waende')
      const blind = blinde(nr) >= 2
      if (!jagt || !blind) ohne.push(nr)
    }
    expect(ohne).toEqual([])
  }, 120_000)

  it('verzeiht im Albtraum praktisch kein Zögern', () => {
    const luft = (nr: number): number => {
      const l = levelDaten(nr)
      let schlimmste = 9
      for (const t of [0.3, 0.9, 1.6, 2.5]) {
        let erlaubt = 0
        for (const pause of [0.3, 1]) {
          if (spieleLoesung(l, { bei: t, dauer: pause }).geschafft) erlaubt = pause
          else break
        }
        schlimmste = Math.min(schlimmste, erlaubt)
      }
      return schlimmste
    }
    const stichprobe = alptraeume.filter((_, i) => i % 3 === 0)
    const mittel = stichprobe.reduce((a, n) => a + luft(n), 0) / stichprobe.length
    // Gemessen 0,28 s (11.09.2026); auf gewöhnlichen Leveln sind es 0,66 bis
    // 0,75 s. Die Grenze liegt bewusst etwas über dem gemessenen Wert: Sie
    // soll anschlagen, wenn die Albträume gutmütig werden, und nicht bei
    // jeder Kleinigkeit am Generator.
    expect(`Albtraum ${mittel.toFixed(2)}s`).toBe(
      mittel < 0.35
        ? `Albtraum ${mittel.toFixed(2)}s`
        : `Albtraum zu gutmütig: ${mittel.toFixed(2)}s`,
    )
  }, 120_000)
})

/**
 * Ab Level 150: vier Dinge, die sich bewegen.
 *
 * Thomas am 11.09.2026: "ab 150 [...] das heißt es sind 4 sachen die sich
 * verändern verschieben auch mal eine wand die dich nach hinten schiebt und
 * man irgendwo warten muss oder dann über das hinterniss zurück springen
 * muss. Das man das nach und nach lernen muss."
 *
 * Drei Zusagen stehen darin, und alle drei werden hier gemessen: dass immer
 * etwas in Bewegung ist, dass die schiebende Wand wirklich zurückschiebt,
 * und dass man das Neue erst kennenlernt, bevor es zwischen allem anderen
 * auftaucht.
 */
describe('Ab Level 150', () => {
  it('hält in jedem Level mindestens vier Dinge in Bewegung', () => {
    const zuRuhig: string[] = []
    for (let nr = VIER_AB; nr <= LEVEL_ANZAHL; nr++) {
      const n = zaehleWandel(levelDaten(nr))
      if (n < WANDEL_ZIEL) zuRuhig.push(`${nr}: nur ${n}`)
    }
    expect(zuRuhig).toEqual([])
  }, 120_000)

  it('bewegt dort deutlich mehr als in der ersten Hälfte', () => {
    const mittel = (von: number, bis: number) => {
      let summe = 0
      for (let nr = von; nr <= bis; nr++) summe += zaehleWandel(levelDaten(nr))
      return summe / (bis - von + 1)
    }
    expect(mittel(VIER_AB, LEVEL_ANZAHL)).toBeGreaterThan(mittel(11, 100) * 2)
  }, 120_000)

  /**
   * Die Wand, die zurückschiebt.
   *
   * Gemessen wird sie an ihrem Sinn: Wer nicht wartet, sondern gleich
   * hinüberspringt, wird von ihr in die Lücke zurückgedrängt und fällt. Der
   * Test nimmt dazu die Wartepause aus der hinterlegten Lösung heraus -- und
   * verlangt, dass es dann schiefgeht.
   */
  it('schiebt bei der Schieberwand zurück, wer nicht wartet', () => {
    const schieberLevel: number[] = []
    for (let nr = 11; nr <= LEVEL_ANZAHL; nr++) {
      if (levelDaten(nr).idee.includes('schieber')) schieberLevel.push(nr)
    }
    expect(schieberLevel.length).toBeGreaterThanOrEqual(4)

    for (const nr of schieberLevel) {
      const l = levelDaten(nr)
      const ohne = [...(l.loesung ?? [])]
      const i = ohne.findIndex((x) => (x.dauer ?? 0) > 1.5 && !x.links && !x.rechts && !x.sprung)
      expect(`Level ${nr}`).toBe(i >= 0 ? `Level ${nr}` : `Level ${nr} wartet gar nicht`)
      ohne.splice(i, 1)
      expect(`${nr} ohne Warten`).toBe(
        spieleLoesung({ ...l, loesung: ohne }).geschafft
          ? `${nr} ohne Warten kommt durch`
          : `${nr} ohne Warten`,
      )
    }
  }, 120_000)

  it('zeigt jede neue Falle zuerst in ihrer eigenen Welt', () => {
    // Welt 6 bringt die blinden, Welt 7 das Pendel, Welt 8 Schieber und
    // Doppellücke. Jede davon muss in ihrer Welt vorkommen, sonst lernt man
    // sie nie kennen, bevor sie im Chaos auftaucht.
    const inWelt = (von: number, bis: number) => {
      const teile = new Set<string>()
      for (let nr = von; nr <= bis; nr++) {
        for (const t of levelDaten(nr)
          .idee.replace('Aus Bausteinen: ', '')
          .replace(/\.$/, '')
          .split(' + ')) {
          teile.add(t.trim())
        }
      }
      return teile
    }
    const welt6 = inWelt(101, 120)
    expect(welt6.has('blindbruch') || welt6.has('blindfall')).toBe(true)
    expect(inWelt(121, 140).has('pendel')).toBe(true)
    const welt8 = inWelt(141, 160)
    expect(welt8.has('schieber')).toBe(true)
    expect(welt8.has('doppelluecke')).toBe(true)
  }, 120_000)
})
