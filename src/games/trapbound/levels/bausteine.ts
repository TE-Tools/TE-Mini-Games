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
  // Die Mauer hängt an der Feder, nicht am Abschnittsende: Ein Federsprung
  // trägt rund hundertvierzig Punkte weit, und sobald der Abschnitt breiter
  // wurde als das, kam die Figur vor der Mauer auf und stand davor.
  const wandX = Math.min(b.x + b.breite - 54, b.x + 118)
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
        //
        // Und in fester Entfernung vor der Tür, nicht am Abschnittsanfang:
        // Die Tür fällt nach 1,4 Sekunden wieder zu, und sobald die
        // Abschnitte länger wurden, reichte die Zeit für den Weg nicht mehr.
        x: Math.max(b.x + 24, b.x + b.breite - 150),
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

/**
 * Etwas läuft hinter einem her.
 *
 * Eine Wand aus Sägeblättern, die den Abschnitt von links nach rechts
 * durchfegt, sobald man ihn betritt. Sie ist langsamer als die Figur -- wer
 * losläuft, kommt davon; wer stehenbleibt, um zu gucken, nicht. Genau das
 * ist der Punkt: In diesem Abschnitt darf man nicht überlegen, man muss
 * vorher überlegt haben.
 *
 * Sie hört kurz vor dem Ende auf. Sonst stünde sie später als tödliche
 * Säule am Anfang des nächsten Abschnitts herum.
 */
export const bJagd: Baustein = (b) => {
  const id = `jg${b.nr}`
  const strecke = b.breite - 56
  // 96 bis 118 Punkte je Sekunde -- die Figur läuft 138. Der Abstand ist
  // knapp genug, dass es im Nacken sitzt, und weit genug, dass ein Sprung
  // über die Lücke noch hineinpasst.
  const tempo = 96 + b.schwer * 22
  const spaltX = b.x + Math.round(b.breite * 0.55)
  const spalt = 26 + Math.round(b.schwer * 8)
  return {
    objekte: [
      boden(b.x, spaltX - b.x),
      boden(spaltX + spalt, b.x + b.breite - spaltX - spalt),
      {
        // Versteckt, bis man an ihr vorbei ist: Stünde sie von Anfang an da,
        // liefe die Figur schon beim Betreten des Abschnitts hinein. Sie
        // taucht hinter einem auf -- so herum gehört sie sich auch.
        typ: 'saege',
        id,
        x: b.x + 2,
        y: BODEN_Y - 74,
        b: 14,
        h: 74,
        versteckt: true,
        weg: { dx: strecke, dy: 0, dauer: strecke / tempo, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: b.x + 30,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'zeigen', ziel: id },
          { tu: 'los', ziel: id },
          { tu: 'beben', wert: 0.35 },
        ],
      },
    ],
    loesung: [
      // Kein Anhalten: durchlaufen, über die Lücke springen, weiterlaufen.
      vor(b, { bisX: spaltX - 16 }),
      vor(b, { sprung: true, dauer: 0.3 }),
      vor(b, { bisBoden: true, dauer: 1.4 }),
      vor(b, { bisX: b.x + b.breite - 14, dauer: 3 }),
    ],
  }
}

/**
 * Wände, die sich verschieben.
 *
 * Zwei Blöcke: Der erste fährt aus dem Boden hoch, der zweite kommt von der
 * Decke herunter -- beide, sobald man den Abschnitt betritt, und mit Versatz,
 * sodass sich der Weg hinter einem schließt, während vorn schon der nächste
 * zugeht. Wer beim ersten Mal schaut, was da passiert, steht drin.
 */
