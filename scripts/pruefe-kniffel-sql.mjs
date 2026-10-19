/**
 * Rechnet die SQL-Fassung der Kniffel-Wertung gegen die TypeScript-Fassung.
 *
 * WARUM ES DAS GIBT. Beim Kniffel *ist* der Würfel das Spiel, also würfelt
 * und rechnet online der Server (Migration 017). Damit steht die Wertung
 * zweimal da, und AGENTS.md sagt: wer eine Regel ändert, ändert beide
 * Seiten. Das war bisher eine Zusage ohne Messung -- bei den Kartenspielen
 * (023/024) gibt es sie, hier fehlte sie. Mit dem Zusatzkniffel (025) kam
 * eine Regel dazu, die in beiden Fassungen an derselben feinen Stelle
 * hängt (Block VOR dem Eintragen), also jetzt auch hier.
 *
 * Gemessen wird dreierlei:
 *
 *   1. `kniffel_punkte` gegen `punkteFuer()` -- über ALLE 252 möglichen
 *      Würfe mal alle dreizehn Felder. Nicht zufällig: Es sind so wenige,
 *      dass Vollständigkeit billiger ist als eine Stichprobe.
 *   2. `kniffel_gesamt` gegen `gesamtpunkte()` -- über zufällige Blöcke,
 *      mit und ohne Zusatzkniffel, einschliesslich der Grenze beim
 *      oberen Bonus (62/63 Punkte).
 *   3. `kniffel_ist_kniffel` gegen die Bedingung „fünf gleiche".
 *
 * Aufruf (braucht ein Postgres, in das man schreiben darf):
 *
 *   createdb kniffeltest
 *   psql -d kniffeltest -f supabase/migrations/pruefung/stub.sql
 *   psql -d kniffeltest -f supabase/migrations/017_kniffel.sql
 *   psql -d kniffeltest -f supabase/migrations/025_zusatzkniffel.sql
 *   PSQL_ARGS="-d kniffeltest" node scripts/pruefe-kniffel-sql.mjs
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const PSQL = process.env.PSQL ?? 'psql'
const ARGS = (process.env.PSQL_ARGS ?? '').split(' ').filter(Boolean)

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

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
const regeln = await server.ssrLoadModule('/src/games/kniffel/regeln.ts')

let fehler = 0
let geprueft = 0

function melde(was, erwartet, bekommen, zusatz = '') {
  fehler++
  console.error(`\n✗ ${was}`)
  console.error(`  TypeScript: ${JSON.stringify(erwartet)}`)
  console.error(`  SQL:        ${JSON.stringify(bekommen)}`)
  if (zusatz) console.error(`  ${zusatz}`)
}

/* ============== 1. punkteFuer() über alle Würfe =================== */

/** Alle 252 Würfe aus fünf Würfeln, Reihenfolge ohne Bedeutung. */
function alleWuerfe() {
  const aus = []
  const bauen = (rest, ab, bisher) => {
    if (rest === 0) {
      aus.push([...bisher])
      return
    }
    for (let w = ab; w <= 6; w++) {
      bisher.push(w)
      bauen(rest - 1, w, bisher)
      bisher.pop()
    }
  }
  bauen(5, 1, [])
  return aus
}

{
  const wuerfe = alleWuerfe()
  const felder = [...regeln.KATEGORIE_IDS]
  const db = sql(`
    with w as (
      select wurf, i from jsonb_array_elements(${lit(wuerfe)}) with ordinality as t(wurf, i)
    ),
    f as (
      select feld, j from jsonb_array_elements_text(${lit(felder)}) with ordinality as t(feld, j)
    )
    select coalesce(jsonb_agg(public.kniffel_punkte(
             f.feld,
             (select array_agg((x)::int) from jsonb_array_elements_text(w.wurf) x)
           ) order by w.i, f.j), '[]'::jsonb)
    from w, f`)
  let n = 0
  for (const wurf of wuerfe) {
    for (const feld of felder) {
      const ts = regeln.punkteFuer(feld, wurf)
      geprueft++
      if (ts !== db[n]) {
        melde(`kniffel_punkte(${feld}, ${wurf.join('')})`, ts, db[n])
        if (fehler > 20) {
          await server.close()
          process.exit(1)
        }
      }
      n++
    }
  }
  console.log(`punkteFuer(): ${wuerfe.length} Würfe × ${felder.length} Felder`)
}

