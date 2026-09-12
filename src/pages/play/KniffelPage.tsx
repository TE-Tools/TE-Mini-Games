/**
 * Kniffel -- Solo gegen den Rechner, oder online mit Freunden.
 *
 * Die Seite hält den Zustand und ruft die Engine. Sie enthält keine Regel:
 * Was ein Wurf wert ist und wann die Partie endet, steht in
 * src/games/kniffel. Der Online-Teil liegt in KniffelOnline.tsx, weil er
 * einen ganz anderen Zustand führt -- dort gibt der Server den Takt vor.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MAX_SPIELER,
  WUERFE_JE_ZUG,
  aktiverSpieler,
  alleFreigeben,
  darfWuerfeln,
  eintragen,
  endstand,
  erstellePartie,
  gesamtpunkte,
  halten,
  kiSchritt,
  wuerfeln,
  type KategorieId,
  type KiStufe,
  type KniffelZustand,
  type SpielerEinrichtung,
} from '@/games/kniffel'
import { addXp, saveGameResult } from '@/offline'
import { processAfterResult } from '@/progression'
import { trySyncNow } from '@/services/remoteSync'
import { isKniffelOnlineAvailable } from '@/services/kniffelOnline'
import { spielerNameOderDu } from '@/services/spielername'
import { spiele, setzeTon, tonAn, vibriere } from '@/services/sound'
import { Wuerfelreihe } from './kniffel/Wuerfelreihe'
import { Kniffelblock, type BlockSpalte } from './kniffel/Kniffelblock'
import { KniffelOnline } from './KniffelOnline'
import { partieXp } from '@/games/kniffel/definition'
import shell from './PlayShell.module.css'
import styles from './KniffelPage.module.css'

/** Wie lange der Rechner „überlegt", damit man seinen Zug sieht. */
const KI_PAUSE_MS = 700
const WURF_ANIMATION_MS = 340

type Ansicht = 'menue' | 'aufbau' | 'solo' | 'online'

const STUFEN: { id: KiStufe; label: string; erklaerung: string }[] = [
  {
    id: 'leicht',
    label: 'Leicht',
    erklaerung: 'Behält die häufigste Zahl, trägt den höchsten Wurf ein.',
  },
  { id: 'normal', label: 'Normal', erklaerung: 'Achtet auf Straßen und auf den oberen Bonus.' },
  {
    id: 'schwer',
    label: 'Schwer',
    erklaerung: 'Probiert jede Haltemöglichkeit durch und rechnet.',
  },
]

