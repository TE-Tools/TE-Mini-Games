import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  bienenFlowGame,
  createBienenLevel,
  createMatch,
  tapSpalte,
  tick,
  kannTippen,
  passtNoch,
  sichtbareSpalten,
  verdeckteBloecke,
  zugaenglich,
  restPixel,
  fehlversuche,
  zaehleFehlversuch,
  loescheFehlversuche,
  plaetzeFuer,
  BONUS_AB,
  SLOT_COUNT,
  COLOR_HEX,
  BIENEN_MAX_LEVEL,
  SICHTBARE_REIHEN,
  type BienenState,
  type BienenLevel,
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
import { useSprache } from '@/i18n/sprache'
import styles from './BienenFlowPage.module.css'

type Phase = 'map' | 'play' | 'won' | 'lost'

interface Biene {
  id: string
  color: number
  /** Start (Platz), Ziel (Pollen) und Ende (Loch). */
  vonX: number
  vonY: number
  zielX: number
  zielY: number
  endeX: number
  endeY: number
}

/**
 * Ein ganzer Bienenflug: vom Platz hoch zum Pollen, aufnehmen, und mit der
 * Fracht hinunter ins Loch. Thomas (30.10.2026): "die Bienen sollen ins
 * Loch fliegen, nicht auf die Blöcke zurück."
 *
 * Er dauert länger als ein Takt -- so sind immer mehrere Bienen gleichzeitig
 * unterwegs, und daraus wird die Straße, die man im Original sieht. Thomas:
 * "die Bienen holen nicht ab wie im Video, sondern fliegen einfach nur
 * runter."
 */
const FLUG_MS = 720
/** Das Ende darf kurz nachwirken, bevor die Karte darüberklappt. */
const ENDE_MS = 900
/**
 * Der Takt der Bienen: So oft holt jeder arbeitende Block einen Pixel.
 *
 * Eingestellt am Original: Thomas hat ein Video von Level 1 geschickt, dort
 * zählt ein Block von 14 in 3,5 Sekunden auf 1 -- also rund 270 ms je
 * Pollen. Vorher hatte ich 55, dann 130, dann 180 ms geraten; jetzt sind es
 * 260 und damit praktisch dasselbe Tempo wie im Original. Ein Block mit 15
 * braucht allein knapp vier Sekunden, mit mehreren Plätzen entsprechend
 * weniger.
 */
const TAKT_MS = 260

/** Auf hellen Blöcken muss die Zahl dunkel stehen, sonst liest sie niemand. */
function schriftFarbe(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const helligkeit =
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return helligkeit > 0.62 ? '#2b2a26' : '#ffffff'
}