export const bWaende: Baustein = (b) => {
  const a = `wa${b.nr}a`
  const c = `wa${b.nr}c`
  const zoneX = b.x + 14
  const ersteX = b.x + Math.round(b.breite * 0.36)
  const zweiteX = b.x + Math.round(b.breite * 0.72)
  const dauer = 0.85 - b.schwer * 0.3

  /**
   * Wann eine Wand losgeht.
   *
   * Gerechnet, nicht geraten: der Weg von der Auslöserzone bis hinter die
   * Wand, geteilt durch das Lauftempo, plus eine Handbreit Luft. Ohne die
   * Rechnung stand die Wand schon oben, bevor überhaupt jemand loslaufen
   * konnte -- der erste Anlauf war schlicht nicht zu schaffen.
   */
  const luft = 0.42 - b.schwer * 0.16
  const losGeht = (wandX: number) => (wandX + 16 + 11 - (b.x + 3)) / 138 + luft

  return {
    objekte: [
      boden(b.x, b.breite),
      // Aus dem Boden hoch -- ganz im Boden versenkt, sonst steht schon vor
      // dem Hochfahren eine Stufe im Weg.
      {
        typ: 'beweger',
        id: a,
        x: ersteX,
        y: BODEN_Y + 12,
        b: 16,
        h: 90,
        weg: { dx: 0, dy: -84, dauer, einweg: true, wartetAufAusloeser: true },
      },
      // Oben drauf Stacheln: Wer zu langsam ist, wird nicht eingesperrt,
      // sondern erwischt -- und ist nach einer halben Sekunde wieder im
      // Spiel. Feststecken ohne Ausweg wäre die schlechtere Strafe.
      //
      // Sie sitzen zwölf Punkte unter der Oberfläche, nicht bündig damit:
      // Bündig standen sie schon vor dem Hochfahren scharf im Weg, und die
      // Figur starb, bevor sich überhaupt etwas bewegt hatte.
      {
        typ: 'stachel',
        id: `${a}s`,
        x: ersteX,
        y: BODEN_Y + 2,
        b: 16,
        h: 10,
        weg: { dx: 0, dy: -84, dauer, einweg: true, wartetAufAusloeser: true },
      },
      // Und von der Decke herunter, mit Stacheln an der Unterkante.
      {
        typ: 'beweger',
        id: c,
        x: zweiteX,
        y: BODEN_Y - 150,
        b: 16,
        h: 72,
        weg: { dx: 0, dy: 78, dauer, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'stachel',
        id: `${c}s`,
        x: zweiteX,
        y: BODEN_Y - 88,
        b: 16,
        h: 10,
        weg: { dx: 0, dy: 78, dauer, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'los', ziel: a, nach: losGeht(ersteX) },
          { tu: 'los', ziel: `${a}s`, nach: losGeht(ersteX) },
          { tu: 'los', ziel: c, nach: losGeht(zweiteX) },
          { tu: 'los', ziel: `${c}s`, nach: losGeht(zweiteX) },
          { tu: 'beben', wert: 0.3 },
        ],
      },
    ],
    // Durchlaufen. Wer stehenbleibt, um zu schauen, steht drin.
    loesung: [vor(b, { bisX: b.x + b.breite - 14, dauer: 3 })],
  }
}

// ------------------------------------------------- Ab Level 101: die blinden
//
// Was diese Bausteine verbindet: Man sieht sie vorher nicht. Ein Bruchboden
// zeigt sonst Risse, ein Fallblock hängt sichtbar an der Decke -- beides mit
// Absicht, damit man beim zweiten Mal eine Chance hat. Hier fehlt der
// Hinweis. Fair bleibt das nur, weil der Neustart eine halbe Sekunde dauert
// und die Stelle immer dieselbe ist: Man lernt sie, statt sie zu sehen.

