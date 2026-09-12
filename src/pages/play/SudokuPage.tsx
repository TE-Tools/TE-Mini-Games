/**
 * Sudoku -- die Spielseite.
 *
 * Drei Ansichten: das Menü mit den drei Stufen, die Levelkarte einer Stufe
 * und das Rätsel selbst. Das Rätsel merkt sich alles auf dem Gerät (Gitter,
 * Notizen, Uhr), weil ein schweres gern eine Stunde dauert und niemand das
 * in einem Rutsch spielen muss.
 *
 * Was das Spiel verrät, hängt an der Stufe: Bei Leicht und Mittel werden
 * falsche Ziffern rot (abschaltbar), bei Schwer nie -- sonst löste man
 * schwere Rätsel durch Ausprobieren, und genau das sollen sie nicht
 * zulassen. Ein Tipp erklärt den nächsten logischen Schritt mit Technik;
 * das kostet Punkte, aber es lehrt etwas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  raetsel,
  levelName,
  levelNummer,
  karteFuer,
  haerte,
  technikName,
  schwierigkeitVon,
  stufeVon,
  SCHWIERIGKEITEN,
  STUFEN_NAME,
  STUFEN_TEXT,
  LEVEL_PRO_STUFE,
  SUDOKU_MAX_LEVEL,
  NACHBARN,
  ZELLEN,
  zeileVon,
  spalteVon,
  kastenVon,
  hatKonflikt,
  tippFuer,
  alleKandidaten,
  werte as werteAus,
  leseStand,
  levelStand,
  merkeAbschluss,
  merkePartie,
  lesePartie,
  vergissPartie,
  setzeEinstellungen,
  geloeste,
  loescheStand,
  type Schwierigkeit,
  type Stand,
  type SudokuWertung,
  type Tipp,
} from '@/games/sudoku'
import { spiele, setzeTon, tonAn } from '@/services/sound'
import { saveGameResult, addXp, recordLevelComplete, getOrCreateGuestProfile } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { LevelMap } from '@/components/level-map/LevelMap'
import shell from './PlayShell.module.css'
import styles from './SudokuPage.module.css'

type Ansicht = 'menue' | 'karte' | 'spiel'

interface Schnappschuss {
  werte: number[]
  notizen: number[]
}

interface Ende {
  wertung: SudokuWertung
  sekunden: number
  fehler: number
  tipps: number
  neu: boolean
}

/** So oft wird die laufende Partie weggeschrieben. */
const SICHERN_ALLE_S = 10

