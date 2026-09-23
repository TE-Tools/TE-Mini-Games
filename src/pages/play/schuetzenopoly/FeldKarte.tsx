/**
 * Die Feldkarte – eine Besitzkarte, wie sie beim Brettspiel auf dem Tisch
 * liegt.
 *
 * Thomas am 23.09.2026: "die Karten sollen ein bisschen besser angezeigt
 * werden, nicht ganz so gequetscht, sondern sehr klein aber wie wirkliche
 * Karten, alles klein geschrieben. Und immer wenn man auf einer Karte
 * landet, soll sie schwingend nach vorne kommen, dann kann man kaufen usw.
 * sagen, und dann geht sie zurück, wenn man fertig ist. Dass das Spiel
 * mittig bleibt und man sieht, wo man drauf ist und was man machen kann."
 *
 * Daraus folgen drei Dinge:
 *
 * 1. Sie sieht aus wie eine Besitzkarte: Farbfahne oben, darunter die
 *    Gebührenstaffel in einer schmalen Spalte, ganz klein gesetzt. Vorher
 *    war es ein Dialog mit Kacheln und großen Überschriften -- viel Fläche
 *    für wenig Inhalt, und die Staffel musste sich trotzdem quetschen.
 * 2. Sie schwingt herein, statt zu erscheinen: Sie kippt um ihre Unterkante
 *    nach vorn, wie eine Karte, die jemand auf den Tisch legt und aufstellt.
 *    Beim Schließen kippt sie zurück.
 * 3. Sie trägt, was man tun kann. Wer auf einem freien Feld landet, kauft
 *    auf der Karte -- nicht in einer Leiste weiter unten, wo nicht steht,
 *    worum es geht.
 *
 * Der Hintergrund bleibt absichtlich hell abgedunkelt: Das Brett soll
 * durchscheinen, damit man sieht, wo die eigene Figur steht.
 */

