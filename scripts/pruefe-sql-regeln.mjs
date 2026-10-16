/**
 * Rechnet die SQL-Fassung der Kartenregeln gegen die TypeScript-Fassung.
 *
 * WARUM ES DAS GIBT. Weil die Hände verdeckt sind, muss der Server
 * mischen und jeden Zug prüfen (siehe docs/design/kartenspiele-online/).
 * Damit stehen die Regeln zweimal da: in src/games/maumau/ und in
 * supabase/migrations/023_kartenspiele_online.sql. Zwei Fassungen
 * derselben Regel laufen auseinander -- nicht beim Schreiben, sondern beim
 * dritten Mal, wenn jemand eine ändert. Dagegen hilft keine Sorgfalt, nur
 * eine Messung.
 *
 * Deshalb ist der Partiezustand in SQL ein jsonb-Blob in derselben Form
 * wie MauZustand, und die Regeln sind reine Funktionen darauf. Dieses
 * Skript schickt denselben Zustand und denselben Zug durch beide
 * Fassungen und vergleicht, was herauskommt -- Karte für Karte.
 *
 * Aufruf (braucht ein Postgres, in das man schreiben darf):
 *
 *   createdb mmtest
 *   psql -d mmtest -f supabase/migrations/pruefung/stub.sql   # auth-Teile
 *   psql -d mmtest -f supabase/migrations/023_kartenspiele_online.sql
 *   PGDATABASE=mmtest node scripts/pruefe-sql-regeln.mjs
 *
 * Gemessen wird dreierlei:
 *   1. Die Blätter -- 32 und 108 Karten, jede mit derselben Kennung,
 *      Farbe, Wirkung und Punktzahl.
 *   2. `passt()` über alle Lagen, die vorkommen können: jede Karte auf
 *      jede oberste Karte, mit und ohne Wunsch, mit und ohne offene
 *      Strafe, in jeder Hausregel-Kombination.
 *   3. Ganze Partien im Gleichschritt: SQL legt, TypeScript legt
 *      dasselbe, danach müssen beide Zustände übereinstimmen.
 *
 * Zuletzt gelaufen: siehe die Zeile am Ende der Ausgabe.
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

/* -------------------------------------------------------- Postgres */

const PSQL = process.env.PSQL ?? 'psql'
const ARGS = (process.env.PSQL_ARGS ?? '').split(' ').filter(Boolean)

/**
 * Eine Abfrage, deren Ergebnis eine einzige jsonb-Zelle ist.
 *
 * Die Abfrage geht durch die Standardeingabe, nicht als `-c`-Argument:
 * Ein Blatt mit 108 Karten in einer Lage ist schnell ein Megabyte, und
 * dafür ist eine Kommandozeile nicht gemacht (E2BIG).
 */
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

/** Ein Textliteral. Nicht lit(): das gäbe '"rot-5-1"' samt Anführungszeichen. */
function txt(wert) {
  return wert === null || wert === undefined ? 'null' : `'${String(wert).replaceAll("'", "''")}'`
}

/* ------------------------------------------------- TypeScript laden */

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error' })
const karten = await server.ssrLoadModule('/src/games/maumau/karten.ts')
const regelnMod = await server.ssrLoadModule('/src/games/maumau/regeln.ts')
const engine = await server.ssrLoadModule('/src/games/maumau/engine.ts')

let fehler = 0
let geprueft = 0

function melde(was, erwartet, bekommen, zusatz = '') {
  fehler++
  console.error(`\n✗ ${was}`)
  console.error(`  TypeScript: ${JSON.stringify(erwartet)}`)
  console.error(`  SQL:        ${JSON.stringify(bekommen)}`)
  if (zusatz) console.error(`  ${zusatz}`)
}

/* ====================== 1. Die Blätter ============================ */

for (const [art, bauen] of [
  ['klassisch', karten.franzoesischesBlatt],
  ['bunt', karten.buntesBlatt],
]) {
  const ts = bauen()
  const db = sql(`select public.mm_blatt('${art}')`)
  geprueft++
  if (db.length !== ts.length) {
    melde(`Blatt ${art}: Kartenzahl`, ts.length, db.length)
    continue
  }
  // Die Reihenfolge darf abweichen (gemischt wird ohnehin), der Inhalt nicht.
  const schluessel = (k) => `${k.id}|${k.farbe ?? '-'}|${k.text}|${k.wirkung}|${k.punkte}`
  const tsSatz = new Set(ts.map(schluessel))
  const dbSatz = new Set(db.map(schluessel))
  const fehlt = [...tsSatz].filter((s) => !dbSatz.has(s))
  const zuviel = [...dbSatz].filter((s) => !tsSatz.has(s))
  if (fehlt.length || zuviel.length) {
    melde(`Blatt ${art}: Inhalt`, fehlt.slice(0, 3), zuviel.slice(0, 3), 'fehlt / zu viel')
  }
}

