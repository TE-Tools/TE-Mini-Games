/**
 * Die Welten von Trapbound – und wie sie auf der Karte aussehen.
 *
 * Die Levelkarte ist dieselbe wie in den anderen Spielen (die gewundene
 * Straße mit Toren), nur mit eigenen Zonen: Statt Urwald und Vulkanland
 * stehen hier Höhlen, Fabrik, Turm, verdrehte Welt und Chaos.
 *
 * Zwanzig Level je Welt, ein Abschnitt je Welt -- damit ist jedes Tor auf
 * der Karte auch ein Weltwechsel, und man sieht beim Öffnen, dass etwas
 * Neues beginnt.
 */

import type { Kartenaufbau, LevelZone } from '@/progression/zones'

/** So viele Level hat jede Welt. */
export const LEVEL_PRO_WELT = 20

export const TRAP_ZONEN: readonly LevelZone[] = [
  {
    id: 'jungle',
    index: 1,
    name: 'Die Höhlen',
    levelFrom: 1,
    levelTo: 20,
    description: 'Wo der Boden nicht hält, was er verspricht.',
    creatures: ['🕳️', '🪨', '💧', '🦇'],
    palette: {
      ground: '#4b3f6b',
      groundLight: '#8f7cc4',
      accent: '#7ce7c8',
      path: '#6b5b95',
      sky: '#221a3a',
      blob: '#2e2450',
    },
    gateLevel: 20,
    gateName: 'Tor zur Fabrik',
  },
  {
    id: 'volcanic',
    index: 2,
    name: 'Die Fabrik',
    levelFrom: 21,
    levelTo: 40,
    description: 'Bänder, Sägen und Pressen. Alles läuft, nichts wartet.',
    creatures: ['⚙️', '🔧', '🪚', '🔩'],
    palette: {
      ground: '#5a4632',
      groundLight: '#c08a3e',
      accent: '#ffb84d',
      path: '#7d6141',
      sky: '#2b211a',
      blob: '#3a2c20',
    },
    gateLevel: 40,
    gateName: 'Tor zum Turm',
  },
  {
    id: 'canyon',
    index: 3,
    name: 'Der Turm',
    levelFrom: 41,
    levelTo: 60,
    description: 'Es geht nach oben. Und alles andere nach unten.',
    creatures: ['🏰', '🪜', '🧱', '🕯️'],
    palette: {
      ground: '#3b4a6b',
      groundLight: '#7f9ad1',
      accent: '#9ad7ff',
      path: '#4f6086',
      sky: '#182238',
      blob: '#22304d',
    },
    gateLevel: 60,
    gateName: 'Tor zur verdrehten Welt',
  },
  {
    id: 'iceage',
    index: 4,
    name: 'Die verdrehte Welt',
    levelFrom: 61,
    levelTo: 80,
    description: 'Oben ist unten, links ist rechts, und nichts davon bleibt so.',
    creatures: ['🌀', '🔀', '🌌', '🪞'],
    palette: {
      ground: '#4a3560',
      groundLight: '#b98ce0',
      accent: '#ff8ae2',
      path: '#5e4177',
      sky: '#1d1330',
      blob: '#2a1c42',
    },
    gateLevel: 80,
    gateName: 'Tor zum Chaos',
  },
  {
    id: 'glacier',
    index: 5,
    name: 'Das Chaos',
    levelFrom: 81,
    levelTo: 100,
    description: 'Alles auf einmal. Viel Glück.',
    creatures: ['💥', '☠️', '🔥', '⚡'],
    palette: {
      ground: '#5c2430',
      groundLight: '#e2596f',
      accent: '#ffd166',
      path: '#7a2f3d',
      sky: '#2a1017',
      blob: '#3d1620',
    },
    gateLevel: 100,
    gateName: 'Tor in die Tiefe',
  },
  // ---------------------------------------------------------------- ab 101
  //
  // Die zweite Hälfte. Hier kommt dazu, was man nicht kommen sieht: Böden,
  // die ohne Risse nachgeben, Blöcke, die aus einer leeren Decke fallen,
  // Stachelregen. Thomas am 10.09.2026: "ab Level hunderteins noch mal um
  // einige schwerer, mehr Fallen, andere Fallen -- das, was von der Decke
  // fällt oder zusammenbricht, dass man das vorher nicht sieht."
  {
    id: 'deep',
    index: 6,
    name: 'Die Tiefe',
    levelFrom: 101,
    levelTo: 120,
    description: 'Hier sieht man die Falle erst, wenn sie zuschnappt.',
    creatures: ['🕯️', '🦴', '🕸️', '🌑'],
    palette: {
      ground: '#2f2b45',
      groundLight: '#6f6a94',
      accent: '#a89bff',
      path: '#413c5e',
      sky: '#141222',
      blob: '#1e1b33',
    },
    gateLevel: 120,
    gateName: 'Tor zur Schmiede',
  },
  {
    id: 'forge',
    index: 7,
    name: 'Die Schmiede',
    levelFrom: 121,
    levelTo: 140,
    description: 'Alles glüht, alles bewegt sich, nichts wartet auf dich.',
    creatures: ['🔨', '🔥', '⛓️', '🪨'],
    palette: {
      ground: '#5e2f16',
      groundLight: '#d97828',
      accent: '#ffb03a',
      path: '#7d3f1d',
      sky: '#2a140a',
      blob: '#3a1c0d',
    },
    gateLevel: 140,
    gateName: 'Tor zum Uhrwerk',
  },
  {
    id: 'clockwork',
    index: 8,
    name: 'Das Uhrwerk',
    levelFrom: 141,
    levelTo: 160,
    description: 'Alles im Takt. Deiner muss dazu passen.',
    creatures: ['⚙️', '🕰️', '🔁', '📐'],
    palette: {
      ground: '#2c4a4a',
      groundLight: '#5fbdb0',
      accent: '#8ff5e2',
      path: '#3b6161',
      sky: '#122423',
      blob: '#1a3231',
    },
    gateLevel: 160,
    gateName: 'Tor in die Leere',
  },
  {
    id: 'void',
    index: 9,
    name: 'Die Leere',
    levelFrom: 161,
    levelTo: 180,
    description: 'Wenig Boden, viel Nichts, und beides wechselt sich ab.',
    creatures: ['🌌', '✨', '🕳️', '🌠'],
    palette: {
      ground: '#232144',
      groundLight: '#6360c0',
      accent: '#b7c7ff',
      path: '#332f63',
      sky: '#0e0d1e',
      blob: '#171630',
    },
    gateLevel: 180,
    gateName: 'Tor zum Spiegelsaal',
  },
  {
    id: 'mirror',
    index: 10,
    name: 'Der Spiegelsaal',
    levelFrom: 181,
    levelTo: 200,
    description: 'Was du siehst, ist selten das, was da ist.',
    creatures: ['🪞', '🔀', '👥', '❓'],
    palette: {
      ground: '#3f2b52',
      groundLight: '#a279c9',
      accent: '#f0a9ff',
      path: '#553a6f',
      sky: '#1a1128',
      blob: '#281a3c',
    },
    gateLevel: 200,
    gateName: 'Tor zum Gewitter',
  },
  {
    id: 'storm',
    index: 11,
    name: 'Das Gewitter',
    levelFrom: 201,
    levelTo: 220,
    description: 'Von oben kommt etwas. Immer.',
    creatures: ['⚡', '🌩️', '🌧️', '💨'],
    palette: {
      ground: '#26364d',
      groundLight: '#5f87bd',
      accent: '#ffe066',
      path: '#334a68',
      sky: '#101823',
      blob: '#182533',
    },
    gateLevel: 220,
    gateName: 'Tor zum Schlund',
  },
  {
    id: 'maw',
    index: 12,
    name: 'Der Schlund',
    levelFrom: 221,
    levelTo: 240,
    description: 'Der Boden ist hier nur eine Meinung.',
    creatures: ['🦷', '🕳️', '🩸', '👁️'],
    palette: {
      ground: '#4a1f2b',
      groundLight: '#b94a5e',
      accent: '#ff8fa0',
      path: '#642a39',
      sky: '#1e0c12',
      blob: '#2c1219',
    },
    gateLevel: 240,
    gateName: 'Tor zur Maschine',
  },
  {
    id: 'machine',
    index: 13,
    name: 'Die Maschine',
    levelFrom: 241,
    levelTo: 260,
    description: 'Sie läuft seit Ewigkeiten und hat auf dich gewartet.',
    creatures: ['🛠️', '🔩', '🪚', '⚡'],
    palette: {
      ground: '#3a3f27',
      groundLight: '#8fa04a',
      accent: '#d8f06a',
      path: '#4e5434',
      sky: '#1a1c11',
      blob: '#262a18',
    },
    gateLevel: 260,
    gateName: 'Tor zum Albtraum',
  },
  {
    id: 'nightmare',
    index: 14,
    name: 'Der Albtraum',
    levelFrom: 261,
    levelTo: 280,
    description: 'Alles, was du gelernt hast. Gleichzeitig.',
    creatures: ['😱', '🌀', '🕯️', '🩻'],
    palette: {
      ground: '#2b1a3d',
      groundLight: '#7b52ad',
      accent: '#ff6ec7',
      path: '#3c2455',
      sky: '#120a1c',
      blob: '#1d1030',
    },
    gateLevel: 280,
    gateName: 'Tor zum Ende',
  },
  {
    id: 'end',
    index: 15,
    name: 'Das Ende',
    levelFrom: 281,
    levelTo: 300,
    description: 'Du dachtest, hier ist Schluss.',
    creatures: ['👑', '🏁', '💀', '🌟'],
    palette: {
      ground: '#4a4a4a',
      groundLight: '#c9c9c9',
      accent: '#ffd76a',
      path: '#5f5f5f',
      sky: '#141414',
      blob: '#232323',
    },
    gateLevel: 300,
    gateName: 'Tor zur Schneide',
  },
  /*
   * Ab hier die dritte Hälfte -- Level 301 bis 400.
   *
   * Thomas am 18.09.2026: "du sollst 100 neue machen". Die fünf Welten
   * hier sind nicht mehr Steigerung derselben Sache, sondern eine eigene
   * Stufe: Was vorher die Ausnahme war -- eine Jagd, eine blinde Falle, ein
   * zuschnappender Ausgang --, ist hier die Regel, und es kommt doppelt.
   */
  {
    id: 'blade',
    index: 16,
    name: 'Die Schneide',
    levelFrom: 301,
    levelTo: 320,
    description: 'Kein Level ohne etwas im Nacken.',
    creatures: ['🪚', '⚔️', '🌀', '⚡'],
    palette: {
      ground: '#3d2a2a',
      groundLight: '#c2555f',
      accent: '#ff8a8a',
      path: '#553636',
      sky: '#190f0f',
      blob: '#281919',
    },
    gateLevel: 320,
    gateName: 'Tor zum Kesselhaus',
  },
  {
    id: 'boiler',
    index: 17,
    name: 'Das Kesselhaus',
    levelFrom: 321,
    levelTo: 340,
    description: 'Heiß, eng, und die Gitter fallen von selbst.',
    creatures: ['🔥', '🛠️', '🌡️', '⚙️'],
    palette: {
      ground: '#4a3418',
      groundLight: '#d98c2b',
      accent: '#ffc258',
      path: '#5f4522',
      sky: '#1c1208',
      blob: '#2a1d0e',
    },
    gateLevel: 340,
    gateName: 'Tor zur Schwärze',
  },
  {
    id: 'blackness',
    index: 18,
    name: 'Die Schwärze',
    levelFrom: 341,
    levelTo: 360,
    description: 'Der Boden sieht überall gleich aus. Er ist es nicht.',
    creatures: ['🌑', '🕳️', '🌫️', '🖤'],
    palette: {
      // Dunkel, aber nicht unlesbar: Beim ersten Anlauf lag der Boden so
      // nah am Himmel, dass man im Bild kaum sah, wo er aufhört. Eine Welt
      // darf finster aussehen -- raten, wo der Rand ist, soll man nicht.
      ground: '#31333e',
      groundLight: '#8288a2',
      accent: '#9fb3ff',
      path: '#3c3f4c',
      sky: '#0c0c11',
      blob: '#1a1b24',
    },
    gateLevel: 360,
    gateName: 'Tor zum Räderwerk',
  },
  {
    id: 'gearworks',
    index: 19,
    name: 'Das Räderwerk',
    levelFrom: 361,
    levelTo: 380,
    description: 'Alles greift ineinander. Auch nach dir.',
    creatures: ['⚙️', '🔗', '🔄', '🔩'],
    palette: {
      ground: '#25403c',
      groundLight: '#4fae9e',
      accent: '#79f3dc',
      path: '#2f524d',
      sky: '#0c1615',
      blob: '#132321',
    },
    gateLevel: 380,
    gateName: 'Tor zum letzten Licht',
  },
  {
    id: 'lastlight',
    index: 20,
    name: 'Das letzte Licht',
    levelFrom: 381,
    levelTo: 400,
    description: 'Zwanzig Level. Diesmal wirklich.',
    creatures: ['🕯️', '✨', '🌟', '🏁'],
    palette: {
      ground: '#44406a',
      groundLight: '#b9b0ee',
      accent: '#fff2a8',
      path: '#565080',
      sky: '#12101f',
      blob: '#1d1a30',
    },
    gateLevel: 400,
    gateName: 'Das letzte Licht',
  },
]

