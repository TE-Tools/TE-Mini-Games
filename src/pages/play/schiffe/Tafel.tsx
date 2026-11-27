/**
 * Was um die Meere herum steht: Kopfzeile, die beiden Meere mit Namen und
 * Flottenstand, die Meldung beim Einschlag, die Hausregeln. Für die Partie
 * gegen den Computer, zu zweit und online dieselben Bausteine.
 */
import type { ReactNode, Ref } from 'react'
import {
  FLOTTE,
  HAUSREGELN,
  STANDARD_REGELN,
  istVersenkt,
  type SchiffeRegeln,
  type Sicht,
} from '@/games/schiffe-versenken'
import { useSprache } from '@/i18n/sprache'
import { Meer } from './Meer'
import type { Meldung } from './useSchussFolge'
import shell from '../PlayShell.module.css'
import styles from './Schiffe.module.css'

export function Kopf({
  titel,
  onZurueck,
  rechts,
}: {
  titel: string
  onZurueck: () => void
  rechts?: ReactNode
}) {
  const { t } = useSprache()
  return (
    <header className={shell.header}>
      <button
        type="button"
        className={shell.back}
        onClick={onZurueck}
        aria-label={t.allgemein.zurueck}
      >
        ←
      </button>
      <h1 className={shell.title}>{titel}</h1>
      {typeof rechts === 'string' ? (
        <span className={shell.levelBadge}>{rechts}</span>
      ) : (
        (rechts ?? <span aria-hidden="true" />)
      )}
    </header>
  )
}

/** Die Hausregeln zum Umlegen -- die Partie nimmt sie beim Start mit. */
export function RegelWahl({
  regeln,
  onRegeln,
}: {
  regeln: SchiffeRegeln
  onRegeln: (r: SchiffeRegeln) => void
}) {
  const { t } = useSprache()
  const ts = t.schiffe
  const abweichend = HAUSREGELN.filter((k) => regeln[k] !== STANDARD_REGELN[k]).length
  return (
    <details className={styles.regeln}>
      <summary>
        <span>{ts.hausregeln}</span>
        <small>{abweichend === 0 ? ts.standardRegeln : ts.abweichend(abweichend)}</small>
      </summary>
      <ul>
        {HAUSREGELN.map((k) => (
          <li key={k}>
            <label className={styles.schalter}>
              <input
                type="checkbox"
                checked={regeln[k]}
                onChange={(e) => onRegeln({ ...regeln, [k]: e.target.checked })}
              />
              <span>
                <strong>{ts.regel[k].titel}</strong>
                <small>{ts.regel[k].text}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {abweichend > 0 && (
        <button type="button" className={styles.klein} onClick={() => onRegeln(STANDARD_REGELN)}>
          {ts.regelnZuruecksetzen}
        </button>
      )}
    </details>
  )
}

export function RegelZeile({ regeln }: { regeln: SchiffeRegeln }) {
  const { t } = useSprache()
  const ts = t.schiffe
  const anders = HAUSREGELN.filter((k) => regeln[k] !== STANDARD_REGELN[k])
  if (anders.length === 0) return null
  return (
    <p className={styles.regelZeile}>
      {ts.hausregeln}: {anders.map((k) => ts.regel[k].kurz(regeln[k])).join(' · ')}
    </p>
  )
}

/** Wie viele Schiffe einer Flotte noch schwimmen -- als kleine Rümpfe. */
function FlottenStand({ versenkt }: { versenkt: ReadonlySet<string> }) {
  const { t } = useSprache()
  const n = FLOTTE.length - versenkt.size
  return (
    <span className={styles.flottenStand} aria-label={t.schiffe.schwimmen(n, FLOTTE.length)}>
      {FLOTTE.map((a) => (
        <span
          key={a.id}
          className={versenkt.has(a.id) ? styles.rumpfWeg : styles.rumpf}
          style={{ width: `${a.laenge * 0.42}rem` }}
          title={t.schiffe.schiffNamen[a.id]}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function MeldungsBanner({ meldung }: { meldung: Meldung }) {
  const { t } = useSprache()
  const ts = t.schiffe
  const text =
    meldung.ergebnis === 'versenkt'
      ? ts.meldung.versenkt(meldung.schiff ? ts.schiffNamen[meldung.schiff] : '')
      : ts.meldung[meldung.ergebnis]
  return (
    <div
      key={meldung.nr}
      className={styles.meldung}
      data-art={meldung.ergebnis}
      role="status"
      style={{ top: meldung.feld < 50 ? '76%' : '22%' }}
    >
      {text}
    </div>
  )
}

/**
 * Das Spielfeld: oben groß das fremde Meer zum Zielen, darunter klein die
 * eigene Flotte. `sicht` ist schon die gezeigte Sicht (nur eingeschlagene
 * Schüsse).
 */
export function Spielfeld({
  sicht,
  gegnerName,
  zielen,
  onZiel,
  zielRef,
  eigenRef,
  meldung,
  letzterMein,
  letzterSein,
}: {
  sicht: Sicht
  gegnerName: string
  zielen: boolean
  onZiel: (feld: number) => void
  zielRef: Ref<HTMLDivElement>
  eigenRef: Ref<HTMLDivElement>
  meldung: Meldung | null
  letzterMein: number | null
  letzterSein: number | null
}) {
  const { t } = useSprache()
  const ts = t.schiffe
  const versenktFremd = new Set(
    sicht.gegnerFlotte.filter((s) => istVersenkt(s, sicht.eigeneSchuesse)).map((s) => s.id),
  )
  const versenktEigen = new Set(
    sicht.eigeneFlotte.filter((s) => istVersenkt(s, sicht.gegnerSchuesse)).map((s) => s.id),
  )
  return (
    <div className={styles.spielfeld}>
      <div className={styles.meerKopf}>
        <span>{ts.meerVon(gegnerName)}</span>
        <FlottenStand versenkt={versenktFremd} />
      </div>
      <Meer
        flotte={sicht.gegnerFlotte}
        schuesse={sicht.eigeneSchuesse}
        fremd
        groesse="gross"
        beschriftung={ts.meerVon(gegnerName)}
        zielen={zielen}
        onFeld={onZiel}
        markiert={letzterMein}
        brettRef={zielRef}
      >
        {meldung?.brett === 'ziel' && <MeldungsBanner meldung={meldung} />}
      </Meer>
      <div className={styles.meerKopf}>
        <span>{ts.eigenesMeer}</span>
        <FlottenStand versenkt={versenktEigen} />
      </div>
      <Meer
        flotte={sicht.eigeneFlotte}
        schuesse={sicht.gegnerSchuesse}
        groesse="klein"
        beschriftung={ts.eigenesMeer}
        markiert={letzterSein}
        brettRef={eigenRef}
      >
        {meldung?.brett === 'eigen' && <MeldungsBanner meldung={meldung} />}
      </Meer>
    </div>
  )
}
