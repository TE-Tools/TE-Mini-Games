/**
 * Was man gerade tun kann: wegwerfen, schieben, mitgehen, erhöhen.
 *
 * Die Leiste zeigt nur, was der Zustand hergibt -- welche Knöpfe es gibt,
 * entscheidet `moeglichkeiten()` in der Engine, nicht diese Datei. Sonst
 * stünde die Regel an zwei Stellen.
 *
 * Das Erhöhen liegt hinter einem zweiten Schritt: Ein Schieberegler neben
 * drei Knöpfen ist auf einem Telefon zu leicht versehentlich angefasst,
 * und ein verrutschter All-in ist nicht zurückzunehmen.
 *
 * Der gewählte Betrag lebt in dieser Leiste. Damit er nicht aus einer
 * vergangenen Setzrunde stehen bleibt, gibt die Seite der Leiste einen
 * Schlüssel mit: Ändert sich die Lage, ist es eine neue Leiste. Das ist
 * weniger Mechanik als ein Effekt, der den Betrag nachträglich zurechtrückt.
 */

import { useState } from 'react'
import type { Moeglichkeiten } from '@/games/texas-holdem'
import styles from './Einsatzleiste.module.css'

interface Props {
  moeglich: Moeglichkeiten
  /** Der Topf samt laufender Einsätze -- für „halber Topf". */
  topf: number
  /** Der eigene Einsatz in dieser Setzrunde. */
  eigenerEinsatz: number
  gesperrt?: boolean
  onFolden: () => void
  onSchieben: () => void
  onMitgehen: () => void
  onErhoehen: (auf: number) => void
}

export function Einsatzleiste({
  moeglich,
  topf,
  eigenerEinsatz,
  gesperrt = false,
  onFolden,
  onSchieben,
  onMitgehen,
  onErhoehen,
}: Props) {
  const spanne = moeglich.erhoehen
  const [offen, setOffen] = useState(false)
  const [betrag, setBetrag] = useState(spanne?.min ?? 0)

  if (offen && spanne) {
    const vorschlag = (anteil: number) =>
      Math.max(spanne.min, Math.min(spanne.max, eigenerEinsatz + Math.round(topf * anteil)))
    return (
      <div className={styles.leiste}>
        <div className={styles.schnell}>
          <button type="button" className={styles.klein} onClick={() => setBetrag(spanne.min)}>
            Minimum
          </button>
          <button type="button" className={styles.klein} onClick={() => setBetrag(vorschlag(0.5))}>
            ½ Topf
          </button>
          <button type="button" className={styles.klein} onClick={() => setBetrag(vorschlag(1))}>
            Topf
          </button>
          <button type="button" className={styles.klein} onClick={() => setBetrag(spanne.max)}>
            All-in
          </button>
        </div>
        <label className={styles.reglerZeile}>
          <span className={styles.betrag}>{betrag}</span>
          <input
            className={styles.regler}
            type="range"
            min={spanne.min}
            max={spanne.max}
            step={Math.max(1, Math.round((spanne.max - spanne.min) / 100))}
            value={betrag}
            onChange={(e) => setBetrag(Number(e.target.value))}
            aria-label="Einsatz wählen"
          />
        </label>
        <div className={styles.zeile}>
          <button type="button" className={styles.abbruch} onClick={() => setOffen(false)}>
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.haupt}
            disabled={gesperrt}
            onClick={() => {
              setOffen(false)
              onErhoehen(betrag)
            }}
          >
            {betrag >= spanne.max ? `All-in ${betrag}` : `Erhöhen auf ${betrag}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.leiste}>
      <div className={styles.zeile}>
        <button
          type="button"
          className={styles.weg}
          disabled={gesperrt || !moeglich.folden}
          onClick={onFolden}
        >
          Wegwerfen
        </button>

        {moeglich.schieben ? (
          <button type="button" className={styles.mit} disabled={gesperrt} onClick={onSchieben}>
            Schieben
          </button>
        ) : (
          <button
            type="button"
            className={styles.mit}
            disabled={gesperrt || moeglich.mitgehen === null}
            onClick={onMitgehen}
          >
            Mitgehen <small>{moeglich.mitgehen ?? 0}</small>
          </button>
        )}

        <button
          type="button"
          className={styles.haupt}
          disabled={gesperrt || !spanne}
          onClick={() => setOffen(true)}
        >
          {moeglich.schieben ? 'Setzen' : 'Erhöhen'}
        </button>
      </div>
    </div>
  )
}
