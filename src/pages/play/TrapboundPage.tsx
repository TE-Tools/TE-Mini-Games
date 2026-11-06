import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  trapboundGame,
  laufe,
  starte,
  levelDaten,
  levelMitKristall,
  abschnittVon,
  weltVon,
  LEVEL_ANZAHL,
  TRAP_KARTE,
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
  PHYSIK,
  BILD_HOEHE,
  type Spielstand,
  type Stand,
} from '@/games/trapbound'
import { spiele, setzeTon, setzeLautstaerke, lautstaerke, tonAn } from '@/services/sound'
import { saveGameResult, addXp, recordLevelComplete, getOrCreateGameProgress } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { LevelMap } from '@/components/level-map/LevelMap'
import { getOrCreateGuestProfile } from '@/offline'
import { zeichne } from './TrapboundBild'
import { useSprache } from '@/i18n/sprache'
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
  const { t } = useSprache()
  const tb = t.trapbound
  const [ansicht, setAnsicht] = useState<Ansicht>('menue')
  const [levelNr, setLevelNr] = useState(1)
  const [stand, setStand] = useState<Stand>(() => leseStand())
  const [hud, setHud] = useState({ tode: 0, zeit: 0, kristall: false })
  const [pause, setPause] = useState(false)
  const [ende, setEnde] = useState<Ende | null>(null)
  const [tipp, setTipp] = useState('')
  const [avatarId, setAvatarId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buehneRef = useRef<HTMLDivElement>(null)
  const spielRef = useRef<Spielstand | null>(null)
  const eingabeRef = useRef({ links: false, rechts: false, sprung: false })
  const todeRef = useRef(0)
  const pauseRef = useRef(false)
  const endeRef = useRef(false)
  /** Zählt bei jedem Levelwechsel hoch; alte Schleifen brechen daran ab. */
  const lauf = useRef(0)
  /** Wo die Kamera gerade steht; null heißt "beim nächsten Bild hinsetzen". */
  const kameraRef = useRef<number | null>(null)
  /** Senkrecht dasselbe -- für die Stockwerk-Level, die höher sind als ein Bild. */
  const kameraYRef = useRef<number | null>(null)

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
        const [p, profil] = await Promise.all([
          getOrCreateGameProgress('trapbound'),
          getOrCreateGuestProfile(),
        ])
        if (weg) return
        const s = leseStand()
        setLevelNr(Math.max(1, Math.min(LEVEL_ANZAHL, p.currentLevel || s.freigeschaltet)))
        setAvatarId(profil.avatar)
      } catch {
        // Ohne Datenbank ist der lokale Stand maßgeblich.
      }
    })()
    return () => {
      weg = true
    }
  }, [])

  /*
   * Das nächste Level schon einmal bauen, während dieses läuft.
   *
   * Ein Level entsteht erst, wenn es gebraucht wird, und der Generator
   * spielt es dabei selbst durch -- bei den langen Endspiel-Leveln dauert das
   * bis zu einer halben Sekunde, auf einem älteren Telefon entsprechend
   * länger. Das wäre genau der Augenblick, in dem man auf den Knopf gedrückt
   * hat und noch nichts passiert.
   *
   * `levelDaten` merkt sich das Ergebnis. Wer also während des Spielens
   * schon einmal das nächste bauen lässt, wartet später nicht mehr. Das
   * passiert in einer Leerlaufpause, damit es dem laufenden Bild nichts
   * wegnimmt.
   */
  const warmeVor = useCallback((nr: number) => {
    if (nr < 1 || nr > LEVEL_ANZAHL) return
    const bauen = () => {
      try {
        levelDaten(nr)
      } catch {
        // Ein Fehler beim Vorwarmen darf das laufende Spiel nicht stören --
        // spätestens beim Start des Levels fällt er ohnehin auf.
      }
    }
    const fenster = window as Window & {
      requestIdleCallback?: (r: () => void, o?: { timeout: number }) => number
    }
    if (typeof fenster.requestIdleCallback === 'function') {
      fenster.requestIdleCallback(bauen, { timeout: 4000 })
    } else {
      window.setTimeout(bauen, 1200)
    }
  }, [])

  const starteLevel = useCallback(
    (nr: number) => {
      lauf.current += 1
      kameraRef.current = null
      kameraYRef.current = null
      const daten = levelDaten(nr)
      spielRef.current = starte(daten)
      todeRef.current = 0
      setLevelNr(nr)
      setHud({ tode: 0, zeit: 0, kristall: false })
      setEnde(null)
      setPause(false)
      setTipp(daten.nr <= 3 ? tb.tippTuer : '')
      setAnsicht('spiel')
      warmeVor(nr + 1)
    },
    [warmeVor, tb.tippTuer],
  )

  // Und schon im Menü das Level vorbereiten, auf das der große Knopf zeigt.
  useEffect(() => {
    if (ansicht === 'menue' || ansicht === 'karte') warmeVor(stand.freigeschaltet)
  }, [ansicht, stand.freigeschaltet, warmeVor])

  /** Nach einem Tod: sofort wieder auf Anfang, Fallen zurück. */
  const neustart = useCallback(() => {
    kameraRef.current = null
    kameraYRef.current = null
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

      /*
       * Die Kamera.
       *
       * Ein Level war bisher genau ein Bildschirm breit. Damit passten zwei,
       * höchstens drei Fallen hinein -- und genau daran lag, was am
       * 18.09.2026 gemeldet wurde: "immer das selbe, die Level sehen ähnlich
       * aus". Längere Level lösen das an der Wurzel, und dafür muss das Bild
       * mitwandern.
       *
       * Der Ausschnitt bleibt immer BILD_BREITE breit, egal wie lang das
       * Level ist: Die Figur behält ihre Größe, ein Sprung sieht überall
       * gleich weit aus. Die Kamera zieht weich nach, damit das Bild beim
       * Laufen nicht springt, und bleibt an den Enden stehen.
       */
      const levelBreite = s.level.breite ?? BILD_BREITE
      const ziel = Math.max(
        0,
        Math.min(levelBreite - BILD_BREITE, s.koerper.x + PHYSIK.breite / 2 - BILD_BREITE / 2),
      )
      if (kameraRef.current === null) kameraRef.current = ziel
      else kameraRef.current += (ziel - kameraRef.current) * 0.18
      const kamera = Math.round(kameraRef.current)

      /*
       * Und senkrecht. Die Stockwerk-Level sind einen Bildschirm breit und
       * mehrere hoch; die Figur steht etwas unter der Mitte, damit man
       * sieht, was über einem kommt. Bei Leveln, die genau ein Bild hoch
       * sind, bleibt das bei null.
       */
      const levelHoehe = s.level.hoehe ?? BILD_HOEHE
      const zielY = Math.max(
        0,
        Math.min(levelHoehe - BILD_HOEHE, s.koerper.y + PHYSIK.hoehe / 2 - BILD_HOEHE * 0.58),
      )
      if (kameraYRef.current === null) kameraYRef.current = zielY
      else kameraYRef.current += (zielY - kameraYRef.current) * 0.14
      const kameraY = Math.round(kameraYRef.current)

      const randX = (c.width - BILD_BREITE * skala) / 2
      const randY = (c.height - BILD_HOEHE * skala) / 2

      // Der Ausschnitt wird beschnitten. Solange ein Level genau ein Bild
      // breit war, lag ohnehin nichts daneben; jetzt schon, und ohne diese
      // Sperre malte das Spiel in den schwarzen Rand hinein.
      ctx.save()
      ctx.beginPath()
      ctx.rect(randX, randY, BILD_BREITE * skala, BILD_HOEHE * skala)
      ctx.clip()

      ctx.setTransform(skala, 0, 0, skala, randX - kamera * skala, randY - kameraY * skala)
      ctx.imageSmoothingEnabled = false
      zeichne(ctx, s, { welt: weltVon(s.level.nr), beben: einst.beben, uhr: u })
      ctx.restore()
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
            {'←'} {tb.zurueck}
          </Link>
        </header>
        <div className={styles.titelblock}>
          <h1 className={styles.titel}>TRAPBOUND</h1>
          <p className={styles.untertitel}>{tb.untertitel}</p>
        </div>
        <div className={styles.menue}>
          <button
            type="button"
            className={styles.menueHaupt}
            onClick={() => starteLevel(Math.min(offen, LEVEL_ANZAHL))}
          >
            {geschaffte(stand) > 0 ? tb.weiterLevel(offen) : tb.spielen}
          </button>
          <button type="button" className={styles.menueKnopf} onClick={() => setAnsicht('karte')}>
            {tb.levelkarte}
          </button>
          <button
            type="button"
            className={styles.menueKnopf}
            onClick={() => setAnsicht('sammlung')}
          >
            {tb.sammlung}
          </button>
          <button
            type="button"
            className={styles.menueKnopf}
            onClick={() => setAnsicht('einstellungen')}
          >
            {tb.einstellungen}
          </button>
          <button type="button" className={styles.menueKnopf} onClick={() => setAnsicht('ueber')}>
            {tb.ueber}
          </button>
        </div>
        <p className={styles.fussnote}>
          {tb.fussnote(geschaffte(stand), LEVEL_ANZAHL, kristalle(stand), todeGesamt(stand))}
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
            {'←'} {tb.menue}
          </button>
          <h1 className={styles.kopfTitel}>{tb.levelkarte}</h1>
          <span className={styles.kopfWert}>
            {geschaffte(stand)}/{LEVEL_ANZAHL}
          </span>
        </header>
        <LevelMap
          currentLevel={Math.min(levelNr, stand.freigeschaltet)}
          highestLevel={stand.freigeschaltet}
          avatarId={avatarId}
          maxLevel={LEVEL_ANZAHL}
          aufbau={TRAP_KARTE}
          onSelectLevel={starteLevel}
          gameLabel={t.spiele.trapbound}
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
            {'←'} {tb.menue}
          </button>
          <h1 className={styles.kopfTitel}>{tb.einstellungen}</h1>
        </header>
        <div className={styles.karte2}>
          <label className={styles.reihe}>
            <span>{tb.ton}</span>
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
            <span>{tb.lautstaerke}</span>
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
            <span>{tb.beben}</span>
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
            <span>{tb.linkshand}</span>
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
            {tb.steuerung} <b>A</b>/<b>D</b> {tb.steuerungOder} <b>W</b>/
            <b>{tb.steuerungLeertaste}</b> {tb.steuerungSpringen} <b>R</b> {tb.steuerungNeu}{' '}
            <b>Esc</b> {tb.steuerungPause}
          </p>
          <button
            type="button"
            className={styles.gefahrKnopf}
            onClick={() => {
              if (!window.confirm(tb.loeschenFrage)) return
              loescheStand()
              setStand(leseStand())
              setLevelNr(1)
            }}
          >
            {tb.loeschen}
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
            {'←'} {tb.menue}
          </button>
          <h1 className={styles.kopfTitel}>{tb.sammlung}</h1>
        </header>
        <div className={styles.karte2}>
          <p className={styles.hinweis}>
            {tb.kristallText1} <b>{tb.kristall}</b>
            {tb.kristallText2}
          </p>
          <div className={styles.kristallGitter}>
            {levelMitKristall().map((l) => {
              const gefunden = Boolean(stand.level[String(l.nr)]?.kristall)
              return (
                <div key={l.nr} className={styles.kristallPlatz}>
                  <span className={gefunden ? styles.kristallDa : styles.kristallWeg}>◆</span>
                  <span>{gefunden ? l.name : tb.level(l.nr)}</span>
                </div>
              )
            })}
          </div>
          <p className={styles.hinweis}>
            {tb.gefunden(kristalle(stand), levelMitKristall().length)}
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
            {'←'} {tb.menue}
          </button>
          <h1 className={styles.kopfTitel}>{tb.ueber}</h1>
        </header>
        <div className={styles.karte2}>
          <p>
            <b>TRAPBOUND</b> {tb.ueberText}
          </p>
          <p className={styles.hinweis}>{tb.ueberEigen}</p>
          <p className={styles.hinweis}>{tb.ueberWelten}</p>
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
          {tb.karte}
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
          <span className={styles.hudWert} title={tb.todeTitel}>
            ☠ {hud.tode}
          </span>
          <span className={styles.hudWert}>{hud.zeit.toFixed(1)}s</span>
          <div className={styles.werkzeuge}>
            <button
              type="button"
              className={styles.werkzeug}
              onClick={neustart}
              aria-label={tb.neuStarten}
            >
              ↻
            </button>
            <button
              type="button"
              className={styles.werkzeug}
              onClick={() => setPause((p) => !p)}
              aria-label={tb.pause}
            >
              {pause ? '▶' : '❚❚'}
            </button>
            <button
              type="button"
              className={styles.werkzeug}
              onClick={vollbild}
              aria-label={tb.vollbild}
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
              aria-label={tb.links}
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
              aria-label={tb.rechts}
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
            aria-label={tb.springen}
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
              <h2>{tb.pause}</h2>
              <p className={styles.hinweis}>{daten.name}</p>
              <div className={styles.dialogKnoepfe}>
                <button type="button" onClick={() => setPause(false)}>
                  {tb.weiter}
                </button>
                <button type="button" onClick={neustart}>
                  {tb.neustart}
                </button>
                <button type="button" onClick={() => setAnsicht('karte')}>
                  {tb.karte}
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
              <h2>{tb.ausgang}</h2>
              <p>{tb.ergebnis(ende.punkte, ende.xp)}</p>
              <p className={styles.hinweis}>
                {tb.zeitTode(ende.zeit.toFixed(1), ende.tode)}
                {ende.kristall ? tb.kristallGefunden : ''}
              </p>
              <div className={styles.dialogKnoepfe}>
                <button type="button" onClick={() => setAnsicht('karte')}>
                  {tb.karte}
                </button>
                <button type="button" onClick={neustart}>
                  {tb.nochmal}
                </button>
                {levelNr < LEVEL_ANZAHL && (
                  <button type="button" className={styles.primaer} onClick={weiter}>
                    {tb.weiter}
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
