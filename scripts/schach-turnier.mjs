#!/usr/bin/env node
/**
 * Schach-Turnier: der Computer, wie er jetzt im Arbeitsverzeichnis steht,
 * gegen eine frühere Fassung aus git.
 *
 *   node scripts/schach-turnier.mjs [ref=main] [partien=100] [ms=100] [stufe=schwer]
 *
 * Jede Eröffnung aus der Liste unten wird zweimal gespielt, mit getauschten
 * Farben; das Eröffnungsbuch ist dabei aus, sonst spielte nur eine Seite
 * daraus. Die Partien laufen auf allen Kernen. Am Ende steht das Ergebnis
 * aus Sicht der neuen Fassung, mit der Elo-Differenz, die es bedeutet.
 *
 * Warum es das gibt: Ob eine Änderung an der Suche oder an der Bewertung
 * den Computer stärker macht, sieht man an keinem einzelnen Zug. Man sieht
 * es nur an vielen Partien -- und unter 100 sagt das Ergebnis wenig.
 */
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { cpus, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [ref = 'main', partien = '100', ms = '100', stufe = 'schwer'] = process.argv.slice(2)

// Im Kindprozess: Partien spielen und das Ergebnis als JSON ausgeben.
if (process.env.SCHACH_TURNIER_KIND) {
  const { neu, alt, von, bis } = JSON.parse(process.env.SCHACH_TURNIER_KIND)
  const N = await import(neu)
  const A = await import(alt)
  const ERÖFFNUNGEN = [
    'e2e4 e7e5',
    'e2e4 c7c5',
    'd2d4 d7d5',
    'd2d4 g8f6',
    'c2c4 e7e5',
    'g1f3 d7d5',
    'e2e4 e7e6',
    'e2e4 c7c6',
    'd2d4 g8f6 c2c4 e7e6',
    'e2e4 e7e5 g1f3 b8c6',
    'e2e4 d7d6',
    'd2d4 f7f5',
    'c2c4 c7c5',
    'e2e4 g8f6',
    'b2b3 e7e5',
    'g2g3 d7d5',
    'e2e4 e7e5 f1c4',
    'd2d4 d7d5 c2c4 c7c6',
    'e2e4 c7c5 g1f3 d7d6',
    'd2d4 g8f6 c2c4 g7g6',
  ]
  const ergebnisse = []
  for (let i = von; i < bis; i++) {
    const neuWeiss = i % 2 === 0
    let p = N.neuePartie()
    for (const z of ERÖFFNUNGEN[Math.floor(i / 2) % ERÖFFNUNGEN.length].split(' '))
      p = N.zieheIn(p, z)
    for (let ply = 0; !p.ende && ply < 300; ply++) {
      const weissAmZug = p.stellung.seite === 1
      const f = weissAmZug === neuWeiss ? N.waehleZug : A.waehleZug
      const werte =
        stufe === 'schwer' ? { zeitMs: Number(ms), tiefe: 64, buch: false } : { buch: false }
      const z = f({ fen: p.stellung.fen(), verlauf: p.verlauf, stufe, seed: i * 1000 + ply, werte })
      const q = z && N.zieheIn(p, z)
      if (!q) break
      p = q
    }
    ergebnisse.push(p.ende?.sieger ? ((p.ende.sieger === 'w') === neuWeiss ? 1 : 0) : 0.5)
  }
  process.stdout.write(JSON.stringify(ergebnisse))
  process.exit(0)
}

const { rolldown } = await import('rolldown')
const tmp = mkdtempSync(join(tmpdir(), 'schach-turnier-'))

async function baue(einstieg, ziel, alias) {
  const b = await rolldown({ input: einstieg, platform: 'node', resolve: { alias } })
  await b.write({ file: ziel, format: 'esm' })
}

// Die alte Fassung: die Schach-Dateien aus git, mit dem Zufallsgenerator daneben.
const altDir = join(tmp, 'alt')
mkdirSync(altDir)
const dateien = execFileSync('git', ['ls-tree', '--name-only', ref, 'src/games/schach/'], {
  cwd: wurzel,
  encoding: 'utf8',
})
  .split('\n')
  .filter((d) => d.endsWith('.ts'))
for (const d of [...dateien, 'src/games/rng.ts']) {
  const text = execFileSync('git', ['show', `${ref}:${d}`], { cwd: wurzel, encoding: 'utf8' })
  writeFileSync(join(altDir, d.split('/').pop()), text.replaceAll("'@/games/rng'", "'./rng'"))
}
writeFileSync(
  join(altDir, 'einstieg.ts'),
  "export { waehleZug } from './ki'\nexport { neuePartie, zieheIn } from './partie'\n",
)
writeFileSync(
  join(tmp, 'neu.ts'),
  "export { waehleZug } from '@/games/schach/ki'\nexport { neuePartie, zieheIn } from '@/games/schach/partie'\n",
)
const alias = { '@': join(wurzel, 'src') }
await baue(join(altDir, 'einstieg.ts'), join(tmp, 'alt.mjs'), alias)
await baue(join(tmp, 'neu.ts'), join(tmp, 'neu.mjs'), alias)

const n = Number(partien)
const kerne = Math.max(1, cpus().length)
const je = Math.ceil(n / kerne)
const teile = []
for (let k = 0; k * je < n; k++) {
  const auftrag = {
    neu: join(tmp, 'neu.mjs'),
    alt: join(tmp, 'alt.mjs'),
    von: k * je,
    bis: Math.min(n, (k + 1) * je),
  }
  teile.push(
    new Promise((fertig, fehler) => {
      let aus = ''
      const kind = spawn(
        process.execPath,
        [fileURLToPath(import.meta.url), ref, partien, ms, stufe],
        {
          env: { ...process.env, SCHACH_TURNIER_KIND: JSON.stringify(auftrag) },
          stdio: ['ignore', 'pipe', 'inherit'],
        },
      )
      kind.stdout.on('data', (d) => (aus += d))
      kind.on('exit', (code) =>
        code === 0 ? fertig(JSON.parse(aus)) : fehler(new Error(`Kind ${k}: ${code}`)),
      )
    }),
  )
}
const alle = (await Promise.all(teile)).flat()
rmSync(tmp, { recursive: true, force: true })

const punkte = alle.reduce((a, b) => a + b, 0)
const q = punkte / alle.length
const elo = q > 0 && q < 1 ? Math.round(-400 * Math.log10(1 / q - 1)) : NaN
const zahl = (x) => alle.filter((e) => e === x).length
console.log(
  `${stufe}, ${ms} ms je Zug, gegen ${ref}: ${punkte}/${alle.length} ` +
    `(+${zahl(1)} =${zahl(0.5)} -${zahl(0)})  ${(q * 100).toFixed(1)} %  Elo ${elo > 0 ? '+' : ''}${elo}`,
)
