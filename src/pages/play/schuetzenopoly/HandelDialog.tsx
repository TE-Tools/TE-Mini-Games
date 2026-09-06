/**
 * Handel: Grundstücke und Taler auf beiden Seiten.
 *
 * Bewusst schlicht gehalten -- antippen, was auf den Tisch kommt, Betrag
 * einstellen, anbieten. Ein Gegner am selben Gerät bestätigt direkt; ein
 * Rechner entscheidet sofort und sagt auch, warum nicht.
 */

import { useMemo, useState } from 'react'
import {
  bewerteAngebot,
  feldName,
  handelbareFelder,
  kaufpreis,
  kiNimmtAn,
  pruefeHandel,
  spielerMit,
  type Handelsangebot,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import styles from './Handel.module.css'

interface HandelDialogProps {
  zustand: SpielZustand
  /** Wer das Angebot macht. */
  anbieterId: string
  onAusfuehren: (angebot: Handelsangebot) => void
  onSchliessen: () => void
}

export function HandelDialog({
  zustand,
  anbieterId,
  onAusfuehren,
  onSchliessen,
}: HandelDialogProps) {
  const anbieter = spielerMit(zustand, anbieterId)!
  const gegner = zustand.spieler.filter((s) => s.id !== anbieterId && !s.insolvent)
  const [partnerId, setPartnerId] = useState(gegner[0]?.id ?? '')
  const [gebeFelder, setGebeFelder] = useState<string[]>([])
  const [willFelder, setWillFelder] = useState<string[]>([])
  const [gebeTaler, setGebeTaler] = useState(0)
  const [willTaler, setWillTaler] = useState(0)
  const [antwort, setAntwort] = useState<string | null>(null)

  const partner = partnerId ? spielerMit(zustand, partnerId) : null

  const angebot: Handelsangebot = useMemo(
    () => ({
      vonId: anbieterId,
      anId: partnerId,
      gebeFelder,
      gebeTaler,
      willFelder,
      willTaler,
    }),
    [anbieterId, partnerId, gebeFelder, gebeTaler, willFelder, willTaler],
  )

  const pruefung = pruefeHandel(zustand, angebot)
  const meine = handelbareFelder(zustand, anbieterId)
  const seine = partnerId ? handelbareFelder(zustand, partnerId) : []

  const umschalten = (liste: string[], setzen: (l: string[]) => void, feldId: string) => {
    setAntwort(null)
    setzen(liste.includes(feldId) ? liste.filter((f) => f !== feldId) : [...liste, feldId])
  }

  const anbieten = () => {
    if (!pruefung.gueltig || !partner) {
      setAntwort(pruefung.grund ?? 'Das geht so nicht.')
      return
    }
    if (partner.typ === 'ki') {
      if (kiNimmtAn(zustand, angebot)) {
        onAusfuehren(angebot)
        return
      }
      const netto = bewerteAngebot(zustand, angebot)
      setAntwort(
        netto <= 0
          ? `${partner.name} winkt ab: „Da lege ich ja drauf."`
          : `${partner.name} überlegt und lehnt ab: „Nicht genug."`,
      )
      return
    }
    // Zwei Menschen am selben Gerät: der andere bestätigt direkt.
    onAusfuehren(angebot)
  }

  return (
    <div className={styles.hintergrund} onClick={onSchliessen} role="presentation">
      <div
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Handel"
      >
        <h3 className={styles.titel}>🤝 Handel</h3>

        {gegner.length === 0 ? (
          <p className={styles.leer}>Es ist niemand mehr da, mit dem sich handeln ließe.</p>
        ) : (
          <>
            <label className={styles.wahl}>
              <span>Mit wem?</span>
              <select
                value={partnerId}
                onChange={(e) => {
                  setPartnerId(e.target.value)
                  setWillFelder([])
                  setWillTaler(0)
                  setAntwort(null)
                }}
              >
                {gegner.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.taler.toLocaleString('de-DE')} 🪙)
                  </option>
                ))}
              </select>
            </label>

            <section className={styles.seite}>
              <h4 className={styles.seitenTitel}>Du gibst</h4>
              <div className={styles.felder}>
                {meine.length === 0 && <span className={styles.leerText}>Nichts Handelbares.</span>}
                {meine.map((feldId) => (
                  <button
                    key={feldId}
                    type="button"
                    className={gebeFelder.includes(feldId) ? styles.feldAn : styles.feldAus}
                    onClick={() => umschalten(gebeFelder, setGebeFelder, feldId)}
                  >
                    {feldName(feldId)}
                    <small>{kaufpreis(feldId).toLocaleString('de-DE')}</small>
                  </button>
                ))}
              </div>
              <label className={styles.taler}>
                <span>Taler dazu: {gebeTaler.toLocaleString('de-DE')} 🪙</span>
                <input
                  type="range"
                  min={0}
                  max={anbieter.taler}
                  step={50}
                  value={gebeTaler}
                  onChange={(e) => {
                    setGebeTaler(Number(e.target.value))
                    setAntwort(null)
                  }}
                />
              </label>
            </section>

            <section className={styles.seite}>
              <h4 className={styles.seitenTitel}>Du bekommst</h4>
              <div className={styles.felder}>
                {seine.length === 0 && <span className={styles.leerText}>Nichts Handelbares.</span>}
                {seine.map((feldId) => (
                  <button
                    key={feldId}
                    type="button"
                    className={willFelder.includes(feldId) ? styles.feldAn : styles.feldAus}
                    onClick={() => umschalten(willFelder, setWillFelder, feldId)}
                  >
                    {feldName(feldId)}
                    <small>{kaufpreis(feldId).toLocaleString('de-DE')}</small>
                  </button>
                ))}
              </div>
              <label className={styles.taler}>
                <span>Taler dazu: {willTaler.toLocaleString('de-DE')} 🪙</span>
                <input
                  type="range"
                  min={0}
                  max={partner?.taler ?? 0}
                  step={50}
                  value={willTaler}
                  onChange={(e) => {
                    setWillTaler(Number(e.target.value))
                    setAntwort(null)
                  }}
                />
              </label>
            </section>

            {antwort && (
              <p className={styles.antwort} role="status">
                {antwort}
              </p>
            )}
            {!pruefung.gueltig && !antwort && pruefung.grund && (
              <p className={styles.hinweis}>{pruefung.grund}</p>
            )}

            <button
              type="button"
              className={styles.anbieten}
              onClick={anbieten}
              disabled={!pruefung.gueltig}
            >
              Angebot machen
            </button>
          </>
        )}

        <button type="button" className={styles.abbrechen} onClick={onSchliessen}>
          Zurück zum Spiel
        </button>
      </div>
    </div>
  )
}
