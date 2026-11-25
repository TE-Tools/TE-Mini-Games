import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWortbombeMatch,
  passBomb,
  explode,
  nextWortbombeRound,
  activeWortbombePlayer,
  MIN_SPIELER,
  MAX_SPIELER,
  wortbombeSieger,
  zuendzeitMs,
  STANDARD_LEBEN,
  type WortbombeState,
} from '@/games/wortbombe'
import type { SilbenStufe } from '@/games/wortbombe'
import { useSprache } from '@/i18n/sprache'
import { akzentStil } from '@/components/party/akzent'
import { ChipSchalter } from '@/components/party/Chips'
import { useSpielerGruppe } from '@/components/party/gruppe'
import {
  PartyHeld,
  PartyKarte,
  PartyKopf,
  PartyRegler,
  StartKnopf,
} from '@/components/party/PartySetup'
import setup from '@/components/party/PartySetup.module.css'
import { SpielerKaertchen, SpielerZahl } from '@/components/party/SpielerKaertchen'
import { spiele, vibriere } from '@/services/sound'
import { Bombe, Knall } from './wortbombe/Bombe'
import { fehlerSatz, partyFehler } from './partyFehler'
import shell from './PartyShell.module.css'
import styles from './WortbombePage.module.css'

const DEFAULT_NAMES = ['Thomas', 'Marina', 'Phillip', 'Sonja']

/** Die Stufen -- die Namen stehen im Wörterbuch, die Silben kommen in der Sprache der App. */
const STUFEN: SilbenStufe[] = ['leicht', 'mittel', 'schwer']

export function WortbombePage() {
  const { t, sprache } = useSprache()
  const w = t.wortbombe
  const g = t.partyGemeinsam
  const [state, setState] = useState<WortbombeState | null>(null)
  const { namen: names, setNamen: setNames, gemerkt, merken } = useSpielerGruppe(DEFAULT_NAMES)
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
        spiele('knall')
        vibriere([90, 40, 220])
        setState((s) => (s && s.phase === 'handoff' ? explode(s) : s))
      }
    }, 120)
    return () => window.clearInterval(uhr)
  }, [zuender])

  /*
   * Das Ticken: gleichmäßig im Sekundentakt, solange die Bombe scharf ist.
   * Es wird nie schneller -- sonst verriete es, wann sie hochgeht.
   */
  const scharf = state?.phase === 'handoff'
  useEffect(() => {
    if (!scharf) return
    const uhr = window.setInterval(() => spiele('tick'), 1000)
    return () => window.clearInterval(uhr)
  }, [scharf])

  const start = useCallback(() => {
    setError(null)
    try {
      const match = createWortbombeMatch({ names, stufen, lives: leben, sprache })
      setState(match)
      merken(names)
      setZuender(Date.now() + zuendzeitMs(match))
    } catch (e) {
      setError(fehlerSatz(e))
    }
  }, [names, stufen, leben, sprache, merken])

  if (!state) {
    return (
      <main className={setup.seite} style={akzentStil('wortbombe')}>
        <PartyKopf titel={t.spiele.wortbombe} />
        <PartyHeld icon="💣">{w.untertitel}</PartyHeld>

        <PartyKarte
          titel={g.spielerAnzahl(MIN_SPIELER, MAX_SPIELER)}
          zusatz={<SpielerZahl anzahl={names.length} max={MAX_SPIELER} />}
        >
          <SpielerKaertchen
            namen={names}
            onNamen={setNames}
            min={MIN_SPIELER}
            max={MAX_SPIELER}
            gemerkt={gemerkt}
          />
        </PartyKarte>

        <PartyKarte titel={w.silben}>
          <ChipSchalter
            beschriftung={w.silben}
            anordnung={3}
            gewaehlt={stufen}
            onUmschalten={(id) =>
              setStufen((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
            }
            optionen={STUFEN.map((id) => ({ wert: id, text: w.stufen[id] }))}
          />
          <PartyRegler
            beschriftung={w.lebenJePerson(leben)}
            wert={leben}
            min={1}
            max={5}
            onWert={setLeben}
          />
          <p className={shell.meta}>{w.rundeEntscheidet}</p>
        </PartyKarte>

        {error && <p className={shell.error}>{partyFehler(t, error)}</p>}
        {stufen.length === 0 && <p className={shell.error}>{w.mindestensEineStufe}</p>}

        <StartKnopf disabled={stufen.length === 0} onClick={start}>
          {w.zuenden}
        </StartKnopf>
      </main>
    )
  }

  const ap = activeWortbombePlayer(state)
  const sieger = wortbombeSieger(state)

  const lebenAnzeige = (
    <div className={shell.card}>
      <ul className={shell.list}>
        {state.players.map((p) => (
          <li
            key={p.id}
            className={
              [p.out && styles.raus, state.phase === 'boom' && p.id === ap.id && styles.getroffen]
                .filter(Boolean)
                .join(' ') || undefined
            }
          >
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
        <Bombe wurf={state.roundIndex * 1000 + state.passes} />
        <div className={`${shell.card} ${styles.silbeBox}`}>
          <p className={shell.subtitle}>{w.sagEinWort}</p>
          <p key={state.silbe} className={styles.silbe}>
            {state.silbe}
          </p>
          <p className={shell.coverName}>{ap.name}</p>
        </div>
        <button
          type="button"
          className={shell.btn}
          onClick={() => {
            spiele('knopf')
            setState(passBomb(state))
          }}
        >
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
          <Knall />
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
