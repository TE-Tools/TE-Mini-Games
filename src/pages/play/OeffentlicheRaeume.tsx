/**
 * Die Liste der öffentlichen Räume in einer Online-Lobby.
 *
 * Ein Baustein für alle fünf Online-Spiele: Wer den Raum aufgemacht hat,
 * wie viele schon drin sind, ein Knopf zum Beitreten. Die Liste holt sich
 * selbst alle zehn Sekunden neu -- wer wartet, soll sehen, wenn ein Raum
 * aufgeht, ohne die Seite neu zu laden.
 */

import { useEffect, useState } from 'react'
import { OEFFENTLICH_ERNEUERN_MS, type OeffentlicherRaum } from '@/services/raeume'
import styles from './OeffentlicheRaeume.module.css'

interface Props {
  /** Holt die aktuelle Liste vom Server. */
  laden: () => Promise<OeffentlicherRaum[]>
  /** Beitreten über den Code des Raums. */
  onBeitreten: (raum: OeffentlicherRaum) => void
  /** Während ein anderer Aufruf läuft, sind die Knöpfe gesperrt. */
  gesperrt?: boolean
}

export function OeffentlicheRaeume({ laden, onBeitreten, gesperrt = false }: Props) {
  const [raeume, setRaeume] = useState<OeffentlicherRaum[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    let abbruch = false
    const hole = () => {
      void laden()
        .then((liste) => {
          if (abbruch) return
          setRaeume(liste)
          setFehler(null)
        })
        .catch((e: unknown) => {
          // Die Liste ist nur Komfort: Ohne sie bleibt der Weg über den Code.
          // Aber warum sie fehlt, soll dastehen -- meist ist auf dem Server
          // die Migration 018 noch nicht eingespielt.
          if (abbruch) return
          setRaeume((alt) => alt ?? [])
          setFehler(e instanceof Error ? e.message : 'Die Liste ließ sich nicht laden.')
        })
    }
    hole()
    const uhr = window.setInterval(hole, OEFFENTLICH_ERNEUERN_MS)
    return () => {
      abbruch = true
      window.clearInterval(uhr)
    }
  }, [laden])

  return (
    <section className={styles.kasten} aria-label="Öffentliche Räume">
      <h2 className={styles.titel}>Öffentliche Räume</h2>
      {raeume === null && <p className={styles.leise}>Suche nach offenen Räumen…</p>}
      {fehler && <p className={styles.leise}>{fehler}</p>}
      {raeume?.length === 0 && !fehler && (
        <p className={styles.leise}>
          Gerade wartet niemand. Mach selbst einen öffentlichen Raum auf – dann steht er hier für
          alle.
        </p>
      )}
      {raeume && raeume.length > 0 && (
        <ul className={styles.liste}>
          {raeume.map((r) => (
            <li key={r.match_id} className={styles.zeile}>
              <div className={styles.text}>
                <strong className={styles.name}>Raum von {r.host_name}</strong>
                <span className={styles.klein}>
                  {r.size} {r.size === 1 ? 'Person' : 'Personen'}
                  {r.plaetze ? ` von ${r.plaetze}` : ''} · Code {r.code}
                </span>
                {r.spieler?.length > 0 && (
                  <span className={styles.klein}>{r.spieler.join(', ')}</span>
                )}
              </div>
              <button
                type="button"
                className={styles.knopf}
                disabled={gesperrt || (r.plaetze !== null && r.size >= r.plaetze)}
                onClick={() => onBeitreten(r)}
              >
                {r.plaetze !== null && r.size >= r.plaetze ? 'Voll' : 'Beitreten'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