/** Boden, der ohne Risse nachgibt. */
export const bBlindBruch: Baustein = (b) => {
  const breite = mische(b.rng, 46, 58)
  return {
    objekte: [
      boden(b.x, 30),
      {
        typ: 'bruch',
        x: b.x + 30,
        y: BODEN_Y,
        b: breite,
        h: BODEN_H,
        verzoegerung: 0.05,
        heimlich: true,
      },
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

/** Ein Block, der aus einer leeren Decke kommt. */
export const bBlindFall: Baustein = (b) => {
  const id = `bf${b.nr}`
  const mitte = b.x + Math.round(b.breite / 2)
  return {
    objekte: [
      boden(b.x, b.breite),
      // Nicht da, bis er fällt: Die Zone lässt ihn im selben Augenblick
      // erscheinen und stürzen.
      {
        typ: 'fall',
        id,
        x: mitte - 22,
        y: 30,
        b: 44,
        h: 42,
        toedlich: true,
        versteckt: true,
      },
      {
        typ: 'zone',
        x: b.x + 8,
        y: BODEN_Y - 50,
        b: 10,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'zeigen', ziel: id },
          { tu: 'fallen', ziel: id },
          { tu: 'beben', wert: 0.4 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisX: b.x + 16 }),
      { dauer: 0.9 },
      vor(b, { bisX: mitte - 40 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
      vor(b, { bisX: mitte + 30 }),
      vor(b, { bisBoden: true, dauer: 1.2 }),
      vor(b, { bisX: b.x + b.breite - 14 }),
    ],
  }
}

/**
 * Ein Sägeblatt, das über einer Lücke hin und her pendelt.
 *
 * Es hängt in Sprunghöhe: Wer davorsteht, ist sicher, wer springt, nicht.
 * Und springen muss man, denn darunter ist ein Loch. Also warten, bis es
 * weggependelt ist -- aber nicht zu lange, es kommt zurück.
 *
 * Der erste Anlauf ließ es auf Bodenhöhe pendeln. Das war schlicht nicht
 * passierbar: kein Zeitfenster, in dem der Gang frei war.
 */
export const bPendel: Baustein = (b) => {
  const id = `pd${b.nr}`
  const links = 40
  const spalt = 34
  // Weit genug pendeln: Bei kurzer Strecke parkte das Blatt genau dort, wo
  // die Figur nach dem Sprung aufkommt -- sie sprang der Säge in die Arme.
  const strecke = Math.min(110, b.breite - links - spalt - 24)
  const dauer = 0.85 - b.schwer * 0.2
  const warte = 0.3
  const zoneX = b.x + links - 20
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, b.breite - links - spalt),
      {
        typ: 'saege',
        id,
        x: b.x + links - 4,
        y: BODEN_Y - 50,
        b: 20,
        h: 20,
        weg: { dx: strecke, dy: 0, dauer, warte, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [{ tu: 'los', ziel: id }],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: zoneX - 5 }),
      // Gerade so lange, bis das Blatt die Lücke verlassen hat.
      { dauer: dauer * 0.55 },
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
    ],
  }
}

/** Stacheln, die nacheinander aus der Decke kommen. */
export const bStachelRegen: Baustein = (b) => {
  const anzahl = 3
  const objekte: Objekt[] = [boden(b.x, b.breite)]
  const loest = []
  const abstand = Math.floor((b.breite - 76) / anzahl)
  for (let k = 0; k < anzahl; k++) {
    const id = `sr${b.nr}_${k}`
    // Stacheln statt Fallblöcke: Ein Fallblock bleibt liegen, wo er
    // aufkommt, und stand danach als Stufe im Weg -- der Test lief mitten im
    // Abschnitt gegen eine Wand aus drei Blöcken. Ein Stachel mit einem Weg
    // fällt genauso, verschwindet aber im Boden.
    objekte.push({
      typ: 'stachel',
      id,
      x: b.x + 56 + k * abstand,
      y: 24,
      b: 16,
      h: 16,
      versteckt: true,
      weg: { dx: 0, dy: 220, dauer: 0.42, einweg: true, wartetAufAusloeser: true },
    })
    // Einer nach dem anderen, im Abstand eines Schrittes -- wer stehenbleibt,
    // bekommt den nächsten auf den Kopf.
    loest.push({ tu: 'zeigen' as const, ziel: id, nach: k * 0.42 })
    loest.push({ tu: 'los' as const, ziel: id, nach: k * 0.42 })
  }
  objekte.push({
    typ: 'zone',
    x: b.x + 10,
    y: BODEN_Y - 50,
    b: 8,
    h: 50,
    einmal: true,
    loest: [...loest, { tu: 'beben', wert: 0.3 }],
  })
  return {
    objekte,
    loesung: [
      // Erst durchlassen, dann in einem Zug hindurch.
      vor(b, { bisX: b.x + 16 }),
      { dauer: 0.42 * anzahl + 0.7 },
      vor(b, { bisX: b.x + b.breite - 14, dauer: 2.4 }),
    ],
  }
}

/** Zwei Lücken hintereinander, dazwischen ein schmaler Absatz. */
export const bDoppelLuecke: Baustein = (b) => {
  const spalt = mische(b.rng, 38, 38 + Math.round(b.schwer * 10))
  const insel = 30
  const links = 28
  const rest = b.breite - links - spalt - insel - spalt
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, insel),
      boden(b.x + links + spalt + insel + spalt, Math.max(20, rest)),
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + links - 16 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
      vor(b, { bisX: b.x + links + spalt + insel - 16 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
    ],
  }
}