function zeitText(sek: number): string {
  const s = Math.max(0, Math.floor(sek))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`
}

function gitterText(werte: number[]): string {
  return werte.map((w) => (w === 0 ? '.' : String(w))).join('')
}

export function SudokuPage() {
  const [ansicht, setAnsicht] = useState<Ansicht>('menue')
  const [stand, setStand] = useState<Stand>(() => leseStand())
  const [stufe, setStufe] = useState<Schwierigkeit>('leicht')
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [nr, setNr] = useState(1)

  // ---- das laufende Rätsel
  const [werte, setWerte] = useState<number[]>(() => new Array(ZELLEN).fill(0))
  const [notizen, setNotizen] = useState<number[]>(() => new Array(ZELLEN).fill(0))
  const [auswahl, setAuswahl] = useState<number | null>(null)
  const [notizModus, setNotizModus] = useState(false)
  const [verlauf, setVerlauf] = useState<Schnappschuss[]>([])
  const [fehler, setFehler] = useState(0)
  const [tipps, setTipps] = useState(0)
  const [sekunden, setSekunden] = useState(0)
  const [pause, setPause] = useState(false)
  const [ende, setEnde] = useState<Ende | null>(null)
  const [tipp, setTipp] = useState<Tipp | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [zeigeFalsche, setZeigeFalsche] = useState(false)

  const uhrRef = useRef<{ seit: number | null; summe: number }>({ seit: null, summe: 0 })
  const meldungTimer = useRef<number | null>(null)

  const einst = stand.einstellungen
  const r = useMemo(() => raetsel(nr), [nr])
  const loesung = r.loesung
  const schwierigkeit = r.schwierigkeit
  const fehlerSichtbar = einst.fehlerZeigen && schwierigkeit !== 'schwer'

  useEffect(() => {
    let weg = false
    void getOrCreateGuestProfile()
      .then((p) => {
        if (!weg) setAvatarId(p.avatar)
      })
      .catch(() => undefined)
    return () => {
      weg = true
    }
  }, [])

  useEffect(
    () => () => {
      if (meldungTimer.current) window.clearTimeout(meldungTimer.current)
    },
    [],
  )

  const zeigeMeldung = useCallback((text: string, ms = 3500) => {
    setMeldung(text)
    if (meldungTimer.current) window.clearTimeout(meldungTimer.current)
    meldungTimer.current = window.setTimeout(() => setMeldung(null), ms)
  }, [])

  const ton = useCallback(
    (klang: Parameters<typeof spiele>[0]) => {
      if (einst.ton && tonAn()) spiele(klang)
    },
    [einst.ton],
  )

  // ------------------------------------------------------------- Uhr

  const uhrLesen = useCallback((): number => {
    const u = uhrRef.current
    return u.summe + (u.seit === null ? 0 : (performance.now() - u.seit) / 1000)
  }, [])

  const uhrStart = useCallback(() => {
    if (uhrRef.current.seit === null) uhrRef.current.seit = performance.now()
  }, [])

  const uhrStopp = useCallback(() => {
    const u = uhrRef.current
    if (u.seit !== null) {
      u.summe += (performance.now() - u.seit) / 1000
      u.seit = null
    }
  }, [])

  const laeuft = ansicht === 'spiel' && !pause && !ende

  useEffect(() => {
    if (!laeuft) {
      uhrStopp()
      return
    }
    uhrStart()
    const t = window.setInterval(() => setSekunden(Math.floor(uhrLesen())), 500)
    return () => {
      window.clearInterval(t)
      uhrStopp()
    }
  }, [laeuft, uhrStart, uhrStopp, uhrLesen])

  // Wer die App in den Hintergrund legt, bekommt automatisch Pause.
  useEffect(() => {
    if (ansicht !== 'spiel') return
    const onSicht = () => {
      if (document.visibilityState === 'hidden' && !ende) setPause(true)
    }
    document.addEventListener('visibilitychange', onSicht)
    return () => document.removeEventListener('visibilitychange', onSicht)
  }, [ansicht, ende])

  // --------------------------------------------------------- Sichern

  const sichern = useCallback(() => {
    if (ansicht !== 'spiel' || ende) return
    merkePartie({
      nr,
      werte: gitterText(werte),
      notizen,
      sekunden: Math.floor(uhrLesen()),
      fehler,
      tipps,
    })
  }, [ansicht, ende, nr, werte, notizen, fehler, tipps, uhrLesen])

  useEffect(() => {
    if (ansicht !== 'spiel' || ende) return
    sichern()
    // Nur bei echten Änderungen am Gitter -- die Uhr sichert unten getrennt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [werte, notizen, fehler, tipps])

  useEffect(() => {
    if (ansicht !== 'spiel' || ende || sekunden === 0) return
    if (sekunden % SICHERN_ALLE_S === 0) sichern()
  }, [sekunden, ansicht, ende, sichern])

  // ----------------------------------------------------------- Start

  const starteLevel = useCallback((levelNr: number, neu = false) => {
    const ziel = Math.max(1, Math.min(SUDOKU_MAX_LEVEL, levelNr))
    const rr = raetsel(ziel)
    const partie = neu ? null : lesePartie(ziel)
    if (neu) vergissPartie(ziel)
    const startWerte = Array.from(rr.vorgabe)
    if (partie) {
      for (let i = 0; i < ZELLEN; i++) {
        if (rr.vorgabe[i] !== 0) continue
        const ch = partie.werte[i]!
        startWerte[i] = ch === '.' ? 0 : Number(ch) || 0
      }
    }
    setNr(ziel)
    setStufe(rr.schwierigkeit)
    setWerte(startWerte)
    setNotizen(
      partie && Array.isArray(partie.notizen) && partie.notizen.length === ZELLEN
        ? partie.notizen.map((n) => Number(n) || 0)
        : new Array(ZELLEN).fill(0),
    )
    setVerlauf([])
    setAuswahl(null)
    setNotizModus(false)
    setFehler(partie?.fehler ?? 0)
    setTipps(partie?.tipps ?? 0)
    uhrRef.current = { seit: null, summe: partie?.sekunden ?? 0 }
    setSekunden(partie?.sekunden ?? 0)
    setPause(false)
    setEnde(null)
    setTipp(null)
    setMeldung(null)
    setZeigeFalsche(false)
    setAnsicht('spiel')
  }, [])

  // ---------------------------------------------------------- Abschluss

  const abschliessen = useCallback(
    async (fertigeWerte: number[]) => {
      uhrStopp()
      const sek = Math.floor(uhrLesen())
      const wertung = werteAus(nr, { geloest: true, sekunden: sek, fehler, tipps })
      const vorher = levelStand(nr)
      const neuerStand = merkeAbschluss({
        nr,
        sekunden: sek,
        punkte: wertung.punkte,
        sterne: wertung.sterne,
      })
      setStand(neuerStand)
      setEnde({ wertung, sekunden: sek, fehler, tipps, neu: !vorher.fertig })
      setAuswahl(null)
      setTipp(null)
      ton('geschafft')
      try {
        await saveGameResult({
          gameId: 'sudoku',
          level: nr,
          score: wertung.punkte,
          xp: wertung.xp,
          stars: wertung.sterne,
          resultData: {
            geloest: true,
            sekunden: sek,
            fehler,
            tipps,
            schwierigkeit: schwierigkeitVon(nr),
            stufe: stufeVon(nr),
            gitter: gitterText(fertigeWerte),
          },
          isPersonalRecord: true,
        })
        await addXp('guest', wertung.xp)
        await recordLevelComplete('sudoku', nr, wertung.xp)
        await processAfterResult({ gameId: 'sudoku', level: nr, isPersonalRecord: true })
        void trySyncNow()
      } catch (e) {
        console.error(e)
      }
    },
    [nr, fehler, tipps, uhrLesen, uhrStopp, ton],
  )

  // ------------------------------------------------------------ Züge

  const merkeVerlauf = useCallback(() => {
    setVerlauf((v) => [...v.slice(-99), { werte: [...werte], notizen: [...notizen] }])
  }, [werte, notizen])

  const setzeZiffer = useCallback(
    (zelle: number, ziffer: number) => {
      if (r.vorgabe[zelle] !== 0 || ende || pause) return
      if (notizModus) {
        if (werte[zelle] !== 0) return
        merkeVerlauf()
        setNotizen((n) => {
          const neu = [...n]
          neu[zelle] = neu[zelle]! ^ (1 << ziffer)
          return neu
        })
        return
      }
      if (werte[zelle] === ziffer) return
      merkeVerlauf()
      const neu = [...werte]
      neu[zelle] = ziffer
      setWerte(neu)
      setTipp(null)
      const neueNotizen = [...notizen]
      neueNotizen[zelle] = 0
      if (einst.notizenAufraeumen) {
        for (const nb of NACHBARN[zelle]!) neueNotizen[nb] = neueNotizen[nb]! & ~(1 << ziffer)
      }
      setNotizen(neueNotizen)
      if (ziffer !== loesung[zelle]) {
        setFehler((f) => f + 1)
        if (fehlerSichtbar) ton('fehlschuss')
        return
      }
      let voll = true
      let richtig = true
      for (let i = 0; i < ZELLEN; i++) {
        if (neu[i] === 0) voll = false
        if (neu[i] !== loesung[i]) richtig = false
      }
      if (voll && richtig) {
        void abschliessen(neu)
      } else if (voll) {
        zeigeMeldung('Alles voll -- aber irgendwo steckt ein Fehler.')
      } else {
        ton('knopf')
      }
    },
    [
      r.vorgabe,
      ende,
      pause,
      notizModus,
      werte,
      notizen,
      einst.notizenAufraeumen,
      loesung,
      fehlerSichtbar,
      merkeVerlauf,
      abschliessen,
      zeigeMeldung,
      ton,
    ],
  )

  const loesche = useCallback(
    (zelle: number) => {
      if (r.vorgabe[zelle] !== 0 || ende || pause) return
      if (werte[zelle] === 0 && notizen[zelle] === 0) return
      merkeVerlauf()
      setWerte((w) => {
        const neu = [...w]
        neu[zelle] = 0
        return neu
      })
      setNotizen((n) => {
        const neu = [...n]
        neu[zelle] = 0
        return neu
      })
      setTipp(null)
    },
    [r.vorgabe, ende, pause, werte, notizen, merkeVerlauf],
  )

  const rueckgaengig = useCallback(() => {
    if (ende || pause) return
    setVerlauf((v) => {
      const letzter = v.at(-1)
      if (!letzter) return v
      setWerte(letzter.werte)
      setNotizen(letzter.notizen)
      return v.slice(0, -1)
    })
    setTipp(null)
  }, [ende, pause])

  const notizenFuellen = useCallback(() => {
    if (ende || pause) return
    merkeVerlauf()
    const kand = alleKandidaten(Uint8Array.from(werte))
    setNotizen(Array.from(kand))
    setTipps((t) => t + 1)
    zeigeMeldung('Alle Kandidaten eingetragen -- zählt wie ein Tipp.')
  }, [ende, pause, werte, merkeVerlauf, zeigeMeldung])

  const tippHolen = useCallback(() => {
    if (ende || pause) return
    const t = tippFuer(Uint8Array.from(werte), loesung)
    setTipps((n) => n + 1)
    if (!t) {
      // Es steht etwas Falsches im Gitter. Kurz zeigen, wo.
      setZeigeFalsche(true)
      window.setTimeout(() => setZeigeFalsche(false), 4000)
      zeigeMeldung('Im Gitter steht etwas Falsches -- die roten Felder stimmen nicht.', 4000)
      return
    }
    setTipp(t)
    setAuswahl(t.zelle)
  }, [ende, pause, werte, loesung, zeigeMeldung])

  const tippEintragen = useCallback(() => {
    if (!tipp) return
    setNotizModus(false)
    const zelle = tipp.zelle
    const ziffer = tipp.ziffer
    setTipp(null)
    // Direkt setzen, ohne den Notizmodus zu beachten.
    merkeVerlauf()
    const neu = [...werte]
    neu[zelle] = ziffer
    setWerte(neu)
    const neueNotizen = [...notizen]
    neueNotizen[zelle] = 0
    if (einst.notizenAufraeumen) {
      for (const nb of NACHBARN[zelle]!) neueNotizen[nb] = neueNotizen[nb]! & ~(1 << ziffer)
    }
    setNotizen(neueNotizen)
    let voll = true
    for (let i = 0; i < ZELLEN; i++) if (neu[i] === 0) voll = false
    if (voll && neu.every((w, i) => w === loesung[i])) void abschliessen(neu)
  }, [tipp, werte, notizen, einst.notizenAufraeumen, loesung, merkeVerlauf, abschliessen])

  // -------------------------------------------------------- Tastatur

  useEffect(() => {
    if (ansicht !== 'spiel') return
    const onKey = (e: KeyboardEvent) => {
      if (ende) return
      if (e.key === 'Escape') {
        setPause((p) => !p)
        e.preventDefault()
        return
      }
      if (pause) return
      const k = e.key
      if (/^[1-9]$/.test(k)) {
        if (auswahl !== null) setzeZiffer(auswahl, Number(k))
        e.preventDefault()
      } else if (k === 'Backspace' || k === 'Delete' || k === '0') {
        if (auswahl !== null) loesche(auswahl)
        e.preventDefault()
      } else if (k === 'n' || k === 'N') {
        setNotizModus((m) => !m)
      } else if ((k === 'z' || k === 'Z') && (e.ctrlKey || e.metaKey)) {
        rueckgaengig()
        e.preventDefault()
      } else if (k.startsWith('Arrow')) {
        const a = auswahl ?? 0
        const rz = zeileVon(a)
        const sp = spalteVon(a)
        let ziel = a
        if (k === 'ArrowUp') ziel = ((rz + 8) % 9) * 9 + sp
        if (k === 'ArrowDown') ziel = ((rz + 1) % 9) * 9 + sp
        if (k === 'ArrowLeft') ziel = rz * 9 + ((sp + 8) % 9)
        if (k === 'ArrowRight') ziel = rz * 9 + ((sp + 1) % 9)
        setAuswahl(ziel)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ansicht, ende, pause, auswahl, setzeZiffer, loesche, rueckgaengig])

  // ------------------------------------------------------- Ableitungen

  const gewaehlteZiffer = auswahl === null ? 0 : werte[auswahl]!
  const uebrig = useMemo(() => {
    const z = new Array(10).fill(9) as number[]
    for (const w of werte) if (w) z[w]!--
    return z
  }, [werte])
  const gitterUint = useMemo(() => Uint8Array.from(werte), [werte])
  const tippBasis = useMemo(() => new Set(tipp?.basis ?? []), [tipp])

  const weiter = useCallback(() => {
    if (stufeVon(nr) >= LEVEL_PRO_STUFE) {
      setAnsicht('menue')
      return
    }
    starteLevel(nr + 1)
  }, [nr, starteLevel])

  // ================================================================ Menü

  if (ansicht === 'menue') {
    return (
      <main className={shell.page}>
        <header className={shell.header}>
          <Link to="/" className={shell.back} aria-label="Zurück">
            ←
          </Link>
          <h1 className={shell.title}>Sudoku</h1>
          <span className={shell.levelBadge}>
            {Object.values(stand.level).filter((l) => l.fertig).length}/{SUDOKU_MAX_LEVEL}
          </span>
        </header>

        <p className={shell.hint}>
          Drei Stufen zu je {LEVEL_PRO_STUFE} Rätseln. Jede Stufe ist eine eigene Strecke -- du
          musst nicht erst alle leichten lösen.
        </p>

        <div className={styles.stufen}>
          {SCHWIERIGKEITEN.map((s) => {
            const frei = stand.frei[s]
            const fertig = geloeste(s, stand)
            const naechste = levelNummer(s, frei)
            const angefangen = Object.values(stand.partien).find(
              (p) => schwierigkeitVon(p.nr) === s,
            )
            return (
              <section key={s} className={`${styles.stufe} ${styles[`stufe_${s}`]}`}>
                <div className={styles.stufeKopf}>
                  <h2 className={styles.stufeName}>{STUFEN_NAME[s]}</h2>
                  <span className={styles.stufeStand}>
                    {fertig}/{LEVEL_PRO_STUFE}
                  </span>
                </div>
                <p className={styles.stufeText}>{STUFEN_TEXT[s]}</p>
                <div className={styles.stufeBalken} aria-hidden="true">
                  <span style={{ width: `${(fertig / LEVEL_PRO_STUFE) * 100}%` }} />
                </div>
                <div className={styles.stufeKnoepfe}>
                  <button
                    type="button"
                    className={styles.stufeHaupt}
                    onClick={() => starteLevel(angefangen ? angefangen.nr : naechste)}
                  >
                    {angefangen
                      ? `Fortsetzen · ${levelName(angefangen.nr)}`
                      : fertig >= LEVEL_PRO_STUFE
                        ? 'Alle gelöst · noch mal'
                        : `${fertig > 0 ? 'Weiter' : 'Spielen'} · Stufe ${frei}`}
                  </button>
                  <button
                    type="button"
                    className={styles.stufeNeben}
                    onClick={() => {
                      setStufe(s)
                      setNr(naechste)
                      setAnsicht('karte')
                    }}
                  >
                    Karte
                  </button>
                </div>
              </section>
            )
          })}
        </div>

        <section className={styles.einstellungen} aria-label="Einstellungen">
          <h2 className={styles.einstTitel}>Einstellungen</h2>
          <label className={styles.reihe}>
            <span>
              Fehler sofort rot zeigen
              <small>Bei Schwer wird nichts verraten.</small>
            </span>
            <input
              type="checkbox"
              checked={einst.fehlerZeigen}
              onChange={(e) =>
                setStand({
                  ...stand,
                  einstellungen: setzeEinstellungen({ fehlerZeigen: e.target.checked }),
                })
              }
            />
          </label>
          <label className={styles.reihe}>
            <span>
              Notizen aufräumen
              <small>Eine gesetzte Ziffer verschwindet aus den Notizen ringsum.</small>
            </span>
            <input
              type="checkbox"
              checked={einst.notizenAufraeumen}
              onChange={(e) =>
                setStand({
                  ...stand,
                  einstellungen: setzeEinstellungen({ notizenAufraeumen: e.target.checked }),
                })
              }
            />
          </label>
          <label className={styles.reihe}>
            <span>Gleiche Ziffern hervorheben</span>
            <input
              type="checkbox"
              checked={einst.gleicheZeigen}
              onChange={(e) =>
                setStand({
                  ...stand,
                  einstellungen: setzeEinstellungen({ gleicheZeigen: e.target.checked }),
                })
              }
            />
          </label>
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
          <p className={styles.tastatur}>
            Am Rechner: <b>1</b>–<b>9</b> eintragen, <b>Pfeile</b> bewegen, <b>N</b> Notizen,{' '}
            <b>Strg+Z</b> zurück, <b>Esc</b> Pause.
          </p>
          <button
            type="button"
            className={styles.gefahr}
            onClick={() => {
              if (!window.confirm('Wirklich den ganzen Sudoku-Fortschritt löschen?')) return
              loescheStand()
              setStand(leseStand())
            }}
          >
            Fortschritt löschen
          </button>
        </section>
      </main>
    )
  }

  // ================================================================ Karte

  if (ansicht === 'karte') {
    const aktuell = schwierigkeitVon(nr) === stufe ? stufeVon(nr) : stand.frei[stufe]
    return (
      <main className={shell.page}>
        <header className={shell.header}>
          <button
            type="button"
            className={shell.back}
            onClick={() => setAnsicht('menue')}
            aria-label="Zum Menü"
          >
            ←
          </button>
          <h1 className={shell.title}>Sudoku · {STUFEN_NAME[stufe]}</h1>
          <span className={shell.levelBadge}>
            {geloeste(stufe, stand)}/{LEVEL_PRO_STUFE}
          </span>
        </header>
        <LevelMap
          currentLevel={Math.min(aktuell, stand.frei[stufe])}
          highestLevel={stand.frei[stufe]}
          avatarId={avatarId}
          maxLevel={LEVEL_PRO_STUFE}
          aufbau={karteFuer(stufe)}
          onSelectLevel={(st) => starteLevel(levelNummer(stufe, st))}
          gameLabel={`Sudoku ${STUFEN_NAME[stufe]}`}
        />
        <button
          type="button"
          className={shell.primaryBtn}
          onClick={() => starteLevel(levelNummer(stufe, stand.frei[stufe]))}
        >
          Weiter spielen · Stufe {stand.frei[stufe]}
        </button>
      </main>
    )
  }

  // ================================================================ Spiel

  const bestes = levelStand(nr, stand)

  return (
    <main className={styles.spielSeite}>
      <header className={styles.kopf}>
        <button
          type="button"
          className={shell.back}
          onClick={() => {
            sichern()
            setAnsicht('karte')
          }}
          aria-label="Zur Karte"
        >
          ←
        </button>
        <div className={styles.kopfMitte}>
          <h1 className={styles.kopfTitel}>{levelName(nr)}</h1>
          <p className={styles.kopfKlein}>
            <span aria-label={`Härte ${haerte(nr)} von 5`}>
              {'●'.repeat(haerte(nr))}
              {'○'.repeat(5 - haerte(nr))}
            </span>
            {' · '}
            {r.anzahlVorgaben} Vorgaben
          </p>
        </div>
        <div className={styles.kopfRechts}>
          <span className={styles.uhr}>{zeitText(sekunden)}</span>
          <button
            type="button"
            className={styles.pauseKnopf}
            onClick={() => setPause((p) => !p)}
            aria-label={pause ? 'Weiter' : 'Pause'}
            disabled={Boolean(ende)}
          >
            {pause ? '▶' : '❚❚'}
          </button>
        </div>
      </header>

      <div className={styles.zeile}>
        <span className={fehler > 0 && fehlerSichtbar ? styles.fehlerRot : styles.leise}>
          Fehler: {fehlerSichtbar ? fehler : '?'}
        </span>
        <span className={styles.leise}>Tipps: {tipps}</span>
        {Number.isFinite(bestes.besteZeit) && (
          <span className={styles.leise}>Best: {zeitText(bestes.besteZeit)}</span>
        )}
      </div>

      <div className={`${styles.gitterRahmen} ${pause ? styles.verdeckt : ''}`}>
        <div className={styles.gitter} role="grid" aria-label="Sudoku-Gitter">
          {werte.map((w, i) => {
            const vorgabe = r.vorgabe[i] !== 0
            const rz = zeileVon(i)
            const sp = spalteVon(i)
            const gewaehlt = auswahl === i
            const nachbar =
              auswahl !== null &&
              !gewaehlt &&
              (zeileVon(auswahl) === rz ||
                spalteVon(auswahl) === sp ||
                kastenVon(auswahl) === kastenVon(i))
            const gleich = einst.gleicheZeigen && gewaehlteZiffer !== 0 && w === gewaehlteZiffer
            const falsch =
              w !== 0 &&
              !vorgabe &&
              (hatKonflikt(gitterUint, i) || ((fehlerSichtbar || zeigeFalsche) && w !== loesung[i]))
            const klassen = [
              styles.zelle,
              vorgabe ? styles.vorgabe : styles.eigen,
              gewaehlt ? styles.gewaehlt : '',
              nachbar ? styles.nachbar : '',
              gleich ? styles.gleich : '',
              falsch ? styles.falsch : '',
              tippBasis.has(i) ? styles.tippBasis : '',
              tipp && tipp.zelle === i ? styles.tippZiel : '',
              sp % 3 === 2 && sp !== 8 ? styles.rechtsDick : '',
              rz % 3 === 2 && rz !== 8 ? styles.untenDick : '',
            ]
              .filter(Boolean)
              .join(' ')
            const notiz = notizen[i]!
            return (
              <button
                key={i}
                type="button"
                role="gridcell"
                className={klassen}
                onClick={() => setAuswahl(i)}
                aria-label={`Zeile ${rz + 1} Spalte ${sp + 1}${w ? `, ${w}` : ', leer'}`}
                aria-selected={gewaehlt}
                disabled={pause}
              >
                {w !== 0 ? (
                  <span className={styles.ziffer}>{w}</span>
                ) : notiz !== 0 ? (
                  <span className={styles.notizen} aria-hidden="true">
                    {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
                      <span
                        key={d}
                        className={
                          notiz & (1 << d)
                            ? gewaehlteZiffer === d && einst.gleicheZeigen
                              ? styles.notizGleich
                              : styles.notiz
                            : styles.notizLeer
                        }
                      >
                        {notiz & (1 << d) ? d : ''}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {pause && !ende && (
          <div className={styles.overlay}>
            <div className={styles.dialog}>
              <h2>Pause</h2>
              <p className={styles.leise}>
                {levelName(nr)} · {zeitText(sekunden)}
              </p>
              <div className={styles.dialogKnoepfe}>
                <button type="button" className={styles.primaer} onClick={() => setPause(false)}>
                  Weiter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Dieses Rätsel von vorn anfangen?')) return
                    starteLevel(nr, true)
                  }}
                >
                  Von vorn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sichern()
                    setAnsicht('karte')
                  }}
                >
                  Karte
                </button>
              </div>
            </div>
          </div>
        )}

        {ende && (
          <div className={styles.overlay}>
            <div className={`${styles.dialog} ${styles.dialogSieg}`}>
              <div className={styles.sterne} aria-label={`${ende.wertung.sterne} von 5 Sternen`}>
                {'★'.repeat(ende.wertung.sterne)}
                {'☆'.repeat(5 - ende.wertung.sterne)}
              </div>
              <h2>Gelöst!</h2>
              <p>
                <strong>{ende.wertung.punkte}</strong> Punkte · +{ende.wertung.xp} XP
              </p>
              <p className={styles.leise}>
                {zeitText(ende.sekunden)} · {ende.fehler} Fehler · {ende.tipps}{' '}
                {ende.tipps === 1 ? 'Tipp' : 'Tipps'}
                {ende.wertung.zeitBonus > 0 && ` · +${ende.wertung.zeitBonus} für die Zeit`}
              </p>
              <p className={styles.leise}>
                Schwerster nötiger Schritt: <b>{technikName(r.technik)}</b>
              </p>
              <div className={styles.dialogKnoepfe}>
                <button type="button" onClick={() => setAnsicht('karte')}>
                  Karte
                </button>
                <button type="button" onClick={() => starteLevel(nr, true)}>
                  Noch mal
                </button>
                {stufeVon(nr) < LEVEL_PRO_STUFE ? (
                  <button type="button" className={styles.primaer} onClick={weiter}>
                    Weiter
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.primaer}
                    onClick={() => setAnsicht('menue')}
                  >
                    Menü
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.werkzeuge}>
        <button
          type="button"
          className={`${styles.werkzeug} ${notizModus ? styles.werkzeugAn : ''}`}
          onClick={() => setNotizModus((m) => !m)}
          aria-pressed={notizModus}
          disabled={pause || Boolean(ende)}
        >
          <span aria-hidden="true">✎</span>
          Notizen {notizModus ? 'an' : 'aus'}
        </button>
        <button
          type="button"
          className={styles.werkzeug}
          onClick={() => auswahl !== null && loesche(auswahl)}
          disabled={pause || Boolean(ende) || auswahl === null}
        >
          <span aria-hidden="true">⌫</span>
          Löschen
        </button>
        <button
          type="button"
          className={styles.werkzeug}
          onClick={rueckgaengig}
          disabled={pause || Boolean(ende) || verlauf.length === 0}
        >
          <span aria-hidden="true">↶</span>
          Zurück
        </button>
        <button
          type="button"
          className={styles.werkzeug}
          onClick={tippHolen}
          disabled={pause || Boolean(ende)}
        >
          <span aria-hidden="true">💡</span>
          Tipp
        </button>
      </div>

      <div className={styles.tasten}>
        {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.taste} ${uebrig[d]! <= 0 ? styles.tasteFertig : ''}`}
            onClick={() => auswahl !== null && setzeZiffer(auswahl, d)}
            disabled={pause || Boolean(ende) || auswahl === null}
            aria-label={`${d} eintragen, noch ${Math.max(0, uebrig[d]!)} übrig`}
          >
            <span className={styles.tasteZiffer}>{d}</span>
            <span className={styles.tasteRest}>{Math.max(0, uebrig[d]!)}</span>
          </button>
        ))}
      </div>

      {(tipp || meldung) && (
        <div className={styles.tippKasten} role="status">
          {tipp ? (
            <>
              <p className={styles.tippText}>{tipp.text}</p>
              <p className={styles.tippTechnik}>
                {tipp.techniken.length > 1
                  ? `Dafür braucht es: ${tipp.techniken.map(technikName).join(' → ')}`
                  : `Technik: ${technikName(tipp.techniken[0]!)}`}
              </p>
              <div className={styles.tippKnoepfe}>
                <button type="button" className={styles.primaer} onClick={tippEintragen}>
                  {tipp.ziffer} eintragen
                </button>
                <button type="button" onClick={() => setTipp(null)}>
                  Selbst weiter
                </button>
              </div>
            </>
          ) : (
            <p className={styles.tippText}>{meldung}</p>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.notizenFuellen}
        onClick={notizenFuellen}
        disabled={pause || Boolean(ende)}
      >
        Alle Notizen eintragen (zählt als Tipp)
      </button>
      <p className={styles.fussnote}>
        {schwierigkeit === 'schwer'
          ? 'Schwer: Fehler werden nicht angezeigt. Ein Tipp verrät, ob etwas Falsches im Gitter steht.'
          : 'Tippe ein Feld an, dann eine Ziffer. Mit Notizen an trägst du Kandidaten ein.'}
      </p>
    </main>
  )
}
