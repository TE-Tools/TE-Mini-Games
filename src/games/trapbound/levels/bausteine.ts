/**
 * Bausteine – aus denen die Level ab Nummer 11 zusammengesetzt werden.
 *
 * Ein Level ist eine Kette von Abschnitten, die nebeneinander auf dem
 * Bildschirm liegen. Jeder Baustein liefert zwei Dinge auf einmal:
 *
 *   OBJEKTE   die Geometrie und die Fallen,
 *   LÖSUNG    die Eingaben, mit denen man da durchkommt.
 *
 * Dass beides aus derselben Funktion kommt, ist der Kern der Sache: Der Test
 * spielt die Lösung ab, und damit ist jedes erzeugte Level nachweislich zu
 * schaffen. Ein Generator, der nur Geometrie ausspuckt, könnte unlösbare
 * Level bauen, ohne dass es jemand merkt.
 *
 * Zwei Regeln halten die Bausteine kombinierbar:
 *
 *   1. Jeder Abschnitt beginnt und endet auf dem Hauptboden (y = 240). Was
 *      dazwischen passiert, ist seine Sache.
 *   2. Fallen mit Zeitverhalten starten nicht beim Levelbeginn, sondern über
 *      eine Zone am Eingang des Abschnitts (`wartetAufAusloeser`). Dadurch
 *      hängt ihre Phase am Eintreffen des Spielers und nicht daran, wie
 *      lange er vorher gebraucht hat -- sonst wäre keine Lösung aufzeichenbar
 *      und kein Zeitfenster fair.
 */

import type { LoesungsSchritt, Objekt } from '../types'

export const BODEN_Y = 240
export const BODEN_H = 30
/** Wo die Füße stehen, wenn die Figur auf dem Hauptboden steht. */
export const STEH_Y = BODEN_Y - 17

export interface BauStelle {
  /** Linke Kante des Abschnitts. */
  x: number
  /** Wie breit er sein darf. */
  breite: number
  /** 0 (Anfang der Welt) bis 1 (Ende). */
  schwer: number
  rng: () => number
  /** Laufende Nummer für eindeutige Kennungen. */
  nr: number
  /** Sind links und rechts gerade vertauscht? */
  umgedreht: boolean
}

export interface BauStueck {
  objekte: Objekt[]
  loesung: LoesungsSchritt[]
  /** Nach diesem Abschnitt vertauscht? */
  umgedreht?: boolean
}

export type Baustein = (b: BauStelle) => BauStueck

/** Nach rechts laufen – auch wenn die Steuerung gerade vertauscht ist. */
function vor(b: BauStelle, rest: Omit<LoesungsSchritt, 'links' | 'rechts'>): LoesungsSchritt {
  return b.umgedreht ? { ...rest, links: true } : { ...rest, rechts: true }
}

function boden(x: number, breite: number): Objekt {
  return { typ: 'block', x, y: BODEN_Y, b: breite, h: BODEN_H }
}

function mische(rng: () => number, von: number, bis: number): number {
  return Math.round(von + rng() * (bis - von))
}

// ---------------------------------------------------------------- Bausteine

/** Nur Boden. Die Ruhe zwischen zwei Fallen. */
export const bWeg: Baustein = (b) => ({
  objekte: [boden(b.x, b.breite)],
  loesung: [vor(b, { bisX: b.x + b.breite - 14 })],
})

/** Eine Lücke im Boden. */
export const bLuecke: Baustein = (b) => {
  const spalt = mische(b.rng, 40, 40 + Math.round(b.schwer * 14))
  const links = 34
  return {
    objekte: [boden(b.x, links), boden(b.x + links + spalt, b.breite - links - spalt)],
    loesung: [
      // Erst Boden unter den Füßen: Kommt die Figur noch aus einem Sprung
      // des vorigen Abschnitts, ginge der nächste sonst ins Leere.
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + links - 16 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
    ],
  }
}

/** Boden, der beim Betreten wegbricht. */
export const bBruch: Baustein = (b) => {
  const breite = mische(b.rng, 42, 52)
  const verzoegerung = 0.16 - b.schwer * 0.12
  return {
    objekte: [
      boden(b.x, 30),
      { typ: 'bruch', x: b.x + 30, y: BODEN_Y, b: breite, h: BODEN_H, verzoegerung },
      boden(b.x + 30 + breite, b.breite - 30 - breite),
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + 14 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
    ],
  }
}

