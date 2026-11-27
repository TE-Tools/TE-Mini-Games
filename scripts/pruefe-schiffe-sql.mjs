/**
 * Rechnet die SQL-Fassung von Schiffe versenken gegen die TypeScript-Fassung.
 *
 * WARUM ES DAS GIBT. Die Flotten sind verdeckt, also hält der Server sie
 * und wertet jeden Schuss aus (siehe docs/design/schiffe-versenken/ und
 * docs/design/kartenspiele-online/). Damit stehen die Regeln zweimal da: in
 * src/games/schiffe-versenken/{flotte,partie}.ts und in
 * supabase/migrations/035_schiffe_versenken_online.sql. Zwei Fassungen
 * derselben Regel laufen auseinander -- nicht beim Schreiben, sondern beim
 * dritten Mal, wenn jemand eine ändert. Dagegen hilft nur eine Messung.
 *
 * Gemessen wird viererlei:
 *   1. Die Flotte: FLOTTE und sv_flotte_def() sind dieselben Schiffe.
 *   2. flottenFehler() gegen sv_flotte_fehler(): tausende zufällige
 *      Aufstellungen, gültige wie kaputte (verschoben, gedreht, über den
 *      Rand, doppelt, falsche Länge, Kommazahlen, Unsinn), mit beiden
 *      Einstellungen von „nicht berühren".
 *   3. Ganze Partien im Gleichschritt: zufällige Flotten, zufällige Schüsse
 *      (auch doppelte und welche neben das Meer), beide Hausregeln. Nach
 *      jedem Schuss müssen beide Zustände übereinstimmen -- und ebenso die
 *      Sicht beider Spieler (sichtFuer gegen sv_sicht), denn die ist das,
 *      was den Server verlässt.
 *   4. Aufgeben (gibAuf gegen sv_aufgabe) an zufälligen Stellen.
 *
 * Aufruf (braucht ein Postgres, in das man schreiben darf):
 *
 *   createdb svtest
 *   psql -d svtest -f supabase/migrations/pruefung/stub.sql
 *   psql -d svtest -f supabase/migrations/035_schiffe_versenken_online.sql
 *   PSQL_ARGS="-d svtest" node scripts/pruefe-schiffe-sql.mjs
 *
 * FLOTTEN=5000 setzt die Zahl der geprüften Aufstellungen, PARTIEN die der
 * Partien.
 *
 * Zuletzt gelaufen: noch nie -- auf dem Rechner, auf dem es entstand
 * (27.11.2026), gab es kein Postgres. Wer es laufen lässt, trägt hier Datum
 * und Ergebnis ein.
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const PSQL = process.env.PSQL ?? 'psql'
const ARGS = (process.env.PSQL_ARGS ?? '').split(' ').filter(Boolean)
const FLOTTEN = Number(process.env.FLOTTEN ?? 4000)
const PARTIEN = Number(process.env.PARTIEN ?? 300)

/** Eine Abfrage, deren Ergebnis eine einzige jsonb-Zelle ist -- über die Standardeingabe. */
function sql(text) {
  const roh = execFileSync(PSQL, [...ARGS, '-At', '-q'], {
    encoding: 'utf8',
    input: text,
    maxBuffer: 1 << 28,
  }).trim()
  return roh === '' ? null : JSON.parse(roh)
}

function lit(wert) {
  return `'${JSON.stringify(wert).replaceAll("'", "''")}'::jsonb`
}

/** Vergleich ohne Rücksicht auf die Reihenfolge der Schlüssel (jsonb sortiert sie um). */
function kanonisch(wert) {
  if (Array.isArray(wert)) return wert.map(kanonisch)
  if (wert && typeof wert === 'object') {
    return Object.fromEntries(
      Object.keys(wert)
        .filter((k) => wert[k] !== undefined)
        .sort()
        .map((k) => [k, kanonisch(wert[k])]),
    )
  }
  return wert
}
const gleich = (a, b) => JSON.stringify(kanonisch(a)) === JSON.stringify(kanonisch(b))

/* ------------------------------------------------- TypeScript laden */

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
const sv = await server.ssrLoadModule('/src/games/schiffe-versenken/index.ts')
const { mulberry32 } = await server.ssrLoadModule('/src/games/rng.ts')

