/**
 * Der gemeinsame Baukasten für die Startbildschirme der Würfel-, Karten-
 * und Brettspiele: ein Rahmen in der Farbe des Spiels, darin Kopfbild,
 * Bilanz und große Moduskarten.
 *
 * Die Farben sind dieselben wie die der Kacheln auf der Startseite
 * (HomePage.module.css) -- wer vom Raster hierher tippt, landet in
 * derselben Farbe.
 *
 * Der Baukasten entscheidet nichts über das Spiel: Er zeigt an, was die
 * Seite ihm gibt, und meldet Tipper zurück.
 */

import type { ReactNode } from 'react'
import { useSprache } from '@/i18n/sprache'
import type { MenueSpiel } from './statistik'
import styles from './SpielMenue.module.css'

/** Der Rahmen: setzt die Akzentfarbe für alles darin. */
export function SpielMenue({ spiel, children }: { spiel: MenueSpiel; children: ReactNode }) {
  return (
    <section className={styles.menue} data-spiel={spiel}>
      {children}
    </section>
  )
}

/** Die kleine Überschrift über den Moduskarten. */
export function ModusTitel() {
  const { t } = useSprache()
  return <h2 className={styles.modusTitel}>{t.spielMenue.waehleModus}</h2>
}

interface ModusKarteProps {
  icon: string
  titel: string
  hinweis?: ReactNode
  /** Der Text der Aktionspille rechts, z. B. „Spielen“. */
  aktion: string
  onClick: () => void
  disabled?: boolean
  /**
   * `haupt`: die naheliegende Wahl, Pille gefüllt.
   * `weiter`: eine laufende Partie -- die ganze Karte in der Spielfarbe.
   */
  art?: 'haupt' | 'neben' | 'weiter'
}

/** Eine große Wahl im Menü: Symbol, Titel, eine Zeile Hinweis, klare Aktion. */
export function ModusKarte({
  icon,
  titel,
  hinweis,
  aktion,
  onClick,
  disabled = false,
  art = 'neben',
}: ModusKarteProps) {
  return (
    <button
      type="button"
      className={styles.modusKarte}
      data-art={art}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.modusIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.modusText}>
        <strong>{titel}</strong>
        {hinweis && <small>{hinweis}</small>}
      </span>
      <span className={styles.modusAktion}>
        {aktion}
        <span aria-hidden="true"> ›</span>
      </span>
    </button>
  )
}

/**
 * Eine Moduskarte mit Einstellungen darin (Schach: Stärke und Farbe).
 * Sieht aus wie eine ModusKarte, ist aber kein Knopf -- der Knopf steht
 * unten in der Fläche.
 */
export function ModusFlaeche({
  icon,
  titel,
  children,
}: {
  icon: string
  titel: string
  children: ReactNode
}) {
  return (
    <div className={styles.modusFlaeche}>
      <div className={styles.flaecheKopf}>
        <span className={styles.modusIcon} aria-hidden="true">
          {icon}
        </span>
        <h2 className={styles.flaecheTitel}>{titel}</h2>
      </div>
      {children}
    </div>
  )
}

/** Der Hauptknopf in der Spielfarbe -- für eine ModusFlaeche. */
export function AkzentKnopf({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={styles.akzentKnopf} onClick={onClick}>
      {children}
    </button>
  )
}