export function BienenFlowPage() {
  const { t } = useSprache()
  const b = t.bienenFlow
  const [level, setLevel] = useState(1)
  const [highest, setHighest] = useState(1)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('map')
  const [cfg, setCfg] = useState<BienenLevel>(() => createBienenLevel(1))
  const [state, setState] = useState<BienenState | null>(null)
  const [score, setScore] = useState(0)
  const [xpGained, setXpGained] = useState(0)
  const [sterne, setSterne] = useState(0)
  const [loading, setLoading] = useState(true)
  const [bienen, setBienen] = useState<Biene[]>([])
  /**
   * Pollen, die schon abgerechnet sind, aber noch liegen: Sie verschwinden
   * erst, wenn die Biene oben angekommen ist und zugreift.
   */
  const [imFlug, setImFlug] = useState<Map<number, number>>(new Map())
  /** Wie oft dieses Level schon schiefging -- ab zehn gibt es einen Platz mehr. */
  const [pleiten, setPleiten] = useState(0)
  /**
   * Mit welcher Zahl ein Block auf seinen Platz kam -- daraus wird die
   * Honigfüllung, die mit jedem Pollen steigt (03.11.2026, nach dem
   * Colony-Flow-Video: dort sieht man dem Block an, wie weit er ist).
   */
  const [startMenge, setStartMenge] = useState<Map<string, number>>(new Map())

  const bildRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const lochRef = useRef<HTMLSpanElement>(null)
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
    // Wer hier schon zehnmal hängengeblieben ist, bekommt den sechsten Platz.
    const match = createMatch(levelCfg, plaetzeFuer(L) - levelCfg.slotCount)
    setPleiten(fehlversuche(L))
    setCfg(levelCfg)
    setLevel(L)
    setState(match)
    setPhase('play')
    setScore(0)
    setXpGained(0)
    setSterne(0)
    setBienen([])
    setImFlug(new Map())
    setStartMenge(new Map())
  }, [])

  const onSelectLevel = useCallback(
    (L: number) => {
      if (L > highest) return
      startLevel(L)
    },
    [highest, startLevel],
  )

  const finishWon = useCallback(async (final: BienenState) => {
    // Geschafft -- der Fehlversuchszähler dieses Levels darf weg.
    loescheFehlversuche(final.level)
    setPleiten(0)
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
   * Der Herzschlag: Solange gespielt wird, holt jeder arbeitende Block im
   * Takt einen Pixel. Tippt man dazwischen, legt sich der neue Block auf den
   * nächsten freien Platz und arbeitet ab dem nächsten Schlag mit.
   */
  useEffect(() => {
    if (!state || state.phase !== 'play' || phase !== 'play') return
    const gen = lauf.current
    const uhr = window.setInterval(() => {
      if (lauf.current !== gen) return
      setState((alt) => {
        if (!alt || alt.phase !== 'play') return alt
        const r = tick(alt)
        if (r.schritte.length === 0) return alt

        // Für jeden Handgriff eine Biene -- pro Schlag sind das höchstens
        // fünf, also nie ein Schwarm.
        const flug: Biene[] = r.schritte.map(
          (sch: { zelle: number; slot: number; farbe: number }, k: number) => {
            const oben = mitte(bildRef.current?.children[sch.zelle])
            const unten = mitte(slotsRef.current?.children[sch.slot])
            const loch = mitte(lochRef.current)
            return {
              endeX: loch.x,
              endeY: loch.y,
              id: `f-${gen}-${alt.moves}-${sch.zelle}-${k}`,
              color: sch.farbe,
              vonX: unten.x,
              vonY: unten.y,
              zielX: oben.x,
              zielY: oben.y,
            }
          },
        )
        setBienen((prev) => [...prev, ...flug])
        window.setTimeout(
          () => setBienen((prev) => prev.filter((x) => !flug.some((f) => f.id === x.id))),
          FLUG_MS,
        )

        // Der Pollen bleibt liegen, bis die Biene oben ist und zugreift.
        setImFlug((prev) => {
          const neu = new Map(prev)
          for (const sch of r.schritte) neu.set(sch.zelle, sch.farbe)
          return neu
        })
        window.setTimeout(() => {
          setImFlug((prev) => {
            const neu = new Map(prev)
            for (const sch of r.schritte) neu.delete(sch.zelle)
            return neu
          })
        }, FLUG_MS * 0.5)

        return r.state
      })
    }, TAKT_MS)
    return () => window.clearInterval(uhr)
  }, [state, phase])

  /** Das Ende kurz nachwirken lassen, bevor die Karte darüberklappt. */
  useEffect(() => {
    if (!state || phase !== 'play') return
    if (state.phase === 'play') return
    const gen = lauf.current
    const uhr = window.setTimeout(() => {
      if (lauf.current !== gen) return
      if (state.phase === 'won') void finishWon(state)
      else {
        setPleiten(zaehleFehlversuch(state.level))
        setPhase('lost')
      }
    }, ENDE_MS)
    return () => window.clearTimeout(uhr)
  }, [state, phase, finishWon])

  const onTapSpalte = useCallback(
    (spalte: number) => {
      if (!state || state.phase !== 'play') return
      const block = state.spalten[spalte]?.[0]
      const ergebnis = tapSpalte(state, spalte)
      if (!ergebnis) return
      if (block) setStartMenge((prev) => new Map(prev).set(block.id, block.amount))
      setState(ergebnis.state)
    },
    [state],
  )

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>{b.laden}</p>
      </main>
    )
  }

  if (phase === 'map') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <Link to="/" className={styles.back}>
            {'←'} {b.zurueck}
          </Link>
          <h1 className={styles.title}>
            <span aria-hidden="true">🐝</span> {t.spiele['bienen-flow']}
          </h1>
        </header>
        <p className={styles.hint}>{b.regeln}</p>
        <LevelMap
          currentLevel={level}
          highestLevel={Math.min(highest, BIENEN_MAX_LEVEL)}
          avatarId={avatarId}
          maxLevel={BIENEN_MAX_LEVEL}
          onSelectLevel={onSelectLevel}
          gameLabel={t.spiele['bienen-flow']}
        />
      </main>
    )
  }

  if (!state) return null

  const pixelGroesse = Math.max(6, Math.min(26, Math.floor(330 / state.cols)))
  const sichtbar = sichtbareSpalten(state, SICHTBARE_REIHEN)
  const verdeckt = verdeckteBloecke(state, SICHTBARE_REIHEN)
  const frei = zugaenglich(state.board, state.rows, state.cols)
  const belegt = state.slots.filter((s) => s != null).length
  const rest = restPixel(state)
  /** Der sechste Platz aus zehn Fehlversuchen. */
  const bonus = state.slotCount > SLOT_COUNT
  const motiv = (b.motive as Record<string, string | undefined>)[cfg.motiv] ?? cfg.motiv
  const stufe = (b.stufen as Record<string, string | undefined>)[cfg.label] ?? cfg.label

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <button type="button" className={styles.back} onClick={() => setPhase('map')}>
          {'←'} {b.karte}
        </button>
        <h1 className={styles.title}>{b.level(state.level)}</h1>
        <button type="button" className={styles.retry} onClick={() => startLevel(state.level)}>
          {b.neu}
        </button>
      </header>

      <div className={styles.meta}>
        <span>
          {motiv} · {stufe}
        </span>
        <span className={belegt >= state.slotCount - 1 ? styles.metaEng : undefined}>
          {b.plaetze(belegt, state.slotCount)}
          {bonus ? ' ★' : ''}
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
          aria-label={b.bild(motiv)}
        >
          {state.board.map((echt, i) => {
            // Was gerade abgeholt wird, liegt noch da, bis die Biene zugreift.
            const c = echt !== 0 ? echt : (imFlug.get(i) ?? 0)
            return (
              <span
                key={i}
                className={`${styles.pixel} ${
                  c === 0 ? styles.pixelWeg : styles.pixelVoll
                } ${c !== 0 && echt !== 0 && !frei[i] ? styles.pixelVerdeckt : ''}`}
                style={c !== 0 ? { background: COLOR_HEX[c] ?? '#888' } : undefined}
              />
            )
          })}
        </div>

        {/*
         * Unter dem Bild die Leiste mit dem, was noch zu holen ist, darunter
         * das Nest. Solange ein Platz arbeitet, schwirrt dort ein kleiner
         * Schwarm -- im Original ist das die Ameisenstraße am Bildrand.
         */}
        <div className={styles.nest}>
          <span className={styles.zaehler} aria-label={b.nochPixel(rest)}>
            <span key={rest} className={styles.zaehlerZahl}>
              {rest}
            </span>
          </span>
          <span className={styles.huegel} aria-hidden="true">
            <span ref={lochRef} className={styles.loch} />
            {belegt > 0 && state.phase === 'play' && (
              <span className={styles.schwarm}>
                {[0, 1, 2, 3, 4].map((k) => (
                  <i key={k} style={{ '--k': k } as CSSProperties}>
                    🐝
                  </i>
                ))}
              </span>
            )}
          </span>
        </div>

        <div className={styles.slots} ref={slotsRef} aria-label={b.plaetzeDerKolonie}>
          {state.slots.map((platz, i) => {
            const start = platz ? (startMenge.get(platz.id) ?? platz.amount) : 0
            const voll = platz && start > 0 ? 1 - platz.amount / start : 0
            return (
              <div
                key={platz ? platz.id : `leer-${i}`}
                className={`${styles.slot} ${platz ? styles.slotBelegt : ''} ${
                  bonus && i === state.slotCount - 1 ? styles.slotBonus : ''
                }`}
                style={
                  platz
                    ? {
                        background: COLOR_HEX[platz.color] ?? '#888',
                        color: schriftFarbe(COLOR_HEX[platz.color] ?? '#888'),
                      }
                    : undefined
                }
              >
                {platz && (
                  <i
                    className={styles.honig}
                    style={{ transform: `scaleY(${voll})` }}
                    aria-hidden="true"
                  />
                )}
                {platz ? <span className={styles.slotZahl}>{platz.amount}</span> : '⬡'}
              </div>
            )
          })}
        </div>

        {bienen.map((biene) => (
          <span
            key={biene.id}
            className={styles.biene}
            style={
              {
                '--von-x': `${biene.vonX}px`,
                '--von-y': `${biene.vonY}px`,
                '--ziel-x': `${biene.zielX}px`,
                '--ziel-y': `${biene.zielY}px`,
                '--ende-x': `${biene.endeX}px`,
                '--ende-y': `${biene.endeY}px`,
                '--dur': `${FLUG_MS}ms`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            🐝
            <i className={styles.fracht} style={{ background: COLOR_HEX[biene.color] ?? '#888' }} />
          </span>
        ))}
      </div>

      <div
        className={styles.spalten}
        style={{ gridTemplateColumns: `repeat(${sichtbar.length}, 1fr)` }}
        aria-label={b.nachschub}
      >
        {sichtbar.map((spalte, si) => (
          <div key={si} className={styles.spalte}>
            {spalte.map((block, bi) => {
              const oben = bi === 0
              const passt = oben && passtNoch(state, block)
              return (
                <button
                  key={block.id}
                  type="button"
                  className={`${styles.block} ${oben ? styles.blockOben : styles.blockTief} ${
                    passt ? styles.blockPasst : ''
                  }`}
                  style={{
                    background: COLOR_HEX[block.color] ?? '#888',
                    color: schriftFarbe(COLOR_HEX[block.color] ?? '#888'),
                  }}
                  disabled={!oben || !kannTippen(state, si)}
                  onClick={() => onTapSpalte(si)}
                  aria-label={
                    oben
                      ? passt
                        ? b.abschickenPasst(block.amount)
                        : b.abschicken(block.amount)
                      : b.wartet(block.amount)
                  }
                >
                  {block.amount}
                </button>
              )
            })}
            {spalte.length === 0 && <span className={styles.spalteLeer} aria-hidden="true" />}
          </div>
        ))}
      </div>

      <p className={styles.regelHinweis}>
        {bonus && b.bonusAktiv}
        {verdeckt > 0 ? b.verdeckt(verdeckt) : b.alleSichtbar}
      </p>

      {phase === 'won' && (
        <div className={styles.overlay}>
          <div className={`${styles.card} ${styles.cardWin}`}>
            <div className={styles.confetti} aria-hidden="true">
              {'⭐'.repeat(Math.max(1, sterne))}
            </div>
            <h2>{b.abgetragen}</h2>
            <p>{b.ergebnis(state.level, score, xpGained)}</p>
            <p className={styles.muted}>
              {state.tote === 0 ? b.genauAufgegangen : b.liegenGeblieben(state.tote)}
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                {b.karte}
              </button>
              {state.level < BIENEN_MAX_LEVEL && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => startLevel(state.level + 1)}
                >
                  {b.weiter}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === 'lost' && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>{b.koloniesteht}</h2>
            <p>{b.koloniestehtText(state.slotCount)}</p>
            <p className={styles.muted}>
              {pleiten >= BONUS_AB
                ? b.versuchMitBonus(pleiten)
                : pleiten >= BONUS_AB - 3
                  ? b.versuchBaldBonus(pleiten, BONUS_AB)
                  : b.versuch(pleiten)}
            </p>
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase('map')}>
                {b.karte}
              </button>
              <button
                type="button"
                className={styles.primary}
                onClick={() => startLevel(state.level)}
              >
                {b.nochmal}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
