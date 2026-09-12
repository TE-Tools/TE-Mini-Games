/**
 * Baut die 150 Sudoku-Level: drei Schwierigkeiten zu je fünfzig Rätseln.
 *
 * Warum vorab und nicht im Spiel: Ein wirklich schweres Rätsel findet man
 * nicht, man siebt es. Von hundert zufällig gegrabenen Rätseln braucht
 * vielleicht eins einen Fisch, und keines von hunderttausend braucht
 * ineinander verschachtelte Annahmen. Das dauert auf dem Handy zu lange
 * und wäre bei jedem Aufruf ein anderes. Hier läuft das Sieb einmal, das
 * Ergebnis liegt als Daten in src/games/sudoku/daten.ts, und der Test
 * prüft jedes einzelne Rätsel nach: eindeutig, richtig bewertet, in der
 * richtigen Reihenfolge.
 *
 * Einteilung nach dem schwersten nötigen Schritt (siehe techniken.ts):
 *   Leicht   nur Singles -- Level 1 mit vielen Vorgaben, Level 50 mit wenigen
 *   Mittel   Paare, Tripel, zeigende Paare, Kasten-Linie
 *   Schwer   ab X-Wing; die letzten Level brauchen Widerspruchsketten oder
 *            sogar ineinander verschachtelte Annahmen
 *
 * Die verschachtelten am Ende entstehen nicht durch Zufall, sondern durch
 * Bergsteigen: Ein hartes Kettenrätsel wird Vorgabe für Vorgabe umgebaut
 * (eine raus, eine andere rein, Eindeutigkeit bleibt), und behalten wird,
 * was schwerer bewertet wird -- bis der Menschenlöser aufgibt.
 *
 * Aufruf: node scripts/build-sudoku-levels.mjs
 * Dauer: rund zehn Minuten.
 */
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'

const server = await createServer({
  configFile: 'vite.config.ts',
  server: { middlewareMode: true },
  logLevel: 'error',
})

