import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWweeMatch,
  currentFrage,
  openVote,
  vote,
  nextFrage,
  auszaehlen,
  activeWweePlayer,
  nameOf,
  STANDARD_RUNDEN,
  type WweeState,
} from '@/games/wer-wuerde-eher'
import type { FrageModus } from '@/games/wer-wuerde-eher'
import { useSprache } from '@/i18n/sprache'
import { fehlerSatz, partyFehler } from './partyFehler'
import shell from './PartyShell.module.css'
import styles from './WerWuerdeEherPage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

/** Die Fragensorten -- die Namen stehen im Wörterbuch. */
const MODI: FrageModus[] = ['personen', 'entweder']

export function WerWuerdeEherPage() {
  const { t, sprache } = useSprache()
  const w = t.werWuerdeEher
  const g = t.partyGemeinsam
  const [state, setState] = useState<WweeState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [modi, setModi] = useState<FrageModus[]>(['personen', 'entweder'])
  const [runden, setRunden] = useState(STANDARD_RUNDEN)
  /** Der Satz der Engine, deutsch -- übersetzt wird beim Rendern. */
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      setState(createWweeMatch({ names, modi, rounds: runden, sprache }))
    } catch (e) {
      setError(fehlerSatz(e))
    }
  }, [namesText, modi, runden, sprache])

  if (!state) {
    const modusText: Record<FrageModus, { label: string; erklaerung: string }> = {
      personen: { label: w.modusPersonen, erklaerung: w.modusPersonenText },
      entweder: { label: w.modusEntweder, erklaerung: w.modusEntwederText },
    }
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} {t.allgemein.zurueck}
        </Link>
        <h1 className={shell.title}>🗳️ {t.spiele['wer-wuerde-eher']}</h1>
        <p className={shell.subtitle}>{w.untertitel}</p>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{g.spielerAnzahl(3, 12)}</h2>
          <label className={shell.label}>
            {g.namenLabel}
            <textarea
              className={shell.textarea}
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{w.fragen}</h2>
          {MODI.map((id) => {
            const an = modi.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={an}
                className={an ? styles.modusAktiv : styles.modus}
                onClick={() =>
                  setModi((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
                }
              >
                <span className={styles.modusName}>{modusText[id].label}</span>
                <span className={styles.modusText}>{modusText[id].erklaerung}</span>
              </button>
            )
          })}
          <label className={shell.label}>
            {w.fragenInPartie(runden)}
            <input
              type="range"
              min={3}
              max={25}
              value={runden}
              onChange={(e) => setRunden(Number(e.target.value))}
            />
          </label>
        </div>

        {error && (
          <p className={shell.error}>
            {partyFehler(t, error, { 'Keine Fragen für diese Auswahl': w.keineFragen })}
          </p>
        )}
        {modi.length === 0 && <p className={shell.error}>{w.mindestensEineSorte}</p>}

        <button type="button" className={shell.btn} disabled={modi.length === 0} onClick={start}>
          {g.losspielen}
        </button>
      </main>
    )
  }

  const frage = currentFrage(state)
  const ap = activeWweePlayer(state)
  const fortschritt = w.fortschritt(state.frageIndex + 1, state.fragen.length)

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{fortschritt}</p>
        <div className={`${shell.card} ${shell.cover}`}>
          <p className={shell.subtitle}>{g.weitergebenAn}</p>
          <p className={shell.coverName}>{ap.name}</p>
          <p className={shell.hint}>{w.stimmeGeheim}</p>
          <button type="button" className={shell.btn} onClick={() => setState(openVote(state))}>
            {w.ichBin(ap.name)}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'vote') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {fortschritt} · {w.nurFuer(ap.name)}
        </p>
        <div className={`${shell.card} ${styles.frageBox}`}>
          <p className={styles.frage}>{frage.text}</p>
        </div>
        {frage.modus === 'personen' ? (
          <div className={shell.grid}>
            {state.players.map((p) => (
              <button
                key={p.id}
                type="button"
                className={shell.pickBtn}
                onClick={() => setState(vote(state, p.id))}
              >
                {p.name}
                {p.id === ap.id ? w.du : ''}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`${shell.btn} ${styles.optionA}`}
              onClick={() => setState(vote(state, 'a'))}
            >
              {frage.a}
            </button>
            <button
              type="button"
              className={`${shell.btn} ${styles.optionB}`}
              onClick={() => setState(vote(state, 'b'))}
            >
              {frage.b}
            </button>
          </>
        )}
      </main>
    )
  }

  if (state.phase === 'result') {
    const { counts, sieger } = auszaehlen(state)
    const gesamt = Object.values(state.votes).length

    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{fortschritt}</p>
        <div className={`${shell.card} ${styles.frageBox}`}>
          <p className={styles.frage}>{frage.text}</p>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>
            {sieger.length === 1
              ? frage.modus === 'personen'
                ? w.ganzKlar(nameOf(state, sieger[0]!))
                : w.mehrheit((sieger[0] === 'a' ? frage.a : frage.b) ?? '')
              : w.unentschieden}
          </h2>
          <ul className={shell.list}>
            {(frage.modus === 'personen'
              ? state.players.map((p) => ({ id: p.id, label: p.name }))
              : [
                  { id: 'a', label: frage.a ?? 'A' },
                  { id: 'b', label: frage.b ?? 'B' },
                ]
            ).map((ziel) => {
              const n = counts[ziel.id] ?? 0
              const anteil = gesamt > 0 ? Math.round((n / gesamt) * 100) : 0
              return (
                <li key={ziel.id}>
                  <span className={styles.balkenZelle}>
                    <span>{ziel.label}</span>
                    <span className={styles.balken} aria-hidden="true">
                      <span className={styles.balkenFuell} style={{ width: `${anteil}%` }} />
                    </span>
                  </span>
                  <strong>{n}</strong>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{w.werWieGestimmt}</h2>
          <ul className={shell.list}>
            {state.players.map((p) => {
              const ziel = state.votes[p.id]
              const text =
                frage.modus === 'personen'
                  ? ziel
                    ? nameOf(state, ziel)
                    : '–'
                  : ziel === 'a'
                    ? frage.a
                    : ziel === 'b'
                      ? frage.b
                      : '–'
              return (
                <li key={p.id}>
                  <span>{p.name}</span>
                  <strong>{text}</strong>
                </li>
              )
            })}
          </ul>
        </div>

        <button type="button" className={shell.btn} onClick={() => setState(nextFrage(state))}>
          {w.naechsteFrage}
        </button>
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>{w.dasWars}</h1>
      <p className={shell.subtitle}>{w.fragenDurch(state.fragen.length)}</p>
      <button type="button" className={shell.btn} onClick={start}>
        {g.neuePartie}
      </button>
      <button type="button" className={shell.btnSecondary} onClick={() => setState(null)}>
        {g.einstellungenAendern}
      </button>
      <Link to="/" className={shell.back}>
        {t.allgemein.zumMenue}
      </Link>
    </main>
  )
}
