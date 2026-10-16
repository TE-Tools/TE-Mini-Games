/**
 * Rechnet die SQL-Fassung von Texas Hold'em gegen die TypeScript-Fassung.
 *
 * WARUM ES DAS GIBT. Zwei verdeckte Karten sind beim Hold'em das ganze
 * Spiel, also mischt und prüft der Server (siehe
 * docs/design/kartenspiele-online/). Damit stehen Wertung und Ablauf
 * zweimal da: in src/games/texas-holdem/ und in
 * supabase/migrations/024_texas_online.sql.
 *
 * Die Handwertung ist dabei die Stelle, an der solche Nachbauten falsch
 * sind -- in diesem Projekt sind in der TypeScript-Fassung schon zwei
 * Fehler gefunden worden, und zwar nicht durch Lesen, sondern durch
 * Gegenrechnen. Also hier genauso:
 *
 *   1. Das Blatt: 52 Karten, dieselben.
 *   2. Die Wertung: zehntausende zufällige Siebenerblätter, dazu die
 *      Fälle, auf die es ankommt (Rad, Royal, zwei Drillinge als Full
 *      House, drei Paare, Flush gegen Strasse).
 *   3. Die Nebenpots: zufällige Einsatzlagen durch beide Fassungen.
 *   4. Ganze Hände im Gleichschritt: Der Server teilt aus, danach machen
 *      beide Fassungen denselben Zug -- und müssen danach denselben
 *      Zustand haben, Chip für Chip. Verglichen wird auch, was jede
 *      Fassung für erlaubt hält (`moeglichkeiten`), denn ein Zustand, der
 *      stimmt, nützt nichts, wenn die Knöpfe anderes anbieten.
 *
 * Aufruf (braucht ein Postgres, in das man schreiben darf):
 *
 *   createdb thtest
 *   psql -d thtest -f supabase/migrations/pruefung/stub.sql
 *   psql -d thtest -f supabase/migrations/024_texas_online.sql
 *   PSQL_ARGS="-d thtest" node scripts/pruefe-texas-sql.mjs
 *
 * BLAETTER=50000 setzt die Zahl der geprüften Blätter, PARTIEN die der
 * Turniere.
 */
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const PSQL = process.env.PSQL ?? 'psql'
const ARGS = (process.env.PSQL_ARGS ?? '').split(' ').filter(Boolean)
const BLAETTER = Number(process.env.BLAETTER ?? 20000)
const PARTIEN = Number(process.env.PARTIEN ?? 6)

/** Abfrage über die Standardeingabe -- eine Kommandozeile ist zu klein. */
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
const karten = await server.ssrLoadModule('/src/games/texas-holdem/karten.ts')
const wertung = await server.ssrLoadModule('/src/games/texas-holdem/wertung.ts')
const engine = await server.ssrLoadModule('/src/games/texas-holdem/engine.ts')
const config = await server.ssrLoadModule('/src/games/texas-holdem/config.ts')

let fehler = 0
let geprueft = 0

function melde(was, erwartet, bekommen, zusatz = '') {
  fehler++
  console.error(`\n✗ ${was}`)
  console.error(`  TypeScript: ${JSON.stringify(erwartet)}`)
  console.error(`  SQL:        ${JSON.stringify(bekommen)}`)
  if (zusatz) console.error(`  ${zusatz}`)
}

/**
 * Gleich, ohne auf die Reihenfolge der Schlüssel zu achten.
 *
 * Postgres gibt jsonb-Objekte nach eigener Ordnung heraus (kurze
 * Schlüssel zuerst). Ein Vergleich über JSON.stringify hielte
 * {"folden":true,"schieben":false} und {"schieben":false,"folden":true}
 * für verschieden -- und hätte diese Prüfung mit einer Meldung
 * beschäftigt, in der beide Seiten dasselbe sagen.
 */
function norm(x) {
  if (Array.isArray(x)) return x.map(norm)
  if (x && typeof x === 'object') {
    return Object.fromEntries(
      Object.keys(x)
        .sort()
        .map((k) => [k, norm(x[k])]),
    )
  }
  return x
}

