/**
 * Die Bilder im Kopf der Spielmenüs -- von Hand gezeichnet, als SVG.
 *
 * Eigene Entwürfe: einfache Würfel, ein Fächer aus Karten, Chips, eine
 * Brettecke, ein Festzelt. Nichts davon ist einem Handelsprodukt
 * nachgebaut (AGENTS.md): Die bunten Karten von „Letzte Karte“ haben
 * eigene Farben und einen eckigen Rahmen statt eines Ovals.
 *
 * Die Bewegung (leichtes Schweben) steht in SpielHero.module.css und
 * schweigt bei prefers-reduced-motion.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { MenueSpiel } from './statistik'
import styles from './SpielHero.module.css'

/** Textdarstellung erzwingen: ♥ ♠ ♣ ♦ ♞ würden sonst mancherorts zu Emoji. */
const TEXT = '︎'

const BREITE = 240
const HOEHE = 140

function Schwebt({ verzug = 0, children }: { verzug?: number; children: ReactNode }) {
  return (
    <g className={styles.schwebt} style={{ '--verzug': `${verzug}s` } as CSSProperties}>
      {children}
    </g>
  )
}

/* ---------------------------------------------------------------- Dame */

/** Ein Damestein von schräg vorn: Rand, Oberseite, eine Rille; die Dame mit Krone. */
function DameStein({
  x,
  y,
  hell,
  krone = false,
}: {
  x: number
  y: number
  hell: boolean
  krone?: boolean
}) {
  const oben = hell ? '#fffaf0' : '#3b322d'
  const rand = hell ? '#d8c4a3' : '#141010'
  const rille = hell ? '#cdb592' : '#5a4d46'
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -12 0 v4 a12 7.5 0 0 0 24 0 v-4 z" fill={rand} />
      <ellipse rx={12} ry={7.5} fill={oben} stroke={rand} strokeWidth={0.8} />
      <ellipse rx={7.5} ry={4.6} fill="none" stroke={rille} strokeWidth={1.2} />
      {krone && (
        <path
          d="M -6 2 l-1.5 -8 l4.5 3.5 l3 -5.5 l3 5.5 l4.5 -3.5 l-1.5 8 z"
          fill="#facc15"
          stroke="#a16207"
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      )}
    </g>
  )
}

function BildDame() {
  const feld = 28
  const links = 50
  const oben = 48
  const felder: ReactNode[] = []
  for (let reihe = 0; reihe < 3; reihe++) {
    for (let spalte = 0; spalte < 5; spalte++) {
      felder.push(
        <rect
          key={`${reihe}-${spalte}`}
          x={links + spalte * feld}
          y={oben + reihe * feld}
          width={feld}
          height={feld}
          fill={(reihe + spalte) % 2 === 0 ? '#f6ecdc' : '#a87650'}
        />,
      )
    }
  }
  const mitte = (spalte: number, reihe: number) => ({
    x: links + spalte * feld + feld / 2,
    y: oben + reihe * feld + feld / 2,
  })
  const a = mitte(0, 2)
  const b = mitte(2, 0)
  return (
    <>
      <rect
        x={links - 4}
        y={oben - 4}
        width={feld * 5 + 8}
        height={feld * 3 + 8}
        rx={6}
        fill="#4a280c"
      />
      {felder}
      <DameStein {...mitte(3, 1)} hell={false} />
      <DameStein {...mitte(1, 1)} hell={false} />
      {/* Der Sprung: über den schwarzen Stein hinweg */}
      <path
        d={`M ${a.x} ${a.y - 8} Q ${a.x + feld / 2} ${b.y - 30} ${b.x} ${b.y - 10}`}
        fill="none"
        stroke="#fde68a"
        strokeWidth={2.5}
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <Schwebt verzug={0}>
        <DameStein {...b} hell />
      </Schwebt>
      <Schwebt verzug={0.8}>
        <DameStein x={mitte(4, 2).x} y={mitte(4, 2).y - 4} hell krone />
      </Schwebt>
      <Schwebt verzug={1.3}>
        <DameStein x={28} y={44} hell={false} krone />
      </Schwebt>
    </>
  )
}

