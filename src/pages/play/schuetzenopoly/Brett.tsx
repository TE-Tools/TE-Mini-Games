/**
 * Das Spielbrett als 11x11-Raster.
 *
 * Jedes Feld zeigt Farbstreifen der Gruppe, Symbol, Kurznamen, die
 * Ausbaustufe als Punkte und den Besitzer als farbigen Rand. Die Figuren
 * stehen als kleine Marken auf ihrem Feld. Antippen öffnet die Feldkarte --
 * auf einem Handybildschirm ist das der einzige Weg, alle Angaben
 * unterzubringen.
 */

import { memo } from 'react'
import {
  BRETT,
  figur,
  grundstueck,
  gruppe,
  type Besitz,
  type BrettFeld,
  type Spieler,
} from '@/games/schuetzenopoly'
import { kante, rasterplatz } from './brettPositionen'
import styles from './Brett.module.css'

interface BrettProps {
  besitz: Record<string, Besitz>
  spieler: Spieler[]
  aktiverSpielerId: string
  /** Feld, das gerade hervorgehoben wird (Ziel der Bewegung). */
  hervorgehoben: number | null
  onFeldTippen: (feld: BrettFeld) => void
  children?: React.ReactNode
}

function farbeVon(feld: BrettFeld): string | null {
  if (feld.typ !== 'grundstueck' || !feld.grundstueckId) return null
  const g = grundstueck(feld.grundstueckId)
  if (!g) return null
  return gruppe(g.gruppe)?.farbe ?? null
}

const Feld = memo(function Feld({
  feld,
  besitz,
  besitzerFarbe,
  figuren,
  hervorgehoben,
  onTippen,
}: {
  feld: BrettFeld
  besitz: Besitz | undefined
  besitzerFarbe: string | null
  figuren: Spieler[]
  hervorgehoben: boolean
  onTippen: () => void
}) {
  const platz = rasterplatz(feld.position)
  const farbe = farbeVon(feld)
  const seite = kante(feld.position)
  const istEcke = feld.position % 10 === 0

  return (
    <button
      type="button"
      className={`${styles.feld} ${istEcke ? styles.ecke : ''} ${hervorgehoben ? styles.aktiv : ''}`}
      style={{
        gridRow: platz.zeile,
        gridColumn: platz.spalte,
        borderColor: besitzerFarbe ?? undefined,
        borderWidth: besitzerFarbe ? 2 : undefined,
      }}
      onClick={onTippen}
      aria-label={`${feld.name}${besitz?.besitzerId ? ', im Besitz' : ''}`}
      data-seite={seite}
    >
      {farbe && <span className={styles.streifen} style={{ background: farbe }} aria-hidden="true" />}
      <span className={styles.icon} aria-hidden="true">
        {feld.icon}
      </span>
      <span className={styles.name}>{feld.name}</span>
      {besitz && besitz.stufe > 0 && (
        <span className={styles.stufen} aria-hidden="true">
          {'▪'.repeat(besitz.stufe)}
        </span>
      )}
      {figuren.length > 0 && (
        <span className={styles.figuren} aria-hidden="true">
          {figuren.map((s) => (
            <span key={s.id} className={styles.figurMarke} style={{ background: figur(s.figurId).farbe }}>
              {figur(s.figurId).icon}
            </span>
          ))}
        </span>
      )}
    </button>
  )
})

export function Brett({
  besitz,
  spieler,
  aktiverSpielerId,
  hervorgehoben,
  onFeldTippen,
  children,
}: BrettProps) {
  const farbeJeSpieler = new Map(spieler.map((s) => [s.id, figur(s.figurId).farbe]))

  return (
    <div className={styles.brett} role="group" aria-label="Spielbrett">
      {BRETT.map((feld) => {
        const b = feld.grundstueckId ? besitz[feld.grundstueckId] : undefined
        const figuren = spieler.filter((s) => !s.insolvent && s.position === feld.position)
        // Der Spieler am Zug steht vorn, damit man ihn nicht sucht.
        figuren.sort((a, b2) =>
          a.id === aktiverSpielerId ? -1 : b2.id === aktiverSpielerId ? 1 : 0,
        )
        return (
          <Feld
            key={feld.position}
            feld={feld}
            besitz={b}
            besitzerFarbe={b?.besitzerId ? (farbeJeSpieler.get(b.besitzerId) ?? null) : null}
            figuren={figuren}
            hervorgehoben={hervorgehoben === feld.position}
            onTippen={() => onFeldTippen(feld)}
          />
        )
      })}
      <div className={styles.mitte}>{children}</div>
    </div>
  )
}
