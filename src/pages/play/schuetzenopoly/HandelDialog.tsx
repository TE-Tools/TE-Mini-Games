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
  handelbareFelder,
  kaufpreis,
  kiNimmtAn,
  pruefeHandel,
  spielerMit,
  type HandelPruefung,
  type Handelsangebot,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import { useSprache, type Texte } from '@/i18n/sprache'
import { feldNameIn } from './texte'
import styles from './Handel.module.css'

/** Der Grund kommt als Kennung; der deutsche Satz der Engine ist nur der Rückfall. */
function grundText(t: Texte, pruefung: HandelPruefung): string | undefined {
  const th = t.schuetzenopoly.handel
  switch (pruefung.code) {
    case undefined:
      return pruefung.grund
    case 'nichtSeins':
      return pruefung.feldId ? th.nichtSeins(feldNameIn(t, pruefung.feldId)) : pruefung.grund
    case 'gebaeude':
      return pruefung.feldId ? th.gebaeude(feldNameIn(t, pruefung.feldId)) : pruefung.grund
    default:
      return th.grund[pruefung.code]
  }
}

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
  const { t, sprache } = useSprache()
  const th = t.schuetzenopoly.handel
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
  const grund = grundText(t, pruefung)
  const meine = handelbareFelder(zustand, anbieterId)
  const seine = partnerId ? handelbareFelder(zustand, partnerId) : []

  const umschalten = (liste: string[], setzen: (l: string[]) => void, feldId: string) => {
    setAntwort(null)
    setzen(liste.includes(feldId) ? liste.filter((f) => f !== feldId) : [...liste, feldId])
  }

  const anbieten = () => {
    if (!pruefung.gueltig || !partner) {
      setAntwort(grund ?? th.gehtNicht)
      return
    }
    if (partner.typ === 'ki') {
      if (kiNimmtAn(zustand, angebot)) {
        onAusfuehren(angebot)
        return
      }
      const netto = bewerteAngebot(zustand, angebot)
      setAntwort(netto <= 0 ? th.winktAb(partner.name) : th.lehntAb(partner.name))
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
        aria-label={th.label}
      >
        <h3 className={styles.titel}>{th.titel}</h3>

        {gegner.length === 0 ? (
          <p className={styles.leer}>{th.niemand}</p>
        ) : (
          <>
            <label className={styles.wahl}>
              <span>{th.mitWem}</span>
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
                    {g.name} ({g.taler.toLocaleString(sprache)} 🪙)
                  </option>
                ))}
              </select>
            </label>

            <section className={styles.seite}>
              <h4 className={styles.seitenTitel}>{th.duGibst}</h4>
              <div className={styles.felder}>
                {meine.length === 0 && (
                  <span className={styles.leerText}>{th.nichtsHandelbares}</span>
                )}
                {meine.map((feldId) => (
                  <button
                    key={feldId}
                    type="button"
                    className={gebeFelder.includes(feldId) ? styles.feldAn : styles.feldAus}
                    onClick={() => umschalten(gebeFelder, setGebeFelder, feldId)}
                  >
                    {feldNameIn(t, feldId)}
                    <small>{kaufpreis(feldId).toLocaleString(sprache)}</small>
                  </button>
                ))}
              </div>
              <label className={styles.taler}>
                <span>{th.talerDazu(gebeTaler.toLocaleString(sprache))}</span>
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
              <h4 className={styles.seitenTitel}>{th.duBekommst}</h4>
              <div className={styles.felder}>
                {seine.length === 0 && (
                  <span className={styles.leerText}>{th.nichtsHandelbares}</span>
                )}
                {seine.map((feldId) => (
                  <button
                    key={feldId}
                    type="button"
                    className={willFelder.includes(feldId) ? styles.feldAn : styles.feldAus}
                    onClick={() => umschalten(willFelder, setWillFelder, feldId)}
                  >
                    {feldNameIn(t, feldId)}
                    <small>{kaufpreis(feldId).toLocaleString(sprache)}</small>
                  </button>
                ))}
              </div>
              <label className={styles.taler}>
                <span>{th.talerDazu(willTaler.toLocaleString(sprache))}</span>
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
            {!pruefung.gueltig && !antwort && grund && <p className={styles.hinweis}>{grund}</p>}

            <button
              type="button"
              className={styles.anbieten}
              onClick={anbieten}
              disabled={!pruefung.gueltig}
            >
              {th.anbieten}
            </button>
          </>
        )}

        <button type="button" className={styles.abbrechen} onClick={onSchliessen}>
          {th.zurueck}
        </button>
      </div>
    </div>
  )
}