try {
  const gitter = await server.ssrLoadModule('/src/games/sudoku/gitter.ts')
  const loeser = await server.ssrLoadModule('/src/games/sudoku/loeser.ts')
  const erzeuger = await server.ssrLoadModule('/src/games/sudoku/erzeuger.ts')
  const techniken = await server.ssrLoadModule('/src/games/sudoku/techniken.ts')
  const rngModul = await server.ssrLoadModule('/src/games/rng.ts')
  const { alsText, anzahlVorgaben } = gitter
  const { istEindeutig } = loeser
  const { erzeugeRaetsel } = erzeuger
  const { bewerte, TECHNIK_GEWICHT } = techniken
  const { createRng } = rngModul

  const G = TECHNIK_GEWICHT
  const PRO_STUFE = 50

  const klasse = (b) => {
    const g = G[b.hoechste]
    if (g <= G['versteckter-single']) return 'leicht'
    if (g < G['x-wing']) return 'mittel'
    return 'schwer'
  }

  /** Ein Rätsel wird nach schwerstem Schritt, dann nach Aufwand verglichen. */
  const rang = (e) => G[e.t] * 1_000_000 + e.p
  const sortiere = (liste) => liste.sort((a, b) => rang(a) - rang(b))

  const eintrag = (vorgabe, loesung, b) => ({
    v: alsText(vorgabe),
    l: alsText(loesung),
    t: b.hoechste,
    p: b.punkte,
    n: anzahlVorgaben(vorgabe),
  })

  const gesehen = new Set()
  const merke = (e) => {
    if (gesehen.has(e.v)) return false
    gesehen.add(e.v)
    return true
  }

  // ------------------------------------------------------------ Leicht
  // Ziel-Vorgaben von 46 (Level 1) bis 30 (Level 50). Grabung hält an,
  // sobald die Zahl erreicht ist; das Rätsel muss mit Singles lösbar sein.
  const leicht = []
  for (let i = 0; i < PRO_STUFE; i++) {
    const ziel = Math.round(46 - (16 * i) / (PRO_STUFE - 1))
    for (let v = 0; ; v++) {
      const r = erzeugeRaetsel(`sudoku-leicht-${i}-${v}`, { symmetrisch: true, mindestens: ziel })
      const b = bewerte(r.vorgabe)
      if (!b.geloest || klasse(b) !== 'leicht') continue
      const e = eintrag(r.vorgabe, r.loesung, b)
      if (!merke(e)) continue
      leicht.push(e)
      break
    }
  }
  // Innerhalb der Stufe nach Aufwand sortiert -- so steigt es wirklich an.
  leicht.sort((a, b) => a.p - b.p || b.n - a.n)
  console.log(`Leicht: ${leicht.length} Rätsel, Vorgaben ${leicht[0].n} … ${leicht.at(-1).n}`)

  // ------------------------------------------------------------ Mittel
  // Ziel-Vorgaben von 34 bis 26. Es muss mindestens ein Paar/Tripel/
  // zeigendes Paar nötig sein, aber nichts ab X-Wing.
  const mittel = []
  for (let i = 0; i < PRO_STUFE; i++) {
    const ziel = Math.round(34 - (8 * i) / (PRO_STUFE - 1))
    for (let v = 0; ; v++) {
      const r = erzeugeRaetsel(`sudoku-mittel-${i}-${v}`, { symmetrisch: true, mindestens: ziel })
      const b = bewerte(r.vorgabe)
      if (!b.geloest || klasse(b) !== 'mittel') continue
      const e = eintrag(r.vorgabe, r.loesung, b)
      if (!merke(e)) continue
      mittel.push(e)
      break
    }
  }
  sortiere(mittel)
  console.log(
    `Mittel: ${mittel.length} Rätsel, Vorgaben ${Math.min(...mittel.map((e) => e.n))} … ${Math.max(
      ...mittel.map((e) => e.n),
    )}`,
  )

  // ------------------------------------------------------------ Schwer
  // Erst sieben: so weit graben, wie es geht (ohne Symmetrie, das gibt
  // weniger Vorgaben), alles ab X-Wing nach Technik in Körbe legen.
  const nachTechnik = new Map()
  const lege = (e) => {
    if (!nachTechnik.has(e.t)) nachTechnik.set(e.t, [])
    nachTechnik.get(e.t).push(e)
  }
  const anzahl = (t) => nachTechnik.get(t)?.length ?? 0

  const start = Date.now()
  const SIEB_MS = 240 * 1000
  let versuche = 0
  const genug = () =>
    anzahl('rohe-gewalt') >= 12 &&
    anzahl('kette') >= 40 &&
    anzahl('x-wing') + anzahl('xy-wing') + anzahl('xyz-wing') >= 60 &&
    anzahl('schwertfisch') + anzahl('faerbung') >= 60
  for (let v = 0; Date.now() - start < SIEB_MS && !genug(); v++) {
    versuche++
    const r = erzeugeRaetsel(`sudoku-schwer-${v}`, { symmetrisch: false, mindestens: 0 })
    const b = bewerte(r.vorgabe)
    if (!b.geloest || klasse(b) !== 'schwer') continue
    const e = eintrag(r.vorgabe, r.loesung, b)
    if (!merke(e)) continue
    lege(e)
  }
  console.log(
    `Sieb: ${versuche} Versuche in ${Math.round((Date.now() - start) / 1000)}s -- ` +
      [...nachTechnik.entries()].map(([t, l]) => `${t}×${l.length}`).join(', '),
  )

  // Die Auswahl, Level 101–150:
  //   101–115  X-Wing, XY-Wing, XYZ-Wing, nacktes Quartett -- gemischt
  //   116–130  Schwertfisch, Qualle, Färbung -- gemischt
  //   131–142  Widerspruchsketten, die aufwendigsten
  //   143–150  verschachtelt: durch Bergsteigen so verschärft, dass keine
  //            einzelne Annahme mehr zum Widerspruch führt
  const WUNSCH = [
    { techniken: ['x-wing', 'xy-wing', 'xyz-wing', 'nacktes-quartett'], anzahl: 15 },
    { techniken: ['schwertfisch', 'qualle', 'faerbung'], anzahl: 15 },
    { techniken: ['kette'], anzahl: 12 },
  ]
  const ANZAHL_VERSCHACHTELT = 8

  const schwer = []
  for (const korb of WUNSCH) {
    // Gleichmäßig über die Techniken verteilen, die es gibt; je Technik die
    // aufwendigsten. Fehlt etwas, füllen die anderen Techniken des Korbs auf.
    const vorhanden = korb.techniken.filter((t) => anzahl(t) > 0)
    const genommen = []
    let rest = korb.anzahl
    const quoten = vorhanden.map(() => 0)
    for (let i = 0; rest > 0 && vorhanden.length > 0; i = (i + 1) % vorhanden.length) {
      const t = vorhanden[i]
      if (quoten[i] < anzahl(t)) {
        quoten[i]++
        rest--
      } else if (quoten.every((q, j) => q >= anzahl(vorhanden[j]))) break
    }
    vorhanden.forEach((t, i) => {
      const liste = sortiere(nachTechnik.get(t))
      genommen.push(...liste.slice(liste.length - quoten[i]))
    })
    if (genommen.length < korb.anzahl) {
      console.warn(`Korb ${korb.techniken.join('/')}: nur ${genommen.length} von ${korb.anzahl}`)
    }
    schwer.push(...genommen)
  }

  // ----------------------------------------------- Bergsteigen für 143–150
  const ketten = sortiere([...(nachTechnik.get('kette') ?? [])])
  // Was das Sieb schon an Verschachteltem fand, zählt; der Rest wird erklettert.
  const verschachtelt = [...(nachTechnik.get('rohe-gewalt') ?? [])]
  const KLETTER_MS = 6 * 60 * 1000
  const kletterStart = Date.now()
  const rng = createRng('sudoku-verschachtelt')
  const wuerfel = (n) => Math.floor(rng() * n)

  /** Ein Schritt: eine Vorgabe raus, notfalls eine andere rein, eindeutig bleiben. */
  const mutiere = (vorgabe, loesung) => {
    const g = new Uint8Array(vorgabe)
    const voll = []
    const leer = []
    for (let i = 0; i < 81; i++) (g[i] ? voll : leer).push(i)
    const raus = voll[wuerfel(voll.length)]
    g[raus] = 0
    if (istEindeutig(g)) return g
    // Nicht mehr eindeutig: irgendeine andere Zelle aus der Lösung dazu.
    for (let versuch = 0; versuch < 12; versuch++) {
      const rein = leer[wuerfel(leer.length)]
      g[rein] = loesung[rein]
      if (istEindeutig(g)) return g
      g[rein] = 0
    }
    return null
  }

  // Mehrere Startpunkte im Wechsel, damit nicht alles aus einem Rätsel stammt.
  const START_ANZAHL = 12
  const lineagen = ketten.slice(ketten.length - START_ANZAHL).map((e) => ({
    vorgabe: gitter.parse(e.v),
    loesung: gitter.parse(e.l),
    rang: rang(e),
    schritte: 0,
  }))
  let runde = 0
  while (
    verschachtelt.length < ANZAHL_VERSCHACHTELT + 2 &&
    Date.now() - kletterStart < KLETTER_MS &&
    lineagen.length > 0
  ) {
    const li = lineagen[runde % lineagen.length]
    runde++
    const neu = mutiere(li.vorgabe, li.loesung)
    if (!neu) continue
    const b = bewerte(neu)
    if (!b.geloest) continue
    li.schritte++
    const e = eintrag(neu, li.loesung, b)
    const r = rang(e)
    // Seitwärts und aufwärts geht es weiter; abwärts nicht.
    if (r >= li.rang) {
      li.vorgabe = neu
      li.rang = r
    }
    if (b.hoechste === 'rohe-gewalt' && merke(e)) {
      verschachtelt.push(e)
      console.log(
        `  verschachtelt #${verschachtelt.length}: ${e.n} Vorgaben, ${e.p} Punkte, nach ${li.schritte} Schritten (${Math.round(
          (Date.now() - kletterStart) / 1000,
        )}s)`,
      )
      // Von hier aus weiter, aber als neues Rätsel zählt nur, was sich unterscheidet.
    }
    if (runde % 400 === 0) {
      console.log(
        `  Bergsteigen: ${runde} Schritte, ${Math.round((Date.now() - kletterStart) / 1000)}s, ${verschachtelt.length} gefunden`,
      )
    }
  }
  sortiere(verschachtelt)
  const finale = verschachtelt.slice(verschachtelt.length - ANZAHL_VERSCHACHTELT)
  if (finale.length < ANZAHL_VERSCHACHTELT) {
    const fehlt = ANZAHL_VERSCHACHTELT - finale.length
    console.warn(`Verschachtelt: nur ${finale.length}, ${fehlt} Ketten rücken nach`)
    const genommen = new Set(schwer.map((e) => e.v))
    const nach = ketten.filter((e) => !genommen.has(e.v))
    schwer.push(...nach.slice(nach.length - fehlt))
  }
  schwer.push(...finale)
  sortiere(schwer)
  console.log(
    `Schwer: ${schwer.length} Rätsel -- ` +
      Object.entries(schwer.reduce((acc, e) => ((acc[e.t] = (acc[e.t] ?? 0) + 1), acc), {}))
        .map(([t, n]) => `${t}×${n}`)
        .join(', '),
  )

  const alle = [...leicht, ...mittel, ...schwer]
  if (alle.length !== 150) throw new Error(`150 erwartet, ${alle.length} gebaut`)

  const zeilen = alle.map(
    (e, i) =>
      `  // ${i + 1}: ${e.t}, ${e.p} Punkte, ${e.n} Vorgaben\n` +
      `  { v: '${e.v}', l: '${e.l}', t: '${e.t}', p: ${e.p} },`,
  )
  const datei =
    `/**\n` +
    ` * Die 150 Sudoku-Rätsel -- erzeugt mit scripts/build-sudoku-levels.mjs.\n` +
    ` *\n` +
    ` * Nicht von Hand ändern: Level 1–50 Leicht, 51–100 Mittel, 101–150 Schwer,\n` +
    ` * innerhalb jeder Stufe nach Aufwand aufsteigend. \`t\` ist der schwerste\n` +
    ` * nötige Schritt, \`p\` die Summe aller Schrittgewichte (techniken.ts).\n` +
    ` * tests/sudoku.test.ts prüft jedes Rätsel auf Eindeutigkeit und Einordnung.\n` +
    ` */\n` +
    `import type { Technik } from './techniken'\n\n` +
    `export interface RaetselDaten {\n` +
    `  /** 81 Zeichen, . für leer. */\n  v: string\n` +
    `  /** Die Lösung, 81 Ziffern. */\n  l: string\n` +
    `  /** Schwerster nötiger Schritt. */\n  t: Technik\n` +
    `  /** Gesamtaufwand. */\n  p: number\n}\n\n` +
    `export const RAETSEL_DATEN: readonly RaetselDaten[] = [\n${zeilen.join('\n')}\n]\n`
  writeFileSync('src/games/sudoku/daten.ts', datei)
  console.log(`src/games/sudoku/daten.ts geschrieben (${Math.round(datei.length / 1024)} KB)`)
} finally {
  await server.close()
}
