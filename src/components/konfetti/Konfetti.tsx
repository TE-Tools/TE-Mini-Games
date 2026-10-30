/**
 * Ein kurzer Konfettiregen, aus ein paar Dutzend Schnipseln.
 *
 * Bewusst ohne Leinwand und ohne Bibliothek: Jeder Schnipsel ist ein
 * Span mit eigener Flugbahn in CSS-Variablen, die Grafikkarte macht den
 * Rest. Das läuft auch dort, wo kein 3D läuft. Mit „Bewegung reduzieren"
 * fällt nichts -- dann zeigt die Seite nur ihren Text.
 */

import { useState, type CSSProperties } from 'react'
import styles from './Konfetti.module.css'

const FARBEN = ['#5a3ce0', '#e8b93a', '#0d7a72', '#c02b48', '#1d4ed8', '#f97316']

export function Konfetti({ anzahl = 48 }: { anzahl?: number }) {
  // Einmal je Auftritt ausgewürfelt; wer neu regnen lassen will, gibt
  // der Komponente einen neuen Schlüssel.
  const [schnipsel] = useState(() =>
    Array.from({ length: anzahl }, (_, i) => ({
      farbe: FARBEN[i % FARBEN.length]!,
      x: Math.round((Math.random() - 0.5) * 260),
      y: Math.round(-120 - Math.random() * 160),
      fall: Math.round(180 + Math.random() * 220),
      dreh: Math.round((Math.random() - 0.5) * 1080),
      verz: Math.round(Math.random() * 120),
      dauer: Math.round(1100 + Math.random() * 700),
      breit: Math.random() < 0.5,
    })),
  )

  return (
    <div className={styles.konfetti} aria-hidden="true">
      {schnipsel.map((s, i) => (
        <span
          key={i}
          className={s.breit ? styles.breit : styles.schmal}
          style={
            {
              '--farbe': s.farbe,
              '--x': `${s.x}px`,
              '--y': `${s.y}px`,
              '--fall': `${s.fall}px`,
              '--dreh': `${s.dreh}deg`,
              animationDelay: `${s.verz}ms`,
              animationDuration: `${s.dauer}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
