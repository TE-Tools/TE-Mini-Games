/**
 * Die Kniffel-Bestenliste: zwei Listen auf denselben Zahlen.
 *
 * Thomas am 30.09.2026: "Kniffel erweitern mit Rangliste, wer viele Spiele
 * gewonnen hat, und eine Rangliste, wer mit den meisten Punkten gewonnen
 * hat."
 *
 * Zwei Fragen, eine Abfrage (`kniffel_bestenliste`, Migration 021):
 *
 *   Siege       -- wer oft gewinnt. Ausdauer.
 *   Bester Sieg -- wer hoch gewinnt. Ein einziger großer Abend genügt.
 *
 * Gezählt werden nur Online-Partien. Ein Sieg gegen den Rechner auf dem
 * eigenen Gerät kann niemand nachprüfen, und eine Rangliste, in der sich
 * jeder selbst eintragen könnte, ist keine.
 */

import { useEffect, useState } from 'react'
import { fetchKniffelBestenliste, type KniffelBestenEintrag } from '@/services/kniffelOnline'
import { sichtbar, sortiere, type BestenlisteArt } from './bestenlisteSortierung'
import styles from './Bestenliste.module.css'

interface Props {
  /** Der eigene Benutzername -- die eigene Zeile wird hervorgehoben. */
  eigenerName?: string | null
  /** Womit die Liste aufgeht. */
  start?: BestenlisteArt
}

export function Bestenliste({ eigenerName, start = 'siege' }: Props) {
  const [art, setArt] = useState<BestenlisteArt>(start)
  const [eintraege, setEintraege] = useState<KniffelBestenEintrag[] | null>(null)

  useEffect(() => {
    let weg = false
    void fetchKniffelBestenliste().then((daten) => {
      if (!weg) setEintraege(daten)
    })
    return () => {
      weg = true
    }
  }, [])

  const gezeigt = eintraege ? sortiere(sichtbar(eintraege, art), art) : []

  return (
    <section className={styles.kasten} aria-label="Bestenliste">
      <div className={styles.kopf}>
        <h3 className={styles.titel}>Bestenliste</h3>
        <div className={styles.schalter} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={art === 'siege'}
            className={art === 'siege' ? styles.anAktiv : styles.an}
            onClick={() => setArt('siege')}
          >
            Meiste Siege
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={art === 'punkte'}
            className={art === 'punkte' ? styles.anAktiv : styles.an}
            onClick={() => setArt('punkte')}
          >
            Höchster Sieg
          </button>
        </div>
      </div>

      {eintraege === null && <p className={styles.leise}>Lade…</p>}

      {eintraege !== null && gezeigt.length === 0 && (
        <p className={styles.leise}>
          Noch keine beendete Online-Partie. Wer die erste zu Ende spielt, steht hier zuerst.
        </p>
      )}

      {gezeigt.length > 0 && (
        <ol className={styles.liste}>
          {gezeigt.map((e, i) => (
            <li
              key={e.username}
              className={`${styles.zeile} ${e.username === eigenerName ? styles.ich : ''}`}
            >
              <span className={styles.platz}>{i + 1}</span>
              <span className={styles.name}>{e.username}</span>
              <span className={styles.wert}>
                {art === 'siege' ? (
                  <>
                    <strong>{e.siege}</strong>
                    <small>
                      {e.siege === 1 ? 'Sieg' : 'Siege'} aus {e.partien}
                    </small>
                  </>
                ) : (
                  <>
                    <strong>{e.bester_sieg}</strong>
                    <small>Punkte im Sieg</small>
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className={styles.fussnote}>Gezählt werden beendete Online-Partien.</p>
    </section>
  )
}
