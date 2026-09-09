import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  squishyDumplingsGame,
  createDumplingLevel,
  createDumplingMatch,
  tausche,
  tauschErlaubt,
  sindNachbarn,
  zeitAbgelaufen,
  freigeschaltet,
  belohnungFuer,
  naechsteBelohnung,
  knoedelFuer,
  SAMMEL_KNOEDEL,
  FARB_HEX,
  FARB_NAME,
  DUMPLING_MAX_LEVEL,
  type DumplingLevel,
  type DumplingState,
  type Zelle,
  type SammelKnoedel,
} from '@/games/squishy-dumplings'
import {
  getOrCreateGameProgress,
  recordLevelComplete,
  saveGameResult,
  addXp,
  getOrCreateGuestProfile,
} from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { LevelMap } from '@/components/level-map/LevelMap'
import { Knoedel } from '@/components/knoedel/Knoedel'
import styles from './SquishyDumplingsPage.module.css'

type Phase = 'map' | 'play' | 'won' | 'lost'

/** Wie lange ein Auflösungsschritt zu sehen ist. */
const SCHRITT_MS = 230
/** Ein ungültiger Tausch geht sichtbar hin und wieder zurück. */
const ZURUECK_MS = 260
/** Der Takt der Uhr. */
const TAKT_MS = 100

const SPEICHER_AVATAR = 'squishy-dumplings:knoedel'

function liesAvatar(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SPEICHER_AVATAR)
  } catch {
    return null
  }
}

function schreibAvatar(id: string): void {
  try {
    localStorage.setItem(SPEICHER_AVATAR, id)
  } catch {
    // Voller oder gesperrter Speicher darf das Spiel nicht anhalten.
  }
}

