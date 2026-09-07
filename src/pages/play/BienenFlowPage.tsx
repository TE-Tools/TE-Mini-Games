import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  bienenFlowGame,
  createBienenLevel,
  createMatch,
  tapSpalte,
  kannTippen,
  passtNoch,
  sichtbareSpalten,
  verdeckteBloecke,
  zugaenglich,
  restPixel,
  COLOR_HEX,
  BIENEN_MAX_LEVEL,
  SICHTBARE_REIHEN,
  type BienenState,
  type BienenBlock,
  type BienenLevel,
  type TapResult,
} from '@/games/bienen-flow'
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
import styles from './BienenFlowPage.module.css'

type Phase = 'map' | 'play' | 'won' | 'lost'

interface Biene {
  id: string
  color: number
  fromX: number
  fromY: number
  toX: number
  toY: number
}

/** So lange fliegt eine Biene von der Zelle zum Platz. */
const FLUG_MS = 300
/** Das Ende darf kurz nachwirken, bevor die Karte darüberklappt. */
const ENDE_MS = 700
/** So lange soll das Tröpfeln eines Zuges höchstens dauern. */
const ARBEIT_MS = 1100

/** Auf hellen Blöcken muss die Zahl dunkel stehen, sonst liest sie niemand. */
function schriftFarbe(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const helligkeit =
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return helligkeit > 0.62 ? '#2b2a26' : '#ffffff'
}

