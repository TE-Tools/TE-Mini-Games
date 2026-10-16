/**
 * Der Pokertisch -- Bande, Filz, Plätze, Topf, Einsätze.
 *
 * Reine Anzeige: Diese Komponente kennt keinen Zustand und keine Regel.
 * Sie bekommt, was zu sehen ist, und zeigt es an; was unten an Knöpfen
 * steht, gibt der Aufrufer als `aktionen` hinein.
 *
 * Warum sie für sich steht: Denselben Tisch gibt es zweimal -- gegen den
 * Rechner (TexasHoldemPage) und online (TexasHoldemOnline). Online kennt
 * der Client die fremden Karten nicht, sondern bekommt `null`; ein Tisch,
 * der den Zustand der Engine erwartet, taugt dort nicht. Zwei Tische
 * wären zwei Oberflächen, die auseinanderlaufen.
 */

import type { CSSProperties, ReactNode } from 'react'
import type { Karte, SpielerStatus } from '@/games/texas-holdem'
import { Chipstapel } from './Chips'
import { Kartenplatz, Spielkarte } from './Spielkarte'
import styles from '../TexasHoldemPage.module.css'

/** Ein Platz am Tisch, wie der Tisch ihn braucht. */
export interface TischSpieler {
  id: string
  name: string
  /** `null` heisst verdeckt -- online kommen fremde Karten gar nicht an. */
  karten: Karte[] | null
  chips: number
  einsatz: number
  status: SpielerStatus
  ichSelbst: boolean
}

interface Platz {
  /** Prozent der Tischbreite. */
  x: number
  /** Prozent der Tischhöhe. */
  y: number
}

/**
 * Wo die Gegner sitzen -- je nachdem, wie viele es sind.
 *
 * Von Hand gesetzt statt auf der Ellipse ausgerechnet: Gerechnete Plätze
 * liegen mathematisch richtig und sehen trotzdem falsch aus, weil die
 * Namenskästchen verschieden breit sind und sich an den Seiten
 * überschneiden. Man selbst sitzt immer unten, ausserhalb des Filzes.
 */
const SITZE: Record<number, Platz[]> = {
  1: [{ x: 50, y: 22 }],
  2: [
    { x: 28, y: 24 },
    { x: 72, y: 24 },
  ],
  3: [
    { x: 14, y: 39 },
    { x: 50, y: 19 },
    { x: 86, y: 39 },
  ],
  4: [
    { x: 13, y: 40 },
    { x: 33, y: 20 },
    { x: 67, y: 20 },
    { x: 87, y: 40 },
  ],
  5: [
    { x: 12, y: 41 },
    { x: 29, y: 21 },
    { x: 50, y: 17 },
    { x: 71, y: 21 },
    { x: 88, y: 41 },
  ],
}

/** Der eigene Platz -- unten am Rand des Filzes. */
const MEIN_PLATZ: Platz = { x: 50, y: 90 }

/**
 * Wo die eigenen Jetons landen.
 *
 * Nicht über `einsatzPunkt` gerechnet, sondern gesetzt: Von unten führt
 * der Weg geradewegs in die Mitte, und dort liegen schon Karten und
 * Topf. Mein Einsatz liegt darunter, zwischen Topf und Tischkante.
 */
const MEIN_EINSATZ: Platz = { x: 50, y: 84 }

/**
 * Wo der Einsatz liegt: zwischen Spieler und Mitte.
 *
 * Deutlich mehr als die Hälfte des Weges -- bei weniger liegen die
 * Jetons auf dem Namenskästchen statt davor. Im Browser ausgemessen.
 */
function einsatzPunkt(p: Platz): Platz {
  return { x: p.x + (50 - p.x) * 0.62, y: p.y + (50 - p.y) * 0.62 }
}

/** Der Geberknopf liegt dichter am Platz als die Jetons -- sonst stapelt sich beides. */
function geberPunkt(p: Platz): Platz {
  return { x: p.x + (50 - p.x) * 0.2, y: p.y + (50 - p.y) * 0.2 }
}