/** Die Farbe eines Feldknödels – Akzent ist dieselbe Farbe, nur dunkler. */
function akzentVon(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const dunkler = (v: number) => Math.max(0, Math.round(v * 0.62))
  const r = dunkler((n >> 16) & 255)
  const g = dunkler((n >> 8) & 255)
  const b = dunkler(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function SquishyDumplingsPage() {
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [cfg, setCfg] = useState<DumplingLevel>(() => createDumplingLevel(1))
  const [state, setState] = useState<DumplingState | null>(null)
  const [feld, setFeld] = useState<Zelle[]>([])
  const [treffer, setTreffer] = useState<Set<number>>(new Set())
  const [gewaehlt, setGewaehlt] = useState<number | null>(null)
  const [wackelt, setWackelt] = useState<number[]>([])
  const [restzeit, setRestzeit] = useState(0)
  const [laeuft, setLaeuft] = useState(false)
  const [score, setScore] = useState(0)
  const [xpGained, setXpGained] = useState(0)
  const [sterne, setSterne] = useState(0)
  const [neuerKnoedel, setNeuerKnoedel] = useState<SammelKnoedel | null>(null)
  const [meinKnoedel, setMeinKnoedel] = useState<string | null>(null)
  const [sammlungOffen, setSammlungOffen] = useState(false)
  const [loading, setLoading] = useState(true)

  /** Zählt bei jedem neuen Level hoch; ältere Animationen brechen daran ab. */
  const lauf = useRef(0)
  /** Wann die Zeit abgelaufen ist -- gerechnet, nicht gezählt. */
  const endeRef = useRef(0)

  useEffect(() => {
    let abgebrochen = false
    void (async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('squishy-dumplings'),
          getOrCreateGuestProfile(),
        ])
        if (abgebrochen) return
        setHighest(Math.max(1, progress.highestLevel || 1))
        setLevel(Math.max(1, progress.currentLevel || progress.highestLevel || 1))
        setAvatarId(profile.avatar)
        setMeinKnoedel(liesAvatar())
      } catch (e) {
        console.error(e)
      } finally {
        if (!abgebrochen) setLoading(false)
      }
    })()
    return () => {
      abgebrochen = true
    }
  }, [])

  /** Wie weit man gekommen ist: das höchste geschaffte Level. */
  const geschafft = Math.max(0, highest - 1)
  const meine = freigeschaltet(geschafft)
  const gewaehlterKnoedel = knoedelFuer(
    meine.some((k) => k.id === meinKnoedel) ? meinKnoedel : meine[meine.length - 1]?.id,
  )

  const startLevel = useCallback((L: number) => {
    lauf.current += 1
    const levelCfg = createDumplingLevel(L)
    const match = createDumplingMatch(levelCfg)
    setCfg(levelCfg)
    setLevel(L)
    setState(match)
    setFeld(match.feld)
    setTreffer(new Set())
    setGewaehlt(null)
    setWackelt([])
    setRestzeit(levelCfg.zeit)
    endeRef.current = Date.now() + levelCfg.zeit * 1000
    setLaeuft(false)
    setPhase('play')
    setScore(0)
    setXpGained(0)
    setSterne(0)
    setNeuerKnoedel(null)
  }, [])

  const onSelectLevel = useCallback(
    (L: number) => {
      if (L > highest) return
      startLevel(L)
    },
    [highest, startLevel],
  )

  const finishWon = useCallback(async (fertig: DumplingState, uebrig: number) => {
    const raw = {
      won: true,
      gesammelt: fertig.gesammelt,
      restzeit: uebrig,
      besteKette: fertig.besteKette,
    }
    const sc = squishyDumplingsGame.calculateScore(fertig.level, raw)
    const xp = squishyDumplingsGame.calculateXP(fertig.level, sc)
    const st = squishyDumplingsGame.calculateStars?.(fertig.level, sc) ?? 0
    setScore(sc)
    setXpGained(xp)
    setSterne(st)
    setNeuerKnoedel(belohnungFuer(fertig.level))
    setPhase('won')
    try {
      await saveGameResult({
        gameId: 'squishy-dumplings',
        level: fertig.level,
        score: sc,
        xp,
        stars: st,
        resultData: raw,
      })
      await addXp('guest', xp)
      const progress = await recordLevelComplete('squishy-dumplings', fertig.level, xp)
      setHighest(Math.max(progress.highestLevel, fertig.level + 1))
      await processAfterResult({ gameId: 'squishy-dumplings', level: fertig.level })
      void trySyncNow()
    } catch (e) {
      console.error(e)
    }
  }, [])

  /**
   * Die Uhr.
   *
   * Gerechnet aus dem Ablaufzeitpunkt statt heruntergezählt: Wer zwischendurch
   * die App wegklickt, bekommt sonst geschenkte Sekunden. Das Ende wird hier
   * im Takt ausgelöst, nicht in einem eigenen Effekt -- ein Effekt, der beim
   * Rendern gleich wieder etwas setzt, ist eine Kaskade.
   */
  useEffect(() => {
    if (phase !== 'play' || !state || state.phase !== 'play') return
    const gen = lauf.current
    const uhr = window.setInterval(() => {
      if (lauf.current !== gen) return
      const uebrig = (endeRef.current - Date.now()) / 1000
      if (uebrig > 0) {
        setRestzeit(uebrig)
        return
      }
      window.clearInterval(uhr)
      setRestzeit(0)
      setState((alt) => (alt ? zeitAbgelaufen(alt) : alt))
      setPhase('lost')
    }, TAKT_MS)
    return () => window.clearInterval(uhr)
  }, [phase, state])

  /** Einen Tausch abspielen: erst der Tausch, dann Kette für Kette. */
  const spieleZug = useCallback(
    (a: number, b: number) => {
      if (!state || state.phase !== 'play' || laeuft) return
      if (!tauschErlaubt(state, a, b)) return
      const gen = lauf.current
      const ergebnis = tausche(state, a, b)

      if (!ergebnis.gueltig) {
        // Der Tausch geht sichtbar hin und wieder zurück -- so sieht man,
        // dass er erlaubt war, aber nichts gebracht hat.
        setLaeuft(true)
        setFeld(ergebnis.getauscht)
        setWackelt([a, b])
        window.setTimeout(() => {
          if (lauf.current !== gen) return
          setFeld(state.feld)
          setWackelt([])
          setLaeuft(false)
        }, ZURUECK_MS)
        return
      }

      setLaeuft(true)
      setFeld(ergebnis.getauscht)
      let verzoegerung = SCHRITT_MS * 0.6

      ergebnis.schritte.forEach((schritt) => {
        window.setTimeout(() => {
          if (lauf.current !== gen) return
          setTreffer(new Set([...schritt.treffer, ...schritt.befreit]))
        }, verzoegerung)
        window.setTimeout(
          () => {
            if (lauf.current !== gen) return
            setTreffer(new Set())
            setFeld(schritt.feld)
          },
          verzoegerung + SCHRITT_MS * 0.55,
        )
        verzoegerung += SCHRITT_MS
      })

      window.setTimeout(() => {
        if (lauf.current !== gen) return
        setFeld(ergebnis.state.feld)
        setState(ergebnis.state)
        setLaeuft(false)
        // Erst wenn die Kette durch ist -- vorher wäre die Karte schon oben,
        // während unten noch Knödel fallen.
        if (ergebnis.state.phase === 'won') {
          void finishWon(ergebnis.state, Math.max(0, (endeRef.current - Date.now()) / 1000))
        }
      }, verzoegerung)
    },
    [state, laeuft, finishWon],
  )

  const onZelle = useCallback(
    (i: number) => {
      if (!state || state.phase !== 'play' || laeuft) return
      if (state.feld[i]!.kaefig) {
        setWackelt([i])
        window.setTimeout(() => setWackelt([]), ZURUECK_MS)
        return
      }
      if (gewaehlt === null) {
        setGewaehlt(i)
        return
      }
      if (gewaehlt === i) {
        setGewaehlt(null)
        return
      }
      if (sindNachbarn(gewaehlt, i, state.cols)) {
        const von = gewaehlt
        setGewaehlt(null)
        spieleZug(von, i)
        return
      }
      setGewaehlt(i)
    },
    [state, gewaehlt, laeuft, spieleZug],
  )

  /** Wischen: Wo der Finger loslässt, dorthin wird getauscht. */
  const zeigerStart = useRef<{ i: number; x: number; y: number } | null>(null)
  const onZeigerRunter = useCallback((i: number, x: number, y: number) => {
    zeigerStart.current = { i, x, y }
  }, [])
  const onZeigerHoch = useCallback(
    (x: number, y: number) => {
      const start = zeigerStart.current
      zeigerStart.current = null
      if (!start || !state) return
      const dx = x - start.x
      const dy = y - start.y
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
        onZelle(start.i)
        return
      }
      const r = Math.floor(start.i / state.cols)
      const c = start.i % state.cols
      const waagerecht = Math.abs(dx) > Math.abs(dy)
      const nr = r + (waagerecht ? 0 : dy > 0 ? 1 : -1)
      const nc = c + (waagerecht ? (dx > 0 ? 1 : -1) : 0)
      if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) return
      setGewaehlt(null)
      spieleZug(start.i, nr * state.cols + nc)
    },
    [state, onZelle, spieleZug],
  )

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Laden…</p>
      </main>
    )
  }

  if (phase === 'map') {
    const naechste = naechsteBelohnung(geschafft)
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <Link to="/" className={styles.back}>
            {'←'} Zurück
          </Link>
          <h1 className={styles.title}>
            <span aria-hidden="true">🥟</span> Squishy Dumplings
          </h1>
        </header>
        <p className={styles.hint}>
          Schieb einen Knödel auf einen Nachbarplatz. Stehen dadurch drei gleiche in einer Reihe,
          verschwinden sie und von oben fallen neue nach. Sammle das Ziel, bevor die Zeit um ist.
          Später kommen Käfige dazu: Ein Knödel im Käfig lässt sich nicht schieben und zerreißt jede
          Reihe – er springt auf, wenn direkt daneben etwas verschwindet.
        </p>

        <section className={styles.sammlung}>
          <button
            type="button"
            className={styles.sammlungKopf}
            onClick={() => setSammlungOffen((o) => !o)}
            aria-expanded={sammlungOffen}
          >
            <span className={styles.sammlungFigur}>
              <Knoedel
                hex={gewaehlterKnoedel.hex}
                akzent={gewaehlterKnoedel.akzent}
                gesicht={gewaehlterKnoedel.gesicht}
              />
            </span>
            <span>
              <strong>Deine Sammlung</strong>
              <br />
              <span className={styles.muted}>
                {meine.length} von {SAMMEL_KNOEDEL.length} Knödeln
                {naechste ? ` · nächster ab Level ${naechste.abLevel}` : ' · alle gesammelt!'}
              </span>
            </span>
            <span aria-hidden="true">{sammlungOffen ? '▲' : '▼'}</span>
          </button>

          {sammlungOffen && (
            <div className={styles.regal}>
              {SAMMEL_KNOEDEL.map((k) => {
                const hab = meine.some((m) => m.id === k.id)
                const aktiv = k.id === gewaehlterKnoedel.id
                return (
                  <button
                    key={k.id}
                    type="button"
                    className={`${styles.regalPlatz} ${aktiv ? styles.regalAktiv : ''} ${
                      hab ? '' : styles.regalZu
                    }`}
                    disabled={!hab}
                    onClick={() => {
                      setMeinKnoedel(k.id)
                      schreibAvatar(k.id)
                    }}
                    title={hab ? k.name : `${k.name} – ab Level ${k.abLevel}`}
                  >
                    <span className={styles.regalBild}>
                      {hab ? (
                        <Knoedel hex={k.hex} akzent={k.akzent} gesicht={k.gesicht} title={k.name} />
                      ) : (
                        <span className={styles.schloss} aria-hidden="true">
                          🔒
                        </span>
                      )}
                    </span>
                    <span className={styles.regalName}>{hab ? k.name : `Level ${k.abLevel}`}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <LevelMap
          currentLevel={level}
          highestLevel={Math.min(highest, DUMPLING_MAX_LEVEL)}
          avatarId={avatarId}
          avatarFigur={
            <span className={styles.kartenFigur}>
              <Knoedel
                hex={gewaehlterKnoedel.hex}
                akzent={gewaehlterKnoedel.akzent}
                gesicht={gewaehlterKnoedel.gesicht}
              />
            </span>
          }
          maxLevel={DUMPLING_MAX_LEVEL}
          onSelectLevel={onSelectLevel}
          gameLabel="Squishy Dumplings"
        />
      </main>
    )
  }

  if (!state) return null

  const knapp = restzeit <= 10
  const anteil = Math.min(1, state.gesammelt / state.ziel)

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={() => setPhase('map')}>
          {'←'} Karte
        </button>
        <h1 className={styles.title}>Level {state.level}</h1>
        <button type="button" className={styles.retry} onClick={() => startLevel(state.level)}>
          Neu
        </button>
      </header>

      <div className={styles.leisten}>
        <div className={styles.zielLeiste}>
          <div className={styles.zielBalken} style={{ width: `${anteil * 100}%` }} />
          <span className={styles.zielText}>
            {Math.min(state.gesammelt, state.ziel)} / {state.ziel} Knödel
          </span>
        </div>
        <div className={`${styles.uhr} ${knapp ? styles.uhrKnapp : ''}`}>
          <span aria-hidden="true">⏱</span> {Math.ceil(restzeit)}s
        </div>
      </div>

      <div className={styles.meta}>
        <span>{cfg.label}</span>
        <span>{cfg.farben} Farben</span>
        {cfg.kaefige > 0 && (
          <span className={state.kaefigeZu > 0 ? styles.metaOffen : undefined}>
            Käfige {cfg.kaefige - state.kaefigeZu}/{cfg.kaefige}
          </span>
        )}
      </div>

      <div
        className={styles.brett}
        style={{ gridTemplateColumns: `repeat(${state.cols}, 1fr)` }}
        aria-label="Spielfeld"
      >
        {feld.map((z, i) => {
          const hex = FARB_HEX[z.farbe] ?? '#888888'
          return (
            <button
              key={i}
              type="button"
              className={`${styles.zelle} ${gewaehlt === i ? styles.zelleGewaehlt : ''} ${
                treffer.has(i) ? styles.zelleTrifft : ''
              } ${wackelt.includes(i) ? styles.zelleWackelt : ''}`}
              onPointerDown={(e) => onZeigerRunter(i, e.clientX, e.clientY)}
              onPointerUp={(e) => onZeigerHoch(e.clientX, e.clientY)}
              disabled={laeuft || state.phase !== 'play'}
              aria-label={`${FARB_NAME[z.farbe] ?? ''}${z.kaefig ? ' im Käfig' : ''}`}
            >
              {z.farbe > 0 && (
                <Knoedel
                  hex={hex}
                  akzent={akzentVon(hex)}
                  gesicht={z.kaefig ? 'schlaf' : 'froh'}
                  kaefig={z.kaefig}
                />
              )}
            </button>
          )
        })}
      </div>

      <p className={styles.regelHinweis}>
        {state.besteKette > 1
          ? `Beste Kette: ${state.besteKette} Auflösungen hintereinander`
          : 'Tipp: Zwei Knödel antippen oder wischen.'}
      </p>

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={`${styles.card} ${styles.cardWin}`}>
            <div className={styles.confetti} aria-hidden="true">
              {'⭐'.repeat(Math.max(1, sterne))}
            </div>
            <h2>Geschafft!</h2>
            <p>
              Level {state.level} · {score} Punkte · +{xpGained} XP
            </p>
            {neuerKnoedel && (
              <div className={styles.belohnung}>
                <span className={styles.belohnungBild}>
                  <Knoedel
                    hex={neuerKnoedel.hex}
                    akzent={neuerKnoedel.akzent}
                    gesicht={neuerKnoedel.gesicht}
                    title={neuerKnoedel.name}
                  />
                </span>
                <span>
                  <strong>Neuer Knödel!</strong>
                  <br />
                  {neuerKnoedel.name} gehört jetzt dir – du kannst ihn als Figur tragen.
                </span>
              </div>
            )}
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                Karte
              </button>
              {state.level < DUMPLING_MAX_LEVEL && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => startLevel(state.level + 1)}
                >
                  Weiter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'lost' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>Zeit um!</h2>
            <p>
              {state.gesammelt} von {state.ziel} Knödeln
              {state.kaefigeZu > 0
                ? ` – und ${state.kaefigeZu} ${state.kaefigeZu === 1 ? 'Käfig war' : 'Käfige waren'} noch zu.`
                : '.'}
            </p>
            <p className={styles.muted}>
              Ketten bringen am meisten: ein Zug, nach dem von allein weiter etwas zusammenfällt.
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                Karte
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => startLevel(state.level)}
              >
                Nochmal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