function gleich(a, b) {
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

/** Ein eigener Zufall mit Startwert -- damit ein Fund nachspielbar ist. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/* ======================= 1. Das Blatt ============================= */

{
  const ts = karten.neuesDeck()
  const db = sql('select public.th_deck()')
  geprueft++
  const schluessel = (k) => `${k.wert}${k.farbe}`
  const a = [...ts.map(schluessel)].sort()
  const b = [...db.map(schluessel)].sort()
  if (!gleich(a, b)) melde('Blatt', a.length, b.length, 'Inhalt weicht ab')
}

/* ====================== 2. Die Wertung ============================ */

const WICHTIGE_FAELLE = [
  ['As Ks Qs Js Ts', 'Royal Flush'],
  ['As 2h 3s 4s 5s', 'Rad als Strasse (Ass unten)'],
  ['As 2s 3s 4s 5s', 'Rad als Straight Flush'],
  ['Ks As 2s 3s 4s', 'K-A-2 ist keine Strasse'],
  ['7h 7d 7s 8h 8d', 'Full House'],
  ['7h 7d 7s 8h 8d 8s 2c', 'Zwei Drillinge -- das hoehere zaehlt'],
  ['Ah Ad Kh Kd Qh Qd 2c', 'Drei Paare -- nur die zwei hoechsten'],
  ['2h 3h 4h 5h 6h 7s 8s', 'Straight Flush gegen hoehere Strasse'],
  ['Ah Kh Qh Jh 9h 8h 2h', 'Flush aus sieben gleichen Farben'],
  ['Ah Ad Ac As Kh Kd 2c', 'Vierling mit Paar daneben'],
  ['Th Td 9h 9d 8h 8d 7c', 'Drei Paare, Kicker ist das dritte Paar'],
  ['Ah Kd', 'Nur zwei Karten -- vor dem Flop'],
]

for (const [text, warum] of WICHTIGE_FAELLE) {
  const hand = karten.kartenAus(text)
  const ts = wertung.besteHand(hand)
  const db = sql(`select public.th_beste_hand(${lit(hand)})`)
  geprueft++
  if (ts.klasse !== db.klasse || !gleich(ts.werte, db.werte)) {
    melde(
      `besteHand(): ${text} (${warum})`,
      { klasse: ts.klasse, werte: ts.werte },
      db,
      wertung.handText(ts),
    )
  }
}

{
  /*
   * Zufällige Siebenerblätter. Sie gehen in Bündeln hinüber, nicht
   * einzeln: Ein psql-Aufruf je Blatt wären zwanzigtausend Prozesse.
   */
  const zufall = rng(20261016)
  const deck = karten.neuesDeck()
  const buendel = 500
  let n = 0
  while (n < BLAETTER) {
    const lagen = []
    for (let i = 0; i < buendel && n < BLAETTER; i++, n++) {
      const misch = [...deck]
      for (let j = misch.length - 1; j > 0; j--) {
        const k = Math.floor(zufall() * (j + 1))
        ;[misch[j], misch[k]] = [misch[k], misch[j]]
      }
      lagen.push(misch.slice(0, 7))
    }
    const db = sql(`
      select coalesce(jsonb_agg(public.th_beste_hand(h) order by i), '[]'::jsonb)
      from jsonb_array_elements(${lit(lagen)}) with ordinality as t(h, i)`)
    for (let i = 0; i < lagen.length; i++) {
      const ts = wertung.besteHand(lagen[i])
      geprueft++
      if (ts.klasse !== db[i].klasse || !gleich(ts.werte, db[i].werte)) {
        melde(
          `besteHand(): ${lagen[i].map(karten.karteText).join(' ')}`,
          { klasse: ts.klasse, werte: ts.werte },
          db[i],
          wertung.handText(ts),
        )
        if (fehler > 10) {
          await server.close()
          process.exit(1)
        }
      }
    }
  }
}

{
  // Und der Vergleich selbst: Paare von Blättern, beide Richtungen.
  const zufall = rng(777)
  const deck = karten.neuesDeck()
  const paare = []
  for (let i = 0; i < 2000; i++) {
    const zieh = () => {
      const aus = []
      while (aus.length < 7) {
        const k = deck[Math.floor(zufall() * deck.length)]
        if (!aus.includes(k)) aus.push(k)
      }
      return aus
    }
    paare.push([wertung.besteHand(zieh()), wertung.besteHand(zieh())])
  }
  const db = sql(`
    select coalesce(jsonb_agg(public.th_vergleiche(p -> 0, p -> 1) order by i), '[]'::jsonb)
    from jsonb_array_elements(${lit(
      paare.map(([a, b]) => [
        { klasse: a.klasse, werte: a.werte },
        { klasse: b.klasse, werte: b.werte },
      ]),
    )})
         with ordinality as t(p, i)`)
  for (let i = 0; i < paare.length; i++) {
    const ts = wertung.vergleicheHand(paare[i][0], paare[i][1])
    geprueft++
    // Nur das Vorzeichen zählt -- die Zahl selbst ist nirgends Bedeutung.
    if (Math.sign(ts) !== Math.sign(db[i])) {
      melde(`vergleicheHand(): Paar ${i}`, Math.sign(ts), Math.sign(db[i]))
    }
  }
}

/* ===================== 3. Die Nebenpots =========================== */

{
  const zufall = rng(4242)
  const lagen = []
  for (let i = 0; i < 1500; i++) {
    const anzahl = 2 + Math.floor(zufall() * 5)
    const spieler = []
    for (let s = 0; s < anzahl; s++) {
      spieler.push({
        seat: s + 1,
        gesamt: Math.floor(zufall() * 5) === 0 ? 0 : Math.floor(zufall() * 600),
        status: ['aktiv', 'allin', 'gefoldet', 'raus'][Math.floor(zufall() * 4)],
      })
    }
    lagen.push(spieler)
  }
  const db = sql(`
    select coalesce(jsonb_agg(public.th_schichten(l) order by i), '[]'::jsonb)
    from jsonb_array_elements(${lit(lagen)}) with ordinality as t(l, i)`)
  for (let i = 0; i < lagen.length; i++) {
    const ts = engine
      .schichten(lagen[i].map((s) => ({ id: String(s.seat), gesamt: s.gesamt, status: s.status })))
      .map((s) => ({ betrag: s.betrag, berechtigte: s.berechtigte.map(Number) }))
    geprueft++
    if (!gleich(ts, db[i])) {
      melde(`schichten(): Lage ${i}`, ts, db[i], JSON.stringify(lagen[i]))
      if (fehler > 5) {
        await server.close()
        process.exit(1)
      }
    }
  }
}

/* ============ 4. Ganze Haende im Gleichschritt ==================== */

const AUFBAU = {
  start_chips: config.START_CHIPS,
  haende_je_stufe: config.HAENDE_JE_STUFE,
  blinds: config.BLIND_STUFEN.map((b) => ({ klein: b.klein, gross: b.gross })),
}

/** Ein SQL-Zustand als TexasZustand -- alle als Rechner, keiner als Mensch. */
function zuTs(st) {
  return {
    spieler: st.spieler.map((s) => ({
      id: `s${s.seat}`,
      name: s.name,
      // Bewusst niemand als Mensch: Die Engine beendet sonst das Turnier,
      // sobald der Mensch draussen ist -- online laeuft es weiter. Genau
      // dieser Unterschied steht in der Migration, und so ist er aus dem
      // Vergleich heraus.
      mensch: false,
      kiStufe: null,
      chips: s.chips,
      einsatz: s.einsatz,
      gesamt: s.gesamt,
      karten: s.karten,
      status: s.status,
      gehandelt: s.gehandelt,
      platz: s.platz,
    })),
    dealer: st.dealer,
    handNr: st.hand_nr,
    blindStufe: st.blind_stufe,
    phase: st.phase,
    board: st.board,
    pot: st.pot,
    hoechsterEinsatz: st.hoechster,
    letzteErhoehung: st.letzte_erhoehung,
    amZug: st.am_zug,
    deck: st.deck,
    seed: 1,
    protokoll: [],
    ergebnis: null,
    siegerId: st.sieger === null ? null : `s${st.spieler[st.sieger]?.seat}`,
  }
}

function kern(z) {
  return {
    chips: z.spieler.map((s) => s.chips),
    einsatz: z.spieler.map((s) => s.einsatz),
    gesamt: z.spieler.map((s) => s.gesamt),
    status: z.spieler.map((s) => s.status),
    gehandelt: z.spieler.map((s) => s.gehandelt),
    platz: z.spieler.map((s) => s.platz),
    karten: z.spieler.map((s) => s.karten.map(karten.karteText).join('')),
    dealer: z.dealer,
    handNr: z.handNr,
    blindStufe: z.blindStufe,
    phase: z.phase,
    board: z.board.map(karten.karteText).join(' '),
    pot: z.pot,
    hoechster: z.hoechsterEinsatz,
    letzteErhoehung: z.letzteErhoehung,
    amZug: z.amZug,
    deckRest: z.deck.length,
  }
}

/** Die Auszahlung, in einer Form, die beide Fassungen vergleichbar macht. */
function auszahlung(tsZustand, sqlSt) {
  const ts = (tsZustand.ergebnis?.anteile ?? [])
    .map((a) => ({
      seat: Number(a.spielerId.slice(1)),
      betrag: a.betrag,
      klasse: a.hand?.klasse ?? null,
      werte: a.hand?.werte ?? null,
    }))
    .sort((a, b) => a.seat - b.seat)
  const db = ((sqlSt.ergebnis?.anteile ?? []) || [])
    .map((a) => ({
      seat: a.seat,
      betrag: a.betrag,
      klasse: a.hand?.klasse ?? null,
      werte: a.hand?.werte ?? null,
    }))
    .sort((a, b) => a.seat - b.seat)
  return [ts, db]
}

let haende = 0
let aktionen = 0

for (let partie = 0; partie < PARTIEN; partie++) {
  const anzahl = 2 + (partie % 5)
  const sitz = Array.from({ length: anzahl }, (_, i) => ({ seat: i + 1, name: `S${i + 1}` }))
  let st = sql(`select public.th_e_erstelle(${lit(sitz)}, ${lit(AUFBAU)})`)
  const zufall = rng(1000 + partie)

  for (let runde = 0; runde < 400 && st.phase !== 'ende'; runde++) {
    if (st.phase === 'showdown') {
      // Ausgezahlt ist ausgezahlt; die naechste Hand mischt neu, also
      // geht es danach mit dem SQL-Stand weiter.
      haende++
      const summe = st.spieler.reduce((n, s) => n + s.chips, 0) + st.pot
      geprueft++
      if (summe !== anzahl * config.START_CHIPS) {
        melde(
          `Chips verschwinden (Hand ${st.hand_nr}, ${anzahl} Spieler)`,
          anzahl * config.START_CHIPS,
          summe,
        )
      }
      st = sql(`select public.th_e_naechste_hand(${lit(st)})`)
      continue
    }

    const ts = zuTs(st)
    const idx = st.am_zug
    const moeglTs = engine.moeglichkeiten(ts)
    const moeglDb = sql(`select public.th_e_moeglichkeiten(${lit(st)})`)
    geprueft++
    const normTs = {
      folden: moeglTs.folden,
      schieben: moeglTs.schieben,
      mitgehen: moeglTs.mitgehen,
      erhoehen: moeglTs.erhoehen,
    }
    if (!gleich(normTs, moeglDb)) {
      melde(`moeglichkeiten(): Hand ${st.hand_nr}, Platz ${idx}`, normTs, moeglDb)
      if (fehler > 5) {
        await server.close()
        process.exit(1)
      }
      break
    }

    // Eine erlaubte Aktion auswählen -- gewürfelt, aber nachspielbar.
    const wahl = []
    if (moeglTs.schieben) wahl.push({ art: 'schieben' })
    if (moeglTs.mitgehen !== null) wahl.push({ art: 'mitgehen' })
    if (moeglTs.folden) wahl.push({ art: 'folden' })
    if (moeglTs.erhoehen) {
      const { min, max } = moeglTs.erhoehen
      wahl.push({ art: 'erhoehen', auf: min })
      wahl.push({ art: 'erhoehen', auf: Math.min(max, min * 2) })
      wahl.push({ art: 'erhoehen', auf: max })
    }
    if (wahl.length === 0) break
    const aktion = wahl[Math.floor(zufall() * wahl.length)]
    aktionen++

    const nachTs = engine.handle(ts, aktion)
    const nachSql = sql(`select public.th_e_handle(${lit(st)}, ${idx}, ${lit(aktion)})`)

    geprueft++
    const a = kern(nachTs)
    const b = kern(zuTs(nachSql))
    if (!gleich(a, b)) {
      const ab = Object.keys(a).filter((k) => !gleich(a[k], b[k]))
      melde(
        `Hand ${st.hand_nr}, ${anzahl} Spieler, ${JSON.stringify(aktion)}: Zustände laufen auseinander`,
        Object.fromEntries(ab.map((k) => [k, a[k]])),
        Object.fromEntries(ab.map((k) => [k, b[k]])),
      )
      if (fehler > 5) {
        await server.close()
        process.exit(1)
      }
      break
    }

    if (nachSql.phase === 'showdown' || nachSql.phase === 'ende') {
      const [eTs, eDb] = auszahlung(nachTs, nachSql)
      geprueft++
      if (!gleich(eTs, eDb)) {
        melde(`Auszahlung Hand ${st.hand_nr}`, eTs, eDb)
        if (fehler > 5) {
          await server.close()
          process.exit(1)
        }
      }
    }
    st = nachSql
  }
}

await server.close()

console.log(
  `\nBlatt, Wertung (${BLAETTER} Blätter), Nebenpots und ${PARTIEN} Turniere ` +
    `(${haende} Hände, ${aktionen} Aktionen)`,
)
console.log(`${geprueft} Vergleiche, ${fehler} Abweichungen`)
if (fehler > 0) process.exit(1)
console.log('ALLES DURCH')
