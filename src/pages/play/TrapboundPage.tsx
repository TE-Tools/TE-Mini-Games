import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  trapboundGame,
  laufe,
  starte,
  levelDaten,
  alleLevel,
  abschnittVon,
  weltVon,
  WELTEN,
  LEVEL_ANZAHL,
  leseStand,
  levelStand,
  merkeTod,
  merkeAbschluss,
  setzeEinstellungen,
  kristalle,
  geschaffte,
  todeGesamt,
  loescheStand,
  BILD_BREITE,
  BILD_HOEHE,
  type Spielstand,
  type Stand,
} from '@/games/trapbound'
import { spiele, setzeTon, setzeLautstaerke, lautstaerke, tonAn } from '@/services/sound'
import { saveGameResult, addXp, recordLevelComplete, getOrCreateGameProgress } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { zeichne } from './TrapboundBild'
import { TrapboundKarte } from './TrapboundKarte'
import styles from './TrapboundPage.module.css'

type Ansicht = 'menue' | 'karte' | 'spiel' | 'einstellungen' | 'sammlung' | 'ueber'

/** Wie lange die Figur nach dem Tod liegen bleibt, bevor es neu losgeht. */
const TOD_MS = 480
/** Wie lange der Ausgang nach dem Erreichen leuchtet. */
const SIEG_MS = 420

interface Ende {
  punkte: number
  xp: number
  sterne: number
  tode: number
  zeit: number
  kristall: boolean
  neu: boolean
}