/* ================= 2. gesamtpunkte() über Blöcke ================== */

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

{
  const zufall = rng(19102026)
  const felder = [...regeln.KATEGORIE_IDS]
  const bloecke = []

  // Gezielt die Grenze des oberen Bonus -- dort entscheidet sich 35.
  for (const summe of [0, 61, 62, 63, 64]) {
    const block = regeln.leererBlock()
    // Die Summe oben aus Sechsern und Fünfern zusammensetzen.
    let rest = summe
    block.sechser = Math.min(30, rest - (rest % 6))
    rest -= block.sechser
    block.fuenfer = Math.min(25, rest - (rest % 5))
    rest -= block.fuenfer
    block.einser = rest
    bloecke.push(block)
    bloecke.push({ ...block, zusatzkniffel: 100 })
    bloecke.push({ ...block, kniffel: 50, zusatzkniffel: 300 })
  }

  for (let i = 0; i < 2000; i++) {
    const block = regeln.leererBlock()
    for (const f of felder) {
      // Manche Felder bleiben frei -- ein halb gefüllter Block ist der
      // Normalfall, nicht die Ausnahme.
      if (zufall() < 0.25) continue
      block[f] = Math.floor(zufall() * (regeln.punkteFuer(f, [6, 6, 6, 6, 6]) + 1))
    }
    if (zufall() < 0.5) block.zusatzkniffel = 100 * (1 + Math.floor(zufall() * 4))
    bloecke.push(block)
  }

  const db = sql(`
    select coalesce(jsonb_agg(public.kniffel_gesamt(b) order by i), '[]'::jsonb)
    from jsonb_array_elements(${lit(bloecke.map(ohneNull))}) with ordinality as t(b, i)`)
  for (let i = 0; i < bloecke.length; i++) {
    const ts = regeln.gesamtpunkte(bloecke[i])
    geprueft++
    if (ts !== db[i]) {
      melde(`kniffel_gesamt()`, ts, db[i], JSON.stringify(bloecke[i]))
      if (fehler > 10) {
        await server.close()
        process.exit(1)
      }
    }
  }
  console.log(`gesamtpunkte(): ${bloecke.length} Blöcke`)
}

/**
 * Der Server kennt nur beschriebene Felder -- ein `null` steht dort gar
 * nicht erst im jsonb. Ohne diese Umformung verglichen wir zwei
 * verschiedene Darstellungen desselben Blocks.
 */
function ohneNull(block) {
  return Object.fromEntries(Object.entries(block).filter(([, v]) => v !== null && v !== undefined))
}

/* ================== 3. Fünf gleiche =============================== */

{
  const wuerfe = [...alleWuerfe(), [0, 0, 0, 0, 0], [6, 6, 6, 6], [1, 1, 1, 1, 1, 1]]
  const db = sql(`
    select coalesce(jsonb_agg(public.kniffel_ist_kniffel(
             (select array_agg((x)::int) from jsonb_array_elements_text(w) x)) order by i), '[]'::jsonb)
    from jsonb_array_elements(${lit(wuerfe)}) with ordinality as t(w, i)`)
  for (let i = 0; i < wuerfe.length; i++) {
    const w = wuerfe[i]
    // Fünf Würfel, alle 1..6, alle gleich.
    const ts = w.length === 5 && w.every((x) => x >= 1 && x <= 6 && x === w[0])
    geprueft++
    if (ts !== db[i]) melde(`kniffel_ist_kniffel(${w.join(',')})`, ts, db[i])
  }
  console.log(`ist_kniffel(): ${wuerfe.length} Würfe`)
}

await server.close()
console.log(`\n${geprueft} Vergleiche, ${fehler} Abweichungen`)
if (fehler > 0) process.exit(1)
console.log('ALLES DURCH')
