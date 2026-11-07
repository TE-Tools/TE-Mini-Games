/**
 * Die beiden Werbe-Angebote von Trapbound, als eigene Bausteine, damit sie
 * sich ohne laufende Spielschleife testen lassen.
 *
 *  - `UeberspringenAngebot`: nach vielen Toden in einem Anlauf das Level
 *    überspringen (`trapbound-ueberspringen`). Gebucht wird nur der
 *    Fortschritt -- kein Ergebnis, keine Punkte, keine XP, kein Rekord.
 *  - `FigurWahl`: die Figur „Glut“ mit Leuchtspur, nur per Video
 *    (`trapbound-farbe`). Reine Optik, bleibt dauerhaft auf dem Gerät.
 *
 * Ohne Netz, ohne Werbung oder ohne Video erscheint von beidem nichts.
 */
import {
  FIGUREN,
  darfUeberspringen,
  istFrei,
  merkeUebersprungen,
  schalteFrei,
  schreibeAussehen,
  waehle,
  type Aussehen,
  type Stand,
} from '@/games/trapbound'
import { recordLevelComplete } from '@/offline'
import { BelohnungsKnopf } from '@/components/werbung/BelohnungsKnopf'
import { useSprache } from '@/i18n/sprache'
import styles from './TrapboundPage.module.css'

interface UeberspringenProps {
  nr: number
  /** Tode in diesem Anlauf. */
  tode: number
  hilfeGenutzt: boolean
  geschafft: boolean
  /** Bevor das Video startet -- das Spiel hält an. */
  onVorDemVideo?: () => void
  /** Nach dem zu Ende geschauten Video, mit dem neuen Stand. */
  onUebersprungen: (stand: Stand) => void
}

export function UeberspringenAngebot({
  nr,
  tode,
  hilfeGenutzt,
  geschafft,
  onVorDemVideo,
  onUebersprungen,
}: UeberspringenProps) {
  const { t } = useSprache()
  const aktiv = darfUeberspringen({ nr, tode, hilfeGenutzt, geschafft })
  if (!aktiv) return null
  return (
    <div className={styles.werbeAngebot} onClickCapture={() => onVorDemVideo?.()}>
      <BelohnungsKnopf
        name="trapbound-ueberspringen"
        aktiv={aktiv}
        belohnung={t.trapbound.ueberspringenBelohnung}
        onBelohnt={() => {
          // Lokal: geschafft ohne Bestwerte, nächstes Level offen.
          const stand = merkeUebersprungen(nr)
          onUebersprungen(stand)
          // App-weit nur der Fortschritt (0 XP). Kein saveGameResult: Es gibt
          // kein Ergebnis, also auch keinen Rekord und keine Sterne.
          void recordLevelComplete('trapbound', nr, 0).catch((e: unknown) => console.error(e))
        }}
      />
    </div>
  )
}

interface FigurWahlProps {
  aussehen: Aussehen
  onAendern: (a: Aussehen) => void
}

export function FigurWahl({ aussehen, onAendern }: FigurWahlProps) {
  const { t } = useSprache()
  const tb = t.trapbound
  const namen: Record<string, string> = { hell: tb.figurHell, glut: tb.figurGlut }
  const gesperrt = FIGUREN.filter((f) => !istFrei(aussehen, f.id))
  const waehlbar = FIGUREN.filter((f) => istFrei(aussehen, f.id))
  // Solange nur die Grundfigur da ist, gibt es nichts zu wählen -- dann
  // zeigt sich höchstens das Angebot, und ohne Video bleibt alles wie immer.
  const mitWahl = waehlbar.length > 1

  return (
    <>
      {mitWahl && (
        <div className={styles.figurWahl}>
          <h2 className={styles.figurTitel}>{tb.figurTitel}</h2>
          <div className={styles.figurReihe}>
            {waehlbar.map((f) => (
              <button
                key={f.id}
                type="button"
                className={styles.figurKnopf}
                aria-pressed={aussehen.gewaehlt === f.id}
                onClick={() => onAendern(schreibeAussehen(waehle(aussehen, f.id)))}
              >
                <span
                  className={styles.figurFarbe}
                  style={{
                    background: f.farbe,
                    boxShadow: f.spur ? `-6px 0 0 -2px ${f.spur}` : undefined,
                  }}
                  aria-hidden="true"
                />
                {namen[f.id] ?? f.id}
              </button>
            ))}
          </div>
          <p className={styles.hinweis}>{tb.figurNurOptik}</p>
        </div>
      )}
      {gesperrt.map((f) => (
        <BelohnungsKnopf
          key={f.id}
          name="trapbound-farbe"
          aktiv={true}
          belohnung={tb.figurGlutBelohnung}
          onBelohnt={() => onAendern(schreibeAussehen(schalteFrei(aussehen, f.id)))}
        />
      ))}
    </>
  )
}
