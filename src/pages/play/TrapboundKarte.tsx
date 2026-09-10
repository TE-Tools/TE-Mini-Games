/**
 * Die Weltkarte von Trapbound.
 *
 * Keine Liste, sondern eine Landschaft: Die Level liegen als Knoten auf
 * einem Pfad, der sich durch die Höhle schlängelt, Abschnitte sind durch
 * ein Tor getrennt, und was noch zu ist, trägt ein Schloss. Gezeichnet als
 * SVG -- das skaliert auf jedes Gerät, lässt sich scrollen und braucht
 * keine Bilddateien.
 *
 * Die Form der Karte kommt aus den Leveldaten: Wer eine Welt hinzufügt,
 * bekommt automatisch einen weiteren Abschnitt auf der Karte. Bei hundert
 * Leveln wächst die Karte nach unten und bleibt scrollbar.
 */

import { useEffect, useRef } from 'react'
import type { LevelStand, Welt } from '@/games/trapbound'
import styles from './TrapboundPage.module.css'

export interface KartenProps {
  welten: Welt[]
  freigeschaltet: number
  aktuell: number
  stand: Record<string, LevelStand>
  onWaehle: (nr: number) => void
}

/** Ein Knoten auf der Karte. */
interface Knoten {
  nr: number
  x: number
  y: number
  welt: Welt
  abschnitt: number
  /** Letztes Level eines Abschnitts -- danach kommt ein Tor. */
  ende: boolean
}

const SPALTE = 120
const ZEILE = 92
const RAND = 60

/** Die Knoten im Zickzack anordnen: zwei Spalten, von unten nach oben. */
function baueKnoten(welten: Welt[]): { knoten: Knoten[]; hoehe: number; breite: number } {
  const knoten: Knoten[] = []
  let reihe = 0
  for (const welt of welten) {
    for (const abschnitt of welt.abschnitte) {
      for (const nr of abschnitt.level) {
        const links = reihe % 2 === 0
        knoten.push({
          nr,
          x: RAND + (links ? 0 : SPALTE),
          y: reihe * ZEILE,
          welt,
          abschnitt: abschnitt.nr,
          ende: abschnitt.level[abschnitt.level.length - 1] === nr,
        })
        reihe++
      }
      // Platz für das Tor zwischen zwei Abschnitten.
      reihe += 0.6
    }
  }
  const hoehe = reihe * ZEILE + RAND * 2
  return { knoten, hoehe, breite: RAND * 2 + SPALTE }
}

