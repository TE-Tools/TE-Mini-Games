/**
 * Ein Knödel, gezeichnet statt fotografiert.
 *
 * Gebraucht an drei Stellen: auf dem Spielfeld, in der Sammlung und als
 * Spielfigur auf der Levelkarte. Deshalb ein eigenes Stück SVG statt CSS im
 * Spielfeld -- es skaliert auf jede Größe und braucht keine Bilddatei, die
 * dann im Cache der App liegt.
 */

export type Gesicht = 'froh' | 'zwinker' | 'selig' | 'frech' | 'schlaf' | 'stern'

export interface KnoedelProps {
  hex: string
  akzent: string
  gesicht?: Gesicht
  /** Kantenlänge in Pixeln; ohne Angabe füllt er seinen Platz. */
  groesse?: number | string
  /** Im Käfig: dann liegt ein goldenes Gitter darüber. */
  kaefig?: boolean
  title?: string
}

/** Die Augen -- daran erkennt man die Knödel auseinander. */
function Augen({ gesicht, dunkel, glanz }: { gesicht: Gesicht; dunkel: string; glanz: string }) {
  if (gesicht === 'zwinker') {
    return (
      <>
        <path
          d="M35 52 q6 -6 12 0"
          stroke={dunkel}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="65" cy="53" rx="5.5" ry="7" fill={dunkel} />
        <circle cx="66.8" cy="50.5" r="2" fill={glanz} />
      </>
    )
  }
  if (gesicht === 'selig') {
    return (
      <>
        <path
          d="M34 55 q7 -9 14 0"
          stroke={dunkel}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M58 55 q7 -9 14 0"
          stroke={dunkel}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (gesicht === 'schlaf') {
    return (
      <>
        <path
          d="M34 53 q7 7 14 0"
          stroke={dunkel}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M58 53 q7 7 14 0"
          stroke={dunkel}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </>
    )
  }
  if (gesicht === 'stern') {
    return (
      <>
        <path
          d="M41 45 l3 7 7.5 .6 -5.7 5 1.8 7.4 -6.6 -4 -6.6 4 1.8 -7.4 -5.7 -5 7.5 -.6z"
          fill={dunkel}
        />
        <path
          d="M65 45 l3 7 7.5 .6 -5.7 5 1.8 7.4 -6.6 -4 -6.6 4 1.8 -7.4 -5.7 -5 7.5 -.6z"
          fill={dunkel}
        />
      </>
    )
  }
  // froh und frech: runde Augen, bei frech schauen sie zur Seite
  const blick = gesicht === 'frech' ? 2.4 : 0
  return (
    <>
      <ellipse cx="41" cy="53" rx="6" ry="7.5" fill={dunkel} />
      <ellipse cx="65" cy="53" rx="6" ry="7.5" fill={dunkel} />
      <circle cx={42.6 + blick} cy="50.2" r="2.2" fill={glanz} />
      <circle cx={66.6 + blick} cy="50.2" r="2.2" fill={glanz} />
    </>
  )
}

export function Knoedel({
  hex,
  akzent,
  gesicht = 'froh',
  groesse,
  kaefig = false,
  title,
}: KnoedelProps) {
  const id = `kn-${hex.replace('#', '')}-${gesicht}`
  // Auf hellen Knödeln braucht das Gesicht eine dunkle Farbe, auf ganz
  // dunklen eine helle -- sonst verschwinden die Augen im Teig. Der Glanzpunkt
  // im Auge muss die Gegenfarbe haben, sonst ist er nicht zu sehen: Erst sahen
  // die Augen auf den mittleren Farben aus wie leere weiße Flecken.
  const n = parseInt(hex.slice(1), 16)
  const helligkeit =
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  const dunkel = helligkeit > 0.22 ? '#3b2f26' : '#f4efe6'
  const glanz = helligkeit > 0.22 ? '#ffffff' : '#3b2f26'

  return (
    <svg
      viewBox="0 0 100 100"
      width={groesse ?? '100%'}
      height={groesse ?? '100%'}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`${id}-f`} cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="45%" stopColor={hex} />
          <stop offset="100%" stopColor={akzent} />
        </radialGradient>
      </defs>

      {/* Der Körper: unten rund, oben zusammengezogen wie ein Teigbeutel. */}
      <path
        d="M50 15
           c-5 0 -8 3 -11 7
           C23 28 11 41 11 59
           c0 17 17 29 39 29
           s39 -12 39 -29
           c0 -18 -12 -31 -28 -37
           c-3 -4 -6 -7 -11 -7z"
        fill={`url(#${id}-f)`}
        stroke={akzent}
        strokeWidth="2.5"
      />
      {/* Die Falten am Zipfel. */}
      <path d="M50 13 q-5 7 -8 12" stroke={akzent} strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M50 13 q5 7 8 12" stroke={akzent} strokeWidth="2" fill="none" opacity="0.7" />
      <path d="M50 13 v13" stroke={akzent} strokeWidth="2" fill="none" opacity="0.5" />

      <ellipse cx="27" cy="64" rx="7" ry="4.5" fill="#ff8fa0" opacity="0.5" />
      <ellipse cx="73" cy="64" rx="7" ry="4.5" fill="#ff8fa0" opacity="0.5" />
      <Augen gesicht={gesicht} dunkel={dunkel} glanz={glanz} />
      <path
        d="M44 64 q6 7 12 0"
        stroke={dunkel}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />

      {kaefig && (
        <g stroke="#e0a91b" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M22 46 v40" opacity="0.95" />
          <path d="M40 40 v48" opacity="0.95" />
          <path d="M60 40 v48" opacity="0.95" />
          <path d="M78 46 v40" opacity="0.95" />
          <path d="M18 44 q32 -22 64 0" />
          <path d="M14 86 h72" />
        </g>
      )}
    </svg>
  )
}
