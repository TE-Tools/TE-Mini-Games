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
 * Gezählt werden Online-Partien und Partien gegen den Rechner -- Thomas
 * am selben Tag: "Bitte auch gegen Computer mit auswerten." Nur die
 * Online-Partien sind allerdings nachprüfbar: Dort würfelt der Server
 * selbst, während eine Partie gegen den Rechner auf dem eigenen Gerät
 * abläuft und der Server nur die Meldung bekommt. Deshalb der kleine
 * Schalter "nur Online" -- er zeigt dieselben Leute, gezählt nach dem,
 * was niemand geschrieben haben kann.
 */

import { useEffect, useState } from 'react'
import {
  fetchKniffelBestenliste,
  fetchMeinBestenlistenName,
  isKniffelOnlineAvailable,
  type KniffelBestenEintrag,
} from '@/services/kniffelOnline'
import {
  sichtbar,
  sortiere,
  werte,
  type BestenlisteArt,
  type Quelle,
} from './bestenlisteSortierung'
import styles from './Bestenliste.module.css'

interface Props {
  /**
   * Der eigene Benutzername -- die eigene Zeile wird hervorgehoben.
   * Nicht gesetzt heißt "sieh selbst nach", null heißt "niemand".
   */
  eigenerName?: string | null
  /** Womit die Liste aufgeht. */
  start?: BestenlisteArt
}

export function Bestenliste({ eigenerName, start = 'siege' }: Props) {
  const [art, setArt] = useState<BestenlisteArt>(start)
  const [quelle, setQuelle] = useState<Quelle>('alle')
  const [eintraege, setEintraege] = useState<KniffelBestenEintrag[] | null>(null)
  const [selbstErmittelt, setSelbstErmittelt] = useState<string | null>(null)

  useEffect(() => {
    let weg = false
    void fetchKniffelBestenliste().then((daten) => {
      if (!weg) setEintraege(daten)
    })
    return () => {
      weg = true
    }
  }, [])

  useEffect(() => {
    if (eigenerName !== undefined) return
    let weg = false
    void fetchMeinBestenlistenName().then((name) => {
      if (!weg) setSelbstErmittelt(name)
    })
    return () => {
      weg = true
    }
  }, [eigenerName])

  const ich = eigenerName === undefined ? selbstErmittelt : eigenerName
  const gezeigt = eintraege ? sortiere(sichtbar(eintraege, art, quelle), art, quelle) : []

  // Ohne Verbindung zum Konto-Server gibt es keine Bestenliste -- dann
  // aber auch keinen leeren Kasten, der so aussieht, als hätte noch
  // niemand gespielt.
  if (!isKniffelOnlineAvailable) return null

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
          {quelle === 'online'
            ? 'Noch keine beendete Online-Partie. Wer die erste zu Ende spielt, steht hier zuerst.'
            : 'Noch keine beendete Partie. Wer die erste zu Ende spielt, steht hier zuerst.'}
        </p>
      )}

      {gezeigt.length > 0 && (
        <ol className={styles.liste}>
          {gezeigt.map((e, i) => {
            const w = werte(e, quelle)
            return (
              <li
                key={e.username}
                className={`${styles.zeile} ${e.username === ich ? styles.ich : ''}`}
              >
                <span className={styles.platz}>{i + 1}</span>
                <span className={styles.name}>{e.username}</span>
                <span className={styles.wert}>
                  {art === 'siege' ? (
                    <>
                      <strong>{w.siege}</strong>
                      <small>
                        {w.siege === 1 ? 'Sieg' : 'Siege'} aus {w.partien}
                      </small>
                    </>
                  ) : (
                    <>
                      <strong>{w.bester_sieg}</strong>
                      <small>Punkte im Sieg</small>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <p className={styles.fussnote}>
        {quelle === 'online'
          ? 'Gezählt werden nur beendete Online-Partien.'
          : 'Gezählt werden beendete Partien, online und gegen den Rechner.'}{' '}
        <button
          type="button"
          className={styles.quelle}
          aria-pressed={quelle === 'online'}
          onClick={() => setQuelle(quelle === 'online' ? 'alle' : 'online')}
        >
          {quelle === 'online' ? 'Rechner mitzählen' : 'Nur Online'}
        </button>
      </p>
    </section>
  )
}
