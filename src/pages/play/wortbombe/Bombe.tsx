/**
 * Die Bombe der Wortbombe -- und ihr Knall. Eigene Zeichnung, kein Emoji.
 *
 * Die Zündschnur brennt, aber sie wird nicht kürzer: Wie viel Zeit bleibt,
 * soll niemand sehen (siehe WortbombePage, der Zünder). Die Spannung kommt
 * vom Funken, vom gleichmäßigen Ticken und davon, dass die Bombe beim
 * Weiterreichen einmal durchs Bild fliegt.
 */
import styles from './Bombe.module.css'

export function Bombe({ wurf }: { wurf: number }) {
  return (
    // Der Schlüssel lässt den Wurf bei jedem Weiterreichen neu ablaufen.
    <div key={wurf} className={styles.wurf} aria-hidden="true">
      <svg viewBox="0 0 120 120" className={styles.bombe}>
        <defs>
          <radialGradient id="bombe-koerper" cx="38%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#5b6478" />
            <stop offset="45%" stopColor="#262b36" />
            <stop offset="100%" stopColor="#0c0e13" />
          </radialGradient>
          <radialGradient id="bombe-funke" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbe6" />
            <stop offset="35%" stopColor="#fde047" />
            <stop offset="70%" stopColor="#f97316" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Zündschnur: ein Bogen vom Hals nach oben rechts. */}
        <path
          d="M74 30c4-10 12-16 22-14"
          fill="none"
          stroke="#a16207"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M74 30c4-10 12-16 22-14"
          fill="none"
          stroke="#fde68a"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="3 4"
          className={styles.schnur}
        />
        {/* Körper, Hals und Glanz. */}
        <circle cx="56" cy="70" r="38" fill="url(#bombe-koerper)" />
        <rect
          x="60"
          y="26"
          width="20"
          height="14"
          rx="3"
          transform="rotate(32 70 33)"
          fill="#3f4656"
        />
        <ellipse
          cx="42"
          cy="54"
          rx="11"
          ry="7"
          fill="#ffffff"
          opacity="0.22"
          transform="rotate(-30 42 54)"
        />
        <circle cx="35" cy="62" r="3" fill="#ffffff" opacity="0.18" />
        {/* Der Funke: ein Leuchten und vier Strahlen, die flackern. */}
        <g className={styles.funke}>
          <circle cx="97" cy="15" r="12" fill="url(#bombe-funke)" />
          <path
            d="M97 3v8M97 19v8M85 15h8M101 15h8M89 7l4 4M101 19l4 4M105 7l-4 4M89 23l4-4"
            stroke="#fde047"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        <g className={styles.splitter}>
          <circle cx="104" cy="10" r="1.6" fill="#fbbf24" />
          <circle cx="90" cy="9" r="1.2" fill="#fde047" />
          <circle cx="106" cy="22" r="1.3" fill="#f97316" />
        </g>
      </svg>
    </div>
  )
}

/** Der Knall: ein Blitz, ein gezackter Feuerball und fliegende Splitter. */
export function Knall() {
  const strahlen = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div className={styles.knall} aria-hidden="true">
      <div className={styles.blitz} />
      <svg viewBox="0 0 200 200" className={styles.feuer}>
        <defs>
          <radialGradient id="knall-feuer" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbe6" />
            <stop offset="30%" stopColor="#fde047" />
            <stop offset="65%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </radialGradient>
        </defs>
        <polygon
          fill="url(#knall-feuer)"
          points="100,8 116,58 164,30 140,78 192,92 142,112 176,160 122,134 112,192 96,140 58,180 70,128 12,136 56,100 10,62 66,70 46,22 90,56"
        />
        <circle cx="100" cy="100" r="30" fill="#fffbe6" opacity="0.85" />
      </svg>
      {strahlen.map((i) => (
        <span
          key={i}
          className={styles.splitterFlug}
          style={{ ['--winkel' as string]: `${i * 30 + (i % 2) * 12}deg` }}
        />
      ))}
    </div>
  )
}
