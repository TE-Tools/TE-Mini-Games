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

import type { Aktion, LoesungsSchritt, Objekt } from '../types'

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

// ------------------------------------------ Ab Level 301: das Endspiel
//
// Was diese fünf verbindet: Sie verzeihen nichts. Die Bausteine davor haben
// ein Zeitfenster oder eine Stelle, die man treffen muss; diese haben
// zwei -- und die zweite kommt, während man die erste noch ausführt.
// Thomas am 18.09.2026: "du sollst 100 neue machen", und zwar schwere.

/**
 * Zwei Blätter über einem Loch, gegeneinander versetzt.
 *
 * Das Pendel war eines: warten, bis es weg ist, springen. Hier hängen zwei
 * übereinander und pendeln gegenläufig -- das untere versperrt den Absprung,
 * das obere den Flugbogen. Es gibt ein Fenster, in dem beides frei ist, und
 * das ist kurz.
 */
export const bDoppelSaege: Baustein = (b) => {
  const a = `ds${b.nr}a`
  const c = `ds${b.nr}c`
  const links = 42
  const spalt = 34
  const strecke = Math.min(104, b.breite - links - spalt - 60)
  const dauer = 0.9 - b.schwer * 0.22
  const zoneX = b.x + links - 22
  /*
   * Das zweite Blatt steht drueben und ist genau so lange oben, wie der
   * Sprung dauert.
   *
   * Der erste Anlauf liess beide waagerecht pendeln, gegeneinander versetzt.
   * Das war nicht schwer, sondern unmoeglich: Wenn eines die Luecke raeumt,
   * faehrt das andere hinein, und ein Fenster gab es nie. Jetzt gibt es
   * zwei Bedingungen statt einer -- das Pendel muss fort sein *und* das
   * Blatt drueben oben --, und beide treffen genau einmal zusammen.
   */
  const blattX = b.x + links + spalt + 22
  /*
   * Wie lange das Blatt drueben oben bleibt: ausgerechnet, nicht geraten.
   *
   * Warten, bis das Pendel fort ist, plus der Sprungbogen, plus der Weg vom
   * Aufkommen bis hinter das Blatt -- und zwei Zehntel Luft. Mit einer
   * geratenen Sekunde kam das Blatt herunter, waehrend die Figur noch
   * darunter lief, und der Abschnitt war nicht zu schaffen.
   */
  const obenLang = dauer * 0.55 + 0.6 + (blattX + 29 - (b.x + links + spalt + 30)) / 138 + 0.2
  return {
    objekte: [
      boden(b.x, links),
      boden(b.x + links + spalt, b.breite - links - spalt),
      // Das Pendel ueber der Luecke: in Sprunghoehe, wie beim Pendel-Baustein.
      {
        typ: 'saege',
        id: a,
        x: b.x + links - 4,
        y: BODEN_Y - 50,
        b: 20,
        h: 20,
        weg: { dx: strecke, dy: 0, dauer, warte: 0.3, wartetAufAusloeser: true },
      },
      // Und drueben, wo man aufkommt, faehrt eines auf und ab.
      {
        typ: 'saege',
        id: c,
        x: blattX,
        y: BODEN_Y - 52,
        b: 18,
        h: 18,
        weg: {
          dx: 0,
          dy: 46,
          dauer: 0.42,
          warte: obenLang,
          wartetAufAusloeser: true,
          // So gestellt, dass es beim Ausloesen gerade oben angekommen ist:
          // Die Pause oben ist das Fenster, und sie laeuft ab dem ersten
          // Augenblick.
          start: 0.42 * 2 + obenLang,
        },
      },
      {
        typ: 'zone',
        x: zoneX,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'los', ziel: a },
          { tu: 'los', ziel: c },
        ],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      vor(b, { bisX: zoneX - 5 }),
      // Gerade so lange, bis das Pendel die Luecke verlassen hat -- laenger
      // nicht, sonst kommt das Blatt drueben schon wieder herunter.
      { dauer: dauer * 0.55 },
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true }),
      vor(b, { bisX: b.x + b.breite - 14, dauer: 1.6 }),
    ],
  }
}