/** Stacheln im Boden. */
export const bStacheln: Baustein = (b) => {
  const breite = mische(b.rng, 34, 34 + Math.round(b.schwer * 12))
  return {
    objekte: [
      boden(b.x, b.breite),
      { typ: 'stachel', x: b.x + 34, y: BODEN_Y - 12, b: breite, h: 12 },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + 16 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
    ],
  }
}

/** Stacheln, die erst ausfahren, wenn man fast da ist. */
export const bStachelFalle: Baustein = (b) => {
  const id = `st${b.nr}`
  return {
    objekte: [
      boden(b.x, b.breite),
      { typ: 'stachel', id, x: b.x + 40, y: BODEN_Y - 12, b: 38, h: 12, versteckt: true },
      {
        typ: 'zone',
        x: b.x + 8,
        y: BODEN_Y - 50,
        b: 10,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'zeigen', ziel: id },
          { tu: 'beben', wert: 0.25 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + 20 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
    ],
  }
}

/**
 * Ein Sägeblatt, das im Durchgang auf und ab fährt.
 *
 * Es steht still, bis man die Zone am Eingang betritt -- erst dann beginnt
 * sein Takt. Dadurch ist das Zeitfenster für jeden gleich, egal wie lange
 * jemand vorher gebraucht hat.
 */
export const bSaege: Baustein = (b) => {
  const id = `sg${b.nr}`
  const mitte = b.x + Math.round(b.breite / 2)
  const warte = 0.9 - b.schwer * 0.35
  // Auslöser und Warteplatz hängen an der Säge, nicht am Abschnittsanfang:
  // Sonst wächst der Weg unter dem Blatt hindurch mit der Abschnittsbreite,
  // während das Zeitfenster gleich bleibt.
  const zoneX = Math.max(b.x + 8, mitte - 46)
  return {
    objekte: [
      boden(b.x, b.breite),
      {
        typ: 'saege',
        id,
        x: mitte - 9,
        y: BODEN_Y - 52,
        b: 18,
        h: 18,
        weg: { dx: 0, dy: 46, dauer: 0.5, warte, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 10,
        h: 50,
        einmal: true,
        loest: [{ tu: 'los', ziel: id }],
      },
    ],
    loesung: [
      // Genau bis in den Auslöser hinein: Wer davor stehenbleibt, startet den
      // Takt gar nicht; wer weit dahinter stehenbleibt, hat den Takt schon
      // ein Stück verstreichen lassen, bevor das Warten überhaupt beginnt.
      vor(b, { bisX: zoneX - 5 }),
      // Erst herunter, unten warten, wieder hoch: Wenn sie oben steht, ist
      // der Weg frei.
      { dauer: 0.5 + warte + 0.5 + 0.05 },
      vor(b, { bisX: b.x + b.breite - 14 }),
    ],
  }
}

/** Ein Block, der von der Decke stürzt – und danach eine Stufe ist. */
export const bDecke: Baustein = (b) => {
  const id = `dk${b.nr}`
  const mitte = b.x + Math.round(b.breite / 2)
  return {
    objekte: [
      boden(b.x, b.breite),
      { typ: 'fall', id, x: mitte - 22, y: 30, b: 44, h: 42, toedlich: true },
      {
        typ: 'zone',
        x: b.x + 8,
        y: BODEN_Y - 50,
        b: 10,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'fallen', ziel: id },
          { tu: 'beben', wert: 0.35 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisX: b.x + 16 }),
      { dauer: 0.9 },
      vor(b, { bisX: mitte - 40 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
      // Herunter geht es ohne Sprung: Ein Hüpfer von der Kante trüge die
      // Figur weit in den nächsten Abschnitt hinein, und dessen Anlauf wäre
      // vorbei, bevor er beginnt.
      vor(b, { bisX: mitte + 30 }),
      vor(b, { bisBoden: true, dauer: 1.2 }),
      vor(b, { bisX: b.x + b.breite - 14 }),
    ],
  }
}

/** Ein Aufzug, der einen über den Abgrund trägt – sobald man ihn ruft. */
export const bAufzug: Baustein = (b) => {
  const id = `az${b.nr}`
  const links = 30
  const spalt = Math.min(120, b.breite - links - 34)
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, b.breite - links - spalt),
      {
        typ: 'beweger',
        id,
        x: b.x + links,
        y: BODEN_Y,
        b: 40,
        h: 14,
        weg: { dx: spalt - 40, dy: 0, dauer: 1.3, wartetAufAusloeser: true, einweg: true },
      },
      {
        // Der Auslöser liegt AUF der Plattform: Stünde er am Eingang, wäre
        // der Aufzug längst drüben, bevor jemand einsteigt.
        typ: 'zone',
        x: b.x + links + 4,
        y: BODEN_Y - 20,
        b: 10,
        h: 20,
        einmal: true,
        loest: [{ tu: 'los', ziel: id }],
      },
    ],
    loesung: [
      vor(b, { bisX: b.x + links + 8 }),
      { dauer: 1.45 },
      vor(b, { bisX: b.x + b.breite - 14 }),
    ],
  }
}