/* --------------------------------------------------------------- Mühle */

/** Ein Mühlestein von oben: flache Scheibe mit Rille und Glanzlicht. */
function MuehleStein({ x, y, hell, r = 9 }: { x: number; y: number; hell: boolean; r?: number }) {
  const flaeche = hell ? '#fbf7ee' : '#334155'
  const rand = hell ? '#b9ab90' : '#0f172a'
  const rille = hell ? '#d9ccb2' : '#475569'
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={rand} />
      <circle r={r - 1.4} fill={flaeche} />
      <circle r={r * 0.55} fill="none" stroke={rille} strokeWidth={1.2} />
      <ellipse
        cx={-r * 0.35}
        cy={-r * 0.4}
        rx={r * 0.32}
        ry={r * 0.18}
        fill="#ffffff"
        opacity={0.45}
      />
    </g>
  )
}

function BildMuehle() {
  const mx = 120
  const my = 70
  const ringe = [58, 38, 18]
  // Punkt eines Rings: Linie und Reihe von -1 bis 1.
  const p = (ring: number, sx: number, sy: number) => ({
    x: mx + sx * ringe[ring]!,
    y: my + sy * ringe[ring]!,
  })
  const punkte: { x: number; y: number }[] = []
  for (let ring = 0; ring < 3; ring++) {
    for (const [sx, sy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ] as const) {
      punkte.push(p(ring, sx, sy))
    }
  }
  const a = p(0, -1, -1)
  const c = p(0, 1, -1)
  return (
    <>
      <rect x={mx - 70} y={my - 66} width={140} height={132} rx={10} fill="#f3ead9" />
      <rect
        x={mx - 70}
        y={my - 66}
        width={140}
        height={132}
        rx={10}
        fill="none"
        stroke="#d6c4a3"
        strokeWidth={2}
      />
      <g fill="none" stroke="#3f3a36" strokeWidth={2}>
        {ringe.map((h) => (
          <rect key={h} x={mx - h} y={my - h} width={2 * h} height={2 * h} />
        ))}
        <path
          d={`M ${mx} ${my - 58} V ${my - 18} M ${mx} ${my + 18} V ${my + 58} M ${mx - 58} ${my} H ${mx - 18} M ${mx + 18} ${my} H ${mx + 58}`}
        />
      </g>
      {punkte.map((q, i) => (
        <circle key={i} cx={q.x} cy={q.y} r={2.6} fill="#3f3a36" />
      ))}
      {/* Die Mühle: drei weiße Steine oben, die Linie leuchtet. */}
      <line
        x1={a.x}
        y1={a.y}
        x2={c.x}
        y2={c.y}
        stroke="#fbbf24"
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.75}
      />
      <MuehleStein {...p(0, -1, -1)} hell />
      <MuehleStein {...p(0, 0, -1)} hell />
      <MuehleStein {...p(0, 1, -1)} hell />
      <MuehleStein {...p(1, -1, 0)} hell={false} />
      <MuehleStein {...p(1, 0, 1)} hell={false} />
      <MuehleStein {...p(2, 1, 0)} hell />
      <MuehleStein {...p(2, 0, -1)} hell={false} />
      <Schwebt verzug={0}>
        <MuehleStein x={30} y={40} hell={false} r={11} />
      </Schwebt>
      <Schwebt verzug={0.9}>
        <MuehleStein x={210} y={98} hell r={11} />
      </Schwebt>
    </>
  )
}

/* ------------------------------------------------------------- Würfel */