/**
 * Der Schieber – eine Wand, die auf dich zukommt und dich zurückdrängt.
 *
 * Thomas am 11.09.2026: "auch mal eine Wand die dich nach hinten schiebt und
 * man irgendwo warten muss oder dann über das Hindernis zurück springen
 * muss."
 *
 * Der Aufbau: eine sichere Seite links, dahinter eine Lücke, dann die offene
 * Strecke. Wer zu früh hinüberspringt, bekommt die Wand entgegen und wird in
 * die Lücke zurückgeschoben. Richtig ist, auf der sicheren Seite zu warten,
 * bis sie sich zurückzieht -- oder, wenn man schon drüben ist, rechtzeitig
 * über die Lücke zurückzuspringen.
 *
 * Sie parkt schräg über Kopfhöhe, nicht am Boden: Am Boden hätte sie den
 * Ausgang des Abschnitts versperrt, und man wäre eingesperrt gewesen statt
 * gefordert.
 */
export const bSchieber: Baustein = (b) => {
  const id = `sb${b.nr}`
  const links = 30
  const spalt = 38
  /*
   * Schnell genug, dass sie unten ist, bevor man da ist.
   *
   * Vorher stand hier 0,9 Sekunden. Das war lange genug, dass die Figur --
   * Lücke überspringen, landen -- nach einer halben Sekunde unter der noch
   * schwebenden Wand hindurchspazierte: Der Schieber schob niemanden mehr
   * zurück, sondern war Deko. Gemessen an Level 198.
   */
  const dauer = 0.46 - b.schwer * 0.08
  // Lange Pause am oberen Parkplatz: Das ist das Fenster, in dem man
  // hinüberkommt.
  const warte = 1.6
  /*
   * Wo die Wand unten ankommt: mitten über der Lücke.
   *
   * Vorher war das hinter der Lücke ausgerechnet, und damit tat die Wand
   * nicht, wofür sie gebaut ist: Wer zu früh hinübersprang, wurde nicht
   * zurückgeschoben, sondern stand nur eine Sekunde davor und ging dann
   * weiter. Jetzt endet sie über dem Loch -- wer ihr im Weg steht, wird
   * hineingeschoben.
   */
  const linksEnde = b.x + 44
  // Gedeckelt, damit sie in einem breiten Abschnitt nicht zur Gewehrkugel
  // wird; der Rest der Breite wird schlichter Boden.
  const weit = Math.min(132, b.breite - 90)
  const parkX = linksEnde + weit
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, b.breite - links - spalt),
      {
        typ: 'beweger',
        id,
        x: parkX,
        y: BODEN_Y - 132,
        b: 16,
        h: 90,
        weg: { dx: -weit, dy: 52, dauer, warte, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: b.x + 10,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'los', ziel: id },
          { tu: 'beben', wert: 0.25 },
        ],
      },
    ],
    loesung: [
      // Auf der sicheren Seite stehenbleiben, bis die Wand wieder hochfährt.
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + 14 }),
      { dauer: dauer + warte + dauer * 0.6 },
      // Jetzt hinüber und durch.
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
      vor(b, { bisX: b.x + b.breite - 14, dauer: 2 }),
    ],
  }
}

