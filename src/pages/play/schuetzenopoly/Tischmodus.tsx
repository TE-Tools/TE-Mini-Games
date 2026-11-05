/**
 * Das Tablet als Tisch.
 *
 * Anlass (05.11.2026, Thomas): Ein Tablet liegt beim Spielen zu mehreren
 * flach in der Mitte, und jeder sitzt an seiner Seite. Bisher war alles nach
 * unten ausgerichtet -- wer gegenüber saß, las Geld und Knöpfe auf dem Kopf.
 *
 * Hier liegt das Brett in der Mitte, und jeder Mitspieler bekommt einen Platz
 * an einer Kante, zu sich gedreht: Name, Geld, Besitz. Wer am Zug ist, hat
 * auf seinem Platz die Handlungsleiste. Die Mitte des Bretts und jede
 * Karte, die aufgeht, drehen sich zu ihm.
 *
 * Regeln stehen hier keine: Die Seite reicht die Leiste und die
 * Überlagerungen fertig herein, dieser Baustein ordnet sie nur an.
 */

import type { CSSProperties, ReactNode } from 'react'
import {
  aktiverSpieler,
  besitzVon,
  figur,
  rolle,
  type BrettFeld,
  type Spieler,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import { useMedienAbfrage } from '../useMedienAbfrage'
import { Brett } from './Brett'
import { tischplaetze, type Tischseite } from './tischplaetze'
import { BrettMitte } from './Tisch'
import styles from './Tischmodus.module.css'

const DREHUNG: Record<Tischseite, string> = {
  unten: '0deg',
  links: '90deg',
  oben: '180deg',
  rechts: '-90deg',
}

interface TischProps {
  zustand: SpielZustand
  /** Die Spieler, wie das Brett sie zeigt -- während des Laufens auf dem Zwischenfeld. */
  spielerFuerBrett: Spieler[]
  hervorgehoben: number | null
  onFeldTippen: (feld: BrettFeld) => void
  /** Die Handlungsleiste des Spielers am Zug; steht auf seinem Platz. */
  leiste: ReactNode
  /** Was gerade aufgeht: Karte, Bauen, Handel, Minispiel. Dreht sich zum Spieler am Zug. */
  ueberlagerungen: ReactNode
  /** Kleine Knöpfe in der Ecke: zurück zur normalen Ansicht, Ton. */
  ecke: ReactNode
}

export function Tischmodus({
  zustand,
  spielerFuerBrett,
  hervorgehoben,
  onFeldTippen,
  leiste,
  ueberlagerungen,
  ecke,
}: TischProps) {
  const quer = useMedienAbfrage('(orientation: landscape)')
  const plaetze = tischplaetze(zustand.spieler.length, quer)
  const aktiv = aktiverSpieler(zustand)
  const sitzVon = new Map(zustand.spieler.map((s, i) => [s.id, plaetze[i] ?? 'unten']))
  const aktivSeite = sitzVon.get(aktiv.id) ?? 'unten'
  const belegt = new Set(plaetze)

  const tiefe = (seite: Tischseite) => (belegt.has(seite) ? 'var(--sitz-tiefe)' : '10px')
  const raster = {
    '--tiefe-oben': tiefe('oben'),
    '--tiefe-unten': tiefe('unten'),
    '--tiefe-links': tiefe('links'),
    '--tiefe-rechts': tiefe('rechts'),
  } as CSSProperties
  const dreh = (seite: Tischseite) => ({ '--dreh': DREHUNG[seite] }) as CSSProperties

  return (
    <main className={styles.tisch} style={raster}>
      {zustand.spieler.map((s) => {
        const seite = sitzVon.get(s.id) ?? 'unten'
        const amZug = s.id === aktiv.id
        return (
          <section
            key={s.id}
            className={`${styles.sitz} ${amZug ? styles.sitzAmZug : ''}`}
            data-seite={seite}
            style={{ ...dreh(seite), gridArea: seite, borderColor: figur(s.figurId).farbe }}
            aria-label={`Platz von ${s.name}`}
          >
            <div className={styles.sitzInnen}>
              <Platzschild zustand={zustand} spieler={s} amZug={amZug} />
              {amZug && <div className={styles.sitzLeiste}>{leiste}</div>}
            </div>
          </section>
        )
      })}

      <div className={styles.mitte}>
        <Brett
          besitz={zustand.besitz}
          spieler={spielerFuerBrett}
          aktiverSpielerId={aktiv.id}
          hervorgehoben={hervorgehoben}
          onFeldTippen={onFeldTippen}
          className={styles.brett}
          ohneZoom
        >
          <div className={styles.mitteDreh} style={dreh(aktivSeite)}>
            <BrettMitte zustand={zustand} />
            <p className={styles.letzteZeile}>{zustand.protokoll.at(-1)?.text}</p>
          </div>
        </Brett>
        <div className={styles.ecke}>{ecke}</div>
      </div>

      <div className={styles.ueberlagerung} data-seite={aktivSeite} style={dreh(aktivSeite)}>
        {ueberlagerungen}
      </div>
    </main>
  )
}

function Platzschild({
  zustand,
  spieler,
  amZug,
}: {
  zustand: SpielZustand
  spieler: Spieler
  amZug: boolean
}) {
  const f = figur(spieler.figurId)
  const r = rolle(spieler.rolle)
  return (
    <div className={`${styles.schild} ${spieler.insolvent ? styles.raus : ''}`}>
      <span className={styles.figur} style={{ background: f.farbe }} aria-hidden="true">
        {f.icon}
      </span>
      <span className={styles.name}>
        {spieler.name}
        {spieler.typ === 'ki' && <small aria-label="Rechner"> 🤖</small>}
        <small className={styles.rolle}>
          {r.icon} {r.name}
        </small>
      </span>
      <span className={styles.werte}>
        <strong>
          {spieler.insolvent ? 'raus' : `${spieler.taler.toLocaleString('de-DE')} 🪙`}
        </strong>
        <small>
          {besitzVon(zustand, spieler.id).length} Felder
          {spieler.aufStrafbank && ' · 🚧'}
        </small>
      </span>
      {amZug && <span className={styles.zugMarke}>am Zug</span>}
    </div>
  )
}