export function TrapboundKarte({ welten, freigeschaltet, aktuell, stand, onWaehle }: KartenProps) {
  const { knoten, hoehe, breite } = baueKnoten(welten)
  const huelle = useRef<HTMLDivElement>(null)

  // Die Karte startet unten (Level 1) und rollt zum aktuellen Level.
  useEffect(() => {
    const el = huelle.current
    if (!el) return
    const k = knoten.find((x) => x.nr === aktuell) ?? knoten[0]
    if (!k) return
    const ziel = hoehe - k.y - RAND - el.clientHeight / 2
    el.scrollTo({ top: Math.max(0, ziel), behavior: 'auto' })
    // Absicht: nur beim Aufbau und bei einem Wechsel des aktuellen Levels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktuell, hoehe])

  const palette = welten[0]!.palette

  return (
    <div className={styles.kartenHuelle} ref={huelle}>
      <svg
        className={styles.karte}
        viewBox={`0 0 ${breite} ${hoehe}`}
        width="100%"
        height={hoehe}
        role="group"
        aria-label="Levelkarte"
      >
        <defs>
          <linearGradient id="tb-grund" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.ferne} />
            <stop offset="100%" stopColor={palette.hintergrund} />
          </linearGradient>
          <radialGradient id="tb-schein">
            <stop offset="0%" stopColor={palette.akzent} stopOpacity="0.5" />
            <stop offset="100%" stopColor={palette.akzent} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={breite} height={hoehe} fill="url(#tb-grund)" />

        {/* Tropfsteine als Andeutung von Höhle -- ruhig, nicht ablenkend. */}
        {Array.from({ length: Math.ceil(hoehe / 70) }, (_, i) => {
          const links = i % 2 === 0
          const y = i * 70 + 20
          const x = links ? 8 : breite - 8
          const h = 22 + ((i * 37) % 30)
          return (
            <path
              key={`z-${i}`}
              d={`M${x - 9} ${y} L${x + 9} ${y} L${x} ${y + h} Z`}
              fill={palette.boden}
              opacity="0.45"
            />
          )
        })}

        {/* Der Pfad zwischen den Knoten. */}
        {knoten.map((k, i) => {
          const naechster = knoten[i + 1]
          if (!naechster) return null
          const y1 = hoehe - RAND - k.y
          const y2 = hoehe - RAND - naechster.y
          const offen = naechster.nr <= freigeschaltet
          return (
            <path
              key={`p-${k.nr}`}
              d={`M${k.x} ${y1} C ${k.x} ${(y1 + y2) / 2}, ${naechster.x} ${(y1 + y2) / 2}, ${naechster.x} ${y2}`}
              stroke={offen ? palette.bodenKante : palette.boden}
              strokeWidth={offen ? 5 : 4}
              strokeDasharray={offen ? undefined : '5 7'}
              fill="none"
              strokeLinecap="round"
            />
          )
        })}

        {/* Die Tore zwischen den Abschnitten. */}
        {knoten.map((k, i) => {
          const naechster = knoten[i + 1]
          if (!k.ende || !naechster) return null
          const y = hoehe - RAND - (k.y + naechster.y) / 2
          const x = (k.x + naechster.x) / 2
          const offen = naechster.nr <= freigeschaltet
          return (
            <g key={`t-${k.nr}`} opacity={offen ? 1 : 0.6}>
              <rect
                x={x - 21}
                y={y - 17}
                width="42"
                height="34"
                rx="4"
                fill={palette.boden}
                stroke={offen ? palette.akzent : palette.bodenKante}
                strokeWidth="2"
              />
              <text
                x={x}
                y={y + 5}
                textAnchor="middle"
                fontSize="15"
                fill={offen ? palette.akzent : palette.bodenKante}
              >
                {offen ? '⌇' : '🔒'}
              </text>
            </g>
          )
        })}

        {knoten.map((k) => {
          const y = hoehe - RAND - k.y
          const l = stand[String(k.nr)]
          const offen = k.nr <= freigeschaltet
          const fertig = Boolean(l?.fertig)
          const hier = k.nr === aktuell
          return (
            <g key={k.nr}>
              {hier && <circle cx={k.x} cy={y} r="34" fill="url(#tb-schein)" />}
              <circle
                cx={k.x}
                cy={y}
                r="20"
                fill={fertig ? palette.akzent : offen ? palette.boden : '#241f38'}
                stroke={hier ? '#ffffff' : fertig ? palette.akzent : palette.bodenKante}
                strokeWidth={hier ? 3 : 2}
                opacity={offen ? 1 : 0.55}
              />
              <text
                x={k.x}
                y={y + 6}
                textAnchor="middle"
                fontSize="16"
                fontWeight="700"
                fill={fertig ? '#10202a' : offen ? '#ffffff' : palette.bodenKante}
              >
                {offen ? k.nr : '🔒'}
              </text>
              {l?.kristall && (
                <text x={k.x + 22} y={y - 14} fontSize="13" aria-hidden="true">
                  ◆
                </text>
              )}
              {offen && (
                <circle
                  cx={k.x}
                  cy={y}
                  r="26"
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onWaehle(k.nr)}
                >
                  <title>{`Level ${k.nr}`}</title>
                </circle>
              )}
            </g>
          )
        })}

        {/* Beschriftung der Abschnitte: hochkant am linken Rand, damit sie
            weder den Pfad noch die Tore verdeckt. */}
        {welten.map((w) =>
          w.abschnitte.map((a) => {
            const eigene = knoten.filter((k) => k.welt.nr === w.nr && k.abschnitt === a.nr)
            if (eigene.length === 0) return null
            const oben = hoehe - RAND - eigene[eigene.length - 1]!.y
            const unten = hoehe - RAND - eigene[0]!.y
            const mitte = (oben + unten) / 2
            return (
              <text
                key={`${w.nr}-${a.nr}`}
                x={16}
                y={mitte}
                textAnchor="middle"
                fontSize="10"
                fill={w.palette.bodenKante}
                letterSpacing="2"
                opacity="0.75"
                transform={`rotate(-90 16 ${mitte})`}
              >
                {w.name.toUpperCase()} · {a.name.toUpperCase()}
              </text>
            )
          }),
        )}
      </svg>
    </div>
  )
}
