/**
 * Die Wortmarke: ein Gamepad in Violett-Gold mit „TE" darin.
 *
 * Als SVG und nicht als Bild, damit sie auf jedem Bildschirm scharf bleibt
 * und die Farben aus demselben Farbkasten kommen wie der Rest der App.
 */
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 40) / 64}
      viewBox="0 0 64 40"
      role="img"
      aria-label="TE-Mini Games"
      focusable="false"
    >
      <defs>
        <linearGradient id="te-logo-rand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="0.55" stopColor="#c4b5fd" />
          <stop offset="1" stopColor="#f0c84a" />
        </linearGradient>
      </defs>

      <path
        d="M18 6h28c6.6 0 12 5 12.9 11.5l1.4 10.2c.6 4.3-3.4 7.7-7.4 6.3-3.4-1.2-6.3-3.4-8.4-6H19.5c-2.1 2.6-5 4.8-8.4 6-4 1.4-8-2-7.4-6.3L5.1 17.5C6 11 11.4 6 18 6Z"
        fill="none"
        stroke="url(#te-logo-rand)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Steuerkreuz links */}
      <path
        d="M13.5 16.5v6M10.5 19.5h6"
        stroke="#f0c84a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Knöpfe rechts */}
      <circle cx="50" cy="16.5" r="2" fill="#a78bfa" />
      <circle cx="54" cy="21.5" r="2" fill="#f0c84a" />
      {/* Das Kürzel in der Mitte */}
      <text
        x="31.5"
        y="24"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill="#f0c84a"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      >
        TE
      </text>
      {/* Funkeln */}
      <path d="M57 3l.8 2.2 2.2.8-2.2.8L57 9l-.8-2.2-2.2-.8 2.2-.8z" fill="#ffe9a8" />
      <path d="M8 1.5l.6 1.5 1.5.6-1.5.6L8 5.7l-.6-1.5L5.9 3.6l1.5-.6z" fill="#c4b5fd" />
    </svg>
  )
}