/* ====================== 2. passt() über alles ===================== */

/**
 * Alle Hausregel-Kombinationen, die für `passt` einen Unterschied machen:
 * die fünf Konterschalter einzeln und zusammen, in jeder Spielart.
 */
const KONTER_FAELLE = [
  regelnMod.KEIN_KONTER,
  regelnMod.VOLLER_KONTER,
  { ...regelnMod.KEIN_KONTER, zweiAufZwei: true },
  { ...regelnMod.KEIN_KONTER, vierAufVier: true },
  { ...regelnMod.KEIN_KONTER, zweiAufVier: true },
  { ...regelnMod.KEIN_KONTER, vierAufZwei: true },
  { ...regelnMod.KEIN_KONTER, schwarzAufSchwarz: true },
  { ...regelnMod.VOLLER_KONTER, zweiAufZwei: false },
]

{
  /*
   * Je Spielart: jede Karte des Blattes als Hand- und als oberste Karte,
   * über alle Wünsche und drei Strafzustände -- bei 108 Karten sind das
   * 174 960 Lagen je Hausregel-Kombination.
   *
   * Das Kreuzprodukt bildet Postgres selbst. Es hinzuschicken wären
   * Megabyte an immer denselben Karten; so geht das Blatt einmal hin und
   * die Antworten kommen in einer festen Reihenfolge zurück, in der auch
   * die TypeScript-Seite rechnet.
   */
  for (const art of ['klassisch', 'bunt', 'extrem']) {
    const blatt = regelnMod.blattVon(art)
    const farben = art === 'klassisch' ? [...karten.FRANZ_FARBEN] : [...karten.BUNT_FARBEN]
    const wuensche = [null, ...farben]
    const strafen = [0, 2, 4]
    for (const konter of KONTER_FAELLE) {
      const regeln = regelnMod.aktiveRegeln(art, { konter })
      const db = sql(`
        with blatt as (
          select k, i from jsonb_array_elements(${lit(blatt)}) with ordinality as t(k, i)
        ),
        wunsch as (
          select w, i from jsonb_array_elements(${lit(wuensche)}) with ordinality as t(w, i)
        )
        select coalesce(jsonb_agg(public.mm_passt(
                 a.k, b.k, w.w #>> '{}', s.s, ${lit(regeln)})
                 order by a.i, b.i, w.i, s.s), '[]'::jsonb)
        from blatt a, blatt b, wunsch w, unnest(array[0, 2, 4]) as s(s)`)
      let n = 0
      for (const karte of blatt) {
        for (const oberste of blatt) {
          for (const wunsch of wuensche) {
            for (const strafe of strafen) {
              const ts = regelnMod.passt(karte, oberste, wunsch, strafe, regeln)
              geprueft++
              if (ts !== db[n]) {
                melde(
                  `passt(): ${art}, ${karte.id} auf ${oberste.id}`,
                  ts,
                  db[n],
                  `Wunsch ${wunsch ?? '-'}, Strafe ${strafe}, Konter ${JSON.stringify(konter)}`,
                )
                if (fehler > 20) {
                  await server.close()
                  process.exit(1)
                }
              }
              n++
            }
          }
        }
      }
    }
  }
}

/* ================ 3. Ganze Partien im Gleichschritt =============== */

/** Ein SQL-Zustand als MauZustand, damit die TS-Engine ihn annimmt. */
function zuTs(st) {
  return {
    spieler: st.spieler.map((s, i) => ({
      id: `p${i}`,
      name: s.name,
      mensch: false,
      kiStufe: null,
      hand: s.hand,
      mauGesagt: s.mau,
      platz: s.platz,
    })),
    amZug: st.am_zug,
    richtung: st.richtung,
    stapel: st.stapel,
    ablage: st.ablage,
    wunsch: st.wunsch,
    strafe: st.strafe,
    aussetzen: st.aussetzen,
    gezogene: st.gezogene,
    leerlauf: st.leerlauf,
    letzterLeger: st.letzter_leger === null ? null : `p${st.letzter_leger}`,
    phase: st.phase,
    siegerId: st.sieger === null ? null : `p${st.sieger}`,
    protokoll: [],
    seed: 1,
    zaehler: 0,
    regeln: st.regeln,
  }
}

/** Was verglichen wird -- alles außer dem Protokoll (das ist Anzeige). */
function kern(z) {
  return {
    haende: z.spieler.map((s) => s.hand.map((k) => k.id)),
    mau: z.spieler.map((s) => s.mauGesagt),
    platz: z.spieler.map((s) => s.platz),
    amZug: z.amZug,
    richtung: z.richtung,
    stapel: z.stapel.map((k) => k.id),
    ablage: z.ablage.map((k) => k.id),
    wunsch: z.wunsch,
    strafe: z.strafe,
    aussetzen: z.aussetzen,
    gezogene: z.gezogene?.id ?? null,
    leerlauf: z.leerlauf,
    phase: z.phase,
    sieger: z.siegerId,
  }
}

