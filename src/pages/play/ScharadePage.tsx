import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createScharadeMatch,
  currentWord,
  startTurn,
  markCorrect,
  markSkipped,
  endTurn,
  nextTurn,
  nextScharadeRound,
  activeScharadePlayer,
  MIN_SPIELER,
  MAX_SPIELER,
  scharadeRangliste,
  type ScharadeState,
} from '@/games/scharade'
import {
  categoriesFor,
  loadCustomCategories,
  customCategoryById,
  isCustomCategory,
  type CustomCategory,
} from '@/games/finde-den-imposter'
import { useSprache } from '@/i18n/sprache'
import { akzentStil } from '@/components/party/akzent'
import { useSpielerGruppe } from '@/components/party/gruppe'
import { KategorieWahl } from '@/components/party/KategorieWahl'
import {
  PartyHeld,
  PartyKarte,
  PartyKopf,
  PartyRegler,
  StartKnopf,
} from '@/components/party/PartySetup'
import setup from '@/components/party/PartySetup.module.css'
import { SpielerKaertchen, SpielerZahl } from '@/components/party/SpielerKaertchen'
import { gueltigeKategorie } from './imposter/kategorien'
import { fehlerSatz, partyFehler } from './partyFehler'
import { Zeitring } from '@/components/zeitring/Zeitring'
import shell from './PartyShell.module.css'
import styles from './ScharadePage.module.css'
import { Spielerbild } from './party/Spielerbild'
import { spiele, vibriere } from '@/services/sound'

const DEFAULT_NAMES = ['Thomas', 'Marina', 'Phillip', 'Sonja']