// ------------------------------------------- Ab Level 161: hoch hinaus
//
// Was diese Bausteine verbindet: Sie spielen nicht mehr nur auf dem
// Hauptboden. Thomas am 18.09.2026: "die Level sehen ähnlich aus [...]
// viele neue Hindernisse oder an anderen Stellen". Genau daran lag es --
// alles stand auf derselben Linie, und ein Level unterschied sich vom
// nächsten nur dadurch, welche Falle auf dieser Linie stand. Hier geht es
// darüber, darunter und darauf.

/**
 * Ein Steg, der über den Abgrund fährt – man muss mitfahren.
 *
 * Der Aufzug fährt hoch und runter, dieser hier quer. Das ist der
 * Unterschied: Man steht nicht davor und wartet, sondern steht *darauf* und
 * fährt. Wer zu früh abspringt, fällt; wer zu spät aussteigt, fährt zurück.
 *
 * Er parkt drüben und kommt geholt: Die Zone am Eingang schickt ihn los, er
 * fährt herüber, wartet kurz -- das ist das Fenster zum Aufsteigen -- und
 * fährt zurück.
 */
export const bFahrsteg: Baustein = (b) => {
  const id = `fg${b.nr}`
  const links = 32
  const rechts = 34
  const spalt = b.breite - links - rechts
  const steg = 46
  const strecke = spalt - steg
  const dauer = strecke / (74 + b.schwer * 26)
  // Reichlich Pause an beiden Enden: Das ist das Fenster zum Ein- und
  // Aussteigen, und es darf nicht der Teil sein, an dem es scheitert.
  const warte = 1.3
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, rechts),
      {
        typ: 'beweger',
        id,
        // Der Steg steht drüben und fährt nach links her: dx ist negativ.
        x: b.x + links + strecke,
        // Bündig mit dem Hauptboden, nicht darüber: Zwei Punkte Stufe
        // reichten, damit die waagerechte Auflösung den Steg für eine Wand
        // hielt -- die Figur lief dagegen, statt aufzusteigen.
        y: BODEN_Y,
        b: steg,
        h: 14,
        weg: { dx: -strecke, dy: 0, dauer, warte, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: b.x + 8,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [{ tu: 'los', ziel: id }],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      // Bis an die Kante und warten, bis der Steg da ist.
      vor(b, { bisX: b.x + links - 14 }),
      { dauer: dauer + warte * 0.35 },
      // Aufsteigen.
      vor(b, { bisX: b.x + links + 16, dauer: 0.7 }),
      // Und stehenbleiben: Der Steg fährt, man selbst nicht.
      { dauer: warte * 0.5 + dauer + 0.12 },
      vor(b, { bisX: b.x + b.breite - 14, dauer: 2 }),
    ],
  }
}

/**
 * Ein Bolzen, der flach über den Boden schießt.
 *
 * Alles andere in diesem Spiel fällt von oben oder kommt aus dem Boden. Der
 * hier kommt waagerecht und schnell -- und zwar von vorn, aus der Richtung,
 * in die man ohnehin läuft. Man sieht ihn kommen und hat eine knappe halbe
 * Sekunde, um zu springen.
 *
 * Er bleibt links im Boden stecken, wo man schon vorbei ist: Bliebe er
 * liegen, wo man steht, wäre der Abschnitt nach dem ersten Schuss versperrt.
 */