function gleich(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Weniger Partien, wenn es nur um einen schnellen Durchlauf geht. */
const PARTIEN = Number(process.env.PARTIEN ?? 8)

let partien = 0
let zuege = 0
let mischungen = 0

for (const art of ['klassisch', 'bunt', 'extrem']) {
  for (let runde = 0; runde < PARTIEN; runde++) {
    const anzahl = 2 + (runde % 3)
    const regeln = regelnMod.aktiveRegeln(art)
    const sitz = Array.from({ length: anzahl }, (_, i) => ({
      seat: i + 1,
      name: `S${i + 1}`,
    }))
    let st = sql(`select public.mm_e_erstelle(${lit(sitz)}, ${lit(regeln)})`)
    partien++

    // Die Handkartenzahl und der Stapel müssen von Anfang an stimmen.
    const gesamt =
      st.spieler.reduce((n, s) => n + s.hand.length, 0) + st.stapel.length + st.ablage.length
    geprueft++
    if (gesamt !== regelnMod.blattVon(art).length) {
      melde(`${art}: Karten gehen verloren beim Geben`, regelnMod.blattVon(art).length, gesamt)
    }
    geprueft++
    if (st.ablage[0].wirkung !== 'keine') {
      melde(`${art}: erste Karte ist eine Aktionskarte`, 'keine', st.ablage[0].wirkung)
    }

    for (let zug = 0; zug < 300 && st.phase === 'laeuft'; zug++) {
      const ts = zuTs(st)
      const idx = st.am_zug
      const spieler = ts.spieler[idx]
      const moeglich = engine.meineSpielbaren(ts, spieler)
      const vorMisch = st.stapel.length

      let nachSql
      let nachTs
      if (moeglich.length > 0) {
        const karte = moeglich[zug % moeglich.length]
        // Vor dem Legen der vorletzten Karte sagt die Hälfte Mau -- damit
        // beide Fassungen die Strafe und das Vergessen zu sehen bekommen.
        if (spieler.hand.length === 2 && zug % 2 === 0) {
          st = sql(`select public.mm_e_mau(${lit(st)}, ${idx})`)
          ts.spieler[idx].mauGesagt = true
        }
        const wunsch =
          karte.wirkung === 'wunsch' || karte.wirkung === 'zieh4'
            ? (art === 'klassisch' ? karten.FRANZ_FARBEN : karten.BUNT_FARBEN)[zug % 4]
            : null
        nachSql = sql(
          `select public.mm_e_legen(${lit(st)}, ${idx}, ${txt(karte.id)}, ${txt(wunsch)})`,
        )
        nachTs = engine.legen(zuTs(st), karte, wunsch ?? undefined)
      } else if (st.gezogene) {
        nachSql = sql(`select public.mm_e_behalten(${lit(st)}, ${idx})`)
        nachTs = engine.behalten(ts)
      } else {
        nachSql = sql(`select public.mm_e_ziehen(${lit(st)}, ${idx})`)
        nachTs = engine.ziehen(ts)
      }
      zuege++

      // Wurde neu gemischt, ist die Reihenfolge des Stapels Zufall --
      // dann vergleichen wir, was vergleichbar bleibt, und machen mit dem
      // SQL-Stand weiter.
      const neuGemischt = nachSql.stapel.length > vorMisch
      if (neuGemischt) {
        mischungen++
        geprueft++
        const summe =
          nachSql.spieler.reduce((n, s) => n + s.hand.length, 0) +
          nachSql.stapel.length +
          nachSql.ablage.length
        if (summe !== regelnMod.blattVon(art).length) {
          melde(
            `${art}: Karten gehen beim Neumischen verloren`,
            regelnMod.blattVon(art).length,
            summe,
          )
        }
        st = nachSql
        continue
      }

      geprueft++
      const a = kern(nachTs)
      const b = kern(zuTs(nachSql))
      if (!gleich(a, b)) {
        const abweichend = Object.keys(a).filter((k) => !gleich(a[k], b[k]))
        melde(
          `${art}, ${anzahl} Spieler, Zug ${zug}: Zustände laufen auseinander`,
          Object.fromEntries(abweichend.map((k) => [k, a[k]])),
          Object.fromEntries(abweichend.map((k) => [k, b[k]])),
        )
        if (fehler > 5) {
          await server.close()
          process.exit(1)
        }
      }
      st = nachSql
    }
  }
}

await server.close()

console.log(
  `\nBlätter, passt() und ${partien} Partien (${zuege} Züge, ${mischungen} Neumischungen)`,
)
console.log(`${geprueft} Vergleiche, ${fehler} Abweichungen`)
if (fehler > 0) process.exit(1)
console.log('ALLES DURCH')