/**
 * Drei Gitter, die nacheinander herunterkrachen.
 *
 * Man läuft hinein, hinter einem fällt das erste, und vorn sind schon zwei
 * weitere unterwegs. Jedes hat Stacheln an der Unterkante: Wer zu langsam
 * ist, wird nicht eingesperrt, sondern erwischt -- und ist eine halbe
 * Sekunde später wieder im Spiel.
 *
 * Der erste Anlauf hatte ein Gitter hinter einem und eine Tür davor, die
 * ein Knopf kurz öffnete. Das war ein Käfig ohne Ausweg: Wer die Tür
 * verpasste, stand zwischen zwei Wänden, konnte nicht sterben und musste
 * von Hand neu starten. Ein Knopf feuert in dieser Engine genau einmal --
 * ein zweiter Versuch war gar nicht vorgesehen. Feststecken ist die
 * schlechtere Strafe; hier kostet es einen Anlauf, nicht die Geduld.
 */
export const bFallgitter: Baustein = (b) => {
  const anzahl = 3
  const objekte: Objekt[] = [boden(b.x, b.breite)]
  const loest: Aktion[] = [{ tu: 'beben', wert: 0.4 }]
  const erste = b.x + 30
  const abstand = Math.floor((b.breite - 60) / anzahl)
  /*
   * Wann ein Gitter losgeht: gerechnet, nicht geraten.
   *
   * Der Weg von der Auslöserzone bis hinter das Gitter, geteilt durch das
   * Lauftempo, plus eine Handbreit Luft -- dieselbe Rechnung wie bei den
   * Schiebewänden. Ohne sie stand das Gitter schon unten, bevor überhaupt
   * jemand loslaufen konnte.
   */
  /*
   * Die Luft muss die Übergabe mit abdecken.
   *
   * Zwischen zwei Bausteinen steht die Figur eine knappe Fünftelsekunde
   * still, und danach braucht sie noch einmal so lange bis auf Tempo. Mit
   * zwei Zehnteln Luft war das Gitter unten, bevor sie überhaupt losgelaufen
   * war -- die Level 325 und 392 gingen genau daran kaputt. Das Zeitfenster
   * wird dadurch nicht größer, es fängt nur später an.
   */
  const luft = 0.62 - b.schwer * 0.14
  const fall = 0.42
  for (let k = 0; k < anzahl; k++) {
    const id = `fg${b.nr}_${k}`
    const x = erste + k * abstand
    const nach = Math.max(0, (x + 14 + 11 - (b.x + 10)) / 138 + luft - fall)
    objekte.push({
      typ: 'beweger',
      id,
      x,
      y: BODEN_Y - 214,
      b: 14,
      h: 80,
      weg: { dx: 0, dy: 134, dauer: fall, einweg: true, wartetAufAusloeser: true },
    })
    objekte.push({
      typ: 'stachel',
      id: `${id}s`,
      x,
      y: BODEN_Y - 136,
      b: 14,
      h: 10,
      weg: { dx: 0, dy: 134, dauer: fall, einweg: true, wartetAufAusloeser: true },
    })
    loest.push({ tu: 'los', ziel: id, nach })
    loest.push({ tu: 'los', ziel: `${id}s`, nach })
  }
  objekte.push({
    typ: 'zone',
    x: b.x + 10,
    y: BODEN_Y - 50,
    b: 8,
    h: 50,
    einmal: true,
    loest,
  })
  return {
    objekte,
    // Durchlaufen. Wer stehenbleibt, um zu schauen, steht darunter.
    loesung: [vor(b, { bisX: b.x + b.breite - 14, dauer: 3.5 })],
  }
}

/**
 * Boden, von dem nur die Hälfte trägt – und man sieht nicht, welche.
 *
 * Der blinde Bruchboden war eine Platte. Hier sind es sechs nebeneinander,
 * und jede zweite hält nicht. Zu sehen ist nichts; man lernt die Strecke,
 * indem man sie verliert. Fair bleibt das, weil der Neustart eine halbe
 * Sekunde dauert und die Platten immer dieselben sind.
 */
