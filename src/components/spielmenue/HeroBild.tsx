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

const BILDER: Record<MenueSpiel, () => ReactNode> = {
  kniffel: BildKniffel,
  maumau: BildMauMau,
  'letzte-karte': BildLetzteKarte,
  'texas-holdem': BildTexas,
  schach: BildSchach,
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