export function KniffelPage() {
  const navigate = useNavigate()
  // Mit ?raum=CODE (von der Seite "Offene Spiele") geht es direkt in den Online-Teil.
  const [ansicht, setAnsicht] = useState<Ansicht>(() =>
    new URLSearchParams(window.location.search).has('raum') ? 'online' : 'menue',
  )
  const [spielerName, setSpielerName] = useState('Du')
  const [gegner, setGegner] = useState(1)
  const [stufe, setStufe] = useState<KiStufe>('normal')
  const [zustand, setZustand] = useState<KniffelZustand | null>(null)
  const [rollt, setRollt] = useState(false)
  const [ton, setTonAn] = useState(tonAn())
  const ergebnisGesichert = useRef(false)

  useEffect(() => {
    let abbruch = false
    // Holt den Namen aus dem Konto, wenn lokal noch keiner steht -- und
    // merkt ihn sich dabei. Ohne Konto bleibt es bei "Du".
    void spielerNameOderDu()
      .then((name) => {
        if (!abbruch) setSpielerName(name)
      })
      .catch(() => undefined)
    return () => {
      abbruch = true
    }
  }, [])

  /* ------------------------------------------------------ Der Rechner */

  useEffect(() => {
    if (!zustand || zustand.phase === 'ende') return
    if (aktiverSpieler(zustand).typ !== 'ki') return
    const uhr = window.setTimeout(() => {
      setZustand((alt) => {
        if (!alt || alt.phase === 'ende') return alt
        if (aktiverSpieler(alt).typ !== 'ki') return alt
        const schritt = kiSchritt(alt)
        if (schritt.aktion === 'wuerfeln') spiele('wuerfel')
        if (schritt.aktion === 'eintragen') spiele('kauf')
        return schritt.state
      })
    }, KI_PAUSE_MS)
    return () => window.clearTimeout(uhr)
  }, [zustand])

  /* --------------------------------------------------- Ergebnis buchen */

  useEffect(() => {
    if (!zustand || zustand.phase !== 'ende' || ergebnisGesichert.current) return
    ergebnisGesichert.current = true

    void (async () => {
      const mensch = zustand.spieler.find((s) => s.typ === 'mensch')
      if (!mensch) return
      const punkte = gesamtpunkte(mensch.block)
      const gewonnen = zustand.siegerId === mensch.id
      const xp = partieXp(punkte, gewonnen)
      try {
        await saveGameResult({
          gameId: 'kniffel',
          level: 1,
          score: punkte,
          xp,
          resultData: {
            punkte,
            gewonnen,
            mitspieler: zustand.spieler.length,
            kiStufe: zustand.spieler.find((s) => s.typ === 'ki')?.kiStufe ?? null,
          },
          stars: 0,
          isPersonalRecord: gewonnen,
        })
        await addXp('guest', xp)
        await processAfterResult({ gameId: 'kniffel', level: 1, isPersonalRecord: gewonnen })
        void trySyncNow()
      } catch (err) {
        console.error('[kniffel] Ergebnis konnte nicht gespeichert werden', err)
      }
    })()
  }, [zustand])

  /* ------------------------------------------------------------ Zug */

  const starten = useCallback(() => {
    const spieler: SpielerEinrichtung[] = [{ name: spielerName || 'Du', typ: 'mensch' }]
    for (let i = 0; i < gegner; i++) {
      spieler.push({ name: `Rechner ${i + 1}`, typ: 'ki', kiStufe: stufe })
    }
    ergebnisGesichert.current = false
    setZustand(erstellePartie({ spieler }))
    setAnsicht('solo')
  }, [spielerName, gegner, stufe])

  const wuerfelKlick = useCallback(() => {
    spiele('wuerfel')
    vibriere(20)
    setRollt(true)
    window.setTimeout(() => setRollt(false), WURF_ANIMATION_MS)
    setZustand((alt) => (alt ? wuerfeln(alt) : alt))
  }, [])

  const haltenKlick = useCallback((index: number) => {
    spiele('tick')
    setZustand((alt) => (alt ? halten(alt, index) : alt))
  }, [])

  const eintragenKlick = useCallback((feld: KategorieId) => {
    spiele('kauf')
    setZustand((alt) => (alt ? eintragen(alt, feld) : alt))
  }, [])

  const tonUmschalten = useCallback(() => {
    const neu = !tonAn()
    setzeTon(neu)
    setTonAn(neu)
    if (neu) spiele('muenze')
  }, [])

  /* -------------------------------------------------------- Anzeige */

  if (ansicht === 'online') {
    return <KniffelOnline eigenerName={spielerName} onZurueck={() => setAnsicht('menue')} />
  }

  if (ansicht === 'menue') {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <Kopf onZurueck={() => navigate('/')} ton={ton} onTon={tonUmschalten} />
        <section className={styles.menue}>
          <p className={styles.einleitung}>
            Dreizehn Felder, drei Würfe je Zug. Wer oben 63 zusammenbekommt, kriegt 35 Punkte dazu –
            und wer fünf gleiche wirft, den Kniffel.
          </p>

          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('aufbau')}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              🤖
            </span>
            <span>
              <strong>Gegen den Rechner</strong>
              <small>Allein, sofort losspielen</small>
            </span>
          </button>

          <button
            type="button"
            className={styles.grosserKnopf}
            onClick={() => setAnsicht('online')}
            disabled={!isKniffelOnlineAvailable}
          >
            <span className={styles.knopfIcon} aria-hidden="true">
              👥
            </span>
            <span>
              <strong>Online gegeneinander</strong>
              <small>
                {isKniffelOnlineAvailable
                  ? 'Raum eröffnen und Code weitergeben'
                  : 'Dafür wird ein Konto gebraucht'}
              </small>
            </span>
          </button>

          <Link to="/" className={shell.homeLink}>
            Zum Menü
          </Link>
        </section>
      </main>
    )
  }

  if (ansicht === 'aufbau') {
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={styles.aufbau}>
          <h2 className={styles.ueberschrift}>Gegen den Rechner</h2>

          <label className={styles.feld}>
            <span>Dein Name</span>
            <input
              className={styles.eingabe}
              value={spielerName}
              onChange={(e) => setSpielerName(e.target.value)}
              maxLength={16}
            />
          </label>

          <fieldset className={styles.gruppe}>
            <legend>Wie viele Gegner?</legend>
            <div className={styles.knopfreihe}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={gegner === n ? styles.wahlAn : styles.wahlAus}
                  onClick={() => setGegner(n)}
                  disabled={n + 1 > MAX_SPIELER}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.gruppe}>
            <legend>Wie stark?</legend>
            <div className={styles.knopfreihe}>
              {STUFEN.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={stufe === s.id ? styles.wahlAn : styles.wahlAus}
                  onClick={() => setStufe(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className={styles.erklaerung}>{STUFEN.find((s) => s.id === stufe)?.erklaerung}</p>
          </fieldset>

          <button type="button" className={styles.start} onClick={starten}>
            🎲 Los geht's
          </button>
        </section>
      </main>
    )
  }

  if (!zustand) return null

  const aktiv = aktiverSpieler(zustand)
  const mensch = aktiv.typ === 'mensch'
  const spalten: BlockSpalte[] = zustand.spieler.map((s) => ({
    id: s.id,
    name: s.name,
    block: s.block,
    ichSelbst: s.typ === 'mensch',
    amZug: s.id === aktiv.id,
  }))

  if (zustand.phase === 'ende') {
    const tabelle = endstand(zustand)
    const menschSpieler = zustand.spieler.find((s) => s.typ === 'mensch')
    const gewonnen = menschSpieler ? zustand.siegerId === menschSpieler.id : false
    return (
      <main className={`${shell.page} ${styles.breiteSeite}`}>
        <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />
        <section className={shell.section}>
          <p className={gewonnen ? shell.correct : shell.wrong}>
            {gewonnen ? '🏆 Gewonnen!' : `${tabelle[0]?.name} gewinnt.`}
          </p>
          <ol className={styles.endstand}>
            {tabelle.map((e, i) => (
              <li key={e.spielerId} className={styles.endEintrag}>
                <span className={styles.endPlatz}>{i + 1}.</span>
                <span className={styles.endName}>{e.name}</span>
                <span className={styles.endWert}>{e.punkte} Punkte</span>
              </li>
            ))}
          </ol>
          <Kniffelblock spalten={spalten} wuerfel={[]} eintragbar={false} onEintragen={() => {}} />
          <div className={shell.resultActions}>
            <button type="button" className={shell.primaryBtn} onClick={starten}>
              Noch eine Partie
            </button>
            <button
              type="button"
              className={shell.secondaryBtn}
              onClick={() => setAnsicht('menue')}
            >
              Anderer Modus
            </button>
            <Link to="/" className={shell.homeLink}>
              Zum Menü
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={`${shell.page} ${styles.breiteSeite}`}>
      <Kopf onZurueck={() => setAnsicht('menue')} ton={ton} onTon={tonUmschalten} />

      <section className={styles.tisch}>
        {/* Würfel und Wurfknopf bleiben oben stehen; darunter scrollt der
            Block weg. Auf dem Handy sonst der Dauerzustand: Man tippt ein
            Feld an und muss zum Würfeln wieder hochscrollen. */}
        <div className={styles.oben}>
          <p
            className={`${styles.amZug} ${mensch ? styles.amZugIch : styles.amZugAndere}`}
            aria-live="polite"
          >
            <span className={styles.amZugPunkt} aria-hidden="true" />
            {mensch ? (
              'Du bist dran'
            ) : (
              <>
                <strong className={styles.amZugName}>{aktiv.name}</strong> ist dran
              </>
            )}
            <span className={styles.wurfZaehler}>
              {zustand.wurfNummer === 0
                ? 'noch nicht gewürfelt'
                : `Wurf ${zustand.wurfNummer} von ${WUERFE_JE_ZUG}`}
            </span>
          </p>

          <Wuerfelreihe
            wuerfel={zustand.wuerfel}
            gehalten={zustand.gehalten}
            haltbar={mensch && zustand.wurfNummer > 0 && zustand.wurfNummer < WUERFE_JE_ZUG}
            rollt={rollt}
            onHalten={haltenKlick}
          />

          {mensch && zustand.wurfNummer > 0 && zustand.wurfNummer < WUERFE_JE_ZUG && (
            <p className={styles.halteHinweis}>
              Tippe die Würfel an, die liegen bleiben sollen.
              {zustand.gehalten.some(Boolean) && (
                <button
                  type="button"
                  className={styles.textKnopf}
                  onClick={() => setZustand((alt) => (alt ? alleFreigeben(alt) : alt))}
                >
                  Alle freigeben
                </button>
              )}
            </p>
          )}

          {mensch && (
            <button
              type="button"
              className={styles.wuerfelKnopf}
              onClick={wuerfelKlick}
              disabled={!darfWuerfeln(zustand)}
            >
              {zustand.wurfNummer === 0
                ? '🎲 Würfeln'
                : darfWuerfeln(zustand)
                  ? `🎲 Nochmal (${WUERFE_JE_ZUG - zustand.wurfNummer} übrig)`
                  : 'Jetzt eintragen'}
            </button>
          )}
        </div>

        {mensch && zustand.wurfNummer > 0 && (
          <p className={styles.eintragHinweis}>
            Tippe im Block auf eine Zahl, um sie einzutragen. Eine 0 streicht das Feld.
          </p>
        )}

        <Kniffelblock
          spalten={spalten}
          wuerfel={zustand.wuerfel}
          eintragbar={mensch && zustand.wurfNummer > 0}
          onEintragen={eintragenKlick}
        />

        <p className={styles.protokoll} aria-live="polite">
          {zustand.protokoll[zustand.protokoll.length - 1]}
        </p>
      </section>
    </main>
  )
}

function Kopf({
  onZurueck,
  ton,
  onTon,
}: {
  onZurueck: () => void
  ton: boolean
  onTon: () => void
}) {
  return (
    <header className={shell.header}>
      <button type="button" className={shell.back} onClick={onZurueck} aria-label="Zurück">
        ←
      </button>
      <h1 className={shell.title}>Kniffel</h1>
      <button
        type="button"
        className={styles.tonKnopf}
        onClick={onTon}
        aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'}
      >
        {ton ? '🔊' : '🔈'}
      </button>
    </header>
  )
}
