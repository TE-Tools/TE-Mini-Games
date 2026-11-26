/**
 * Die Damesteine als Vektorgrafik -- eigene Formen, keine fremde Garnitur.
 *
 * Ein Stein ist eine flache Scheibe, leicht von vorn gesehen: Unten der
 * Rand (dunkler), darüber die Oberseite mit zwei eingedrehten Rillen. Eine
 * Dame ist zwei Steine übereinander, wie man sie am Brett stapelt, und
 * trägt obenauf eine goldene Krone -- so erkennt man sie auch auf einen
 * flüchtigen Blick.
 *
 * Gezeichnet auf 100 × 100. Die Verläufe brauchen eindeutige Kennungen je
 * Grafik (`useId`), sonst greift die zweite Grafik auf der Seite auf die
 * Verläufe der ersten zu.
 */
import { useId, type CSSProperties, type Ref } from 'react'

interface Farben {
  oben: string
  unten: string
  rand: string
  rille: string
  kante: string
}

const FARBEN: Record<'w' | 'b', Farben> = {
  w: { oben: '#fffdf8', unten: '#e9dcc4', rand: '#cdb99a', rille: '#c9b391', kante: '#8c7556' },
  b: { oben: '#4a403b', unten: '#221c19', rand: '#120e0c', rille: '#5e524c', kante: '#0b0807' },
}

/** Eine Scheibe: Rand unten, Oberseite darüber. `y` ist die Mitte der Oberseite. */
function Scheibe({ y, f, verlauf }: { y: number; f: Farben; verlauf: string }) {
  return (
    <g>
      <path
        d={`M10 ${y} v9 a40 27 0 0 0 80 0 v-9 z`}
        fill={f.rand}
        stroke={f.kante}
        strokeWidth={1.5}
      />
      <ellipse
        cx={50}
        cy={y}
        rx={40}
        ry={27}
        fill={`url(#${verlauf})`}
        stroke={f.kante}
        strokeWidth={1.5}
      />
      <ellipse cx={50} cy={y} rx={29} ry={19.5} fill="none" stroke={f.rille} strokeWidth={2.2} />
      <ellipse cx={50} cy={y} rx={17} ry={11.5} fill="none" stroke={f.rille} strokeWidth={1.6} />
    </g>
  )
}

export function Stein({
  figur,
  className,
  stil,
  refSvg,
}: {
  /** +1 weißer Stein, +2 weiße Dame, -1 / -2 schwarz. */
  figur: number
  className?: string
  stil?: CSSProperties
  refSvg?: Ref<SVGSVGElement>
}) {
  const id = useId().replace(/:/g, '')
  const f = FARBEN[figur > 0 ? 'w' : 'b']
  const dame = Math.abs(figur) === 2
  const verlauf = `dv${id}`
  const oben = dame ? 40 : 50
  return (
    <svg
      ref={refSvg}
      className={className}
      style={stil}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={verlauf} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={f.oben} />
          <stop offset="100%" stopColor={f.unten} />
        </radialGradient>
      </defs>
      {dame && <Scheibe y={58} f={f} verlauf={verlauf} />}
      <Scheibe y={oben} f={f} verlauf={verlauf} />
      {dame && (
        <g data-krone="">
          <path
            d={`M33 ${oben + 7} l-3 -17 l10 8 l10 -12 l10 12 l10 -8 l-3 17 z`}
            fill="#f5c542"
            stroke="#a16207"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
          <rect
            x={33}
            y={oben + 5}
            width={34}
            height={5}
            rx={1.5}
            fill="#e0a92a"
            stroke="#a16207"
            strokeWidth={1.2}
          />
          <circle cx={50} cy={oben - 10} r={2.6} fill="#fff7d6" />
        </g>
      )}
    </svg>
  )
}
