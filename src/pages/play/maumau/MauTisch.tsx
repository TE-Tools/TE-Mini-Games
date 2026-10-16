/**
 * Der Tisch -- Filz, Mitspieler, Mitte, Hand.
 *
 * Reine Anzeige: Diese Komponente kennt keinen Zustand und keine Regel.
 * Sie bekommt, was zu sehen ist, und sagt nach oben, was angetippt wurde.
 *
 * Warum sie überhaupt für sich steht: Denselben Tisch gibt es zweimal --
 * gegen den Rechner (MauMauPage) und online (MauMauOnline). Online weiss
 * der Client die fremden Hände nicht, sondern nur deren Anzahl; ein Tisch,
 * der den Zustand der Engine erwartet, taugt dort nicht. Zwei Tische
 * wären zwei Oberflächen, die auseinanderlaufen -- und das sieht man
 * sofort, nämlich daran, dass Online schlechter aussieht.
 */

import type { CSSProperties, ReactNode } from 'react'
import { FARB_NAME, type Karte } from '@/games/maumau'
import { Blattkarte, Farbwunsch, Ziehstapel } from './Blattkarte'
import { Handfaecher } from './Handfaecher'
import styles from '../MauMauPage.module.css'

/** Ein Mitspieler, wie der Tisch ihn braucht: Name und Kartenzahl. */
export interface TischSpieler {
  id: string
  name: string
  karten: number
  amZug: boolean
}

export interface MauTischProps {
  /** Alle außer mir, in Sitzordnung. */
  gegner: TischSpieler[]
  stapel: number
  oberste: Karte
  wunsch: string | null
  strafe: number
  richtung: 1 | -1
  /** Wer die oberste Karte gelegt hat -- daraus kommt die Flugrichtung. */
  letzterLeger: string | null
  /** Die eigene Kennung, damit „von mir" erkannt wird. */
  ichId: string | null
  protokoll: string[]

  hand: Karte[]
  istSpielbar: (k: Karte) => boolean
  amZug: boolean
  amZugName: string
  gezogene: Karte | null
  /** Steht die vorletzte Karte an? Dann gibt es den Mau-Knopf. */
  mauMoeglich: boolean
  mauGesagt: boolean
  /** „Mau!" oder „Letzte Karte!". */
  ansage: string
  /** Französisches Blatt: andere Farben zur Auswahl. */
  klassisch: boolean
  /** Für welche Karte gerade eine Farbe gewählt wird. */
  wunschFuer: Karte | null

  onZiehen: () => void
  onLegen: (k: Karte) => void
  onBehalten: () => void
  onMau: () => void
  onFarbe: (farbe: string) => void
  onWunschAbbruch: () => void
  /** Zusätzliche Zeile unter dem Tisch -- online steht da der Spielcode. */
  kopfzeile?: ReactNode
  /** Was gerade schiefging. */
  fehler?: string | null
}