const AUGEN: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [3, 1],
    [1, 3],
    [3, 3],
  ],
  5: [
    [1, 1],
    [3, 1],
    [2, 2],
    [1, 3],
    [3, 3],
  ],
  6: [
    [1, 1],
    [3, 1],
    [1, 2],
    [3, 2],
    [1, 3],
    [3, 3],
  ],
}

function Wuerfel({ groesse, augen }: { groesse: number; augen: number }) {
  const s = groesse
  return (
    <g>
      <rect x={3} y={5} width={s} height={s} rx={s * 0.22} fill="rgb(0 0 0 / 0.22)" />
      <rect x={0} y={0} width={s} height={s} rx={s * 0.22} fill="#ffffff" />
      <rect
        x={0}
        y={s * 0.62}
        width={s}
        height={s * 0.38}
        rx={s * 0.2}
        fill="rgb(15 23 42 / 0.06)"
      />
      {AUGEN[augen]!.map(([ax, ay]) => (
        <circle
          key={`${ax}-${ay}`}
          cx={(s * ax) / 4}
          cy={(s * ay) / 4}
          r={s * 0.095}
          fill="#1e293b"
        />
      ))}
    </g>
  )
}

function BildKniffel() {
  return (
    <>
      <g transform="translate(34 50) rotate(-14)">
        <Schwebt verzug={0}>
          <Wuerfel groesse={50} augen={5} />
        </Schwebt>
      </g>
      <g transform="translate(94 20) rotate(6)">
        <Schwebt verzug={0.6}>
          <Wuerfel groesse={58} augen={6} />
        </Schwebt>
      </g>
      <g transform="translate(166 46) rotate(15)">
        <Schwebt verzug={1.2}>
          <Wuerfel groesse={50} augen={3} />
        </Schwebt>
      </g>
    </>
  )
}

/* -------------------------------------------------------------- Karten */

const KARTE_B = 56
const KARTE_H = 80

function Blattkarte({ wert, farbe, rot }: { wert: string; farbe: string; rot: boolean }) {
  const ton = rot ? '#c1121f' : '#16181d'
  return (
    <g>
      <rect x={2} y={4} width={KARTE_B} height={KARTE_H} rx={7} fill="rgb(0 0 0 / 0.22)" />
      <rect
        width={KARTE_B}
        height={KARTE_H}
        rx={7}
        fill="#fffdf8"
        stroke="#e7e1d4"
        strokeWidth={1}
      />
      <text x={7} y={16} fontSize={13} fontWeight={800} fill={ton}>
        {wert}
      </text>
      <text x={7} y={29} fontSize={11} fill={ton}>
        {farbe + TEXT}
      </text>
      <text x={KARTE_B / 2} y={57} fontSize={30} textAnchor="middle" fill={ton}>
        {farbe + TEXT}
      </text>
    </g>
  )
}

function BunteKarte({
  zeichen,
  von,
  nach,
  id,
}: {
  zeichen: string
  von: string
  nach: string
  id: string
}) {
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={von} />
          <stop offset="1" stopColor={nach} />
        </linearGradient>
      </defs>
      <rect x={2} y={4} width={KARTE_B} height={KARTE_H} rx={7} fill="rgb(0 0 0 / 0.22)" />
      <rect width={KARTE_B} height={KARTE_H} rx={7} fill="#ffffff" />
      <rect x={3} y={3} width={KARTE_B - 6} height={KARTE_H - 6} rx={5} fill={`url(#${id})`} />
      {/* Ein heller Schrägstreifen -- das Erkennungszeichen dieses Blatts. */}
      <path
        d={`M 3 ${KARTE_H * 0.62} L ${KARTE_B - 3} ${KARTE_H * 0.28} L ${KARTE_B - 3} ${KARTE_H * 0.5} L 3 ${KARTE_H * 0.84} Z`}
        fill="rgb(255 255 255 / 0.18)"
      />
      <text x={8} y={18} fontSize={13} fontWeight={900} fill="#ffffff">
        {zeichen}
      </text>
      <text
        x={KARTE_B / 2 + 4}
        y={KARTE_H / 2 + 12}
        fontSize={zeichen.length > 1 ? 22 : 28}
        fontWeight={900}
        textAnchor="middle"
        fill="#ffffff"
        stroke="rgb(0 0 0 / 0.18)"
        strokeWidth={2}
        paintOrder="stroke"
      >
        {zeichen}
      </text>
    </g>
  )
}