function warte(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

export function BienenFlowPage() {
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [cfg, setCfg] = useState<BienenLevel>(() => createBienenLevel(1))
  const [state, setState] = useState<BienenState | null>(null)
  /** Was gerade zu sehen ist -- hinkt beim Tröpfeln absichtlich hinterher. */
  const [zeigeBoard, setZeigeBoard] = useState<number[]>([])
  const [zeigeSlots, setZeigeSlots] = useState<(BienenBlock | null)[]>([])
  const [score, setScore] = useState(0)
  const [xpGained, setXpGained] = useState(0)
  const [sterne, setSterne] = useState(0)
  const [loading, setLoading] = useState(true)
  const [bienen, setBienen] = useState<Biene[]>([])

  const bildRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const buehneRef = useRef<HTMLDivElement>(null)
  /** Zählt bei jedem neuen Zug hoch; ältere Animationen brechen daran ab. */
  const lauf = useRef(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [progress, profile] = await Promise.all([
          getOrCreateGameProgress('bienen-flow'),
          getOrCreateGuestProfile(),
        ])
        if (cancelled) return
        setHighest(Math.max(1, progress.highestLevel || 1))
        setLevel(Math.max(1, progress.currentLevel || progress.highestLevel || 1))
        setAvatarId(profile.avatar)
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const startLevel = useCallback((L: number) => {
    lauf.current += 1
    const levelCfg = createBienenLevel(L)
    const match = createMatch(levelCfg)
    setCfg(levelCfg)
    setLevel(L)
    setState(match)
    setZeigeBoard(match.board.slice())
    setZeigeSlots(match.slots.slice())
    setPhase('play')
    setScore(0)
    setXpGained(0)
    setSterne(0)
    setBienen([])
  }, [])

  const onSelectLevel = useCallback(
    (L: number) => {
      if (L > highest) return
      startLevel(L)
    },
    [highest, startLevel],
  )

  const finishWon = useCallback(async (final: BienenState) => {
    const raw = { won: true, tote: final.tote, slotCount: final.slotCount }
    const sc = bienenFlowGame.calculateScore(final.level, raw)
    const xp = bienenFlowGame.calculateXP(final.level, sc)
    const st = bienenFlowGame.calculateStars?.(final.level, sc) ?? 0
    setScore(sc)
    setXpGained(xp)
    setSterne(st)
    setPhase('won')
    try {
      await saveGameResult({
        gameId: 'bienen-flow',
        level: final.level,
        score: sc,
        xp,
        stars: st,
        resultData: raw,
      })
      await addXp('guest', xp)
      const progress = await recordLevelComplete('bienen-flow', final.level, xp)
      setHighest(Math.max(progress.highestLevel, final.level + 1))
      await processAfterResult({ gameId: 'bienen-flow', level: final.level })
      void trySyncNow()
    } catch (e) {
      console.error(e)
    }
  }, [])

  function mitte(el: Element | null | undefined): { x: number; y: number } {
    const buehne = buehneRef.current
    if (!buehne || !el) return { x: 0, y: 0 }
    const br = buehne.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    return { x: er.left + er.width / 2 - br.left, y: er.top + er.height / 2 - br.top }
  }

  /**
   * Spielt die Handgriffe der Bienen nacheinander ab. Der Zustand selbst ist
   * schon fertig gerechnet -- das hier ist nur die Vorführung. Tippt man
   * mitten hinein, bricht der Lauf ab und der nächste beginnt beim fertigen
   * Stand; so geht keine Eingabe verloren.
   */
  const zeigeArbeit = useCallback(
    async (vorher: BienenState, ergebnis: TapResult, gen: number) => {
      const board = vorher.board.slice()
      const slots = vorher.slots.slice()
      slots[ergebnis.slot] = { ...ergebnis.block }
      setZeigeBoard(board.slice())
      setZeigeSlots(slots.slice())

      const takt = Math.max(14, Math.min(70, Math.floor(ARBEIT_MS / Math.max(1, ergebnis.schritte.length))))
      for (let i = 0; i < ergebnis.schritte.length; i++) {
        if (lauf.current !== gen) return
        const s = ergebnis.schritte[i]!
        board[s.zelle] = 0
        const rest = (slots[s.slot]?.amount ?? 1) - 1
        slots[s.slot] = rest > 0 ? { ...slots[s.slot]!, amount: rest } : null
        setZeigeBoard(board.slice())
        setZeigeSlots(slots.slice())

        // Nicht für jeden Handgriff eine Biene -- bei 60 Pixeln wäre das Chaos.
        if (i % 3 === 0) {
          const von = mitte(bildRef.current?.children[s.zelle])
          const nach = mitte(slotsRef.current?.children[s.slot])
          const id = `b-${gen}-${i}`
          setBienen((prev) => [
            ...prev,
            { id, color: s.farbe, fromX: von.x, fromY: von.y, toX: nach.x, toY: nach.y },
          ])
          window.setTimeout(() => setBienen((prev) => prev.filter((b) => b.id !== id)), FLUG_MS)
        }
        await warte(takt)
      }

      if (lauf.current !== gen) return
      setZeigeBoard(ergebnis.state.board.slice())
      setZeigeSlots(ergebnis.state.slots.slice())

      if (ergebnis.state.phase === 'won') {
        await warte(ENDE_MS)
        if (lauf.current === gen) void finishWon(ergebnis.state)
      } else if (ergebnis.state.phase === 'lost') {
        await warte(ENDE_MS)
        if (lauf.current === gen) setPhase('lost')
      }
    },
    [finishWon],
  )

  const onTapSpalte = useCallback(
    (spalte: number) => {
      if (!state || state.phase !== 'play') return
      const ergebnis = tapSpalte(state, spalte)
      if (!ergebnis) return
      const gen = ++lauf.current
      setState(ergebnis.state)
      void zeigeArbeit(state, ergebnis, gen)
    },
    [state, zeigeArbeit],
  )

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Laden…</p>
      </main>
    )
  }

  if (phase === 'map') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <Link to="/" className={styles.back}>
            {'←'} Zurück
          </Link>
          <h1 className={styles.title}>
            <span aria-hidden="true">🐝</span> Bienen-Flow
          </h1>
        </header>
        <p className={styles.hint}>
          Schieb einen Block auf einen freien Platz – von dort holen die Bienen Pixel seiner Farbe
          aus dem Bild. Sie kommen nur an das heran, was von außen zugänglich ist. Der Block ist
          voll, wenn seine Zahl bei null ist; passt seine Farbe gerade nirgends, wartet er und
          belegt den Platz. Fünf wartende Plätze, und die Kolonie steht.
        </p>
        <LevelMap
          currentLevel={level}
          highestLevel={Math.min(highest, BIENEN_MAX_LEVEL)}
          avatarId={avatarId}
          maxLevel={BIENEN_MAX_LEVEL}
          onSelectLevel={onSelectLevel}
          gameLabel="Bienen-Flow"
        />
      </main>
    )
  }

  if (!state) return null

  const pixelGroesse = Math.max(6, Math.min(26, Math.floor(330 / state.cols)))
  const sichtbar = sichtbareSpalten(state, SICHTBARE_REIHEN)
  const verdeckt = verdeckteBloecke(state, SICHTBARE_REIHEN)
  const frei = zugaenglich(zeigeBoard, state.rows, state.cols)
  const belegt = zeigeSlots.filter((s) => s != null).length

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

      <div className={styles.meta}>
        <span>{cfg.motiv}</span>
        <span>{restPixel({ ...state, board: zeigeBoard })} Pixel</span>
        <span className={belegt >= state.slotCount - 1 ? styles.metaEng : undefined}>
          Plätze {belegt}/{state.slotCount}
        </span>
      </div>

      <div className={styles.buehne} ref={buehneRef}>
        <div
          ref={bildRef}
          className={styles.bild}
          style={{
            gridTemplateColumns: `repeat(${state.cols}, ${pixelGroesse}px)`,
            gridTemplateRows: `repeat(${state.rows}, ${pixelGroesse}px)`,
          }}
          aria-label={`Bild: ${cfg.motiv}`}
        >
          {zeigeBoard.map((c, i) => (
            <span
              key={i}
              className={`${styles.pixel} ${c === 0 ? styles.pixelWeg : ''} ${
                c !== 0 && !frei[i] ? styles.pixelVerdeckt : ''
              }`}
              style={c !== 0 ? { background: COLOR_HEX[c] ?? '#888' } : undefined}
            />
          ))}
        </div>

        <div className={styles.slots} ref={slotsRef} aria-label="Plätze der Kolonie">
          {zeigeSlots.map((b, i) => (
            <div
              key={i}
              className={`${styles.slot} ${b ? styles.slotBelegt : ''}`}
              style={
                b
                  ? {
                      background: COLOR_HEX[b.color] ?? '#888',
                      color: schriftFarbe(COLOR_HEX[b.color] ?? '#888'),
                    }
                  : undefined
              }
            >
              {b ? <span className={styles.slotZahl}>{b.amount}</span> : '⬡'}
            </div>
          ))}
        </div>

        {bienen.map((b) => (
          <span
            key={b.id}
            className={styles.biene}
            style={
              {
                '--from-x': `${b.fromX}px`,
                '--from-y': `${b.fromY}px`,
                '--to-x': `${b.toX}px`,
                '--to-y': `${b.toY}px`,
                '--dur': `${FLUG_MS}ms`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            🐝
          </span>
        ))}
      </div>

      <div className={styles.spalten} aria-label="Nachschub">
        {sichtbar.map((spalte, si) => (
          <div key={si} className={styles.spalte}>
            {spalte.map((b, bi) => {
              const oben = bi === 0
              const passt = oben && passtNoch(state, b)
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`${styles.block} ${oben ? styles.blockOben : styles.blockTief} ${
                    passt ? styles.blockPasst : ''
                  }`}
                  style={{
                    background: COLOR_HEX[b.color] ?? '#888',
                    color: schriftFarbe(COLOR_HEX[b.color] ?? '#888'),
                  }}
                  disabled={!oben || !kannTippen(state, si)}
                  onClick={() => onTapSpalte(si)}
                  aria-label={
                    oben
                      ? `Block mit ${b.amount} abschicken${passt ? ', geht genau auf' : ''}`
                      : `Block mit ${b.amount}, wartet`
                  }
                >
                  {b.amount}
                </button>
              )
            })}
            {spalte.length === 0 && <span className={styles.spalteLeer} aria-hidden="true" />}
          </div>
        ))}
      </div>

      <p className={styles.regelHinweis}>
        {verdeckt > 0
          ? `Noch ${verdeckt} Blöcke unter dem sichtbaren Stapel – halte einen Platz frei.`
          : 'Alle Blöcke sind zu sehen.'}
      </p>

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={`${styles.card} ${styles.cardWin}`}>
            <div className={styles.confetti} aria-hidden="true">
              {'⭐'.repeat(Math.max(1, sterne))}
            </div>
            <h2>Bild abgetragen!</h2>
            <p>
              Level {state.level} · {score} Punkte · +{xpGained} XP
            </p>
            <p className={styles.muted}>
              {state.tote === 0
                ? 'Kein Block zu viel – genau aufgegangen.'
                : `${state.tote} ${state.tote === 1 ? 'Block' : 'Blöcke'} blieben liegen`}
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                Karte
              </button>
              {state.level < BIENEN_MAX_LEVEL && (
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
            <h2>Die Kolonie steht</h2>
            <p>
              Alle {state.slotCount} Plätze sind belegt, und keine dieser Farben liegt gerade frei.
              Damit kommt keine Biene mehr an ein Pixel heran.
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