export const bBlindWeg: Baustein = (b) => {
  const links = 26
  const rechts = 26
  const strecke = b.breite - links - rechts
  /*
   * Sieben Platten, nicht sechs.
   *
   * Bei einer geraden Zahl war die letzte ein Loch, und der Abschnitt endete
   * mit einem Sprung auf einen sechsundzwanzig Punkte schmalen Streifen --
   * direkt davor begann schon der nächste Baustein. Die Level 343, 348 und
   * 354 gingen genau daran kaputt. Ungerade trägt die letzte Platte.
   */
  const anzahl = 7
  const platte = strecke / anzahl
  const objekte: Objekt[] = [boden(b.x, links)]
  const loesung: LoesungsSchritt[] = [vor(b, { bisBoden: true, dauer: 1 })]
  for (let k = 0; k < anzahl; k++) {
    const x = b.x + links + k * platte
    if (k % 2 === 0) {
      objekte.push({ typ: 'block', x, y: BODEN_Y, b: platte, h: BODEN_H })
    } else {
      // Nicht "bricht weg", sondern "war nie da": Die Platte verschwindet
      // sofort, wenn man sie betritt. Ein Bruchboden mit Verzögerung liesse
      // sich überrennen, und dann wäre das hier nur ein Laufstück.
      objekte.push({
        typ: 'bruch',
        x,
        y: BODEN_Y,
        b: platte,
        h: BODEN_H,
        verzoegerung: 0.01,
        heimlich: true,
      })
      // Und über jedes Loch muss gesprungen werden.
      loesung.push(vor(b, { bisX: x - 15 }))
      loesung.push(vor(b, { sprung: true, dauer: 0.3 }))
      loesung.push(vor(b, { bisBoden: true, dauer: 1.2 }))
    }
  }
  objekte.push(boden(b.x + links + strecke, rechts))
  loesung.push(vor(b, { bisX: b.x + b.breite - 14, dauer: 1.6 }))
  return { objekte, loesung }
}

/**
 * Eine Zange: zwei Wände, die von beiden Seiten zufahren.
 *
 * Die Schiebewände kamen bisher von oben und von unten. Diese kommen von
 * links und von rechts auf dieselbe Stelle zu, und dazwischen muss man
 * hindurch, bevor sie sich treffen. Es geht genau einmal, und zwar sofort.
 */
export const bZange: Baustein = (b) => {
  const l = `zg${b.nr}l`
  const r = `zg${b.nr}r`
  const mitte = b.x + Math.round(b.breite * 0.58)
  const weit = 70
  /*
   * Sie kommen von oben aussen, nicht von der Seite.
   *
   * Der erste Anlauf liess sie waagerecht zufahren. Dann stand die linke
   * Wand aber schon vor dem Ausloesen mitten im Weg, und der Abschnitt war
   * nicht zu betreten. Jetzt haengen beide ueber Kopfhoehe und fahren
   * schraeg herunter -- gefaehrlich werden sie erst auf den letzten
   * Zehnteln.
   */
  const hoch = 200
  const fallhoehe = hoch - 62
  /** Ab wann die Unterkante unter Kopfhoehe ist: gemessen, nicht geraten. */
  const gefaehrlichAb = (hoch - 62 - 17) / fallhoehe
  /*
   * Gemessen wird bis hinter die rechte Backe, nicht bis zur Mitte.
   *
   * Die rechte Wand kommt bei `mitte` an und ist sechzehn breit, die Figur
   * elf -- wer bei `mitte + 22` steht, steht noch darin. Level 379 starb
   * genau vier Punkte davor. Sechsundvierzig lässt Luft, ohne dass der
   * Abschnitt geschenkt wäre: Stehenbleiben kostet immer noch den Anlauf.
   */
  const laufzeit = (mitte + 46 - (b.x + 12)) / 138
  // So lange, dass man es im Lauf schafft -- und mit der Schwierigkeit
  // schrumpft die Luft, die dabei bleibt.
  // Dieselbe Rechnung wie beim Fallgitter: Die Übergabe zwischen zwei
  // Bausteinen kostet rund drei Zehntel, und die müssen mit hinein.
  const dauer = laufzeit / gefaehrlichAb + (0.58 - b.schwer * 0.14)
  return {
    objekte: [
      boden(b.x, b.breite),
      {
        typ: 'beweger',
        id: l,
        x: mitte - weit - 16,
        y: BODEN_Y - hoch,
        b: 16,
        h: 62,
        weg: { dx: weit, dy: fallhoehe, dauer, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'beweger',
        id: r,
        x: mitte + weit,
        y: BODEN_Y - hoch,
        b: 16,
        h: 62,
        weg: { dx: -weit, dy: fallhoehe, dauer, einweg: true, wartetAufAusloeser: true },
      },
      /*
       * Stacheln an beiden Unterkanten.
       *
       * Ohne sie war die Zange ein Käfig: Wer zu spät kam, stand zwischen
       * zwei Wänden, konnte nicht sterben und musste von Hand neu starten
       * (Level 382). Feststecken ohne Ausweg ist die schlechtere Strafe --
       * jetzt kostet es einen Anlauf.
       */
      {
        typ: 'stachel',
        id: `${l}s`,
        x: mitte - weit - 16,
        y: BODEN_Y - hoch + 62,
        b: 16,
        h: 10,
        weg: { dx: weit, dy: fallhoehe, dauer, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'stachel',
        id: `${r}s`,
        x: mitte + weit,
        y: BODEN_Y - hoch + 62,
        b: 16,
        h: 10,
        weg: { dx: -weit, dy: fallhoehe, dauer, einweg: true, wartetAufAusloeser: true },
      },
      {
        typ: 'zone',
        x: b.x + 12,
        y: BODEN_Y - 50,
        b: 8,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'los', ziel: l },
          { tu: 'los', ziel: r },
          { tu: 'los', ziel: `${l}s` },
          { tu: 'los', ziel: `${r}s` },
          { tu: 'beben', wert: 0.35 },
        ],
      },
    ],
    // Durchlaufen. Wer stehenbleibt, um zu schauen, steht dazwischen.
    loesung: [vor(b, { bisX: b.x + b.breite - 14, dauer: 3.5 })],
  }
}

