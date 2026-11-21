/**
 * Die Schachfiguren als Vektorgrafik -- eigene, flache Formen aus Kreisen,
 * Bögen und Kanten, kein Zeichensatz und keine fremde Figurengarnitur.
 *
 * Warum nicht mehr die Schriftzeichen (♞): Wie sie aussehen, entscheidet
 * das Handy. Auf dem einen sind sie fein, auf dem anderen klobig, und
 * manches malt den Bauern als buntes Emoji. Die Grafik sieht überall gleich
 * aus, ist in jeder Größe scharf und braucht keine Datei -- also auch
 * offline da.
 *
 * Gezeichnet auf 100 × 100; alle Figuren stehen auf demselben Sockel, damit
 * sie auf dem Brett eine Linie bilden.
 */

import type { CSSProperties } from 'react'

const SOCKEL = 'M20 84a6 6 0 0 1 6-6h48a6 6 0 0 1 6 6v2a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z'

/** Die Formen je Figur (1 Bauer … 6 König): Umriss, dann helle Details. */
interface Form {
  /** Flächen in der Farbe der Figur, mit Umriss. */
  koerper: string[]
  /** Kugeln in der Farbe der Figur (Krone der Dame). */
  punkte?: [number, number, number][]
  /** Linien in der Gegenfarbe: Schlitz der Läufermütze, Mauerfuge, Mähne. */
  details?: string[]
  /** Punkte in der Gegenfarbe: das Auge des Springers. */
  augen?: [number, number, number][]
}

const FORMEN: Record<number, Form> = {
  1: {
    koerper: [
      SOCKEL,
      'M31 78c0-13 6-21 11-25h16c5 4 11 12 11 25z',
      'M50 20a15 15 0 1 1 0 30 15 15 0 0 1 0-30z',
    ],
  },
  2: {
    koerper: [
      SOCKEL,
      'M30 78c0-14 6-22 14-29l-10 3c-6 2-11-2-11-7 0-3 1-5 4-8l17-17 1-8 7 6c14 3 24 17 24 34 0 10-2 18-4 26z',
    ],
    details: ['M64 40c4 6 5 14 4 22'],
    augen: [[47, 33, 3.6]],
  },
  3: {
    koerper: [
      SOCKEL,
      'M36 78l4-18c-6-6-8-14-5-22 3-8 9-14 15-20 6 6 12 12 15 20 3 8 1 16-5 22l4 18z',
      'M50 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12z',
    ],
    details: ['M57 28l-13 15'],
  },
  4: {
    koerper: [
      SOCKEL,
      'M33 78l3-34h28l3 34z',
      'M27 18h10v8h7v-8h12v8h7v-8h10v20c0 3-2 6-5 6H32c-3 0-5-3-5-6z',
    ],
    details: ['M38 54h24'],
  },
  5: {
    koerper: [SOCKEL, 'M34 78l3-26h26l3 26z', 'M28 52l-4-28 14 12 12-22 12 22 14-12-4 28z'],
    punkte: [
      [24, 21, 4.5],
      [50, 11, 4.5],
      [76, 21, 4.5],
    ],
  },
  6: {
    koerper: [
      SOCKEL,
      'M34 78l3-26h26l3 26z',
      'M28 52c-6-12 2-24 13-22 4 1 7 4 9 7 2-3 5-6 9-7 11-2 19 10 13 22z',
      'M46 6h8v8h7v7h-7v9h-8v-9h-7v-7h7z',
    ],
  },
}

interface Props {
  /** Figur wie auf dem Brett: Betrag 1..6, Vorzeichen = Farbe (positiv Weiß). */
  figur: number
  className?: string
  stil?: CSSProperties
}

export function Figur({ figur, className, stil }: Props) {
  const form = FORMEN[Math.abs(figur)]
  if (!form) return null
  const weiss = figur > 0
  const detail = weiss ? 'var(--figur-weiss-rand, #3b3f4a)' : 'var(--figur-schwarz-licht, #e8ebf2)'
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={stil}
      aria-hidden="true"
      focusable="false"
      data-figur={weiss ? 'w' : 'b'}
    >
      <g
        fill={weiss ? 'var(--figur-weiss, #fbfaf7)' : 'var(--figur-schwarz, #2b2f3a)'}
        stroke={weiss ? 'var(--figur-weiss-rand, #3b3f4a)' : 'var(--figur-schwarz-rand, #11131a)'}
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {form.koerper.map((d, i) => (
          <path key={i} d={d} />
        ))}
        {form.punkte?.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
      {form.details && (
        <g fill="none" stroke={detail} strokeWidth="4" strokeLinecap="round">
          {form.details.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
      {form.augen?.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={detail} />
      ))}
    </svg>
  )
}
