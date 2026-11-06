/**
 * Vor der Partie: Wer spielt mit, wie stark sind die Rechner, wie lange
 * soll es dauern.
 *
 * Voreingestellt ist ein Mensch gegen zwei normale KI-Gegner -- das ist
 * das, was jemand will, der die App öffnet und einfach spielen möchte.
 */

import { useState } from 'react'
import {
  MAX_SPIELER,
  MIN_SPIELER,
  MAX_RUNDEN_LIMIT,
  MIN_RUNDEN_LIMIT,
  STANDARD_RUNDEN_LIMIT,
  ROLLEN,
  FIGUREN,
  type KiStufe,
  type SpielerEinrichtung,
} from '@/games/schuetzenopoly'
import { useSprache } from '@/i18n/sprache'
import styles from './Aufbau.module.css'

interface AufbauProps {
  vorschlagName: string
  onStart: (spieler: SpielerEinrichtung[], rundenLimit: number) => void
  onAbbrechen: () => void
}

interface Reihe {
  name: string
  typ: 'mensch' | 'ki'
  kiStufe: KiStufe
}

const STUFEN: KiStufe[] = ['leicht', 'normal', 'schwer']

export function Spielaufbau({ vorschlagName, onStart, onAbbrechen }: AufbauProps) {
  const { t } = useSprache()
  const ta = t.schuetzenopoly.aufbau
  // Die Vorschläge sind nur der Anfang -- jeder Name lässt sich überschreiben.
  const [reihen, setReihen] = useState<Reihe[]>(() => [
    { name: vorschlagName || t.schuetzenopoly.du, typ: 'mensch', kiStufe: 'normal' },
    { name: ta.rechnerEins, typ: 'ki', kiStufe: 'normal' },
    { name: ta.rechnerZwei, typ: 'ki', kiStufe: 'normal' },
  ])
  const [rundenLimit, setRundenLimit] = useState(STANDARD_RUNDEN_LIMIT)
  const [fehler, setFehler] = useState<string | null>(null)

  const aendere = (index: number, teil: Partial<Reihe>) => {
    setReihen((alt) => alt.map((r, i) => (i === index ? { ...r, ...teil } : r)))
    setFehler(null)
  }

  const hinzufuegen = () => {
    if (reihen.length >= MAX_SPIELER) return
    setReihen((alt) => [...alt, { name: ta.gegner(alt.length), typ: 'ki', kiStufe: 'normal' }])
  }

  const entfernen = (index: number) => {
    if (reihen.length <= MIN_SPIELER) return
    setReihen((alt) => alt.filter((_, i) => i !== index))
  }

  const starten = () => {
    const namen = reihen.map((r) => r.name.trim())
    if (namen.some((n) => !n)) {
      setFehler(ta.fehlerName)
      return
    }
    const kleingeschrieben = namen.map((n) => n.toLowerCase())
    if (new Set(kleingeschrieben).size !== namen.length) {
      setFehler(ta.fehlerDoppelt)
      return
    }
    onStart(
      reihen.map((r) => ({
        name: r.name.trim(),
        typ: r.typ,
        kiStufe: r.typ === 'ki' ? r.kiStufe : undefined,
      })),
      rundenLimit,
    )
  }

  return (
    <section className={styles.aufbau}>
      <h2 className={styles.ueberschrift}>{ta.werSpieltMit}</h2>

      <ul className={styles.liste}>
        {reihen.map((reihe, i) => (
          <li key={i} className={styles.reihe}>
            <div className={styles.reiheKopf}>
              <input
                className={styles.name}
                value={reihe.name}
                onChange={(e) => aendere(i, { name: e.target.value })}
                maxLength={16}
                aria-label={ta.nameVon(i + 1)}
              />
              {reihen.length > MIN_SPIELER && (
                <button
                  type="button"
                  className={styles.weg}
                  onClick={() => entfernen(i)}
                  aria-label={ta.entfernen(reihe.name)}
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.schalter} role="group" aria-label={ta.spielerart}>
              <button
                type="button"
                className={reihe.typ === 'mensch' ? styles.schalterAn : styles.schalterAus}
                onClick={() => aendere(i, { typ: 'mensch' })}
              >
                {ta.mensch}
              </button>
              <button
                type="button"
                className={reihe.typ === 'ki' ? styles.schalterAn : styles.schalterAus}
                onClick={() => aendere(i, { typ: 'ki' })}
              >
                {ta.rechner}
              </button>
            </div>

            {reihe.typ === 'ki' && (
              <div className={styles.stufen} role="group" aria-label={ta.schwierigkeit}>
                {STUFEN.map((stufe) => (
                  <button
                    key={stufe}
                    type="button"
                    className={reihe.kiStufe === stufe ? styles.stufeAn : styles.stufeAus}
                    onClick={() => aendere(i, { kiStufe: stufe })}
                    title={ta.stufenText[stufe]}
                  >
                    {ta.stufen[stufe]}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {reihen.length < MAX_SPIELER && (
        <button type="button" className={styles.plus} onClick={hinzufuegen}>
          {ta.plusMitspieler}
        </button>
      )}

      <label className={styles.dauer}>
        <span>
          {ta.spieldauer} <strong>{ta.runden(rundenLimit)}</strong>
        </span>
        <input
          type="range"
          min={MIN_RUNDEN_LIMIT}
          max={MAX_RUNDEN_LIMIT}
          step={5}
          value={rundenLimit}
          onChange={(e) => setRundenLimit(Number(e.target.value))}
        />
        <span className={styles.dauerHinweis}>
          {rundenLimit <= 15 ? ta.dauerKurz : rundenLimit <= 25 ? ta.dauerMittel : ta.dauerLang}
        </span>
      </label>

      <p className={styles.hinweis}>{ta.zufall(ROLLEN.length, FIGUREN.length)}</p>

      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}

      <button type="button" className={styles.start} onClick={starten}>
        {ta.starten}
      </button>
      <button type="button" className={styles.zurueck} onClick={onAbbrechen}>
        {t.allgemein.zurueck}
      </button>
    </section>
  )
}
