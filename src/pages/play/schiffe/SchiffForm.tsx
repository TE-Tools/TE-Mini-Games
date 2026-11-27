/**
 * Die Schiffe, von oben gesehen -- eigene Zeichnungen, keine Kästchen.
 *
 * Jedes Schiff ist eine Gattung mit ihren Merkmalen: der Träger mit
 * Flugdeck und Inselturm, der Kreuzer mit zwei Geschütztürmen, die Fregatte
 * mit Landedeck, die Korvette mit Radarkuppel, das Schnellboot mit
 * Windschutzscheibe. Nichts davon ist einem Handelsprodukt nachgebaut.
 *
 * Gezeichnet wird waagrecht, Bug rechts, in Einheiten von zehn je Feld;
 * senkrechte Schiffe dreht `SchiffForm` um die Mitte ihres ersten Feldes.
 */
import type { ReactNode } from 'react'
import type { Schiff, SchiffId } from '@/games/schiffe-versenken'

export type SchiffZustand = 'heil' | 'versenkt' | 'aufgedeckt' | 'passt' | 'passtNicht'

interface Farben {
  rumpf: string
  rumpfDunkel: string
  deck: string
  aufbau: string
  akzent: string
  fenster: string
}

const FARBEN: Record<SchiffZustand, Farben> = {
  heil: {
    rumpf: '#64748b',
    rumpfDunkel: '#334155',
    deck: '#cbd5e1',
    aufbau: '#f1f5f9',
    akzent: '#475569',
    fenster: '#0ea5e9',
  },
  aufgedeckt: {
    rumpf: '#7c8798',
    rumpfDunkel: '#4b5563',
    deck: '#d6dde6',
    aufbau: '#eef2f6',
    akzent: '#64748b',
    fenster: '#7dd3fc',
  },
  versenkt: {
    rumpf: '#3f3a36',
    rumpfDunkel: '#1c1917',
    deck: '#57534e',
    aufbau: '#44403c',
    akzent: '#292524',
    fenster: '#1c1917',
  },
  passt: {
    rumpf: '#0f766e',
    rumpfDunkel: '#134e4a',
    deck: '#99f6e4',
    aufbau: '#f0fdfa',
    akzent: '#115e59',
    fenster: '#0ea5e9',
  },
  passtNicht: {
    rumpf: '#b91c1c',
    rumpfDunkel: '#7f1d1d',
    deck: '#fecaca',
    aufbau: '#fef2f2',
    akzent: '#991b1b',
    fenster: '#f87171',
  },
}

/** Ein Geschützturm von oben: Drehkranz und Rohr nach vorn. */
function Turm({ x, f }: { x: number; f: Farben }) {
  return (
    <g>
      <rect x={x + 1.2} y={4.55} width={3.6} height={0.9} rx={0.4} fill={f.rumpfDunkel} />
      <circle cx={x} cy={5} r={1.55} fill={f.aufbau} stroke={f.rumpfDunkel} strokeWidth={0.45} />
      <circle cx={x - 0.3} cy={5} r={0.55} fill={f.akzent} />
    </g>
  )
}

function rumpfPfad(laenge: number): string {
  const l = laenge * 10
  // Heck rund, Bug spitz. Ein wenig Abstand zum Feldrand, damit Wasser bleibt.
  return `M 1.6 2.3 C 0.5 2.6 0.5 7.4 1.6 7.7 L ${l - 4.2} 7.7 C ${l - 2} 7.5 ${l - 0.9} 6.2 ${l - 0.5} 5 C ${l - 0.9} 3.8 ${l - 2} 2.5 ${l - 4.2} 2.3 Z`
}

function deckPfad(laenge: number): string {
  const l = laenge * 10
  return `M 2.2 3.1 C 1.5 3.4 1.5 6.6 2.2 6.9 L ${l - 4.6} 6.9 C ${l - 2.8} 6.7 ${l - 1.9} 5.8 ${l - 1.6} 5 C ${l - 1.9} 4.2 ${l - 2.8} 3.3 ${l - 4.6} 3.1 Z`
}