export function MauTisch({
  gegner,
  stapel,
  oberste,
  wunsch,
  strafe,
  richtung,
  letzterLeger,
  ichId,
  protokoll,
  hand,
  istSpielbar,
  amZug,
  amZugName,
  gezogene,
  mauMoeglich,
  mauGesagt,
  ansage,
  klassisch,
  wunschFuer,
  onZiehen,
  onLegen,
  onBehalten,
  onMau,
  onFarbe,
  onWunschAbbruch,
  kopfzeile,
  fehler,
}: MauTischProps) {
  /*
   * Woher die zuletzt gelegte Karte kommt: von dem Platz, der sie gelegt
   * hat. Ausgelöst wird die Bewegung ohne Zustand -- der Schlüssel der
   * Karte ändert sich, also entsteht das Element neu und spielt seine
   * Animation. (Ein setState im Effekt wäre hier auch das, was ESLint
   * zu Recht verbietet.)
   */
  const legerPlatz = gegner.findIndex((s) => s.id === letzterLeger)
  const vonMir = letzterLeger !== null && letzterLeger === ichId
  const flugX = vonMir || legerPlatz < 0 ? 0 : (legerPlatz - (gegner.length - 1) / 2) * 92
  const flugY = vonMir ? 150 : -120
  const nichtsPasst = amZug && !gezogene && !hand.some((k) => istSpielbar(k))

  return (
    <section className={styles.tisch}>
      {kopfzeile}

      {/* Bande aussen, Filz innen -- die Mitspieler sitzen mit am Tisch. */}
      <div className={styles.bande}>
        <div className={styles.filz}>
          <div className={styles.gegner}>
            {gegner.map((s) => (
              <Gegner key={s.id} spieler={s} />
            ))}
          </div>

          <div className={styles.mitte} role="group" aria-label="Tischmitte">
            <Ziehstapel anzahl={stapel} gesperrt={!amZug || Boolean(gezogene)} onClick={onZiehen} />
            <div className={styles.ablage}>
              <span
                key={oberste.id}
                className={styles.geflogen}
                style={
                  {
                    '--von-x': `${flugX}px`,
                    '--von-y': `${flugY}px`,
                  } as CSSProperties
                }
              >
                <Blattkarte karte={oberste} />
              </span>
              {wunsch && (
                <span className={styles.wunschBand}>
                  <Farbwunsch farbe={wunsch} />
                </span>
              )}
            </div>
            <div className={styles.lage}>
              {strafe > 0 && <span className={styles.strafe}>+{strafe}</span>}
              <span className={styles.richtung} aria-hidden="true">
                {richtung === 1 ? '↻' : '↺'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ol className={styles.protokoll} aria-label="Was bisher geschah">
        {protokoll
          .slice(-2)
          .reverse()
          .map((zeile, i) => (
            <li key={`${protokoll.length}-${i}`}>{zeile}</li>
          ))}
      </ol>

      {fehler && (
        <p className={styles.hinweis} role="alert">
          {fehler}
        </p>
      )}

      <div className={styles.unten}>
        {wunschFuer ? (
          <div className={styles.farbwahl} role="group" aria-label="Farbe wünschen">
            <p className={styles.farbfrage}>Welche Farbe?</p>
            <div className={styles.farbknoepfe}>
              {(klassisch
                ? (['herz', 'karo', 'pik', 'kreuz'] as const)
                : (['rot', 'blau', 'gruen', 'gelb'] as const)
              ).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={styles.farbknopf}
                  data-farbe={f}
                  onClick={() => onFarbe(f)}
                >
                  {FARB_NAME[f]}
                </button>
              ))}
            </div>
            <button type="button" className={styles.abbruch} onClick={onWunschAbbruch}>
              Abbrechen
            </button>
          </div>
        ) : (
          <>
            <div className={styles.handZeile}>
              <span className={styles.handTitel}>
                {amZug ? 'Du bist dran' : `${amZugName} ist dran …`}
              </span>
              {amZug && mauMoeglich && (
                <button
                  type="button"
                  className={mauGesagt ? styles.mauAn : styles.mau}
                  onClick={onMau}
                  aria-pressed={mauGesagt}
                >
                  {ansage}
                </button>
              )}
            </div>

            {gezogene && amZug && (
              /*
                Die gezogene Karte steht hier und nicht nur im Fächer:
                Bei einer langen Hand sucht man sie sonst.
              */
              <div className={styles.gezogen}>
                <span>Gezogen – legen?</span>
                <Blattkarte
                  karte={gezogene}
                  klein
                  spielbar={istSpielbar(gezogene)}
                  onClick={istSpielbar(gezogene) ? () => onLegen(gezogene) : undefined}
                />
                <button type="button" className={styles.klein} onClick={onBehalten}>
                  Behalten
                </button>
              </div>
            )}

            <Handfaecher karten={hand} istSpielbar={istSpielbar} onLegen={onLegen} amZug={amZug} />

            {nichtsPasst && (
              <p className={styles.hinweis}>Nichts passt – zieh eine Karte vom Stapel.</p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function Gegner({ spieler }: { spieler: TischSpieler }) {
  return (
    <div className={styles.gegnerKarte} data-zug={spieler.amZug ? 'ja' : undefined}>
      <div className={styles.gegnerBlatt} aria-hidden="true">
        {Array.from({ length: Math.min(spieler.karten, 5) }, (_, i) => (
          <span
            key={i}
            className={styles.gegnerkarte}
            style={{ '--i': i, zIndex: i } as CSSProperties}
          >
            <Blattkarte zu klein />
          </span>
        ))}
      </div>
      <span className={styles.gegnerName}>{spieler.name}</span>
      <span className={styles.gegnerZahl}>
        {spieler.karten} {spieler.karten === 1 ? 'Karte' : 'Karten'}
      </span>
    </div>
  )
}
