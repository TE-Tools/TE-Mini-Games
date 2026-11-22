/**
 * Die Hausregeln zum Umlegen -- einmal für beide Stellen, an denen sie
 * gewählt werden: im Aufbau gegen den Rechner und im Online-Warteraum.
 *
 * Thomas am 15.10.2026: „man kann entscheiden, ob 2 auf plus 2 geht, 4
 * auf plus 4 geht, schwarze Karte auf schwarze Karte geht ... das als
 * Auswahlmöglichkeit." Genau deshalb steht das Kontern nicht als ein
 * Schalter da, sondern als fünf -- und deshalb steht die Liste hier und
 * nicht zweimal in zwei Seiten.
 */

import type { Konter, Spielart } from '@/games/maumau'
import { useSprache } from '@/i18n/sprache'
import { KONTER_REGELN } from './konterRegeln'
import styles from '../MauMauPage.module.css'

/** Was sich einzeln umlegen lässt. */
export interface HausregelStand {
  konter: Konter
  ziehenBisPassend: boolean
  haendeWandern: boolean
}

/** Eine Hausregel: an oder aus, mit einem Satz dazu, warum. */
export function Schalter({
  name,
  erklaerung,
  an,
  onUm,
  gesperrt,
}: {
  name: string
  erklaerung: string
  an: boolean
  onUm: () => void
  gesperrt?: boolean
}) {
  return (
    <button
      type="button"
      className={styles.schalter}
      onClick={onUm}
      aria-pressed={an}
      aria-label={name}
      disabled={gesperrt}
    >
      <span className={styles.schalterText}>
        <strong>{name}</strong>
        <small>{erklaerung}</small>
      </span>
      <span className={an ? styles.kipperAn : styles.kipper} aria-hidden="true">
        <span className={styles.knubbel} />
      </span>
    </button>
  )
}

/** Die Spielart -- nur beim bunten Blatt gibt es eine Wahl. */
export function Spielartwahl({
  art,
  onArt,
  gesperrt,
}: {
  art: Spielart
  onArt: (a: Spielart) => void
  gesperrt?: boolean
}) {
  const { t } = useSprache()
  return (
    <fieldset className={styles.gruppe}>
      <legend>{t.maumau.wieWirdGespielt}</legend>
      <div className={styles.knopfreihe}>
        {(['bunt', 'extrem'] as Spielart[]).map((a) => (
          <button
            key={a}
            type="button"
            className={art === a ? styles.wahlAn : styles.wahlAus}
            onClick={() => onArt(a)}
            disabled={gesperrt}
          >
            {t.maumau.spielarten[a].name}
          </button>
        ))}
      </div>
      <p className={styles.erklaerung}>{t.maumau.spielarten[art].erklaerung}</p>
    </fieldset>
  )
}

/** Alle Hausregeln als Liste von Schaltern. */
export function Hausregelwahl({
  klassisch,
  stand,
  onStand,
  gesperrt,
}: {
  klassisch: boolean
  stand: HausregelStand
  onStand: (neu: HausregelStand) => void
  gesperrt?: boolean
}) {
  const { t } = useSprache()
  return (
    <fieldset className={styles.gruppe}>
      <legend>{t.maumau.hausregeln}</legend>
      <ul className={styles.regelliste}>
        {KONTER_REGELN.filter((r) => klassisch === false || r.auchKlassisch).map((r) => (
          <li key={r.id}>
            {/* Name und Erklärung kommen über die Kennung aus dem Wörterbuch. */}
            <Schalter
              name={klassisch ? t.maumau.konter[r.id].nameKlassisch : t.maumau.konter[r.id].name}
              erklaerung={t.maumau.konter[r.id].erklaerung}
              an={stand.konter[r.id]}
              gesperrt={gesperrt}
              onUm={() =>
                onStand({
                  ...stand,
                  konter: { ...stand.konter, [r.id]: !stand.konter[r.id] },
                })
              }
            />
          </li>
        ))}
        <li>
          <Schalter
            name={t.maumau.ziehenBisPassend}
            erklaerung={t.maumau.ziehenBisPassendText}
            an={stand.ziehenBisPassend}
            gesperrt={gesperrt}
            onUm={() => onStand({ ...stand, ziehenBisPassend: !stand.ziehenBisPassend })}
          />
        </li>
        {!klassisch && (
          <li>
            <Schalter
              name={t.maumau.haendeWandern}
              erklaerung={t.maumau.haendeWandernText}
              an={stand.haendeWandern}
              gesperrt={gesperrt}
              onUm={() => onStand({ ...stand, haendeWandern: !stand.haendeWandern })}
            />
          </li>
        )}
      </ul>
    </fieldset>
  )
}
