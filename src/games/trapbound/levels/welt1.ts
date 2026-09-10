/**
 * WELT 1 – DIE HÖHLEN
 *
 * Reine Daten. Hier steht keine Spiellogik, nur Geometrie und Auslöser.
 * Ein neues Level ist ein weiterer Eintrag in dieser Liste; die Engine muss
 * dafür nicht angefasst werden.
 *
 * Der Aufbau der zehn Level folgt einer Lehrkurve:
 *
 *   1-3   Grundlagen: laufen, springen, klettern. Nichts lügt.
 *   4-6   Die ersten Fallen. Jede fasst genau eine Lüge: der Boden, die
 *         Tür, die Decke.
 *   7-8   Fallen kombiniert. Bewegung plus Täuschung.
 *   9     Die Regel selbst kippt (Schwerkraft).
 *   10    Prüfung: alles zusammen, mit einem falschen Ausgang.
 *
 * Maße: 480x270. Boden liegt bei y=240, eine stehende Figur bei y=223,
 * eine Tür (22x32) bei y=208.
 */

import type { LevelDaten } from '../types'

const BODEN_Y = 240
const BODEN_H = 30

export const WELT1: LevelDaten[] = [
  {
    nr: 1,
    welt: 1,
    abschnitt: 1,
    name: 'Erster Schritt',
    idee: 'Nur laufen. Der Spieler soll einmal ankommen, ohne dass etwas passiert.',
    start: { x: 40, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 480, h: BODEN_H },
      { typ: 'schild', x: 92, y: 200, b: 76, h: 16, text: 'NACH RECHTS' },
      { typ: 'ziel', x: 420, y: 208, b: 22, h: 32 },
    ],
    loesung: [{ rechts: true, bisX: 418 }],
  },

  {
    nr: 2,
    welt: 1,
    abschnitt: 1,
    name: 'Kleiner Sprung',
    idee: 'Eine Lücke. Sprungtaste lernen, Absturz ist die einzige Gefahr.',
    start: { x: 30, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 190, h: BODEN_H },
      { typ: 'block', x: 250, y: BODEN_Y, b: 230, h: BODEN_H },
      { typ: 'schild', x: 60, y: 200, b: 66, h: 16, text: 'SPRINGEN' },
      { typ: 'ziel', x: 430, y: 208, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 172 },
      { rechts: true, sprung: true, dauer: 0.3 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 428 },
    ],
  },

  {
    nr: 3,
    welt: 1,
    abschnitt: 1,
    name: 'Aufstieg',
    idee: 'Drei Stufen. Sprunghöhe und Absatzkante kennenlernen.',
    start: { x: 24, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 130, h: BODEN_H },
      { typ: 'block', x: 160, y: 206, b: 60, h: 12 },
      { typ: 'block', x: 250, y: 172, b: 60, h: 12 },
      { typ: 'block', x: 340, y: 140, b: 140, h: 12 },
      { typ: 'ziel', x: 430, y: 108, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 112 },
      { rechts: true, sprung: true, dauer: 0.32 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 205 },
      { rechts: true, sprung: true, dauer: 0.32 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 296 },
      { rechts: true, sprung: true, dauer: 0.32 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 428 },
    ],
  },

  {
    nr: 4,
    welt: 1,
    abschnitt: 1,
    name: 'Der Boden lügt',
    idee: 'Ein Stück Boden sieht aus wie der Rest und bricht beim Betreten weg. Beim zweiten Versuch springt man darüber.',
    start: { x: 24, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 330, h: BODEN_H },
      { typ: 'bruch', x: 330, y: BODEN_Y, b: 50, h: BODEN_H, verzoegerung: 0.12 },
      { typ: 'block', x: 380, y: BODEN_Y, b: 100, h: BODEN_H },
      { typ: 'schild', x: 60, y: 200, b: 92, h: 16, text: 'SPAZIERGANG' },
      { typ: 'ziel', x: 430, y: 208, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 312 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 428 },
    ],
  },

  {
    nr: 5,
    welt: 1,
    abschnitt: 1,
    name: 'Türsteher',
    idee: 'Die Tür weicht aus, sobald man nahe kommt, und lässt Stacheln aus dem Boden fahren. Also drüber springen.',
    start: { x: 24, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 480, h: BODEN_H },
      { typ: 'stachel', id: 'zahn', x: 372, y: 228, b: 40, h: 12, versteckt: true },
      {
        typ: 'ziel',
        x: 350,
        y: 208,
        b: 22,
        h: 32,
        flieht: { dx: 90, dy: 0 },
        loest: [
          { tu: 'zeigen', ziel: 'zahn' },
          { tu: 'beben', wert: 0.3 },
        ],
      },
    ],
    loesung: [
      { rechts: true, bisX: 352 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, dauer: 0.4 },
    ],
  },

  {
    nr: 6,
    welt: 1,
    abschnitt: 2,
    name: 'Kopf einziehen',
    idee: 'Ein Block stürzt von der Decke, sobald man eine bestimmte Stelle passiert. Wer weiterläuft, wird erschlagen; wer wartet, benutzt ihn als Stufe.',
    start: { x: 24, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 480, h: BODEN_H },
      { typ: 'block', x: 0, y: 0, b: 480, h: 18 },
      {
        typ: 'zone',
        x: 170,
        y: 170,
        b: 16,
        h: 70,
        einmal: true,
        loest: [
          { tu: 'fallen', ziel: 'brocken' },
          { tu: 'beben', wert: 0.35 },
        ],
      },
      { typ: 'fall', id: 'brocken', x: 236, y: 18, b: 44, h: 42, toedlich: true },
      { typ: 'ziel', x: 430, y: 208, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 178 },
      { dauer: 1.2 },
      { rechts: true, bisX: 224 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 276 },
      { rechts: true, sprung: true, dauer: 0.2 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 428 },
    ],
  },

  {
    nr: 7,
    welt: 1,
    abschnitt: 2,
    name: 'Sägewerk',
    idee: 'Zwei Inseln über dem Abgrund, darüber pendelt ein Sägeblatt. Stehen ist sicher, springen nur im richtigen Augenblick.',
    start: { x: 24, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 150, h: BODEN_H },
      { typ: 'block', x: 172, y: 214, b: 52, h: 12 },
      { typ: 'block', x: 250, y: 214, b: 52, h: 12 },
      { typ: 'block', x: 330, y: BODEN_Y, b: 150, h: BODEN_H },
      {
        typ: 'saege',
        x: 170,
        y: 166,
        b: 18,
        h: 18,
        weg: { dx: 118, dy: 0, dauer: 1.5, warte: 0.35 },
      },
      { typ: 'ziel', x: 430, y: 208, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 136 },
      { rechts: true, sprung: true, dauer: 0.3 },
      { rechts: true, bisBoden: true },
      { dauer: 0.9 },
      { rechts: true, sprung: true, dauer: 0.3 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 292 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 428 },
    ],
  },

  {
    nr: 8,
    welt: 1,
    abschnitt: 2,
    name: 'Falscher Freund',
    idee: 'Ein Schild zeigt nach rechts. Rechts bricht der Boden weg und darunter warten Stacheln. Der Weg führt nach links in ein Loch, das keiner freiwillig betritt -- und wer oben noch einmal hochspringt, findet den Kristall.',
    start: { x: 150, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 266, h: BODEN_H },
      { typ: 'block', id: 'restboden', x: 266, y: BODEN_Y, b: 34, h: BODEN_H },
      { typ: 'schild', x: 158, y: 202, b: 84, h: 16, text: 'AUSGANG →' },
      { typ: 'teleport', x: 10, y: 212, b: 26, h: 28, nach: { x: 96, y: 100 } },
      { typ: 'block', x: 88, y: 120, b: 70, h: 12 },
      { typ: 'kristall', x: 200, y: 176, b: 12, h: 12 },
      { typ: 'block', x: 200, y: 96, b: 70, h: 12 },
      { typ: 'block', x: 310, y: 124, b: 70, h: 12 },
      { typ: 'block', x: 390, y: 96, b: 90, h: 12 },
      {
        typ: 'zone',
        x: 246,
        y: 190,
        b: 14,
        h: 50,
        einmal: true,
        loest: [
          { tu: 'zeigen', ziel: 'biss' },
          { tu: 'weg', ziel: 'restboden' },
          { tu: 'beben', wert: 0.4 },
        ],
      },
      { typ: 'stachel', id: 'biss', x: 266, y: 256, b: 214, h: 14, versteckt: true },
      { typ: 'ziel', x: 440, y: 64, b: 22, h: 32 },
    ],
    loesung: [
      { links: true, bisXunter: 30 },
      { dauer: 0.2 },
      { sprung: true, dauer: 0.32 },
      { bisBoden: true },
      { rechts: true, bisX: 140 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 254 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 364 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 438 },
    ],
  },

  {
    nr: 9,
    welt: 1,
    abschnitt: 2,
    name: 'Kopfüber',
    idee: 'Auf halbem Weg dreht sich die Schwerkraft. Der Ausgang hängt an der Decke, und in der Decke klafft eine Lücke.',
    start: { x: 24, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 480, h: BODEN_H },
      { typ: 'block', x: 0, y: 0, b: 220, h: 20 },
      { typ: 'block', x: 286, y: 0, b: 194, h: 20 },
      {
        typ: 'zone',
        x: 150,
        y: 160,
        b: 16,
        h: 80,
        einmal: true,
        loest: [
          { tu: 'schwerkraft', wert: -1 },
          { tu: 'beben', wert: 0.5 },
        ],
      },
      { typ: 'ziel', x: 436, y: 20, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 158 },
      { rechts: true, bisBoden: true, dauer: 2 },
      { rechts: true, bisX: 196 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true, dauer: 2 },
      { rechts: true, bisX: 434 },
    ],
  },

  {
    nr: 10,
    welt: 1,
    abschnitt: 2,
    name: 'Prüfung der Höhlen',
    idee: 'Alles zusammen: Bruchboden, Aufzug, Säge, Feder -- und unten steht ein Ausgang, der keiner ist.',
    start: { x: 20, y: 223 },
    objekte: [
      { typ: 'block', x: 0, y: BODEN_Y, b: 96, h: BODEN_H },
      { typ: 'bruch', x: 96, y: BODEN_Y, b: 40, h: BODEN_H, verzoegerung: 0.22 },
      { typ: 'bruch', x: 136, y: BODEN_Y, b: 40, h: BODEN_H, verzoegerung: 0.22 },
      {
        typ: 'beweger',
        id: 'aufzug',
        x: 200,
        y: 214,
        b: 64,
        h: 12,
        // Der Aufzug hält genau auf Höhe der Plattform: Man geht hinüber,
        // statt zu springen. Ein Sprung würde geradewegs in die Säge führen.
        weg: { dx: 0, dy: -68, dauer: 1.6, warte: 0.6, start: 2.8 },
      },
      { typ: 'block', x: 264, y: 146, b: 110, h: 12 },
      {
        // Senkrecht statt waagerecht: Ein Sägeblatt, das die Plattform
        // entlangfährt, ließe sich nicht überholen -- eines, das auf und ab
        // geht, macht daraus ein Zeitfenster.
        typ: 'saege',
        x: 320,
        y: 92,
        b: 18,
        h: 18,
        // Der Startversatz ist so gewählt, dass die Säge oben steht, wenn
        // man zügig ankommt: Wer durchläuft, kommt durch; wer trödelt,
        // wartet auf das nächste Fenster.
        weg: { dx: 0, dy: 42, dauer: 0.8, warte: 1.6 },
      },
      { typ: 'block', x: 274, y: BODEN_Y, b: 206, h: BODEN_H },
      { typ: 'feder', x: 416, y: BODEN_Y, b: 28, h: 14, kraft: 760 },
      { typ: 'block', x: 330, y: 84, b: 90, h: 12 },
      { typ: 'ziel', x: 300, y: 208, b: 22, h: 32, falle: true },
      { typ: 'schild', x: 292, y: 186, b: 46, h: 14, text: 'AUSGANG' },
      { typ: 'ziel', x: 350, y: 52, b: 22, h: 32 },
    ],
    loesung: [
      { rechts: true, bisX: 84 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { rechts: true, bisBoden: true },
      { rechts: true, bisX: 158 },
      { rechts: true, sprung: true, dauer: 0.34 },
      { bisBoden: true },
      { links: true, dauer: 0.12 },
      { dauer: 1.6 },
      { rechts: true, bisX: 362 },
      { rechts: true, dauer: 0.6 },
      { links: true, bisBoden: true, dauer: 3 },
      { links: true, bisXunter: 360 },
    ],
  },
]