export function TrapboundPage() {
  const [ansicht, setAnsicht] = useState<Ansicht>('menue')
  const [levelNr, setLevelNr] = useState(1)
  const [stand, setStand] = useState<Stand>(() => leseStand())
  const [hud, setHud] = useState({ tode: 0, zeit: 0, kristall: false })
  const [pause, setPause] = useState(false)
  const [ende, setEnde] = useState<Ende | null>(null)
  const [tipp, setTipp] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buehneRef = useRef<HTMLDivElement>(null)
  const spielRef = useRef<Spielstand | null>(null)
  const eingabeRef = useRef({ links: false, rechts: false, sprung: false })
  const todeRef = useRef(0)
  const pauseRef = useRef(false)
  const endeRef = useRef(false)
  /** Zählt bei jedem Levelwechsel hoch; alte Schleifen brechen daran ab. */
  const lauf = useRef(0)

  const einst = stand.einstellungen

  useEffect(() => {
    pauseRef.current = pause
  }, [pause])
  useEffect(() => {
    endeRef.current = ende !== null
  }, [ende])

  /** Beim ersten Aufruf: Wo stand der Spieler? */
  useEffect(() => {
    let weg = false
    void (async () => {
      try {
        const p = await getOrCreateGameProgress('trapbound')
        if (weg) return
        const s = leseStand()
        setLevelNr(Math.max(1, Math.min(LEVEL_ANZAHL, p.currentLevel || s.freigeschaltet)))
      } catch {
        // Ohne Datenbank ist der lokale Stand maßgeblich.
      }
    })()
    return () => {
      weg = true
    }
  }, [])

  const starteLevel = useCallback((nr: number) => {
    lauf.current += 1
    const daten = levelDaten(nr)
    spielRef.current = starte(daten)
    todeRef.current = 0
    setLevelNr(nr)
    setHud({ tode: 0, zeit: 0, kristall: false })
    setEnde(null)
    setPause(false)
    setTipp(daten.nr <= 3 ? 'Nach rechts zur Tür.' : '')
    setAnsicht('spiel')
  }, [])

  /** Nach einem Tod: sofort wieder auf Anfang, Fallen zurück. */
  const neustart = useCallback(() => {
    const daten = levelDaten(levelNr)
    spielRef.current = starte(daten)
    setEnde(null)
  }, [levelNr])

  const gewonnen = useCallback(async (s: Spielstand) => {
    const roh = {
      won: true,
      tode: todeRef.current,
      zeit: s.zeit,
      kristall: s.kristall,
    }
    const punkte = trapboundGame.calculateScore(s.level.nr, roh)
    const xp = trapboundGame.calculateXP(s.level.nr, punkte)
    const sterne = trapboundGame.calculateStars?.(s.level.nr, punkte) ?? 0
    const vorher = levelStand(s.level.nr)
    const neuerStand = merkeAbschluss({
      nr: s.level.nr,
      tode: todeRef.current,
      zeit: s.zeit,
      kristall: s.kristall,
    })
    setStand(neuerStand)
    setEnde({
      punkte,
      xp,
      sterne,
      tode: todeRef.current,
      zeit: s.zeit,
      kristall: s.kristall,
      neu: !vorher.fertig,
    })
    try {
      await saveGameResult({
        gameId: 'trapbound',
        level: s.level.nr,
        score: punkte,
        xp,
        stars: sterne,
        resultData: roh,
      })
      await addXp('guest', xp)
      await recordLevelComplete('trapbound', s.level.nr, xp)
      await processAfterResult({ gameId: 'trapbound', level: s.level.nr })
      void trySyncNow()
    } catch (e) {
      console.error(e)
    }
  }, [])

  /** Die Schleife: rechnen, zeichnen, Töne. */
  useEffect(() => {
    if (ansicht !== 'spiel') return
    const gen = lauf.current
    let laeuftNoch = true
    let zuletzt = performance.now()
    let uhr = 0
    let hudZeit = 0
    let totSeit = -1
    let siegSeit = -1

    const bild = () => {
      if (!laeuftNoch || lauf.current !== gen) return
      const jetzt = performance.now()
      const dt = Math.min(0.05, Math.max(0, (jetzt - zuletzt) / 1000))
      zuletzt = jetzt
      uhr += dt

      const s = spielRef.current
      if (s) {
        if (!pauseRef.current && !endeRef.current) {
          const neu = laufe(s, eingabeRef.current, dt)
          spielRef.current = neu

          for (const e of neu.ereignisse) {
            if (e === 'sprung') spiele('sprung')
            else if (e === 'landung') spiele('landen')
            else if (e === 'falle') spiele('falle')
            else if (e === 'feder') spiele('sprung')
            else if (e === 'teleport') spiele('knopf')
            else if (e === 'knopf') spiele('knopf')
            else if (e === 'kristall') spiele('geheimnis')
            else if (e === 'tod') spiele('tod')
            else if (e === 'geschafft') spiele('geschafft')
          }

          if (neu.phase === 'tot' && totSeit < 0) {
            totSeit = jetzt
            todeRef.current += 1
            merkeTod(neu.level.nr)
            setHud((h) => ({ ...h, tode: todeRef.current }))
          }
          if (neu.phase === 'geschafft' && siegSeit < 0) siegSeit = jetzt

          if (totSeit > 0 && jetzt - totSeit > TOD_MS) {
            totSeit = -1
            neustart()
          }
          if (siegSeit > 0 && jetzt - siegSeit > SIEG_MS) {
            siegSeit = -1
            void gewonnen(neu)
          }

          hudZeit += dt
          if (hudZeit > 0.2) {
            hudZeit = 0
            setHud({ tode: todeRef.current, zeit: neu.zeit, kristall: neu.kristall })
          }
        }
        zeichneAlles(s, uhr)
      }
      requestAnimationFrame(bild)
    }

    const zeichneAlles = (s: Spielstand, u: number) => {
      const c = canvasRef.current
      if (!c) return
      const ctx = c.getContext('2d')
      if (!ctx) return
      const dpr = Math.min(2.5, window.devicePixelRatio || 1)
      const breiteCss = c.clientWidth
      const hoeheCss = c.clientHeight
      if (breiteCss === 0 || hoeheCss === 0) return
      if (c.width !== Math.round(breiteCss * dpr) || c.height !== Math.round(hoeheCss * dpr)) {
        c.width = Math.round(breiteCss * dpr)
        c.height = Math.round(hoeheCss * dpr)
      }
      const skala = Math.min(c.width / BILD_BREITE, c.height / BILD_HOEHE)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = '#0b0916'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.setTransform(
        skala,
        0,
        0,
        skala,
        (c.width - BILD_BREITE * skala) / 2,
        (c.height - BILD_HOEHE * skala) / 2,
      )
      ctx.imageSmoothingEnabled = false
      zeichne(ctx, s, { welt: weltVon(s.level.nr), beben: einst.beben, uhr: u })
    }

    requestAnimationFrame(bild)
    return () => {
      laeuftNoch = false
    }
  }, [ansicht, neustart, gewonnen, einst.beben])

  /** Tastatur. */
  useEffect(() => {
    if (ansicht !== 'spiel') return
    const runter = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') eingabeRef.current.links = true
      else if (k === 'd' || k === 'arrowright') eingabeRef.current.rechts = true
      else if (k === 'w' || k === 'arrowup' || k === ' ' || k === 'spacebar')
        eingabeRef.current.sprung = true
      else if (k === 'r') neustart()
      else if (k === 'escape') setPause((p) => !p)
      else return
      e.preventDefault()
    }
    const hoch = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'a' || k === 'arrowleft') eingabeRef.current.links = false
      else if (k === 'd' || k === 'arrowright') eingabeRef.current.rechts = false
      else if (k === 'w' || k === 'arrowup' || k === ' ' || k === 'spacebar')
        eingabeRef.current.sprung = false
    }
    window.addEventListener('keydown', runter)
    window.addEventListener('keyup', hoch)
    return () => {
      window.removeEventListener('keydown', runter)
      window.removeEventListener('keyup', hoch)
      eingabeRef.current = { links: false, rechts: false, sprung: false }
    }
  }, [ansicht, neustart])

  const halte = useCallback((taste: 'links' | 'rechts' | 'sprung', an: boolean) => {
    eingabeRef.current[taste] = an
  }, [])

  const vollbild = useCallback(() => {
    const el = buehneRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.().catch(() => undefined)
  }, [])

  const weiter = useCallback(() => {
    const naechstes = Math.min(LEVEL_ANZAHL, levelNr + 1)
    if (naechstes === levelNr) setAnsicht('karte')
    else starteLevel(naechstes)
  }, [levelNr, starteLevel])

  // ------------------------------------------------------------------ Menü

  if (ansicht === 'menue') {
    const offen = stand.freigeschaltet
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <Link to="/" className={styles.back}>
            {'←'} Zurück
          </Link>
        </header>
        <div className={styles.titelblock}>
          <h1 className={styles.titel}>TRAPBOUND</h1>
          <p className={styles.untertitel}>Der Boden lügt.</p>
        </div>
        <div className={styles.menue}>
          <button
            type="button"
            className={styles.menueHaupt}
            onClick={() => starteLevel(Math.min(offen, LEVEL_ANZAHL))}
          >
            {geschaffte(stand) > 0 ? `WEITER · LEVEL ${offen}` : 'SPIELEN'}
          </button>
          <button type="button" className={styles.menueKnopf} onClick={() => setAnsicht('karte')}>
            Levelkarte
          </button>
          <button
            type="button"
            className={styles.menueKnopf}
            onClick={() => setAnsicht('sammlung')}
          >
            Sammlung
          </button>
          <button
            type="button"
            className={styles.menueKnopf}
            onClick={() => setAnsicht('einstellungen')}
          >
            Einstellungen
          </button>
          <button type="button" className={styles.menueKnopf} onClick={() => setAnsicht('ueber')}>
            Über das Spiel
          </button>
        </div>
        <p className={styles.fussnote}>
          {geschaffte(stand)} von {LEVEL_ANZAHL} Leveln · {kristalle(stand)} Kristalle ·{' '}
          {todeGesamt(stand)} Tode
        </p>
      </main>
    )
  }

  // ------------------------------------------------------------------ Karte

  if (ansicht === 'karte') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <button type="button" className={styles.back} onClick={() => setAnsicht('menue')}>
            {'←'} Menü
          </button>
          <h1 className={styles.kopfTitel}>Levelkarte</h1>
          <span className={styles.kopfWert}>
            {geschaffte(stand)}/{LEVEL_ANZAHL}
          </span>
        </header>
        <TrapboundKarte
          welten={WELTEN}
          freigeschaltet={stand.freigeschaltet}
          aktuell={levelNr}
          stand={stand.level}
          onWaehle={starteLevel}
        />
      </main>
    )
  }

  // --------------------------------------------------------- Einstellungen

  if (ansicht === 'einstellungen') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <button type="button" className={styles.back} onClick={() => setAnsicht('menue')}>
            {'←'} Menü
          </button>
          <h1 className={styles.kopfTitel}>Einstellungen</h1>
        </header>
        <div className={styles.karte2}>
          <label className={styles.reihe}>
            <span>Ton</span>
            <input
              type="checkbox"
              checked={einst.ton && tonAn()}
              onChange={(e) => {
                setzeTon(e.target.checked)
                setStand({ ...stand, einstellungen: setzeEinstellungen({ ton: e.target.checked }) })
              }}
            />
          </label>
          <label className={styles.reihe}>
            <span>Lautstärke</span>
            <input
              type="range"
              min={0}
              max={100}
              defaultValue={Math.round(lautstaerke() * 100)}
              onChange={(e) => {
                const wert = Number(e.target.value) / 100
                setzeLautstaerke(wert)
                setStand({
                  ...stand,
                  einstellungen: setzeEinstellungen({ lautstaerke: wert }),
                })
              }}
            />
          </label>
          <label className={styles.reihe}>
            <span>Bildschirm wackeln</span>
            <input
              type="checkbox"
              checked={einst.beben}
              onChange={(e) =>
                setStand({
                  ...stand,
                  einstellungen: setzeEinstellungen({ beben: e.target.checked }),
                })
              }
            />
          </label>
          <label className={styles.reihe}>
            <span>Knöpfe für Linkshänder</span>
            <input
              type="checkbox"
              checked={einst.linkshand}
              onChange={(e) =>
                setStand({
                  ...stand,
                  einstellungen: setzeEinstellungen({ linkshand: e.target.checked }),
                })
              }
            />
          </label>
          <p className={styles.hinweis}>
            Steuerung am Rechner: <b>A</b>/<b>D</b> oder Pfeiltasten, <b>W</b>/<b>Leertaste</b>{' '}
            springen, <b>R</b> neu starten, <b>Esc</b> Pause.
          </p>
          <button
            type="button"
            className={styles.gefahrKnopf}
            onClick={() => {
              if (!window.confirm('Wirklich den ganzen Fortschritt löschen?')) return
              loescheStand()
              setStand(leseStand())
              setLevelNr(1)
            }}
          >
            Fortschritt löschen
          </button>
        </div>
      </main>
    )
  }

  // ------------------------------------------------------------- Sammlung

  if (ansicht === 'sammlung') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <button type="button" className={styles.back} onClick={() => setAnsicht('menue')}>
            {'←'} Menü
          </button>
          <h1 className={styles.kopfTitel}>Sammlung</h1>
        </header>
        <div className={styles.karte2}>
          <p className={styles.hinweis}>
            In manchen Leveln liegt ein <b>Schattenkristall</b>. Er ist nie auf dem Weg zum Ausgang
            – man findet ihn nur, wenn man dorthin geht, wo man eigentlich nicht hin soll.
          </p>
          <div className={styles.kristallGitter}>
            {alleLevel().map((l) => {
              const hat = l.objekte.some((o) => o.typ === 'kristall')
              const gefunden = Boolean(stand.level[String(l.nr)]?.kristall)
              if (!hat) return null
              return (
                <div key={l.nr} className={styles.kristallPlatz}>
                  <span className={gefunden ? styles.kristallDa : styles.kristallWeg}>◆</span>
                  <span>{gefunden ? l.name : `Level ${l.nr}`}</span>
                </div>
              )
            })}
          </div>
          <p className={styles.hinweis}>
            {kristalle(stand)} von{' '}
            {alleLevel().filter((l) => l.objekte.some((o) => o.typ === 'kristall')).length}{' '}
            gefunden.
          </p>
        </div>
      </main>
    )
  }

  // ------------------------------------------------------------------ Über

  if (ansicht === 'ueber') {
    return (
      <main className={styles.page}>
        <header className={styles.top}>
          <button type="button" className={styles.back} onClick={() => setAnsicht('menue')}>
            {'←'} Menü
          </button>
          <h1 className={styles.kopfTitel}>Über das Spiel</h1>
        </header>
        <div className={styles.karte2}>
          <p>
            <b>TRAPBOUND</b> ist ein Fallen-Jump-and-Run: kurze Level, die harmlos aussehen und es
            nicht sind. Sterben gehört dazu; jeder Tod ist erklärbar, und nach dem Tod geht es
            sofort weiter.
          </p>
          <p className={styles.hinweis}>
            Eigenständig entwickelt für TE-Mini Games – eigene Figur, eigene Welt, eigene Level,
            eigene Fallen. Alle Grafiken und Töne entstehen im Browser, es werden keine fremden
            Vorlagen verwendet.
          </p>
          <p className={styles.hinweis}>
            Welt 1 „Die Höhlen“ mit zehn Leveln ist fertig. Die Level liegen als Daten vor, damit
            weitere Welten – Fabrik, Turm, verdrehte Welt – ohne Umbau der Spielengine dazukommen
            können.
          </p>
        </div>
      </main>
    )
  }

  // ------------------------------------------------------------------ Spiel

  const daten = levelDaten(levelNr)
  const abschnitt = abschnittVon(levelNr)
  const knoepfeGetauscht = einst.linkshand

  return (
    <main className={styles.spielSeite}>
      <div className={styles.hud}>
        <button type="button" className={styles.hudKnopf} onClick={() => setAnsicht('karte')}>
          Karte
        </button>
        <div className={styles.hudMitte}>
          <span className={styles.hudLevel}>
            {levelNr}. {daten.name}
          </span>
          <span className={styles.hudKlein}>
            {abschnitt.welt.name} · {abschnitt.name}
          </span>
        </div>
        <div className={styles.hudRechts}>
          <span className={styles.hudWert} title="Tode in diesem Anlauf">
            ☠ {hud.tode}
          </span>
          <span className={styles.hudWert}>{hud.zeit.toFixed(1)}s</span>
          <div className={styles.werkzeuge}>
            <button
              type="button"
              className={styles.werkzeug}
              onClick={neustart}
              aria-label="Level neu starten"
            >
              ↻
            </button>
            <button
              type="button"
              className={styles.werkzeug}
              onClick={() => setPause((p) => !p)}
              aria-label="Pause"
            >
              {pause ? '▶' : '❚❚'}
            </button>
            <button
              type="button"
              className={styles.werkzeug}
              onClick={vollbild}
              aria-label="Vollbild"
            >
              ⛶
            </button>
          </div>
        </div>
      </div>

      <div className={styles.buehne} ref={buehneRef}>
        <div className={styles.leinwandBox}>
          <canvas ref={canvasRef} className={styles.leinwand} />
          {tipp && <div className={styles.tipp}>{tipp}</div>}
        </div>

        <div className={`${styles.pad} ${knoepfeGetauscht ? styles.padGetauscht : ''}`}>
          <div className={styles.padLinks}>
            <button
              type="button"
              className={styles.padKnopf}
              aria-label="links"
              onPointerDown={(e) => {
                e.preventDefault()
                halte('links', true)
              }}
              onPointerUp={() => halte('links', false)}
              onPointerLeave={() => halte('links', false)}
              onPointerCancel={() => halte('links', false)}
            >
              ◀
            </button>
            <button
              type="button"
              className={styles.padKnopf}
              aria-label="rechts"
              onPointerDown={(e) => {
                e.preventDefault()
                halte('rechts', true)
              }}
              onPointerUp={() => halte('rechts', false)}
              onPointerLeave={() => halte('rechts', false)}
              onPointerCancel={() => halte('rechts', false)}
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            className={`${styles.padKnopf} ${styles.padSprung}`}
            aria-label="springen"
            onPointerDown={(e) => {
              e.preventDefault()
              halte('sprung', true)
            }}
            onPointerUp={() => halte('sprung', false)}
            onPointerLeave={() => halte('sprung', false)}
            onPointerCancel={() => halte('sprung', false)}
          >
            ⤒
          </button>
        </div>

        {pause && !ende && (
          <div className={styles.overlay}>
            <div className={styles.dialog}>
              <h2>Pause</h2>
              <p className={styles.hinweis}>{daten.name}</p>
              <div className={styles.dialogKnoepfe}>
                <button type="button" onClick={() => setPause(false)}>
                  Weiter
                </button>
                <button type="button" onClick={neustart}>
                  Neu starten
                </button>
                <button type="button" onClick={() => setAnsicht('karte')}>
                  Karte
                </button>
              </div>
            </div>
          </div>
        )}

        {ende && (
          <div className={styles.overlay}>
            <div className={`${styles.dialog} ${styles.dialogSieg}`}>
              <div className={styles.sterne} aria-hidden="true">
                {'★'.repeat(Math.max(1, ende.sterne))}
              </div>
              <h2>Ausgang erreicht</h2>
              <p>
                {ende.punkte} Punkte · +{ende.xp} XP
              </p>
              <p className={styles.hinweis}>
                {ende.zeit.toFixed(1)} Sekunden · {ende.tode} {ende.tode === 1 ? 'Tod' : 'Tode'}
                {ende.kristall ? ' · Kristall gefunden ◆' : ''}
              </p>
              <div className={styles.dialogKnoepfe}>
                <button type="button" onClick={() => setAnsicht('karte')}>
                  Karte
                </button>
                <button type="button" onClick={neustart}>
                  Nochmal
                </button>
                {levelNr < LEVEL_ANZAHL && (
                  <button type="button" className={styles.primaer} onClick={weiter}>
                    Weiter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
