/**
 * Das Schachbrett. Zeigt an und meldet Antippen -- es entscheidet nichts.
 * Welche Felder ein Ziel sind, sagt die Seite (aus `zieleVon`).
 */
import { feldName, type Farbe, type Stellung } from '@/games/schach'
import { useSprache } from '@/i18n/sprache'
import { figurName, figurZeichen } from './figuren'
import styles from './Brett.module.css'

interface Props {
  stellung: Stellung
  /** Welche Farbe unten steht -- die eigene. */
  unten: Farbe
  auswahl: number | null
  /** Die Felder, auf die die ausgewählte Figur ziehen darf. */
  ziele: number[]
  letzterZug: { von: number; nach: number } | null
  /** Solange gesperrt (nicht dran, Partie aus), meldet das Brett nichts. */
  gesperrt: boolean
  onFeld: (feld: number) => void
}

export function Brett({ stellung, unten, auswahl, ziele, letzterZug, gesperrt, onFeld }: Props) {
  const { t } = useSprache()
  const reihen = unten === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const linien = unten === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const imSchach = stellung.imSchach() ? stellung.koenig[stellung.seite === 1 ? 0 : 1] : -1
  const zielMenge = new Set(ziele)

  return (
    <div className={styles.brett} role="grid" aria-label={t.schach.brett}>
      {reihen.map((reihe, zeile) => (
        <div key={reihe} className={styles.reihe} role="row">
          {linien.map((linie, spalte) => {
            const feld = reihe * 16 + linie
            const figur = stellung.brett[feld]!
            const hell = (reihe + linie) % 2 === 1
            const ziel = zielMenge.has(feld)
            const klassen = [
              styles.feld,
              hell ? styles.hell : styles.dunkel,
              auswahl === feld && styles.gewaehlt,
              letzterZug && (letzterZug.von === feld || letzterZug.nach === feld) && styles.letzter,
              feld === imSchach && styles.schach,
              ziel && (figur ? styles.schlagZiel : styles.ziel),
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={feld}
                type="button"
                role="gridcell"
                className={klassen}
                data-feld={feldName(feld)}
                aria-label={t.schach.feld(feldName(feld), figur ? figurName(t, figur) : '')}
                aria-selected={auswahl === feld}
                disabled={gesperrt}
                onClick={() => onFeld(feld)}
              >
                {figur !== 0 && (
                  <span
                    className={`${styles.figur} ${figur > 0 ? styles.weiss : styles.schwarz}`}
                    aria-hidden="true"
                  >
                    {figurZeichen(figur)}
                  </span>
                )}
                {spalte === 0 && (
                  <span className={styles.reihenName} aria-hidden="true">
                    {reihe + 1}
                  </span>
                )}
                {zeile === 7 && (
                  <span className={styles.linienName} aria-hidden="true">
                    {'abcdefgh'[linie]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
