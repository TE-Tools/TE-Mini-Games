/**
 * Die Mitspieler als Kärtchen: jeder mit seinem farbigen Bild (dieselbe
 * Farbe wie später bei der Übergabe), ein Tipp auf × nimmt ihn heraus, ein
 * Feld darunter nimmt neue auf -- Enter oder „Hinzufügen". Mehrere auf
 * einmal gehen auch („Anna, Ben"), etwa aus einer kopierten Nachricht.
 *
 * Min und Max kommen vom Spiel. Unter dem Minimum steht ein freundlicher
 * Hinweis, gesperrt wird hier nichts -- ob man so starten kann, entscheidet
 * wie bisher die Seite bzw. die Engine. Am Maximum nimmt das Feld nichts
 * mehr an.
 *
 * Unterscheidet sich die gemerkte Runde (gruppe.ts) von der jetzigen, steht
 * darüber ein Knopf, der sie zurückholt.
 */
import { useId, useState, type FormEvent } from 'react'
import { useSprache } from '@/i18n/sprache'
import { anfang, farbeFuer } from '@/pages/play/party/spielerFarbe'
import { gleicheRunde, NAME_LAENGE } from './gruppe'
import styles from './SpielerKaertchen.module.css'

type Hinweis = { art: 'doppelt'; name: string } | null

export function SpielerKaertchen({
  namen,
  onNamen,
  min,
  max,
  gemerkt,
}: {
  namen: readonly string[]
  onNamen: (namen: string[]) => void
  min: number
  max: number
  /** Die zuletzt gespielte Runde -- `null`, wenn es keine gibt. */
  gemerkt?: readonly string[] | null
}) {
  const { t } = useSprache()
  const p = t.partyGruppe
  const feldId = useId()
  const [eingabe, setEingabe] = useState('')
  const [hinweis, setHinweis] = useState<Hinweis>(null)

  const voll = namen.length >= max
  const fehlend = Math.max(0, min - namen.length)
  const angebot =
    gemerkt && gemerkt.length > 0 && !gleicheRunde(gemerkt, namen) ? gemerkt.slice(0, max) : null

  const aufnehmen = (e?: FormEvent) => {
    e?.preventDefault()
    const neu = [...namen]
    let doppelt: string | null = null
    for (const roh of eingabe.split(/[\n,;]+/)) {
      const name = roh.trim().slice(0, NAME_LAENGE)
      if (!name) continue
      if (neu.length >= max) break
      if (neu.some((n) => n.toLowerCase() === name.toLowerCase())) {
        doppelt = name
        continue
      }
      neu.push(name)
    }
    setHinweis(doppelt ? { art: 'doppelt', name: doppelt } : null)
    if (neu.length !== namen.length) onNamen(neu)
    // Ein abgewiesener Name bleibt stehen -- man will ihn vielleicht nur ändern.
    setEingabe(doppelt && neu.length === namen.length ? doppelt : '')
  }

  const entfernen = (index: number) => {
    setHinweis(null)
    onNamen(namen.filter((_, i) => i !== index))
  }

  return (
    <div className={styles.wrap}>
      {angebot && (
        <button
          type="button"
          className={styles.angebot}
          onClick={() => {
            setHinweis(null)
            onNamen([...angebot])
          }}
        >
          <span className={styles.angebotIcon} aria-hidden="true">
            ↺
          </span>
          <span className={styles.angebotText}>
            {p.letzteRunde(angebot.join(', '))} – <strong>{p.uebernehmen}</strong>
          </span>
        </button>
      )}

      <ul className={styles.liste} aria-label={p.mitspieler}>
        {namen.map((name, i) => {
          const [a, b] = farbeFuer(name)
          // Der Name ist der Schlüssel -- so springen beim Entfernen nicht alle
          // folgenden Kärtchen neu herein. Doppelte (aus alten Listen) zählen mit.
          const schon = namen.slice(0, i).filter((n) => n === name).length
          return (
            <li key={`${name}#${schon}`} className={styles.kaertchen}>
              <span
                className={styles.bild}
                style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}
                aria-hidden="true"
              >
                {anfang(name)}
              </span>
              <span className={styles.name}>{name}</span>
              <button
                type="button"
                className={styles.weg}
                onClick={() => entfernen(i)}
                aria-label={p.entfernen(name)}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>

      <form className={styles.neu} onSubmit={aufnehmen}>
        <label htmlFor={feldId} className={styles.unsichtbar}>
          {p.neuerName}
        </label>
        <input
          id={feldId}
          className={styles.feld}
          value={eingabe}
          onChange={(e) => {
            setEingabe(e.target.value)
            if (hinweis) setHinweis(null)
          }}
          placeholder={voll ? p.voll(max) : p.nameEingeben}
          maxLength={NAME_LAENGE * 4}
          disabled={voll}
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className={styles.dazu} disabled={voll || eingabe.trim() === ''}>
          <span aria-hidden="true">＋</span> {p.hinzufuegen}
        </button>
      </form>

      <p className={styles.status} aria-live="polite">
        {hinweis ? (
          <span className={styles.warnung}>{p.schonDabei(hinweis.name)}</span>
        ) : voll ? (
          <span>{p.voll(max)}</span>
        ) : fehlend > 0 ? (
          <span className={styles.warnung}>{p.nochFehlen(fehlend, min)}</span>
        ) : (
          <span>{p.gemerkt}</span>
        )}
      </p>
    </div>
  )
}

/** „4 von 12" neben der Überschrift. */
export function SpielerZahl({ anzahl, max }: { anzahl: number; max: number }) {
  const { t } = useSprache()
  return <span className={styles.zahl}>{t.partyGruppe.anzahl(anzahl, max)}</span>
}