/** So viele Level gibt es insgesamt. */
export const TRAP_MAX_LEVEL = TRAP_ZONEN.length * LEVEL_PRO_WELT

/**
 * Der Kartenaufbau für die gemeinsame Levelkarte.
 *
 * Ein Abschnitt ist genau eine Welt: `segmentGroesse` und `levelProZone`
 * sind beide zwanzig. Dadurch ist jedes Tor auf der Karte ein Weltentor.
 */
export const TRAP_KARTE: Kartenaufbau = {
  zonen: TRAP_ZONEN,
  levelProZone: LEVEL_PRO_WELT,
  segmentGroesse: LEVEL_PRO_WELT,
  maxLevel: TRAP_MAX_LEVEL,
}

export function weltNummer(level: number): number {
  const L = Math.max(1, Math.min(TRAP_MAX_LEVEL, Math.floor(level)))
  return Math.ceil(L / LEVEL_PRO_WELT)
}

export function weltZone(level: number): LevelZone {
  return TRAP_ZONEN[weltNummer(level) - 1]!
}

/** Wie weit man in seiner Welt ist: 0 beim ersten Level, 1 beim letzten. */
export function weltFortschritt(level: number): number {
  const L = Math.max(1, Math.min(TRAP_MAX_LEVEL, Math.floor(level)))
  return (((L - 1) % LEVEL_PRO_WELT) + 1 - 1) / (LEVEL_PRO_WELT - 1)
}