/** Eine Wand, die zu hoch zum Springen ist – und eine Feder davor. */
export const bFeder: Baustein = (b) => {
  const wandX = b.x + b.breite - 54
  return {
    objekte: [
      boden(b.x, b.breite),
      { typ: 'feder', x: b.x + 26, y: BODEN_Y, b: 28, h: 14, kraft: 720 },
      { typ: 'block', x: wandX, y: BODEN_Y - 74, b: 16, h: 74 },
    ],
    loesung: [
      vor(b, { bisX: b.x + 22 }),
      vor(b, { bisBoden: true, dauer: 2.6 }),
      vor(b, { bisX: b.x + b.breite - 14 }),
    ],
  }
}

/** Eine Tür, die erst aufgeht, wenn man auf den Knopf tritt. */
export const bKnopfTuer: Baustein = (b) => {
  const id = `tr${b.nr}`
  const eilig = b.schwer > 0.45
  return {
    objekte: [
      boden(b.x, b.breite),
      {
        typ: 'knopf',
        // Bündig im Boden: Ein aufgesetzter Knopf wäre eine Stufe, gegen die
        // man läuft, statt daraufzutreten.
        x: b.x + 24,
        y: BODEN_Y,
        b: 26,
        h: 8,
        loest: eilig
          ? [
              { tu: 'oeffnen', ziel: id },
              { tu: 'schliessen', ziel: id, nach: 1.4 },
            ]
          : [{ tu: 'oeffnen', ziel: id }],
      },
      { typ: 'tuer', id, x: b.x + b.breite - 40, y: BODEN_Y - 62, b: 16, h: 62 },
    ],
    loesung: [vor(b, { bisX: b.x + b.breite - 14 })],
  }
}

/** Ein Teleporter, der durch die Wand bringt. */
export const bTeleport: Baustein = (b) => {
  const wandX = b.x + b.breite - 60
  return {
    objekte: [
      boden(b.x, b.breite),
      {
        typ: 'teleport',
        x: b.x + 20,
        y: BODEN_Y - 28,
        b: 24,
        h: 28,
        nach: { x: wandX + 30, y: STEH_Y },
      },
      { typ: 'block', x: wandX, y: BODEN_Y - 80, b: 16, h: 80 },
    ],
    loesung: [vor(b, { bisX: b.x + b.breite - 14 })],
  }
}

/** Ein Abgrund, über den eine unsichtbare Platte führt. */
export const bUnsichtbar: Baustein = (b) => {
  const links = 26
  const spalt = Math.min(110, b.breite - links - 30)
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, b.breite - links - spalt),
      { typ: 'block', x: b.x + links, y: BODEN_Y, b: spalt, h: 12, geheim: true },
    ],
    loesung: [vor(b, { bisX: b.x + b.breite - 14 })],
  }
}

/** Ein Förderband, das einen zurückschiebt. */
export const bBand: Baustein = (b) => {
  const schub = -(50 + Math.round(b.schwer * 34))
  return {
    objekte: [
      boden(b.x, 24),
      { typ: 'block', x: b.x + 24, y: BODEN_Y, b: b.breite - 48, h: BODEN_H, schub },
      boden(b.x + b.breite - 24, 24),
    ],
    loesung: [vor(b, { bisX: b.x + b.breite - 14, dauer: 6 })],
  }
}

