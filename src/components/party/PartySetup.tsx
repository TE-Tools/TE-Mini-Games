/**
 * Das Gerüst der Partyspiel-Einstellungen: dieselbe Kopfzeile wie jede
 * andere Spielseite (PlayShell), darunter eine Zeile mit Bild und Farbe des
 * Spiels, die Karten mit den Einstellungen und ein großer Startknopf.
 *
 * Jede Seite setzt ihre Farbe mit `akzentStil()` auf `<main>`; alles hier
 * liest nur `--akzent`.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSprache } from '@/i18n/sprache'
import shell from '@/pages/play/PlayShell.module.css'
import styles from './PartySetup.module.css'

/** Kopfzeile wie bei Kniffel & Co.: Zurück, Name, rechts Platz für ein Abzeichen. */
export function PartyKopf({
  titel,
  rechts,
  onZurueck,
}: {
  titel: string
  rechts?: ReactNode
  /** Ohne: zurück zur Startseite. */
  onZurueck?: () => void
}) {
  const { t } = useSprache()
  return (
    <header className={`${shell.header} ${styles.kopf}`}>
      {onZurueck ? (
        <button
          type="button"
          className={shell.back}
          onClick={onZurueck}
          aria-label={t.allgemein.zurueck}
        >
          ←
        </button>
      ) : (
        <Link to="/" className={shell.back} aria-label={t.allgemein.zurueck}>
          ←
        </Link>
      )}
      <h1 className={shell.title}>{titel}</h1>
      {rechts ?? <span aria-hidden="true" className={styles.kopfPlatz} />}
    </header>
  )
}

/** Bild des Spiels in seiner Farbe und ein, zwei Sätze, worum es geht. */
export function PartyHeld({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <section className={styles.held}>
      <span className={styles.heldIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.heldText}>{children}</p>
    </section>
  )
}

/** Eine Karte mit Überschrift. */
export function PartyKarte({
  titel,
  zusatz,
  children,
}: {
  titel?: ReactNode
  /** Steht rechts neben der Überschrift, z. B. „4 von 12". */
  zusatz?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.karte}>
      {(titel || zusatz) && (
        <div className={styles.karteKopf}>
          {titel && <h2 className={styles.karteTitel}>{titel}</h2>}
          {zusatz}
        </div>
      )}
      {children}
    </section>
  )
}

/** Der eine große Knopf, mit dem es losgeht. Bleibt beim Scrollen unten sichtbar. */
export function StartKnopf({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className={styles.startLeiste}>
      <button type="button" className={styles.start} onClick={onClick} disabled={disabled}>
        <span className={styles.startText}>{children}</span>
        <span className={styles.startPfeil} aria-hidden="true">
          ▶
        </span>
      </button>
    </div>
  )
}

/** Der zweite Weg (online, Editor …) -- ruhig, unter dem Start. */
export function ZweiterKnopf({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={styles.zweit} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Ein Schieberegler in der Farbe des Spiels. Die Beschriftung trägt den Wert
 * schon mit („Zeit je Person: 60 s") -- so steht er im Wörterbuch an einer Stelle.
 */
export function PartyRegler({
  beschriftung,
  wert,
  min,
  max,
  schritt = 1,
  onWert,
}: {
  beschriftung: string
  wert: number
  min: number
  max: number
  schritt?: number
  onWert: (wert: number) => void
}) {
  const anteil = ((wert - min) / (max - min)) * 100
  return (
    <label className={styles.regler}>
      <span className={styles.reglerText}>{beschriftung}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={schritt}
        value={wert}
        onChange={(e) => onWert(Number(e.target.value))}
        style={{ ['--anteil' as string]: `${anteil}%` }}
      />
    </label>
  )
}