/** Vier Karten im Fächer, gedreht um einen Punkt unterhalb der Mitte. */
function Faecher({ karten }: { karten: ReactNode[] }) {
  const winkel = [-30, -10, 10, 30]
  return (
    <>
      {karten.map((karte, i) => (
        <g
          key={i}
          transform={`rotate(${winkel[i]} ${BREITE / 2} 158) translate(${BREITE / 2 - KARTE_B / 2} 34)`}
        >
          <Schwebt verzug={i * 0.35}>{karte}</Schwebt>
        </g>
      ))}
    </>
  )
}

function BildMauMau() {
  return (
    <Faecher
      karten={[
        <Blattkarte key="7" wert="7" farbe="♥" rot />,
        <Blattkarte key="8" wert="8" farbe="♣" rot={false} />,
        <Blattkarte key="10" wert="10" farbe="♦" rot />,
        <Blattkarte key="A" wert="A" farbe="♠" rot={false} />,
      ]}
    />
  )
}

function BildLetzteKarte() {
  return (
    <Faecher
      karten={[
        <BunteKarte key="a" id="lk-a" zeichen="7" von="#fb923c" nach="#c2410c" />,
        <BunteKarte key="b" id="lk-b" zeichen="⇄" von="#2dd4bf" nach="#0f766e" />,
        <BunteKarte key="c" id="lk-c" zeichen="+2" von="#c084fc" nach="#6d28d9" />,
        <BunteKarte key="d" id="lk-d" zeichen="★" von="#fb7185" nach="#be123c" />,
      ]}
    />
  )
}

/* --------------------------------------------------------------- Poker */

function Chipstapel({ x, y, farben }: { x: number; y: number; farben: string[] }) {
  return (
    <g>
      {farben.map((farbe, i) => {
        const cy = y - i * 7
        return (
          <g key={i}>
            <ellipse cx={x} cy={cy + 3} rx={21} ry={8} fill="rgb(0 0 0 / 0.35)" />
            <ellipse cx={x} cy={cy} rx={21} ry={8} fill={farbe} />
            <ellipse
              cx={x}
              cy={cy}
              rx={17}
              ry={6}
              fill="none"
              stroke="rgb(255 255 255 / 0.85)"
              strokeWidth={2.5}
              strokeDasharray="4 4"
            />
          </g>
        )
      })}
    </g>
  )
}

function BildTexas() {
  return (
    <>
      <g transform="rotate(-12 82 140) translate(50 30)">
        <Schwebt verzug={0}>
          <Blattkarte wert="A" farbe="♠" rot={false} />
        </Schwebt>
      </g>
      <g transform="rotate(9 120 140) translate(90 26)">
        <Schwebt verzug={0.5}>
          <Blattkarte wert="K" farbe="♥" rot />
        </Schwebt>
      </g>
      <Schwebt verzug={1}>
        <Chipstapel
          x={180}
          y={112}
          farben={['#be123c', '#f8fafc', '#be123c', '#1d4ed8', '#be123c']}
        />
      </Schwebt>
      <Schwebt verzug={1.4}>
        <Chipstapel x={213} y={124} farben={['#ca8a04', '#ca8a04', '#f8fafc']} />
      </Schwebt>
    </>
  )
}

/* -------------------------------------------------------------- Schach */

