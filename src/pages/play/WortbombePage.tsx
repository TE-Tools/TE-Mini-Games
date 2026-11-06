import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWortbombeMatch,
  passBomb,
  explode,
  nextWortbombeRound,
  activeWortbombePlayer,
  wortbombeSieger,
  zuendzeitMs,
  STANDARD_LEBEN,
  type WortbombeState,
} from '@/games/wortbombe'
import type { SilbenStufe } from '@/games/wortbombe'
import { useSprache } from '@/i18n/sprache'
import { fehlerSatz, partyFehler } from './partyFehler'
import shell from './PartyShell.module.css'
import styles from './WortbombePage.module.css'

const DEFAULT_NAMES = 'Thomas\nMarina\nPhillip\nSonja'

/** Die Stufen -- die Namen stehen im Wörterbuch. Die Silben selbst bleiben deutsch. */
const STUFEN: SilbenStufe[] = ['leicht', 'mittel', 'schwer']

export function WortbombePage() {
  const { t } = useSprache()
  const w = t.wortbombe
  const g = t.partyGemeinsam
  const [state, setState] = useState<WortbombeState | null>(null)
  const [namesText, setNamesText] = useState(DEFAULT_NAMES)
  const [stufen, setStufen] = useState<SilbenStufe[]>(['leicht', 'mittel'])
  const [leben, setLeben] = useState(STANDARD_LEBEN)
  /** Der Satz der Engine, deutsch -- übersetzt wird beim Rendern. */
  const [error, setError] = useState<string | null>(null)

  /**
   * Der Zünder. Absichtlich nur ein Zeitpunkt und keine Anzeige: Wer sieht,
   * wie viel Zeit bleibt, spielt auf Zeit statt auf Wörter.
   */
  const [zuender, setZuender] = useState<number | null>(null)

  useEffect(() => {
    if (zuender === null) return
    const uhr = window.setInterval(() => {
      if (Date.now() >= zuender) {
        window.clearInterval(uhr)
        setZuender(null)
        setState((s) => (s && s.phase === 'handoff' ? explode(s) : s))
      }
    }, 120)
    return () => window.clearInterval(uhr)
  }, [zuender])

  const start = useCallback(() => {
    setError(null)
    try {
      const names = namesText
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean)
      const match = createWortbombeMatch({ names, stufen, lives: leben })
      setState(match)
      setZuender(Date.now() + zuendzeitMs(match))
    } catch (e) {
      setError(fehlerSatz(e))
    }
  }, [namesText, stufen, leben])

  if (!state) {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <Link to="/" className={shell.back}>
          {'←'} {t.allgemein.zurueck}
        </Link>
        <h1 className={shell.title}>💣 {t.spiele.wortbombe}</h1>
        <p className={shell.subtitle}>{w.untertitel}</p>

        <div className={shell.card}>
          <h2 className={shell.cardTitle}>{g.spielerAnzahl(2, 12)}</h2>
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
          <h2 className={shell.cardTitle}>{w.silben}</h2>
          <div className={shell.grid}>
            {STUFEN.map((id) => {
              const an = stufen.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={an}
                  className={an ? styles.chipAktiv : shell.pickBtn}
                  onClick={() =>
                    setStufen((alt) =>
                      alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id],
                    )
                  }
                >
                  {w.stufen[id]}
                </button>
              )
            })}
          </div>
          <label className={shell.label}>
            {w.lebenJePerson(leben)}
            <input
              type="range"
              min={1}
              max={5}
              value={leben}
              onChange={(e) => setLeben(Number(e.target.value))}
            />
          </label>
          <p className={shell.meta}>{w.rundeEntscheidet}</p>
        </div>

        {error && <p className={shell.error}>{partyFehler(t, error)}</p>}
        {stufen.length === 0 && <p className={shell.error}>{w.mindestensEineStufe}</p>}

        <button type="button" className={shell.btn} disabled={stufen.length === 0} onClick={start}>
          {w.zuenden}
        </button>
      </main>
    )
  }

  const ap = activeWortbombePlayer(state)
  const sieger = wortbombeSieger(state)

  const lebenAnzeige = (
    <div className={shell.card}>
      <ul className={shell.list}>
        {state.players.map((p) => (
          <li key={p.id} className={p.out ? styles.raus : undefined}>
            <span>{p.name}</span>
            <strong>{p.out ? w.raus : '❤️'.repeat(p.lives)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>{w.runde(state.roundIndex + 1)}</p>
        <div className={`${shell.card} ${styles.silbeBox}`}>
          <p className={shell.subtitle}>{w.sagEinWort}</p>
          <p key={state.silbe} className={styles.silbe}>
            {state.silbe}
          </p>
          <p className={shell.coverName}>{ap.name}</p>
        </div>
        <button type="button" className={shell.btn} onClick={() => setState(passBomb(state))}>
          {w.gesagt}
        </button>
        {lebenAnzeige}
      </main>
    )
  }

  if (state.phase === 'boom') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <div className={`${shell.card} ${styles.boomBox}`}>
          <p className={styles.boom}>💥</p>
          <h1 className={shell.title}>{w.hatteSie(ap.name)}</h1>
          <p className={shell.subtitle}>{ap.out ? w.istRaus(ap.name) : w.nochLeben(ap.lives)}</p>
        </div>
        {lebenAnzeige}
        <button
          type="button"
          className={shell.btn}
          onClick={() => {
            const next = nextWortbombeRound(state)
            setState(next)
            if (next.phase === 'handoff') setZuender(Date.now() + zuendzeitMs(next))
          }}
        >
          {t.allgemein.weiter}
        </button>
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>🏆 {sieger ? w.gewinnt(sieger.name) : w.niemandGewinnt}</h1>
      {lebenAnzeige}
      <button type="button" className={shell.btn} onClick={start}>
        {w.nochEinePartie}
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