/**
 * Kopfüber: Die Schwerkraft dreht sich um, und man läuft an der Decke.
 *
 * Das gab es bisher nur in einem einzigen handgebauten Level (Nummer 9).
 * Für das Endspiel ist es der richtige Baustein: Alles, was man über Laufen
 * und Springen gelernt hat, gilt weiter -- nur zeigt "unten" jetzt nach
 * oben. Man fällt hinauf, läuft an der Decke entlang, springt dort über
 * eine Lücke (der Sprung trägt einen nach unten, nicht nach oben) und wird
 * am Ende wieder heruntergelassen.
 *
 * Der erste Anlauf war ein Steg, der schräg nach oben fuhr. Der ging an der
 * Engine kaputt: Ein Block, der sich gleichzeitig seitwärts und nach oben
 * bewegt, schiebt die Figur einmal heraus *und* nimmt sie als Boden mit --
 * sie lief dem Steg vorn herunter. Hier bewegt sich nichts; es dreht sich
 * nur.
 */
export const bKopfueber: Baustein = (b) => {
  const hin = `ku${b.nr}a`
  const zurueck = `ku${b.nr}b`
  /** Wo die Decke ist, auf der man gleich steht. */
  const deckeY = 40
  const deckeH = 30
  /*
   * Wie weit der Fall trägt: gemessen, nicht geraten.
   *
   * Von den Füßen auf dem Hauptboden bis an die Decke sind es rund
   * hundertfünfzig Punkte; bei 1400 Schwerkraft dauert das knapp eine halbe
   * Sekunde, und in der Zeit trägt der Lauf rund siebzig Punkte weit. So
   * viel Platz muss hinter jedem der beiden Drehpunkte liegen.
   */
  const flug = Math.ceil(Math.sqrt((2 * (BODEN_Y - deckeY - deckeH - 17)) / 1400) * 138) + 12
  const dreh = b.x + 16
  const zurueckX = Math.max(dreh + flug + 70, b.x + b.breite - flug - 30)
  // Die Lücke in der Decke liegt zwischen den beiden Drehpunkten.
  const luecke = Math.round((dreh + flug + zurueckX) / 2) - 20
  const spalt = 38
  return {
    objekte: [
      boden(b.x, b.breite),
      // Die Decke, auf der man gleich steht -- mit einer Lücke darin.
      { typ: 'block', x: b.x, y: deckeY, b: luecke - b.x, h: deckeH },
      {
        typ: 'block',
        x: luecke + spalt,
        y: deckeY,
        b: b.x + b.breite - (luecke + spalt),
        h: deckeH,
      },
      // Hin: Die Zone geht über die ganze Höhe, damit niemand daran vorbei
      // kann.
      {
        typ: 'zone',
        id: hin,
        x: dreh,
        y: 0,
        b: 8,
        h: BODEN_Y,
        einmal: true,
        loest: [
          { tu: 'schwerkraft', wert: -1 },
          { tu: 'beben', wert: 0.4 },
        ],
      },
      // Und zurück.
      {
        typ: 'zone',
        id: zurueck,
        x: zurueckX,
        y: 0,
        b: 8,
        h: BODEN_Y,
        einmal: true,
        loest: [
          { tu: 'schwerkraft', wert: 1 },
          { tu: 'beben', wert: 0.4 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      // Hinein und nach oben fallen.
      vor(b, { bisX: dreh + 4 }),
      vor(b, { bisBoden: true, dauer: 1.6 }),
      // An der Decke entlang bis vor die Lücke.
      vor(b, { bisX: luecke - 16, dauer: 2.4 }),
      // Der Sprung trägt hier nach unten -- er hilft trotzdem hinüber.
      vor(b, { sprung: true, dauer: 0.34 }),
      vor(b, { bisBoden: true, dauer: 1.6 }),
      // Weiter bis zur zweiten Drehung, dann wieder herunter.
      vor(b, { bisX: zurueckX + 4, dauer: 2.4 }),
      vor(b, { bisBoden: true, dauer: 1.6 }),
      vor(b, { bisX: b.x + b.breite - 14, dauer: 1.6 }),
    ],
  }
}

/**
 * Der Sprung, der an der Decke endet.
 *
 * Thomas am 20.09.2026: "auch mit auf dem Kopf laufen und solche Sachen,
 * wenn man springt plötzlich an der Decke ist".
 *
 * Genau so ist es gebaut: Eine Mauer versperrt den Boden, man muss springen
 * -- und oben im Bogen hängt der Bereich, der die Schwerkraft umdreht. Wer
 * springt, fliegt nicht wieder herunter, sondern weiter hoch und kommt an
 * der Decke auf. Wer nicht springt, steht vor der Mauer. Es gibt also keinen
 * Weg vorbei, und beim ersten Mal rechnet damit niemand.
 *
 * Der Bereich hängt über Kopfhöhe: Eine stehende Figur reicht von 223 bis
 * 240, der Bereich fängt bei 148 an. Im Sprung sind die Füße sechzig Punkte
 * höher, und dann liegt der Kopf mitten darin.
 */
export const bSprungDreh: Baustein = (b) => {
  const deckeY = 40
  const deckeH = 30
  /** Wie weit der Lauf trägt, während die Figur an die Decke fällt. */
  const flug = Math.ceil(Math.sqrt((2 * (BODEN_Y - deckeY - deckeH - 17)) / 1400) * 138) + 12
  const wandX = b.x + 42
  const drehX = wandX + 20
  const zurueckX = Math.max(drehX + flug + 60, b.x + b.breite - flug - 34)
  return {
    objekte: [
      boden(b.x, b.breite),
      // Die Decke, auf der man gleich steht.
      { typ: 'block', x: b.x, y: deckeY, b: b.breite, h: deckeH },
      // Die Mauer, an der der Weg unten endet. Dreißig Punkte hoch: Ein
      // Sprung trägt sechzig, sie ist also kein Hindernis, sondern ein
      // Zwang.
      { typ: 'block', x: wandX, y: BODEN_Y - 30, b: 14, h: 30 },
      // Und mitten im Sprungbogen dreht sich alles um.
      {
        typ: 'zone',
        x: drehX,
        y: BODEN_Y - 92,
        b: 10,
        h: 46,
        einmal: true,
        loest: [
          { tu: 'schwerkraft', wert: -1 },
          { tu: 'beben', wert: 0.45 },
        ],
      },
      // Am Ende des Abschnitts geht es wieder herunter.
      {
        typ: 'zone',
        x: zurueckX,
        y: 0,
        b: 8,
        h: BODEN_Y,
        einmal: true,
        loest: [
          { tu: 'schwerkraft', wert: 1 },
          { tu: 'beben', wert: 0.4 },
        ],
      },
    ],
    loesung: [
      vor(b, { bisBoden: true, dauer: 1 }),
      // Bis kurz vor die Mauer, dann springen -- und oben dreht es sich.
      vor(b, { bisX: wandX - 20 }),
      vor(b, { sprung: true, dauer: 0.36 }),
      vor(b, { bisBoden: true, dauer: 1.8 }),
      // An der Decke weiter bis zum zweiten Drehpunkt.
      vor(b, { bisX: zurueckX + 4, dauer: 2.6 }),
      vor(b, { bisBoden: true, dauer: 1.8 }),
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
  doppelsaege: { name: 'doppelsaege', bau: bDoppelSaege, min: 200 },
  fallgitter: { name: 'fallgitter', bau: bFallgitter, min: 190 },
  blindweg: { name: 'blindweg', bau: bBlindWeg, min: 300 },
  zange: { name: 'zange', bau: bZange, min: 210 },
  kopfueber: { name: 'kopfueber', bau: bKopfueber, min: 290 },
  sprungdreh: { name: 'sprungdreh', bau: bSprungDreh, min: 260 },
}
