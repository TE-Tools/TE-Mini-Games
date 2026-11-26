/**
 * "So geht's" statt einer Textwand über der Levelkarte: drei kurze Schritte
 * mit Bild, die ganze Erklärung zum Aufklappen. Nach der ersten Runde
 * (`merkeSoGehtsGesehen`) steht nur noch eine schmale Leiste da, die die
 * Schritte auf Wunsch wieder zeigt.
 */
import { useId, useState, type CSSProperties } from 'react'
import { useSprache } from '@/i18n/sprache'
import { soGehtsGesehen } from './soGehtsSpeicher'
import styles from './SoGehts.module.css'

export interface SoGehtsSchritt {
  bild: string
  text: string
}

interface Props {
  /** Kennung für den Speicher, meist die gameId. */
  spiel: string
  schritte: readonly SoGehtsSchritt[]
  /** Die vollständige Erklärung hinter "Mehr erklären"; ohne sie kein Knopf. */
  mehr?: string
  /** Ein kurzer Satz unter den Schritten, sichtbar, solange die Karte offen ist. */
  fussnote?: string
  akzent?: string
}

export function SoGehts({ spiel, schritte, mehr, fussnote, akzent }: Props) {
  const { t } = useSprache()
  const z = t.levelZiel
  const [offen, setOffen] = useState(() => !soGehtsGesehen(spiel))
  const [ausfuehrlich, setAusfuehrlich] = useState(false)
  const mehrId = useId()
  const schritteId = useId()
  const stil = akzent ? ({ '--so-akzent': akzent } as CSSProperties) : undefined

  return (
    <section className={styles.karte} style={stil} aria-label={z.soGehts}>
      <button
        type="button"
        className={styles.kopf}
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        aria-controls={schritteId}
      >
        <span className={styles.kopfBild} aria-hidden="true">
          💡
        </span>
        <span className={styles.kopfText}>{z.soGehts}</span>
        <span className={styles.pfeil} aria-hidden="true">
          {offen ? '▲' : '▼'}
        </span>
      </button>

      {offen && (
        <div id={schritteId}>
          <ol className={styles.schritte}>
            {schritte.map((s, i) => (
              <li key={i} className={styles.schritt} style={{ '--i': i } as CSSProperties}>
                <span className={styles.nummer} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.bild} aria-hidden="true">
                  {s.bild}
                </span>
                <span className={styles.schrittText}>{s.text}</span>
              </li>
            ))}
          </ol>
          {fussnote && <p className={styles.fussnote}>{fussnote}</p>}
          {mehr ? (
            <>
              <button
                type="button"
                className={styles.mehrKnopf}
                onClick={() => setAusfuehrlich((a) => !a)}
                aria-expanded={ausfuehrlich}
                aria-controls={mehrId}
              >
                {ausfuehrlich ? z.wenigerErklaeren : z.mehrErklaeren}
              </button>
              {ausfuehrlich && (
                <p id={mehrId} className={styles.mehr}>
                  {mehr}
                </p>
              )}
            </>
          ) : (
            <div className={styles.abschluss} />
          )}
        </div>
      )}
    </section>
  )
}