function BildSchach() {
  const feld = 28
  const links = 50
  const oben = 48
  const felder: ReactNode[] = []
  for (let reihe = 0; reihe < 3; reihe++) {
    for (let spalte = 0; spalte < 5; spalte++) {
      felder.push(
        <rect
          key={`${reihe}-${spalte}`}
          x={links + spalte * feld}
          y={oben + reihe * feld}
          width={feld}
          height={feld}
          fill={(reihe + spalte) % 2 === 0 ? '#f3ead9' : '#a1866a'}
        />,
      )
    }
  }
  const figur = (zeichen: string, spalte: number, hell: boolean, verzug: number) => (
    <Schwebt verzug={verzug}>
      <text
        x={links + spalte * feld + feld / 2}
        y={oben + feld - 4}
        fontSize={44}
        textAnchor="middle"
        fill={hell ? '#fffaf0' : '#1c1917'}
        stroke={hell ? '#1c1917' : '#fffaf0'}
        strokeWidth={1.2}
        paintOrder="stroke"
      >
        {zeichen + TEXT}
      </text>
    </Schwebt>
  )
  return (
    <>
      <rect
        x={links - 4}
        y={oben - 4}
        width={feld * 5 + 8}
        height={feld * 3 + 8}
        rx={6}
        fill="#292524"
      />
      {felder}
      {figur('♚', 1, false, 0.4)}
      {figur('♞', 3, true, 0)}
      {figur('♙', 4, true, 0.9)}
      {figur('♟', 0, false, 1.3)}
    </>
  )
}

/* -------------------------------------------------------- Käsekästchen */