export function ScharadePage() {
  const { t, sprache } = useSprache()
  const s = t.scharade
  const g = t.partyGemeinsam
  const [state, setState] = useState<ScharadeState | null>(null)
  const { namen: names, setNamen: setNames, gemerkt, merken } = useSpielerGruppe(DEFAULT_NAMES)
  const kategorien = useMemo(() => categoriesFor(sprache), [sprache])
  const [wahl, setCategoryId] = useState('')
  const categoryId = useMemo(
    () => gueltigeKategorie(wahl, kategorien, isCustomCategory),
    [wahl, kategorien],
  )
  const [sekunden, setSekunden] = useState(60)
  /** Der Satz der Engine, deutsch -- übersetzt wird beim Rendern. */
  const [error, setError] = useState<string | null>(null)
  const [eigene] = useState<CustomCategory[]>(() => loadCustomCategories())

  const [ablauf, setAblauf] = useState<number | null>(null)
  /** Der Begriff, der gerade wegfliegt (nur für die Animation). */
  const [weg, setWeg] = useState<{
    wort: string
    richtig: boolean
    nr: number
    zug: string
  } | null>(null)
  const [rest, setRest] = useState<number | null>(null)

  useEffect(() => {
    if (ablauf === null) return
    const uhr = window.setInterval(() => {
      const uebrig = Math.max(0, Math.ceil((ablauf - Date.now()) / 1000))
      setRest(uebrig)
      if (uebrig === 0) {
        window.clearInterval(uhr)
        setAblauf(null)
        setState((st) => (st && st.phase === 'play' ? endTurn(st) : st))
      }
    }, 200)
    return () => window.clearInterval(uhr)
  }, [ablauf])

  const start = useCallback(() => {
    setError(null)
    try {
      const eigeneKategorie = isCustomCategory(categoryId)
        ? customCategoryById(categoryId)
        : undefined
      setState(
        createScharadeMatch({
          names,
          categoryId,
          seconds: sekunden,
          customWords: eigeneKategorie?.words,
          customCategoryLabel: eigeneKategorie?.label,
        }),
      )
      merken(names)
      setAblauf(null)
      setRest(null)
    } catch (e) {
      setError(fehlerSatz(e))
    }
  }, [names, categoryId, sekunden, merken])

  if (!state) {
    return (
      <main className={setup.seite} style={akzentStil('scharade')}>
        <PartyKopf titel={t.spiele.scharade} />
        <PartyHeld icon="🎭">{s.untertitel}</PartyHeld>

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

        <PartyKarte>
          {/* Nur die Kategorien der Oberflächensprache -- die Wörter gibt es je Sprache. */}
          <KategorieWahl
            beschriftung={s.kategorie}
            eingebaut={kategorien}
            eigene={eigene.map((c) => ({ id: c.id, label: c.label, anzahl: c.words.length }))}
            titelEingebaut={s.eingebaut}
            titelEigene={s.eigene}
            wert={categoryId}
            onWahl={setCategoryId}
          />
          <PartyRegler
            beschriftung={s.zeitJePerson(sekunden)}
            wert={sekunden}
            min={30}
            max={180}
            schritt={15}
            onWert={setSekunden}
          />
          <p className={shell.meta}>{s.geteilt(t.spiele['finde-den-imposter'])}</p>
        </PartyKarte>

        {error && (
          <p className={shell.error}>
            {partyFehler(t, error, { 'Diese Kategorie hat keine Wörter': s.keineWoerter })}
          </p>
        )}

        <StartKnopf onClick={start}>{g.losspielen}</StartKnopf>
      </main>
    )
  }

  const ap = activeScharadePlayer(state)

  if (state.phase === 'handoff') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {s.runde(state.roundIndex + 1)} · {state.categoryLabel}
        </p>
        <div className={`${shell.card} ${shell.cover}`}>
          <Spielerbild name={ap.name} />
          <p className={shell.subtitle}>{g.weitergebenAn}</p>
          <p className={shell.coverName}>{ap.name}</p>
          <p className={shell.hint}>{s.anleitung(state.seconds)}</p>
          <button
            type="button"
            className={shell.btn}
            onClick={() => {
              setState(startTurn(state))
              setAblauf(Date.now() + state.seconds * 1000)
              setRest(state.seconds)
            }}
          >
            {s.losGehts}
          </button>
        </div>
      </main>
    )
  }

  if (state.phase === 'play') {
    // Ein wegfliegender Begriff gehört zu diesem Zug -- beim nächsten Zug fliegt
    // nicht noch einmal der letzte Begriff der vorigen Person weg.
    const zug = `${state.roundIndex}:${ap.id}`
    const fliegt = weg?.zug === zug ? weg : null
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <p className={shell.meta}>
          {ap.name} · {s.treffer(state.roundCorrect.length)}
        </p>
        <Zeitring rest={rest ?? state.seconds} gesamt={state.seconds} />
        {/* Der alte Begriff fliegt weg -- nach oben bei Richtig, zur Seite beim
            Überspringen --, während der neue hereinspringt. */}
        <div className={styles.buehne}>
          {fliegt && (
            <div
              key={`weg${fliegt.nr}`}
              className={`${shell.card} ${styles.wordBox} ${fliegt.richtig ? styles.wegRichtig : styles.wegWeiter}`}
              aria-hidden="true"
            >
              <p className={styles.word}>{fliegt.wort}</p>
            </div>
          )}
          {fliegt?.richtig && (
            <span key={`plus${fliegt.nr}`} className={styles.plusEins} aria-hidden="true">
              +1
            </span>
          )}
          <div key={currentWord(state)} className={`${shell.card} ${styles.wordBox}`}>
            <p className={styles.word}>{currentWord(state)}</p>
          </div>
        </div>
        <button
          type="button"
          className={`${shell.btn} ${styles.hit}`}
          onClick={() => {
            spiele('treffer')
            vibriere(20)
            setWeg({ wort: currentWord(state), richtig: true, nr: (weg?.nr ?? 0) + 1, zug })
            setState(markCorrect(state))
          }}
        >
          {s.richtig}
        </button>
        <button
          type="button"
          className={shell.btnSecondary}
          onClick={() => {
            spiele('knopf')
            setWeg({ wort: currentWord(state), richtig: false, nr: (weg?.nr ?? 0) + 1, zug })
            setState(markSkipped(state))
          }}
        >
          {s.ueberspringen}
        </button>
      </main>
    )
  }

  if (state.phase === 'round_result') {
    return (
      <main className={`${shell.page} ${styles.farbe}`}>
        <h1 className={shell.title}>{s.zeitUm}</h1>
        <p className={shell.subtitle}>
          {ap.name}: <strong>{state.roundCorrect.length}</strong>{' '}
          {s.trefferWort(state.roundCorrect.length)},{' '}
          {s.uebersprungenAnzahl(state.roundSkipped.length)}
        </p>
        {state.roundCorrect.length > 0 && (
          <div className={shell.card}>
            <h2 className={shell.cardTitle}>{s.getroffen}</h2>
            <ul className={shell.list}>
              {state.roundCorrect.map((w) => (
                <li key={w}>
                  <span>{w}</span>
                  <strong className={shell.ok}>✓</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.roundSkipped.length > 0 && (
          <div className={shell.card}>
            <h2 className={shell.cardTitle}>{s.uebersprungen}</h2>
            <ul className={shell.list}>
              {state.roundSkipped.map((w) => (
                <li key={w}>
                  <span>{w}</span>
                  <strong className={shell.bad}>↷</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className={shell.btn} onClick={() => setState(nextTurn(state))}>
          {t.allgemein.weiter}
        </button>
      </main>
    )
  }

  const rang = scharadeRangliste(state)

  return (
    <main className={`${shell.page} ${styles.farbe}`}>
      <h1 className={shell.title}>{s.standNachRunde(state.roundIndex + 1)}</h1>
      <div className={shell.card}>
        <ul className={shell.list}>
          {rang.map((p, i) => (
            <li key={p.id}>
              <span>
                {i + 1}. {p.name}
              </span>
              <strong className={shell.ok}>{s.treffer(p.correct)}</strong>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        className={shell.btn}
        onClick={() => setState(nextScharadeRound(state))}
      >
        {s.nochEineRunde}
      </button>
      <button type="button" className={shell.btnSecondary} onClick={() => setState(null)}>
        {g.neuePartie}
      </button>
      <Link to="/" className={shell.back}>
        {t.allgemein.zumMenue}
      </Link>
    </main>
  )
}