import { useEffect } from 'react'
import {
  AUSBAU_FAKTOR,
  AUSBAU_NAMEN,
  GRUPPEN_FAKTOR,
  GRUPPEN_FAKTOR_PREMIUM,
  SONDERFELD_GEBUEHR,
  VERBAND_FAKTOR_BEIDE,
  VERBAND_FAKTOR_EINER,
  baukosten,
  grundstueck,
  gruppe,
  gruppeKomplett,
  istGrundstueck,
  istSonderfeld,
  istVerband,
  kaufpreis,
  spielerMit,
  type BrettFeld,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import styles from './FeldKarte.module.css'

interface FeldKarteProps {
  feld: BrettFeld
  zustand: SpielZustand
  /** Läuft die Karte gerade zurück? Dann spielt die Rückwärtsbewegung. */
  geht?: boolean
  /** Was man auf diesem Feld tun kann -- Kaufen, Stehen lassen, Weiter. */
  aktionen?: React.ReactNode
  onSchliessen: () => void
}

const ART_TEXT: Record<string, string> = {
  schuetzenfest: 'Schützenfest',
  kirmes: 'Kirmes',
  umzug: 'Umzug',
  volksfest: 'Volksfest',
}

/** Zahlen auf der Karte: immer mit Tausenderpunkt, nie mit Währungswort. */
function zahl(n: number): string {
  return Math.round(n).toLocaleString('de-DE')
}

export function FeldKarte({ feld, zustand, geht, aktionen, onSchliessen }: FeldKarteProps) {
  const feldId = feld.grundstueckId
  const besitz = feldId ? zustand.besitz[feldId] : undefined
  const besitzer = besitz?.besitzerId ? spielerMit(zustand, besitz.besitzerId) : null
  const g = feldId ? grundstueck(feldId) : undefined
  const gr = g ? gruppe(g.gruppe) : undefined
  const komplett = feldId && istGrundstueck(feldId) ? gruppeKomplett(zustand, feldId) : false
  const gruppenFaktor = komplett ? (gr?.premium ? GRUPPEN_FAKTOR_PREMIUM : GRUPPEN_FAKTOR) : 1

  // Mit der Escape-Taste geht die Karte zurück wie mit dem Knopf.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen()
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen])

  return (
    <div
      className={`${styles.hintergrund} ${geht ? styles.hintergrundGeht : ''}`}
      onClick={onSchliessen}
      role="presentation"
    >
      <div className={styles.buehne}>
        <article
          className={`${styles.karte} ${geht ? styles.karteGeht : ''}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={feld.name}
        >
          <header className={styles.fahne} style={gr ? { background: gr.farbe } : undefined}>
            <span className={styles.art}>
              {g ? (ART_TEXT[g.art] ?? 'Veranstaltung') : feldArt(feld)}
            </span>
            <h3 className={styles.titel}>{g?.stadt ?? feld.name}</h3>
            {g && <span className={styles.veranstaltung}>{g.veranstaltung}</span>}
          </header>

          {feldId && besitz && istGrundstueck(feldId) && g && (
            <>
              <table className={styles.staffel}>
                {/*
                  Die Überschrift ist nötig, nicht Zierde: Die erste Zeile
                  der Staffel heißt "Grundstück" (also unbebaut), und unten
                  steht der Kaufpreis. Ohne "Standgeld" darüber standen
                  zweimal dieselben Wörter für zwei verschiedene Zahlen.
                */}
                <caption className={styles.staffelTitel}>Standgeld</caption>
                <tbody>
                  {AUSBAU_NAMEN.map((name, stufe) => (
                    <tr key={name} className={besitz.stufe === stufe ? styles.aktuell : undefined}>
                      <th scope="row">{name}</th>
                      <td>
                        {zahl(
                          g.grundgebuehr *
                            AUSBAU_FAKTOR[stufe as 0 | 1 | 2 | 3 | 4] *
                            gruppenFaktor,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {komplett && <p className={styles.notiz}>Gruppe komplett – Gebühren erhöht.</p>}
              <dl className={styles.fuss}>
                <div>
                  <dt>Kaufpreis</dt>
                  <dd>{zahl(kaufpreis(feldId))}</dd>
                </div>
                <div>
                  <dt>Ausbau je Stufe</dt>
                  <dd>{zahl(baukosten(feldId))}</dd>
                </div>
              </dl>
            </>
          )}

          {feldId && besitz && istSonderfeld(feldId) && (
            <>
              <table className={styles.staffel}>
                <caption className={styles.staffelTitel}>Standgeld</caption>
                <tbody>
                  {SONDERFELD_GEBUEHR.slice(1).map((betrag, i) => (
                    <tr key={i}>
                      <th scope="row">
                        {i + 1} Feld{i > 0 ? 'er' : ''} im Besitz
                      </th>
                      <td>{zahl(betrag)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className={styles.fuss}>
                <div>
                  <dt>Kaufpreis</dt>
                  <dd>{zahl(kaufpreis(feldId))}</dd>
                </div>
              </dl>
            </>
          )}

          {feldId && besitz && istVerband(feldId) && (
            <>
              <table className={styles.staffel}>
                <caption className={styles.staffelTitel}>Standgeld</caption>
                <tbody>
                  <tr>
                    <th scope="row">Ein Verband</th>
                    <td>Würfel × {VERBAND_FAKTOR_EINER}</td>
                  </tr>
                  <tr>
                    <th scope="row">Beide Verbände</th>
                    <td>Würfel × {VERBAND_FAKTOR_BEIDE}</td>
                  </tr>
                </tbody>
              </table>
              <dl className={styles.fuss}>
                <div>
                  <dt>Kaufpreis</dt>
                  <dd>{zahl(kaufpreis(feldId))}</dd>
                </div>
              </dl>
            </>
          )}

          {feldId && besitz && (
            <p className={styles.besitzZeile}>
              {besitzer ? (
                <>
                  Im Besitz von <strong>{besitzer.name}</strong>
                  {istGrundstueck(feldId) && besitz.stufe > 0 && ` · ${AUSBAU_NAMEN[besitz.stufe]}`}
                </>
              ) : (
                'Noch frei'
              )}
            </p>
          )}

          {!feldId && <p className={styles.sonderText}>{beschreibeSonderfeld(feld)}</p>}

          {g && <p className={styles.fakt}>{g.fakt}</p>}

          <div className={styles.aktionen}>
            {aktionen}
            <button type="button" className={styles.schliessen} onClick={onSchliessen}>
              {aktionen ? 'Karte weglegen' : 'Schließen'}
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

/** Die Zeile über dem Namen, wenn es kein Grundstück ist. */
function feldArt(feld: BrettFeld): string {
  switch (feld.typ) {
    case 'start':
      return 'Festplatz'
    case 'strafbank':
    case 'zur_strafbank':
      return 'Strafbank'
    case 'freies_fest':
      return 'Freies Fest'
    case 'ereignis':
      return 'Ereigniskarte'
    case 'vereinskarte':
      return 'Vereinskarte'
    case 'minispiel':
      return 'Schießstand'
    case 'sonderfeld':
      // Die vier Umzüge stehen an der Stelle, an der klassische Bretter
      // Bahnhöfe haben. "Feld" stand hier vorher, und das sagt nichts.
      return 'Umzug'
    case 'verband':
      return 'Verband'
    default:
      return 'Feld'
  }
}

function beschreibeSonderfeld(feld: BrettFeld): string {
  switch (feld.typ) {
    case 'start':
      return 'Wer hier vorbeikommt, bekommt die Standgebühren des Festplatzes ausgezahlt.'
    case 'strafbank':
      return 'Nur zu Besuch – solange man nicht selbst hier sitzt. Ein Pasch, eine Zahlung oder die Fürsprache-Karte holen einen wieder heraus.'
    case 'freies_fest':
      return 'Eintritt frei, und der Wirt gibt etwas dazu. Eine Runde zum Durchatmen.'
    case 'zur_strafbank':
      return 'Von hier geht es sofort auf die Strafbank – ohne über START zu kommen.'
    case 'ereignis':
      return 'Zieh eine Ereigniskarte. Meist geht es dabei ums Geld.'
    case 'vereinskarte':
      return 'Zieh eine Vereinskarte. Die wirken auf spätere Züge und auf die Mitspieler.'
    case 'minispiel':
      return 'Am Schießstand geht es um Bronze, Silber oder Gold.'
    default:
      return ''
  }
}
