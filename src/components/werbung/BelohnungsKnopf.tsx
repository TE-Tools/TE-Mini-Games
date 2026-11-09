/**
 * Der eine Knopf, über den ein Spiel Werbung anbietet.
 *
 * Er erscheint nur, wenn wirklich ein Video bereitsteht -- offline, ohne
 * Werbung oder ohne Video ist er nicht da, und das Spiel sieht aus wie
 * immer. Beschriftet ist er immer als Werbevideo: Wer tippt, soll wissen,
 * worauf er sich einlässt.
 *
 * Das Spiel sagt nur, WANN es anbietet (`aktiv`), WAS es dafür gibt
 * (`belohnung`) und was bei einem zu Ende geschauten Video passiert
 * (`onBelohnt`). Wie oft, entscheidet das Spiel über `aktiv`.
 */
import { useEffect, useState } from 'react'
import { belohnungAnfragen, type Angebot } from '@/services/werbung'
import { useSprache } from '@/i18n/sprache'
import styles from './BelohnungsKnopf.module.css'

interface Props {
  /** Die Stelle, für AdSense-Berichte, z.B. 'sudoku-tipp'. */
  name: string
  /** Darf gerade angeboten werden? */
  aktiv: boolean
  /** Was es gibt, schon in der Sprache der Oberfläche, z.B. „+1 Tipp“. */
  belohnung: string
  onBelohnt: () => void
  className?: string
}

export function BelohnungsKnopf({ name, aktiv, belohnung, onBelohnt, className }: Props) {
  const { t } = useSprache()
  const [angebot, setAngebot] = useState<Angebot | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [abgebrochen, setAbgebrochen] = useState(false)
  // Nach jedem Video neu fragen, solange das Spiel weiter anbietet.
  const [runde, setRunde] = useState(0)

  useEffect(() => {
    // Nicht aktiv: Der Knopf rendert ohnehin nichts; ein altes Angebot
    // wird beim nächsten Anfragen ersetzt.
    if (!aktiv) return
    let weg = false
    void belohnungAnfragen(name).then((a) => {
      if (!weg) setAngebot(a)
    })
    return () => {
      weg = true
    }
  }, [aktiv, name, runde])

  if (!aktiv || (!angebot && !abgebrochen)) return null

  return (
    <div className={`${styles.rahmen} ${className ?? ''}`}>
      {angebot && (
        <button
          type="button"
          className={styles.knopf}
          disabled={laeuft}
          onClick={async () => {
            setLaeuft(true)
            setAbgebrochen(false)
            const geschaut = await angebot.zeigen()
            setLaeuft(false)
            setAngebot(null)
            if (geschaut) onBelohnt()
            else setAbgebrochen(true)
            setRunde((r) => r + 1)
          }}
        >
          <span aria-hidden="true">▶</span>{' '}
          {laeuft ? t.werbung.laeuft : t.werbung.videoAnsehen(belohnung)}
          <small className={styles.hinweis}>{t.werbung.hinweis}</small>
        </button>
      )}
      {abgebrochen && !angebot && (
        <p className={styles.abgebrochen} role="status">
          {t.werbung.abgebrochen}
        </p>
      )}
    </div>
  )
}