const DETAILS: Record<SchiffId, (f: Farben) => ReactNode> = {
  // Flugdeck mit Mittellinie, Schrägdeck und dem Inselturm an Steuerbord.
  traeger: (f) => (
    <g>
      <path d="M 3 2.9 L 44 2.9 L 47.2 5 L 44 7.1 L 3 7.1 Z" fill={f.rumpfDunkel} />
      <line
        x1={5}
        y1={5}
        x2={44}
        y2={5}
        stroke="#f8fafc"
        strokeWidth={0.35}
        strokeDasharray="1.6 1.2"
      />
      <line x1={8} y1={6.6} x2={26} y2={3.6} stroke="#fde047" strokeWidth={0.3} opacity={0.85} />
      <rect
        x={30}
        y={2.2}
        width={6}
        height={1.6}
        rx={0.4}
        fill={f.aufbau}
        stroke={f.akzent}
        strokeWidth={0.3}
      />
      <circle cx={33} cy={3} r={0.45} fill={f.fenster} />
      {/* Zwei abgestellte Flieger als kleine Pfeile. */}
      <path d="M 12 5.6 l 2 -0.7 l -0.5 0.7 l 0.5 0.7 z" fill={f.deck} />
      <path d="M 17 5.6 l 2 -0.7 l -0.5 0.7 l 0.5 0.7 z" fill={f.deck} />
    </g>
  ),
  kreuzer: (f) => (
    <g>
      <Turm x={30.5} f={f} />
      <Turm x={8} f={f} />
      <rect
        x={14}
        y={3.4}
        width={11}
        height={3.2}
        rx={0.8}
        fill={f.aufbau}
        stroke={f.akzent}
        strokeWidth={0.3}
      />
      <rect x={17.5} y={3.9} width={4.5} height={2.2} rx={0.5} fill={f.deck} />
      <rect x={22.5} y={4.3} width={1.2} height={1.4} rx={0.3} fill={f.fenster} />
      <ellipse cx={15.6} cy={5} rx={1.1} ry={0.8} fill={f.rumpfDunkel} />
    </g>
  ),
  fregatte: (f) => (
    <g>
      <Turm x={22} f={f} />
      <rect
        x={11}
        y={3.5}
        width={7.5}
        height={3}
        rx={0.8}
        fill={f.aufbau}
        stroke={f.akzent}
        strokeWidth={0.3}
      />
      <rect x={16.5} y={4.2} width={1.2} height={1.6} rx={0.3} fill={f.fenster} />
      <line x1={13.5} y1={2.9} x2={13.5} y2={7.1} stroke={f.akzent} strokeWidth={0.35} />
      {/* Landedeck am Heck. */}
      <circle cx={5.5} cy={5} r={1.7} fill="none" stroke="#f8fafc" strokeWidth={0.35} />
      <circle cx={5.5} cy={5} r={0.4} fill="#f8fafc" />
    </g>
  ),
  korvette: (f) => (
    <g>
      <Turm x={22.5} f={f} />
      <rect
        x={10}
        y={3.6}
        width={8}
        height={2.8}
        rx={0.9}
        fill={f.aufbau}
        stroke={f.akzent}
        strokeWidth={0.3}
      />
      <circle cx={13} cy={5} r={1.25} fill="#f8fafc" stroke={f.akzent} strokeWidth={0.3} />
      <rect x={16.4} y={4.3} width={1.1} height={1.4} rx={0.3} fill={f.fenster} />
      <path
        d="M 2.6 3.6 L 6 3.6 L 6 6.4 L 2.6 6.4"
        fill="none"
        stroke={f.akzent}
        strokeWidth={0.35}
      />
    </g>
  ),
  schnellboot: (f) => (
    <g>
      <path
        d="M 7 3.4 L 12.5 3.4 Q 14 5 12.5 6.6 L 7 6.6 Z"
        fill={f.aufbau}
        stroke={f.akzent}
        strokeWidth={0.3}
      />
      <path d="M 11.2 3.8 Q 12.9 5 11.2 6.2" fill="none" stroke={f.fenster} strokeWidth={0.8} />
      <circle cx={15.5} cy={5} r={0.75} fill={f.akzent} />
      <line x1={16} y1={5} x2={17.6} y2={5} stroke={f.rumpfDunkel} strokeWidth={0.45} />
      <line x1={2.5} y1={4} x2={5.5} y2={4} stroke={f.deck} strokeWidth={0.3} />
      <line x1={2.5} y1={6} x2={5.5} y2={6} stroke={f.deck} strokeWidth={0.3} />
    </g>
  ),
}

/** Ein Schiff auf dem Meer (viewBox 0 0 100 100). */
export function SchiffForm({
  schiff,
  zustand = 'heil',
  className,
}: {
  schiff: Pick<Schiff, 'id' | 'laenge' | 'x' | 'y' | 'richtung'>
  zustand?: SchiffZustand
  className?: string
}) {
  const f = FARBEN[zustand]
  const dreh = schiff.richtung === 'v' ? ' rotate(90 5 5)' : ''
  return (
    <g
      className={className}
      transform={`translate(${schiff.x * 10} ${schiff.y * 10})${dreh}`}
      data-schiff={schiff.id}
      data-zustand={zustand}
      opacity={zustand === 'aufgedeckt' ? 0.75 : 1}
    >
      {/* Schatten im Wasser. */}
      <path d={rumpfPfad(schiff.laenge)} fill="rgba(8,47,73,0.28)" transform="translate(0.5 0.7)" />
      <path d={rumpfPfad(schiff.laenge)} fill={f.rumpf} stroke={f.rumpfDunkel} strokeWidth={0.4} />
      <path d={deckPfad(schiff.laenge)} fill={f.deck} />
      {DETAILS[schiff.id](f)}
      {zustand === 'versenkt' && (
        <g stroke="#0c0a09" strokeWidth={0.45} fill="none" opacity={0.9}>
          <path d={`M ${schiff.laenge * 3} 2.6 l 1.2 1.6 l -0.8 1.2 l 1.4 1.8`} />
          <path d={`M ${schiff.laenge * 7} 7.4 l -1 -1.5 l 1 -1 l -0.6 -1.6`} />
        </g>
      )}
      {zustand === 'aufgedeckt' && (
        <path
          d={rumpfPfad(schiff.laenge)}
          fill="none"
          stroke="#fff"
          strokeWidth={0.5}
          strokeDasharray="1.2 0.9"
        />
      )}
    </g>
  )
}