let fehler = 0
let geprueft = 0

async function melde(was, erwartet, bekommen, zusatz = '') {
  fehler++
  console.error(`\n✗ ${was}`)
  console.error(`  TypeScript: ${JSON.stringify(erwartet)}`)
  console.error(`  SQL:        ${JSON.stringify(bekommen)}`)
  if (zusatz) console.error(`  ${zusatz}`)
  if (fehler > 20) {
    await server.close()
    process.exit(1)
  }
}

const REGELSAETZE = [
  { nichtBeruehren: true, nochmalNachTreffer: false },
  { nichtBeruehren: false, nochmalNachTreffer: false },
  { nichtBeruehren: true, nochmalNachTreffer: true },
  { nichtBeruehren: false, nochmalNachTreffer: true },
]

/* ======================== 1. Die Flotte =========================== */

{
  const db = sql('select public.sv_flotte_def()')
  geprueft++
  if (!gleich(db, sv.FLOTTE)) await melde('FLOTTE und sv_flotte_def()', sv.FLOTTE, db)
  for (const roh of [null, {}, { nichtBeruehren: false }, { nochmalNachTreffer: 'ja' }]) {
    geprueft++
    const ts = sv.regelnAus(roh)
    const b = sql(`select public.sv_regeln(${roh === null ? 'null' : lit(roh)})`)
    if (!gleich(ts, b)) await melde(`regelnAus(${JSON.stringify(roh)})`, ts, b)
  }
}

/* =================== 2. flottenFehler über alles ================== */

/** Eine Aufstellung zufällig verderben -- oder nicht. */
function verdorben(flotte, zufall) {
  const f = flotte.map((s) => ({ ...s }))
  const i = Math.floor(zufall() * f.length)
  const s = f[i]
  switch (Math.floor(zufall() * 12)) {
    case 0:
      s.x += Math.floor(zufall() * 5) - 2
      break
    case 1:
      s.y += Math.floor(zufall() * 5) - 2
      break
    case 2:
      s.richtung = s.richtung === 'h' ? 'v' : 'h'
      break
    case 3:
      s.x = 10 - Math.floor(zufall() * 3)
      break
    case 4:
      f.push({ ...f[0] })
      break
    case 5:
      f.splice(i, 1)
      break
    case 6:
      s.laenge += 1
      break
    case 7:
      s.x += 0.5
      break
    case 8:
      s.id = 'flugzeug'
      break
    case 9:
      s.richtung = 'd'
      break
    case 10: {
      // Neben ein anderes Schiff schieben -- berührt oder überlappt.
      const j = (i + 1) % f.length
      s.x = f[j].x + Math.floor(zufall() * 3) - 1
      s.y = f[j].y + Math.floor(zufall() * 3) - 1
      break
    }
    default:
      // unverändert
      break
  }
  return f
}

{
  const zufall = mulberry32(2026)
  const faelle = []
  for (let n = 0; n < FLOTTEN; n++) {
    const regeln = REGELSAETZE[n % 2]
    const basis = sv.zufallsFlotte(n % 3 === 0 ? REGELSAETZE[1] : regeln, zufall)
    faelle.push({ flotte: n % 4 === 0 ? basis : verdorben(basis, zufall), regeln })
  }
  faelle.push({ flotte: 'Unsinn', regeln: REGELSAETZE[0] })
  faelle.push({ flotte: [1, 2, 3, 4, 5], regeln: REGELSAETZE[0] })
  faelle.push({ flotte: { x: 1 }, regeln: REGELSAETZE[0] })

  // In Blöcken, damit keine Abfrage zu groß wird.
  for (let ab = 0; ab < faelle.length; ab += 500) {
    const block = faelle.slice(ab, ab + 500)
    const db = sql(`
      select coalesce(jsonb_agg(to_jsonb(public.sv_flotte_fehler(f -> 'flotte', f -> 'regeln')) order by i), '[]'::jsonb)
      from jsonb_array_elements(${lit(block)}) with ordinality as t(f, i)`)
    for (let k = 0; k < block.length; k++) {
      geprueft++
      const ts = sv.flottenFehler(block[k].flotte, block[k].regeln)
      if (ts !== db[k]) {
        await melde(`flottenFehler, Fall ${ab + k}`, ts, db[k], JSON.stringify(block[k]))
      }
    }
  }
}