/**
 * Aus welcher Richtung die Jetons angeflogen kommen.
 *
 * Von der Seite des Spielers, 26 Punkte weit. Die Animation beginnt dort
 * und endet auf dem Einsatzpunkt -- das ist das „in die Mitte werfen".
 */
function wurfVersatz(p: Platz): { '--wurf-x': string; '--wurf-y': string } {
  const dx = p.x - 50
  const dy = p.y - 50
  const laenge = Math.hypot(dx, dy) || 1
  return {
    '--wurf-x': `${((dx / laenge) * 26).toFixed(1)}px`,
    '--wurf-y': `${((dy / laenge) * 26).toFixed(1)}px`,
  }
}

export interface PokerTischProps {
  /** Alle Plätze in Sitzordnung, mich eingeschlossen. */
  spieler: TischSpieler[]
  amZugId: string | null
  dealerId: string | null
  board: Karte[]
  topf: number
  handNr: number
  blinds: { klein: number; gross: number }
  /** Liegen die Karten offen? */
  gezeigt: boolean
  /** Welche Karte zur Gewinnerhand gehört -- für den Ring. */
  zaehltMit: (k?: Karte | null) => boolean
  protokoll: string[]
  ergebnisText: string | null
  /** Was unten steht: Einsatzleiste, „Nächste Hand" oder eine Wartezeile. */
  aktionen: ReactNode
}

export function PokerTisch({
  spieler,
  amZugId,
  dealerId,
  board,
  topf,
  handNr,
  blinds,
  gezeigt,
  zaehltMit,
  protokoll,
  ergebnisText,
  aktionen,
}: PokerTischProps) {
  const ich = spieler.find((s) => s.ichSelbst)
  const gegner = spieler.filter((s) => !s.ichSelbst)
  const sitze = SITZE[gegner.length] ?? SITZE[5]!
  const platzVon = (id: string): Platz => {
    if (ich && id === ich.id) return MEIN_PLATZ
    const i = gegner.findIndex((s) => s.id === id)
    return sitze[i] ?? MEIN_PLATZ
  }

  const einsaetze = spieler
    .filter((s) => s.einsatz > 0)
    .map((s) => ({
      id: s.id,
      betrag: s.einsatz,
      platz: platzVon(s.id),
      punkt: s.ichSelbst ? MEIN_EINSATZ : einsatzPunkt(platzVon(s.id)),
    }))

  const geberPlatz = dealerId ? geberPunkt(platzVon(dealerId)) : null

  return (
    <section className={styles.tisch}>
      {/*
        Der Tisch: aussen die Bande, innen der Filz. Die Plätze liegen
        absolut auf dem Filz, die Einsätze zwischen Platz und Mitte --
        so sieht man, wessen Jetons da liegen.
      */}
      <div className={styles.bande}>
        <div className={styles.filz}>
          <div className={styles.mitte} role="group" aria-label="Tischmitte">
            <div className={styles.board} role="group" aria-label="Gemeinschaftskarten">
              {[0, 1, 2, 3, 4].map((i) =>
                board[i] ? (
                  <Spielkarte
                    key={i}
                    karte={board[i]}
                    groesse="tisch"
                    zaehlt={zaehltMit(board[i])}
                  />
                ) : (
                  <Kartenplatz key={i} groesse="tisch" />
                ),
              )}
            </div>
            <p className={styles.topf}>
              {/* Der Schlüssel ist der Betrag: Wächst der Topf, entsteht
                  der Stapel neu und wächst sichtbar mit. */}
              <span key={topf} className={styles.topfChips}>
                <Chipstapel betrag={topf} zahl="keine" hoechstens={6} />
              </span>
              <span className={styles.topfZahl}>{topf}</span>
              <span className={styles.topfWort}>im Topf</span>
            </p>
            <p className={styles.stufe}>
              Hand {handNr} · Blinds {blinds.klein}/{blinds.gross}
            </p>
          </div>

          {gegner.map((s, i) => (
            <div
              key={s.id}
              className={styles.sitz}
              style={{
                left: `${(sitze[i] ?? MEIN_PLATZ).x}%`,
                top: `${(sitze[i] ?? MEIN_PLATZ).y}%`,
              }}
            >
              <GegnerKarte
                spieler={s}
                amZug={amZugId === s.id}
                offen={gezeigt}
                zaehltMit={zaehltMit}
              />
            </div>
          ))}

          {/* Die Einsätze. Der Schlüssel enthält den Betrag -- bei jeder
              Erhöhung fliegen die Jetons neu ein. */}
          {einsaetze.map(({ id, betrag, platz, punkt }) => (
            <span
              key={`${id}-${betrag}`}
              className={styles.einsatzMarke}
              style={
                {
                  left: `${punkt.x}%`,
                  top: `${punkt.y}%`,
                  ...wurfVersatz(platz),
                } as CSSProperties
              }
            >
              <Chipstapel betrag={betrag} klein />
            </span>
          ))}

          {geberPlatz && (
            <span
              className={styles.geberKnopf}
              style={{ left: `${geberPlatz.x}%`, top: `${geberPlatz.y}%` }}
              title="Geber"
              aria-label="Geber"
            >
              D
            </span>
          )}
        </div>
      </div>

      <ol className={styles.protokoll} aria-label="Was bisher geschah">
        {/*
          Das Ergebnis steht gleich darunter gross im Kasten -- im
          Protokoll wäre es dieselbe Zeile zweimal untereinander.
        */}
        {protokoll
          .filter((zeile) => zeile !== ergebnisText)
          .slice(-4)
          .reverse()
          .map((zeile, i) => (
            <li key={`${protokoll.length}-${i}`}>{zeile}</li>
          ))}
      </ol>

      {ergebnisText && (
        <p className={styles.ergebnis} role="status">
          {ergebnisText}
        </p>
      )}

      <div className={styles.unten}>
        <div className={styles.ichZeile}>
          <div className={styles.meineKarten} role="group" aria-label="Deine Karten">
            {ich?.karten?.length ? (
              ich.karten.map((k, i) => <Spielkarte key={i} karte={k} zaehlt={zaehltMit(k)} />)
            ) : (
              <>
                <Kartenplatz />
                <Kartenplatz />
              </>
            )}
          </div>
          <div className={styles.meinStand}>
            <strong className={styles.meineChips}>{ich?.chips ?? 0}</strong>
            <span className={styles.meinEinsatz}>
              {ich && ich.einsatz > 0 ? `im Einsatz: ${ich.einsatz}` : 'Chips'}
            </span>
            {ich?.status === 'gefoldet' && <span className={styles.weggeworfen}>weggeworfen</span>}
            {ich?.status === 'raus' && <span className={styles.weggeworfen}>ausgeschieden</span>}
          </div>
        </div>

        {aktionen}
      </div>
    </section>
  )
}