function BildKaesekaestchen() {
  const z = 26
  const spalten = 4
  const reihen = 3
  const x0 = BREITE / 2 - (spalten * z) / 2
  const y0 = 30
  const p = (s: number, r: number) => ({ x: x0 + s * z, y: y0 + r * z })
  // Gezogene Linien: [von Spalte, von Reihe, nach Spalte, nach Reihe, Farbe]
  const linien: [number, number, number, number, string][] = [
    [0, 0, 1, 0, '#a21caf'],
    [0, 0, 0, 1, '#0891b2'],
    [1, 0, 1, 1, '#a21caf'],
    [0, 1, 1, 1, '#0891b2'],
    [1, 0, 2, 0, '#0891b2'],
    [2, 0, 2, 1, '#a21caf'],
    [1, 1, 2, 1, '#a21caf'],
    [2, 1, 2, 2, '#0891b2'],
    [3, 0, 4, 0, '#a21caf'],
    [4, 0, 4, 1, '#0891b2'],
    [0, 2, 0, 3, '#a21caf'],
    [1, 3, 2, 3, '#0891b2'],
    [3, 2, 4, 2, '#a21caf'],
  ]
  const kaestchen: [number, number, string, string][] = [
    [0, 0, '#67e8f9', 'B'],
    [1, 0, '#f0abfc', 'A'],
  ]
  const punkte: ReactNode[] = []
  for (let r = 0; r <= reihen; r++) {
    for (let s = 0; s <= spalten; s++) {
      const { x, y } = p(s, r)
      punkte.push(<circle key={`${s}-${r}`} cx={x} cy={y} r={3.2} fill="#3b0764" />)
    }
  }
  const neu = { von: p(3, 1), nach: p(3, 2) }
  return (
    <>
      <g transform={`rotate(-4 ${BREITE / 2} 70)`}>
        <rect
          x={x0 - 18}
          y={y0 - 18}
          width={spalten * z + 36}
          height={reihen * z + 36}
          rx={10}
          fill="rgb(0 0 0 / 0.22)"
          transform="translate(3 5)"
        />
        <rect
          x={x0 - 18}
          y={y0 - 18}
          width={spalten * z + 36}
          height={reihen * z + 36}
          rx={10}
          fill="#fdfcff"
        />
        {/* Karopapier */}
        {Array.from({ length: spalten * 2 + 3 }, (_, i) => (
          <line
            key={`kv${i}`}
            x1={x0 - 13 + i * (z / 2)}
            y1={y0 - 18}
            x2={x0 - 13 + i * (z / 2)}
            y2={y0 + reihen * z + 18}
            stroke="#dbeafe"
            strokeWidth={0.8}
          />
        ))}
        {Array.from({ length: reihen * 2 + 3 }, (_, i) => (
          <line
            key={`kw${i}`}
            x1={x0 - 18}
            y1={y0 - 13 + i * (z / 2)}
            x2={x0 + spalten * z + 18}
            y2={y0 - 13 + i * (z / 2)}
            stroke="#dbeafe"
            strokeWidth={0.8}
          />
        ))}
        {kaestchen.map(([s, r, farbe, buchstabe]) => {
          const { x, y } = p(s, r)
          return (
            <g key={`k${s}-${r}`}>
              <rect x={x + 3} y={y + 3} width={z - 6} height={z - 6} rx={4} fill={farbe} />
              <text
                x={x + z / 2}
                y={y + z / 2 + 5}
                fontSize={14}
                fontWeight={900}
                textAnchor="middle"
                fill="#3b0764"
              >
                {buchstabe}
              </text>
            </g>
          )
        })}
        {linien.map(([s1, r1, s2, r2, farbe], i) => {
          const a = p(s1, r1)
          const b = p(s2, r2)
          return (
            <line
              key={`l${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={farbe}
              strokeWidth={3.6}
              strokeLinecap="round"
            />
          )
        })}
        {/* Die frisch gezogene Linie leuchtet */}
        <Schwebt verzug={0.2}>
          <line
            x1={neu.von.x}
            y1={neu.von.y}
            x2={neu.nach.x}
            y2={neu.nach.y}
            stroke="#facc15"
            strokeWidth={9}
            strokeLinecap="round"
            opacity={0.55}
          />
          <line
            x1={neu.von.x}
            y1={neu.von.y}
            x2={neu.nach.x}
            y2={neu.nach.y}
            stroke="#a21caf"
            strokeWidth={3.6}
            strokeLinecap="round"
          />
        </Schwebt>
        {punkte}
      </g>
      {/* Ein Stift am Rand */}
      <Schwebt verzug={0.8}>
        <g transform="translate(205 92) rotate(38)">
          <rect x={-5} y={-34} width={10} height={44} rx={2} fill="#facc15" />
          <rect x={-5} y={-40} width={10} height={8} rx={2} fill="#f9a8d4" />
          <rect x={-5} y={-33} width={10} height={3} fill="#a1a1aa" />
          <path d="M -5 10 L 5 10 L 0 22 Z" fill="#fde68a" />
          <path d="M -1.6 18 L 1.6 18 L 0 22 Z" fill="#3b0764" />
        </g>
      </Schwebt>
    </>
  )
}

/* ------------------------------------------------------ Schützenopoly */

function BildSchuetzenopoly() {
  const seite = 108
  const x0 = BREITE / 2 - seite / 2
  const y0 = 18
  const zellen = 6
  const z = seite / zellen
  const streifen = ['#dc2626', '#f59e0b', '#2563eb', '#db2777', '#0891b2', '#7c3aed']
  const rand: ReactNode[] = []
  for (let i = 0; i < zellen; i++) {
    rand.push(
      <rect
        key={`o${i}`}
        x={x0 + i * z + 1}
        y={y0 + 1}
        width={z - 2}
        height={5}
        rx={1}
        fill={streifen[i]}
      />,
      <rect
        key={`u${i}`}
        x={x0 + i * z + 1}
        y={y0 + seite - 6}
        width={z - 2}
        height={5}
        rx={1}
        fill={streifen[(i + 3) % zellen]}
      />,
    )
  }
  return (
    <>
      <g transform={`rotate(-6 ${BREITE / 2} 72)`}>
        <rect x={x0 + 3} y={y0 + 5} width={seite} height={seite} rx={8} fill="rgb(0 0 0 / 0.25)" />
        <rect x={x0} y={y0} width={seite} height={seite} rx={8} fill="#fbf6e4" />
        <rect
          x={x0 + z}
          y={y0 + z}
          width={seite - 2 * z}
          height={seite - 2 * z}
          rx={4}
          fill="#3f6212"
        />
        {Array.from({ length: zellen - 1 }, (_, i) => (
          <g key={`l${i}`} stroke="#e4dcc0" strokeWidth={1}>
            <line x1={x0 + (i + 1) * z} y1={y0} x2={x0 + (i + 1) * z} y2={y0 + z} />
            <line x1={x0 + (i + 1) * z} y1={y0 + seite - z} x2={x0 + (i + 1) * z} y2={y0 + seite} />
            <line x1={x0} y1={y0 + (i + 1) * z} x2={x0 + z} y2={y0 + (i + 1) * z} />
            <line x1={x0 + seite - z} y1={y0 + (i + 1) * z} x2={x0 + seite} y2={y0 + (i + 1) * z} />
          </g>
        ))}
        {rand}
        {/* Das Festzelt in der Mitte */}
        <Schwebt verzug={0.3}>
          <g transform={`translate(${BREITE / 2} ${y0 + seite / 2 + 4})`}>
            <path d="M -26 16 L 0 -16 L 26 16 Z" fill="#fefce8" />
            <path d="M -13 16 L 0 -16 L 0 16 Z" fill="#dc2626" />
            <path d="M 13 16 L 0 -16 L 0 16 Z" fill="#dc2626" opacity={0.55} />
            <path d="M -5 16 L 0 4 L 5 16 Z" fill="#422006" />
            <line x1={0} y1={-16} x2={0} y2={-28} stroke="#fefce8" strokeWidth={1.5} />
            <path d="M 0 -28 L 11 -24 L 0 -20 Z" fill="#facc15" />
          </g>
        </Schwebt>
      </g>
      {/* Zielscheibe und Taler am Rand */}
      <Schwebt verzug={0.9}>
        <g transform="translate(206 40)">
          <circle r={19} fill="#fefce8" />
          <circle r={14} fill="#dc2626" />
          <circle r={9} fill="#fefce8" />
          <circle r={4.5} fill="#dc2626" />
        </g>
      </Schwebt>
      <Schwebt verzug={1.5}>
        <g transform="translate(36 102)">
          <circle r={15} fill="#ca8a04" />
          <circle r={11} fill="#facc15" stroke="#a16207" strokeWidth={1.5} />
          <text y={5} fontSize={14} fontWeight={900} textAnchor="middle" fill="#a16207">
            ★
          </text>
        </g>
      </Schwebt>
    </>
  )
}

/* --------------------------------------------------- Schiffe versenken */

/** Ein Schiff von der Seite: Rumpf, Aufbau, Mast. Eigener Entwurf. */
function Seitenschiff({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -34 0 L 34 0 L 26 12 L -28 12 Z" fill="#475569" />
      <path d="M -34 0 L 34 0 L 32 3 L -32 3 Z" fill="#cbd5e1" />
      <rect
        x={-12}
        y={-12}
        width={22}
        height={12}
        rx={2}
        fill="#f1f5f9"
        stroke="#64748b"
        strokeWidth={1}
      />
      <rect x={-7} y={-8} width={4} height={3} fill="#0ea5e9" />
      <rect x={0} y={-8} width={4} height={3} fill="#0ea5e9" />
      <line x1={-1} y1={-12} x2={-1} y2={-24} stroke="#64748b" strokeWidth={1.5} />
      <path d="M -1 -24 l 9 3 l -9 3 z" fill="#0369a1" />
      <rect x={16} y={-5} width={9} height={5} rx={1.5} fill="#94a3b8" />
      <line x1={25} y1={-3} x2={33} y2={-5} stroke="#475569" strokeWidth={1.6} />
    </g>
  )
}

function BildSchiffeVersenken() {
  return (
    <>
      {/* Meer mit zwei Wellenlinien. */}
      <rect x={0} y={96} width={BREITE} height={HOEHE - 96} fill="#0284c7" />
      <path
        d="M 0 96 Q 15 92 30 96 T 60 96 T 90 96 T 120 96 T 150 96 T 180 96 T 210 96 T 240 96"
        fill="none"
        stroke="#bae6fd"
        strokeWidth={2}
      />
      <path
        d="M 0 112 Q 20 108 40 112 T 80 112 T 120 112 T 160 112 T 200 112 T 240 112"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth={1.5}
        opacity={0.7}
      />
      <Schwebt>
        <Seitenschiff x={52} y={92} s={0.85} />
      </Schwebt>
      {/* Der Bogen der Rakete mit Rauchspur. */}
      <path
        d="M 70 70 Q 120 -6 176 74"
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.85}
        strokeDasharray="1 7"
      />
      <g transform="translate(160 46) rotate(52)">
        <path
          d="M -16 -3 L 6 -3 Q 13 -2 14 0 Q 13 2 6 3 L -16 3 Z"
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth={0.8}
        />
        <path d="M 6 -3 Q 13 -2 14 0 Q 13 2 6 3 Z" fill="#dc2626" />
        <path d="M -12 -3 L -17 -8 L -16 -3 Z M -12 3 L -17 8 L -16 3 Z" fill="#b91c1c" />
        <path d="M -16 -2.5 Q -24 0 -16 2.5 Z" fill="#fbbf24" />
        <path d="M -16 -1.5 Q -30 0 -16 1.5 Z" fill="#f97316" opacity={0.8} />
      </g>
      {/* Links eine Fontäne, rechts ein Feuerball. */}
      <g transform="translate(206 98)">
        <circle r={20} fill="#f97316" opacity={0.35} />
        <circle r={13} fill="#fb923c" />
        <circle cx={-4} cy={-4} r={8} fill="#fde047" />
        <circle cx={-6} cy={-6} r={3.5} fill="#fffbeb" />
        <circle cx={8} cy={-16} r={7} fill="#57534e" opacity={0.7} />
        <circle cx={-2} cy={-24} r={6} fill="#78716c" opacity={0.55} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <line
            key={i}
            x1={Math.cos(i * 1.05) * 16}
            y1={Math.sin(i * 1.05) * 16}
            x2={Math.cos(i * 1.05) * 24}
            y2={Math.sin(i * 1.05) * 24}
            stroke="#fde047"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </g>
      <g transform="translate(128 98)" fill="#e0f2fe">
        <path d="M -6 0 Q -4 -26 0 -34 Q 4 -26 6 0 Z" fill="#f0f9ff" />
        <circle cx={-10} cy={-18} r={2.2} />
        <circle cx={11} cy={-22} r={2} />
        <circle cx={-14} cy={-8} r={1.6} />
        <circle cx={15} cy={-10} r={1.8} />
        <ellipse cx={0} cy={2} rx={16} ry={3.5} fill="none" stroke="#f0f9ff" strokeWidth={1.5} />
      </g>
    </>
  )
}

const BILDER: Record<MenueSpiel, () => ReactNode> = {
  kniffel: BildKniffel,
  maumau: BildMauMau,
  'letzte-karte': BildLetzteKarte,
  'texas-holdem': BildTexas,
  schach: BildSchach,
  dame: BildDame,
  'schiffe-versenken': BildSchiffeVersenken,
  muehle: BildMuehle,
  kaesekaestchen: BildKaesekaestchen,
  schuetzenopoly: BildSchuetzenopoly,
}

export function HeroBild({ spiel }: { spiel: MenueSpiel }) {
  const Bild = BILDER[spiel]
  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${BREITE} ${HOEHE}`}
      role="presentation"
      focusable="false"
      fontFamily="var(--font-sans)"
    >
      <Bild />
    </svg>
  )
}