/* ================ 3. Ganze Partien im Gleichschritt =============== */

let schuesse = 0
let aufgaben = 0
{
  const zufall = mulberry32(35)
  for (let n = 0; n < PARTIEN; n++) {
    const regeln = REGELSAETZE[n % REGELSAETZE.length]
    const beginner = n % 2
    let ts = sv.neuePartie(
      regeln,
      sv.zufallsFlotte(regeln, zufall),
      sv.zufallsFlotte(regeln, zufall),
      beginner,
    )
    let db = sql(
      `select public.sv_neue_partie(${lit(regeln)}, ${lit(ts.flotten[0])}, ${lit(ts.flotten[1])}, ${beginner})`,
    )
    geprueft++
    if (!gleich(ts, db)) {
      await melde(`Partie ${n}: Anfang`, ts, db)
      continue
    }
    const aufgabeBei = n % 5 === 0 ? Math.floor(zufall() * 120) : -1

    for (let zug = 0; zug < 260 && !ts.ende; zug++) {
      if (zug === aufgabeBei) {
        const wer = Math.floor(zufall() * 2)
        const nachTs = sv.gibAuf(ts, wer)
        const nachDb = sql(`select public.sv_aufgabe(${lit(db)}, ${wer})`)
        geprueft++
        aufgaben++
        if (!gleich(nachTs, nachDb)) await melde(`Partie ${n}: Aufgabe`, nachTs, nachDb)
        ts = nachTs
        db = nachDb
        break
      }
      // Meist ein freies Feld, manchmal ein schon beschossenes oder eins daneben.
      const r = zufall()
      const feld =
        r < 0.04 ? 100 + Math.floor(zufall() * 5) : r < 0.1 ? -1 : Math.floor(zufall() * 100)
      const nachTs = sv.schiesse(ts, feld)
      // Ein Schritt, drei Antworten: Zustand und beide Sichten.
      const antwort = sql(`
        with n as (select public.sv_schuss(${lit(db)}, ${feld}) as st)
        select jsonb_build_array(
          n.st,
          case when n.st is null then null else public.sv_sicht(n.st, 0) end,
          case when n.st is null then null else public.sv_sicht(n.st, 1) end)
        from n`)
      const [nachDb, sicht0, sicht1] = antwort
      geprueft++
      schuesse++
      if ((nachTs === null) !== (nachDb === null) || (nachTs && !gleich(nachTs, nachDb))) {
        await melde(
          `Partie ${n}, Schuss ${zug} auf ${feld}: Zustände laufen auseinander`,
          nachTs,
          nachDb,
        )
        break
      }
      if (!nachTs) continue
      for (const [ich, sicht] of [
        [0, sicht0],
        [1, sicht1],
      ]) {
        geprueft++
        const erwartet = sv.sichtFuer(nachTs, ich)
        if (!gleich(erwartet, sicht)) {
          await melde(`Partie ${n}, Schuss ${zug}: Sicht von Spieler ${ich}`, erwartet, sicht)
        }
        // Und das Wichtigste: Vor dem Ende kein unversenktes fremdes Schiff.
        if (!nachTs.ende) {
          const fremd = nachTs.flotten[1 - ich]
          for (const s of sicht.gegnerFlotte) {
            const original = fremd.find((x) => x.id === s.id)
            geprueft++
            if (!sv.istVersenkt(original, nachTs.schuesse[ich])) {
              await melde(`Partie ${n}: Sicht verrät ein unversenktes Schiff`, null, s)
            }
          }
        }
      }
      ts = nachTs
      db = nachDb
    }
  }
}

await server.close()

console.log(
  `\nFlotte, ${FLOTTEN} Aufstellungen, ${PARTIEN} Partien (${schuesse} Schüsse, ${aufgaben} Aufgaben)`,
)
console.log(`${geprueft} Vergleiche, ${fehler} Abweichungen`)
if (fehler > 0) process.exit(1)
console.log('ALLES DURCH')
