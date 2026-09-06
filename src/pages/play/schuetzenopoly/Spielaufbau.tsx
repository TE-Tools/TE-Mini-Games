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

const STUFEN: { id: KiStufe; label: string; erklaerung: string }[] = [
  { id: 'leicht', label: 'Leicht', erklaerung: 'Kauft nach Gefühl, baut selten, handelt nicht.' },
  { id: 'normal', label: 'Normal', erklaerung: 'Sammelt Gruppen, baut sinnvoll, handelt gelegentlich.' },
  { id: 'schwer', label: 'Schwer', erklaerung: 'Rechnet Gebühren, blockiert, handelt gezielt.' },
]

export function Spielaufbau({ vorschlagName, onStart, onAbbrechen }: AufbauProps) {
  const [reihen, setReihen] = useState<Reihe[]>([
    { name: vorschlagName || 'Du', typ: 'mensch', kiStufe: 'normal' },
    { name: 'Vereinsheim', typ: 'ki', kiStufe: 'normal' },
    { name: 'Festzelt', typ: 'ki', kiStufe: 'normal' },
  ])
  const [rundenLimit, setRundenLimit] = useState(STANDARD_RUNDEN_LIMIT)
  const [fehler, setFehler] = useState<string | null>(null)

  const aendere = (index: number, teil: Partial<Reihe>) => {
    setReihen((alt) => alt.map((r, i) => (i === index ? { ...r, ...teil } : r)))
    setFehler(null)
  }

  const hinzufuegen = () => {
    if (reihen.length >= MAX_SPIELER) return
    setReihen((alt) => [
      ...alt,
      { name: `Gegner ${alt.length}`, typ: 'ki', kiStufe: 'normal' },
    ])
  }

  const entfernen = (index: number) => {
    if (reihen.length <= MIN_SPIELER) return
    setReihen((alt) => alt.filter((_, i) => i !== index))
  }

  const starten = () => {
    const namen = reihen.map((r) => r.name.trim())
    if (namen.some((n) => !n)) {
      setFehler('Jeder Mitspieler braucht einen Namen.')
      return
    }
    const kleingeschrieben = namen.map((n) => n.toLowerCase())
    if (new Set(kleingeschrieben).size !== namen.length) {
      setFehler('Zwei Mitspieler heißen gleich.')
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
      <h2 className={styles.ueberschrift}>Wer spielt mit?</h2>

      <ul className={styles.liste}>
        {reihen.map((reihe, i) => (
          <li key={i} className={styles.reihe}>
            <div className={styles.reiheKopf}>
              <input
                className={styles.name}
                value={reihe.name}
                onChange={(e) => aendere(i, { name: e.target.value })}
                maxLength={16}
                aria-label={`Name von Spieler ${i + 1}`}
              />
              {reihen.length > MIN_SPIELER && (
                <button
                  type="button"
                  className={styles.weg}
                  onClick={() => entfernen(i)}
                  aria-label={`${reihe.name} entfernen`}
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.schalter} role="group" aria-label="Spielerart">
              <button
                type="button"
                className={reihe.typ === 'mensch' ? styles.schalterAn : styles.schalterAus}
                onClick={() => aendere(i, { typ: 'mensch' })}
              >
                👤 Mensch
              </button>
              <button
                type="button"
                className={reihe.typ === 'ki' ? styles.schalterAn : styles.schalterAus}
                onClick={() => aendere(i, { typ: 'ki' })}
              >
                🤖 Rechner
              </button>
            </div>

            {reihe.typ === 'ki' && (
              <div className={styles.stufen} role="group" aria-label="Schwierigkeit">
                {STUFEN.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={reihe.kiStufe === s.id ? styles.stufeAn : styles.stufeAus}
                    onClick={() => aendere(i, { kiStufe: s.id })}
                    title={s.erklaerung}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {reihen.length < MAX_SPIELER && (
        <button type="button" className={styles.plus} onClick={hinzufuegen}>
          + Mitspieler
        </button>
      )}

      <label className={styles.dauer}>
        <span>
          Spieldauer: <strong>{rundenLimit} Runden</strong>
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
          {rundenLimit <= 15
            ? 'Kurze Partie, etwa 10 Minuten.'
            : rundenLimit <= 25
              ? 'Etwa 15 bis 25 Minuten.'
              : 'Lange Partie – hier wird richtig gebaut.'}
        </span>
      </label>

      <p className={styles.hinweis}>
        Rollen und Figuren werden zu Beginn zufällig verteilt. Es gibt {ROLLEN.length} Rollen
        und {FIGUREN.length} Figuren.
      </p>

      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}

      <button type="button" className={styles.start} onClick={starten}>
        🎲 Partie starten
      </button>
      <button type="button" className={styles.zurueck} onClick={onAbbrechen}>
        Zurück
      </button>
    </section>
  )
}
