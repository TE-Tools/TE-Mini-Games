/**
 * Die Liste der öffentlichen Räume in einer Online-Lobby.
 *
 * Ein Baustein für alle fünf Online-Spiele: Wer den Raum aufgemacht hat,
 * wie viele schon drin sind, ein Knopf zum Beitreten. Die Liste holt sich
 * selbst alle zehn Sekunden neu -- wer wartet, soll sehen, wenn ein Raum
 * aufgeht, ohne die Seite neu zu laden.
 */

import { useContext, useEffect, useState } from 'react'
import { OEFFENTLICH_ERNEUERN_MS, type OeffentlicherRaum } from '@/services/raeume'
import { SprachContext } from '@/i18n/sprache'
import { de } from '@/i18n/texte/de'
import styles from './OeffentlicheRaeume.module.css'

/**
 * Die Texte der Liste.
 *
 * Bewusst ohne `useSprache()`: Dieser Baustein steckt in allen
 * Online-Lobbys, auch in denen, die noch nicht übersetzt sind und deren
 * Tests ihn ohne SprachProvider rendern. Fehlt der Provider, bleibt die
 * Liste deutsch, statt die ganze Seite mitzureissen. In der App gibt es
 * den Provider immer.
 */
function useListenTexte() {
  return (useContext(SprachContext)?.t ?? de).oeffentlicheRaeume
}

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
  const texte = useListenTexte()
  const ladeFehler = texte.ladeFehler

  useEffect(() => {
    let abbruch = false
    const hole = () => {
      // Im Hintergrund nicht nachfragen -- das kostet Akku und Daten für nichts.
      if (document.hidden) return
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
          setFehler(e instanceof Error ? e.message : ladeFehler)
        })
    }
    hole()
    const uhr = window.setInterval(hole, OEFFENTLICH_ERNEUERN_MS)
    return () => {
      abbruch = true
      window.clearInterval(uhr)
    }
  }, [laden, ladeFehler])

  return (
    <section className={styles.kasten} aria-label={texte.titel}>
      <h2 className={styles.titel}>{texte.titel}</h2>
      {raeume === null && <p className={styles.leise}>{texte.suche}</p>}
      {fehler && <p className={styles.fehler}>{fehler}</p>}
      {raeume?.length === 0 && !fehler && <p className={styles.leise}>{texte.leer}</p>}
      {raeume && raeume.length > 0 && (
        <ul className={styles.liste}>
          {raeume.map((r) => (
            <li key={r.match_id} className={styles.zeile}>
              <div className={styles.text}>
                <strong className={styles.name}>{texte.raumVon(r.host_name)}</strong>
                <span className={styles.klein}>
                  {texte.personen(r.size)}
                  {r.plaetze ? texte.vonPlaetzen(r.plaetze) : ''} · {texte.code(r.code)}
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
                {r.plaetze !== null && r.size >= r.plaetze ? texte.voll : texte.beitreten}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