function GegnerKarte({
  spieler,
  amZug,
  offen,
  zaehltMit,
}: {
  spieler: TischSpieler
  amZug: boolean
  offen: boolean
  zaehltMit: (k?: Karte | null) => boolean
}) {
  const raus = spieler.status === 'raus'
  const weg = spieler.status === 'gefoldet'
  // Online kommen fremde Karten als null an; dann liegen eben zwei
  // Rückseiten da. Verdeckt ist hier keine Entscheidung der Oberfläche.
  const karten = spieler.karten ?? [null, null]
  return (
    <div
      className={styles.gegnerKarte}
      data-zug={amZug ? 'ja' : undefined}
      data-weg={weg || raus ? 'ja' : undefined}
    >
      <div className={styles.gegnerKarten}>
        {raus ? (
          <span className={styles.rausText}>raus</span>
        ) : (
          karten.map((k, i) => (
            <Spielkarte
              key={i}
              karte={k ?? undefined}
              zu={!k || !offen || weg}
              groesse="klein"
              zaehlt={zaehltMit(k)}
            />
          ))
        )}
      </div>
      <span className={styles.gegnerName}>{spieler.name}</span>
      <span className={styles.gegnerChips}>
        {spieler.status === 'allin' ? (
          <span className={styles.allin}>all-in</span>
        ) : (
          <>
            <Chipstapel betrag={spieler.chips} klein zahl="keine" hoechstens={3} />
            <span className={styles.gegnerZahl}>{spieler.chips}</span>
          </>
        )}
      </span>
    </div>
  )
}
