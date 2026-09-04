/**
 * Zerlegt die Migrationen in Stücke, die sich auf dem Handy einfügen lassen.
 *
 * Anlass (04.09.2026, Thomas): "superbase kann ich den Code nicht einfügen per
 * handy stürzt die seite ab weil zu lange". ALL_IN_ONE.sql ist rund 190 KB --
 * der SQL-Editor im Browser eines Telefons steigt dabei aus.
 *
 * Zwei Kniffe machen daraus etwas Handliches:
 *
 *  1. Nur was fehlt. Wer schon bis Migration 010 eingespielt hat, braucht den
 *     ganzen Anfang nicht mehr.
 *  2. Ohne die Kommentarblöcke. Die erklären, WARUM etwas so gebaut ist -- das
 *     gehört ins Repository, nicht in ein Fenster, das man einmal abschickt.
 *     Sie machen gut ein Drittel der Zeichen aus.
 *
 * Jedes Stück ist für sich gefahrlos mehrfach ausführbar, und die Reihenfolge
 * steht in den Dateinamen. Geschnitten wird nur an Anweisungsgrenzen, nie
 * mitten in einer Funktion.
 *
 * Aufruf: node scripts/build-teile.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const quelle = 'supabase/migrations'
const ziel = join(quelle, 'teile')

/** Ab hier fehlt es auf einer Datenbank, die bis 010 eingespielt wurde. */
const AB = '011'
/** Grösse, ab der ein Stück geteilt wird. Auf dem Handy noch bequem. */
const GRENZE = 14000

/**
 * Kommentare raus -- aber nur ganze Zeilen und Blöcke, nie etwas innerhalb
 * einer Zeichenkette. Deshalb wird jede Zeile für sich betrachtet und ein
 * "--" nur am Zeilenanfang gestrichen; ein Bindestrich-Paar mitten in einem
 * Wort der Wortliste bleibt damit unangetastet.
 */
function ohneKommentare(sql) {
  const zeilen = sql.split('\n')
  const raus = []
  let imBlock = false
  for (const z of zeilen) {
    const t = z.trim()
    if (imBlock) {
      if (t.includes('*/')) imBlock = false
      continue
    }
    if (t.startsWith('/*') && !t.includes('*/')) { imBlock = true; continue }
    if (t.startsWith('/*') && t.includes('*/')) continue
    if (t.startsWith('--')) continue
    raus.push(z)
  }
  return raus.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/**
 * An Anweisungsgrenzen schneiden. Eine Funktion endet mit "$$;" auf eigener
 * Zeile, eine gewöhnliche Anweisung mit ";" -- innerhalb von $$ ... $$ wird
 * nicht geschnitten, sonst zerfiele eine Funktion in zwei Hälften.
 */
function anweisungen(sql) {
  const teile = []
  let aktuell = []
  let imKoerper = false
  for (const z of sql.split('\n')) {
    aktuell.push(z)
    const dollar = (z.match(/\$\$/g) || []).length
    if (dollar % 2 === 1) imKoerper = !imKoerper
    if (!imKoerper && z.trimEnd().endsWith(';')) {
      teile.push(aktuell.join('\n'))
      aktuell = []
    }
  }
  if (aktuell.join('').trim()) teile.push(aktuell.join('\n'))
  return teile
}

/**
 * Eine einzelne Anweisung kann für sich schon zu gross sein: Die 1000 Wörter
 * der Imposter-Kategorien stehen in EINEM insert mit tausend Wertezeilen.
 * Das lässt sich gefahrlos in mehrere inserts mit demselben Kopf zerlegen --
 * an den Zeilengrenzen der Werte, nie mitten in einem Wort.
 */
function insertTeilen(anweisung) {
  if (anweisung.length <= GRENZE) return [anweisung]
  const m = anweisung.match(/^([\s\S]*?\bvalues\b)([\s\S]*)$/i)
  if (!m) return [anweisung]
  const kopf = m[1]
  const schwanz = m[2].trim().replace(/;\s*$/, '')
  // Wertezeilen enden auf "), " -- am Zeilenumbruch dahinter wird geschnitten.
  const zeilen = schwanz.split(/,\n/)
  const teile = []
  let puffer = []
  let laenge = kopf.length
  for (const z of zeilen) {
    if (puffer.length > 0 && laenge + z.length > GRENZE) {
      teile.push(kopf + '\n' + puffer.join(',\n') + ';')
      puffer = []
      laenge = kopf.length
    }
    puffer.push(z)
    laenge += z.length + 2
  }
  if (puffer.length > 0) teile.push(kopf + '\n' + puffer.join(',\n') + ';')
  return teile
}

const dateien = readdirSync(quelle)
  .filter((d) => /^\d+[a-z]?_.*\.sql$/.test(d) && d.slice(0, 3) >= AB)
  .sort()

// Nur die erzeugten SQL-Dateien wegraeumen, nicht den ganzen Ordner: Dort
// liegt auch LIESMICH.md, das von Hand geschrieben ist. Vorher stand hier ein
// rmSync(ziel, {recursive:true}) -- das hat die Anleitung stillschweigend
// mitgenommen, und ein "git add -A" hat das Loeschen dann mitcommittet.
// Aufgefallen erst zwei Tage spaeter, als jemand die Anleitung suchte.
mkdirSync(ziel, { recursive: true })
for (const veraltet of readdirSync(ziel).filter((d) => d.endsWith('.sql'))) {
  rmSync(join(ziel, veraltet))
}

let nummer = 0
const uebersicht = []

for (const datei of dateien) {
  const roh = ohneKommentare(readFileSync(join(quelle, datei), 'utf8'))
  const stuecke = []
  let puffer = ''
  for (const a of anweisungen(roh).flatMap(insertTeilen)) {
    if (puffer && puffer.length + a.length > GRENZE) {
      stuecke.push(puffer)
      puffer = ''
    }
    puffer += a + '\n'
  }
  if (puffer.trim()) stuecke.push(puffer)

  stuecke.forEach((inhalt, i) => {
    nummer += 1
    const name = `${String(nummer).padStart(2, '0')}_${datei.replace(/\.sql$/, '')}${
      stuecke.length > 1 ? `_teil${i + 1}von${stuecke.length}` : ''
    }.sql`
    const kopf =
      `-- ${name}\n` +
      `-- Aus ${datei}. Nacheinander einfuegen, Reihenfolge der Dateinamen.\n` +
      `-- Gefahrlos mehrfach ausfuehrbar. Erzeugt mit scripts/build-teile.mjs --\n` +
      `-- die Begruendungen stehen in der Ursprungsdatei.\n\n`
    writeFileSync(join(ziel, name), kopf + inhalt.trim() + '\n')
    uebersicht.push({ name, kb: Math.round((kopf + inhalt).length / 1024) })
  })
}

const gesamt = uebersicht.reduce((s, u) => s + u.kb, 0)
console.log(`${ziel}: ${uebersicht.length} Stücke, zusammen ~${gesamt} KB`)
for (const u of uebersicht) console.log(`  ${u.name.padEnd(52)} ${u.kb} KB`)