export const bSchuss: Baustein = (b) => {
  const id = `sc${b.nr}`
  // Langsam genug, dass man ihn kommen sieht: Der erste Anlauf schoss mit
  // 285 Punkten je Sekunde, und zwischen Auslöser und Einschlag lagen zwei
  // Zehntel -- das war kein Zeitfenster, sondern Auswendiglernen.
  const tempo = 150 + b.schwer * 50
  const startX = b.x + b.breite - 22
  const strecke = startX - (b.x + 2)
  const flug = strecke / tempo
  const zoneX = b.x + 12
  /** Wo die Figur steht, wenn es knallt. */
  const warteX = b.x + 34
  /** Wann der Bolzen an ihr ist, vom Auslöser an gerechnet. */
  const ankunft = (startX - (warteX + 11)) / tempo
  // Der Bogen dauert knapp sechs Zehntel, die Spitze liegt in der Mitte.
  const gipfel = 0.29
  const anlauf = (warteX - zoneX) / 138
  return {
    objekte: [
      boden(b.x, b.breite),
      {
        typ: 'saege',
        id,
        x: startX,
        y: BODEN_Y - 15,
        b: 15,
        h: 15,
        versteckt: true,
        weg: { dx: -strecke, dy: 0, dauer: flug, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'zeigen', ziel: id },
          { tu: 'los', ziel: id },
          { tu: 'beben', wert: 0.3 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: warteX }),
      { dauer: Math.max(0.05, ankunft - gipfel - anlauf) },
      // Auf der Stelle springen: Wer dabei losläuft, kommt dem Bolzen
      // entgegen und trifft ihn, bevor der Bogen oben ist.
      { sprung: true, dauer: 0.34 },
      { bisBoden: true, dauer: 1.2 },
      vor(b, { bisX: b.x + b.breite - 14, dauer: 2.4 }),
    ],
  }
}

/**
 * Der Weg nach oben – unten ist zu.
 *
 * Eine Mauer sperrt den Hauptboden ab, daneben führen zwei Stufen auf ein
 * Dach, und drüben geht es wieder hinunter. Das ist der einzige Baustein,
 * in dem man den Boden für eine ganze Weile verlässt -- und deshalb der,
 * der am meisten dagegen tut, dass alle Level gleich aussehen.
 */
export const bDachweg: Baustein = (b) => {
  // Die drei Höhen sind gemessen, nicht geraten: Ein Sprung trägt sechzig
  // Punkte hoch und -- aus dem Stand, bis die Füße wieder auf Absatzhöhe
  // sind -- rund fünfzig weit. Vierundvierzig und zweiundvierzig Stufenhöhe
  // lassen also knapp zwanzig Punkte Luft, genug, um nicht an der
  // Dachkante hängenzubleiben.
  const stufeY = BODEN_Y - 44
  const dachY = BODEN_Y - 86
  const stufeX = b.x + 40
  const dachX = b.x + 120
  const dachBis = b.x + b.breite - 30
  const mauerX = b.x + b.breite - 84
  return {
    objekte: [
      boden(b.x, b.breite),
      // Die Sperre: Unten kommt niemand durch. Sie steht unter dem Dach,
      // damit man sie von oben überquert.
      { typ: 'block', x: mauerX, y: BODEN_Y - 78, b: 16, h: 78 },
      { typ: 'block', x: stufeX, y: stufeY, b: 72, h: 10 },
      { typ: 'block', x: dachX, y: dachY, b: dachBis - dachX, h: 10 },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + 4 }),
      // Erst zum Stehen kommen: Wer mit vollem Schwung abspringt, fliegt
      // über die Stufe hinweg.
      { dauer: 0.35 },
      vor(b, { sprung: true, dauer: 0.36 }),
      vor(b, { bisBoden: true, dauer: 1.4 }),
      vor(b, { bisX: b.x + 86 }),
      vor(b, { sprung: true, dauer: 0.36 }),
      vor(b, { bisBoden: true, dauer: 1.4 }),
      // Oben entlang bis ans Ende des Dachs ...
      vor(b, { bisX: dachBis - 14, dauer: 2.4 }),
      // ... und ohne Taste hinunter: Ein Schritt ins Leere trägt weit genug,
      // ein gehaltener Lauf trüge bis in den nächsten Abschnitt.
      { bisBoden: true, dauer: 1.6 },
      vor(b, { bisX: b.x + b.breite - 14, dauer: 1.6 }),
    ],
  }
}

/**
 * Eine ganze Strecke, die hinter einem einbricht.
 *
 * Nicht eine Platte, sondern fünf hintereinander. Jede hält lange genug für
 * einen Schritt und nicht lange genug für zwei. Wer losrennt, ist drüben;
 * wer in der Mitte kurz überlegt, steht auf nichts mehr.
 */
