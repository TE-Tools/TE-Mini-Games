/**
 * Die Mühlesteine als Vektorgrafik -- eigene Form, keine fremde Garnitur.
 *
 * Ein Stein ist eine flache, gedrechselte Scheibe, von oben gesehen: ein
 * dunklerer Rand, die gewölbte Oberseite mit einer eingedrehten Rille und
 * ein weiches Glanzlicht oben links. Weiß wie Elfenbein, Schwarz wie
 * Schiefer.
 *
 * Gezeichnet auf 100 × 100. Die Verläufe brauchen eindeutige Kennungen je
 * Grafik (`useId`), sonst greift die zweite Grafik auf der Seite auf die
 * Verläufe der ersten zu.
 */
import { useId, type CSSProperties, type Ref } from 'react'
import type { Farbe } from '@/games/muehle'

const FARBEN: Record<Farbe, { hell: string; dunkel: string; rand: string; rille: string }> = {
  w: { hell: '#fffdf7', dunkel: '#e4d9c2', rand: '#a8977a', rille: '#cdbd9f' },
  b: { hell: '#64748b', dunkel: '#1e293b', rand: '#0b1220', rille: '#475569' },
}

export function Stein({
  farbe,
  className,
  stil,
  refSvg,
}: {
  farbe: Farbe
  className?: string
  stil?: CSSProperties
  refSvg?: Ref<SVGSVGElement>
}) {
  const id = useId().replace(/:/g, '')
  const f = FARBEN[farbe]
  const verlauf = `ms${id}`
  return (
    <svg
      ref={refSvg}
      className={className}
      style={stil}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      data-stein={farbe}
    >
      <defs>
        <radialGradient id={verlauf} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={f.hell} />
          <stop offset="100%" stopColor={f.dunkel} />
        </radialGradient>
      </defs>
      <circle cx={50} cy={52} r={44} fill={f.rand} />
      <circle cx={50} cy={49} r={42} fill={`url(#${verlauf})`} />
      <circle cx={50} cy={49} r={27} fill="none" stroke={f.rille} strokeWidth={3} />
      <circle cx={50} cy={49} r={12} fill="none" stroke={f.rille} strokeWidth={2} opacity={0.7} />
      <ellipse cx={36} cy={31} rx={13} ry={7} fill="#ffffff" opacity={farbe === 'w' ? 0.7 : 0.22} />
    </svg>
  )
}