/** Eine Presse: breit, schwer, und sie kommt genau dann, wenn man da ist. */
export const bPresse: Baustein = (b) => {
  const id = `pr${b.nr}`
  const mitte = b.x + Math.round(b.breite / 2)
  // Die Presse ist breiter als die Säge, der Weg darunter also länger --
  // deshalb steht ihr oberes Fenster etwas großzügiger.
  const warte = 1 - b.schwer * 0.25
  // Wie bei der Säge: Der Warteplatz gehört neben die Presse.
  const zoneX = Math.max(b.x + 8, mitte - 46)
  return {
    objekte: [
      boden(b.x, b.breite),
      {
        typ: 'saege',
        id,
        x: mitte - 24,
        y: BODEN_Y - 78,
        b: 48,
        h: 26,
        weg: { dx: 0, dy: 60, dauer: 0.35, warte, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 10,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'los', ziel: id },
          { tu: 'beben', wert: 0.3 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisX: zoneX - 5 }),
      { dauer: 0.35 + warte + 0.35 + 0.05 },
      vor(b, { bisX: b.x + b.breite - 14 }),
    ],
  }
}

/** Ab hier sind links und rechts vertauscht. */
export const bUmkehr: Baustein = (b) => ({
  objekte: [
    boden(b.x, b.breite),
    {
      typ: 'zone',
      x: b.x + 16,
      y: BODEN_Y - 50,
      b: 10,
      h: 50,
      einmal: true,
      loest: [{ tu: 'umkehren' }, { tu: 'beben', wert: 0.3 }],
    },
    { typ: 'schild', x: b.x + 30, y: BODEN_Y - 40, b: 44, h: 14, text: '?!' },
  ],
  loesung: [
    // Bis kurz vor die Zone mit Bedingung, dann ein kurzes Stück blind
    // hinein: Der Wechsel darf nicht mitten in einer Bedingung passieren,
    // sonst läuft die Figur in die falsche Richtung, bis die Zeit um ist.
    vor(b, { bisX: b.x + 2 }),
    vor(b, { dauer: 0.32 }),
    { ...(b.umgedreht ? { rechts: true } : { links: true }), bisX: b.x + b.breite - 14 },
  ],
  umgedreht: !b.umgedreht,
})

/** Ein Sprung, bei dem die Sprungkraft nachlässt. */
export const bSchwacherSprung: Baustein = (b) => {
  const links = 34
  const spalt = 34
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, b.breite - links - spalt),
      {
        typ: 'zone',
        x: b.x + 8,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [{ tu: 'sprungkraft', wert: 0.72 }],
      },
      // Und danach wieder normal, sonst schleppt man es durch das ganze Level.
      {
        typ: 'zone',
        x: b.x + b.breite - 20,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [{ tu: 'sprungkraft', wert: 1 }],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + links - 16 }),
      vor(b, { sprung: true, dauer: 0.4 }),
      vor(b, { bisBoden: true }),
      vor(b, { bisX: b.x + b.breite - 12 }),
    ],
  }
}

export interface BausteinEintrag {
  name: string
  bau: Baustein
  /** Wie breit der Abschnitt mindestens sein muss. */
  min: number
}

export const BAUSTEINE: Record<string, BausteinEintrag> = {
  weg: { name: 'weg', bau: bWeg, min: 60 },
  luecke: { name: 'luecke', bau: bLuecke, min: 120 },
  bruch: { name: 'bruch', bau: bBruch, min: 120 },
  stacheln: { name: 'stacheln', bau: bStacheln, min: 110 },
  stachelfalle: { name: 'stachelfalle', bau: bStachelFalle, min: 120 },
  saege: { name: 'saege', bau: bSaege, min: 120 },
  decke: { name: 'decke', bau: bDecke, min: 140 },
  aufzug: { name: 'aufzug', bau: bAufzug, min: 150 },
  feder: { name: 'feder', bau: bFeder, min: 150 },
  knopftuer: { name: 'knopftuer', bau: bKnopfTuer, min: 130 },
  teleport: { name: 'teleport', bau: bTeleport, min: 140 },
  unsichtbar: { name: 'unsichtbar', bau: bUnsichtbar, min: 130 },
  band: { name: 'band', bau: bBand, min: 120 },
  presse: { name: 'presse', bau: bPresse, min: 130 },
  umkehr: { name: 'umkehr', bau: bUmkehr, min: 110 },
  schwachersprung: { name: 'schwachersprung', bau: bSchwacherSprung, min: 130 },
}