export const bEinsturz: Baustein = (b) => {
  const links = 26
  const rechts = 26
  const strecke = b.breite - links - rechts
  // Platten von rund dreißig Punkten: So bleibt man auf jeder etwa eine
  // Fünftelsekunde, und daran hängt, wie lange sie halten darf.
  const anzahl = Math.max(4, Math.round(strecke / 30))
  const platte = strecke / anzahl
  // Gerechnet, nicht geraten: Lauftempo ist 138, die Figur 11 breit. So
  // lange braucht ein Schritt über eine Platte -- plus eine Handbreit Luft,
  // die mit der Schwierigkeit schrumpft.
  const verzoegerung = (platte + 11) / 138 + 0.16 - b.schwer * 0.06
  const objekte: Objekt[] = [boden(b.x, links)]
  for (let k = 0; k < anzahl; k++) {
    objekte.push({
      typ: 'bruch',
      x: b.x + links + k * platte,
      y: BODEN_Y,
      b: platte,
      h: BODEN_H,
      verzoegerung,
    })
  }
  objekte.push(boden(b.x + links + strecke, rechts))
  return {
    objekte,
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      // In einem Zug hindurch. Anhalten ist hier die einzige Art zu
      // verlieren.
      vor(b, { bisX: b.x + b.breite - 14, dauer: 3 }),
    ],
  }
}

/**
 * Zwei Trittsteine über dem Nichts, und beide fallen.
 *
 * Der Einsturz mit Boden darunter verzeiht einen Fehltritt. Hier ist
 * darunter nichts: Wer einen Stein verpasst oder darauf stehenbleibt, fällt
 * aus dem Bild. Die Sprünge gehen ineinander über -- ankommen, weiterlaufen,
 * wieder abspringen --, und genau das muss man ein paarmal üben.
 */
export const bKippStufen: Baustein = (b) => {
  const links = 28
  const stein = 44
  const spalt = 40
  // Zwei Steine, drei Sprünge. Die Maße sind nicht gewählt, sondern
  // gemessen: Ein Sprung mit Anlauf trägt einundachtzig Punkte weit, und mit
  // Lücke vierzig und Stein vierundvierzig kommt die Figur jedes Mal in der
  // Mitte des nächsten Steins auf.
  const s1 = b.x + links + spalt
  const s2 = s1 + stein + spalt
  const bank = s2 + stein + spalt
  const objekte: Objekt[] = [
    boden(b.x, links),
    { typ: 'fall', x: s1, y: BODEN_Y, b: stein, h: 14, verzoegerung: 0.26 },
    { typ: 'fall', x: s2, y: BODEN_Y, b: stein, h: 14, verzoegerung: 0.26 },
    boden(bank, Math.max(24, b.x + b.breite - bank)),
  ]
  return {
    objekte,
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: b.x + links - 16 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true, dauer: 1.2 }),
      // Nicht bis an die Kante trödeln: Der Stein hält nur einen Wimpernschlag.
      vor(b, { bisX: s1 + stein - 22 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true, dauer: 1.2 }),
      vor(b, { bisX: s2 + stein - 22 }),
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true, dauer: 1.2 }),
      vor(b, { bisX: b.x + b.breite - 14, dauer: 1.6 }),
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
  jagd: { name: 'jagd', bau: bJagd, min: 148 },
  waende: { name: 'waende', bau: bWaende, min: 138 },
  blindbruch: { name: 'blindbruch', bau: bBlindBruch, min: 120 },
  blindfall: { name: 'blindfall', bau: bBlindFall, min: 130 },
  pendel: { name: 'pendel', bau: bPendel, min: 190 },
  stachelregen: { name: 'stachelregen', bau: bStachelRegen, min: 140 },
  doppelluecke: { name: 'doppelluecke', bau: bDoppelLuecke, min: 160 },
  schieber: { name: 'schieber', bau: bSchieber, min: 160 },
  fahrsteg: { name: 'fahrsteg', bau: bFahrsteg, min: 190 },
  schuss: { name: 'schuss', bau: bSchuss, min: 190 },
  dachweg: { name: 'dachweg', bau: bDachweg, min: 230 },
  einsturz: { name: 'einsturz', bau: bEinsturz, min: 170 },
  kippstufen: { name: 'kippstufen', bau: bKippStufen, min: 270 },
}
