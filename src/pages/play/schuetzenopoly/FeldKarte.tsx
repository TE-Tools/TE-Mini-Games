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
 *
 * Thomas am 23.09.2026, nachgereicht: "bitte kleines Farbsymbol, wem welche
 * Karte gehört, damit man Bescheid weiß. Und auch bei KI-Gegnern Karte
 * hochkommen lassen und Animation, welcher Button gedrückt wird."
 *
 * Daher zwei weitere Dinge:
 *
 * 4. Die Besitzzeile trägt die Farbe und die Figur des Besitzers -- dieselbe
 *    Marke wie auf dem Brett. Ein Name allein verlangt, dass man sich merkt,
 *    wer welche Farbe hat.
 * 5. Die Knöpfe sind Daten, kein fertiger Baum. Nur so kann die Seite sagen,
 *    welcher gerade gedrückt wird -- und das gilt für den Menschen wie für
 *    den Rechner, der seinen Knopf selbst drückt, während man zusieht.
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
  figur,
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
import { useSprache, type Sprache, type Texte } from '@/i18n/sprache'
import { ausbauName, feldAnzeige } from './texte'
import styles from './FeldKarte.module.css'

/**
 * Ein Knopf auf der Karte.
 *
 * Absichtlich Daten und kein fertiges JSX: Die Karte muss einen Knopf auch
 * dann als gedrückt zeigen können, wenn ihn niemand angetippt hat -- beim
 * Zug des Rechners. Ohne `onKlick` ist der Knopf nur zu sehen, nicht zu
 * bedienen; so schaut man der KI zu, ohne für sie entscheiden zu können.
 */
export interface KartenAktion {
  id: string
  text: string
  /** Der gemeinte Knopf -- golden statt hell. */
  haupt?: boolean
  gesperrt?: boolean
  onKlick?: () => void
}

/** Wer gerade auf dem Feld steht. Steht nur auf der Karte, wenn es nicht man selbst ist. */
export interface KartenAkteur {
  name: string
  icon: string
  farbe: string
}

interface FeldKarteProps {
  feld: BrettFeld
  zustand: SpielZustand
  /** Läuft die Karte gerade zurück? Dann spielt die Rückwärtsbewegung. */
  geht?: boolean
  /** Was man auf diesem Feld tun kann -- Kaufen, Stehen lassen, Weiter. */
  aktionen?: KartenAktion[]
  /** Welcher Knopf gerade gedrückt wird -- der eigene oder der des Rechners. */
  gedrueckt?: string | null
  /** Der Rechner, dem die Karte gerade vorgelegt wird. */
  akteur?: KartenAkteur
  onSchliessen: () => void
}

/** Zahlen auf der Karte: immer mit Tausendertrennung, nie mit Währungswort. */
function zahlIn(sprache: Sprache, n: number): string {
  return Math.round(n).toLocaleString(sprache)
}

export function FeldKarte({
  feld,
  zustand,
  geht,
  aktionen,
  gedrueckt,
  akteur,
  onSchliessen,
}: FeldKarteProps) {
  const { t, sprache } = useSprache()
  const tk = t.schuetzenopoly.karte
  const zahl = (n: number) => zahlIn(sprache, n)
  const feldTitel = feldAnzeige(t, feld).name
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
          aria-label={feldTitel}
        >
          <header className={styles.fahne} style={gr ? { background: gr.farbe } : undefined}>
            <span className={styles.art}>
              {g
                ? ((tk.arten as Record<string, string | undefined>)[g.art] ?? tk.veranstaltung)
                : feldArt(t, feld)}
            </span>
            <h3 className={styles.titel}>{g?.stadt ?? feldTitel}</h3>
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
                <caption className={styles.staffelTitel}>{tk.standgeld}</caption>
                <tbody>
                  {AUSBAU_NAMEN.map((_, stufe) => (
                    <tr key={stufe} className={besitz.stufe === stufe ? styles.aktuell : undefined}>
                      <th scope="row">{ausbauName(t, stufe)}</th>
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
              {komplett && <p className={styles.notiz}>{tk.gruppeKomplett}</p>}
              <dl className={styles.fuss}>
                <div>
                  <dt>{tk.kaufpreis}</dt>
                  <dd>{zahl(kaufpreis(feldId))}</dd>
                </div>
                <div>
                  <dt>{tk.ausbauJeStufe}</dt>
                  <dd>{zahl(baukosten(feldId))}</dd>
                </div>
              </dl>
            </>
          )}

          {feldId && besitz && istSonderfeld(feldId) && (
            <>
              <table className={styles.staffel}>
                <caption className={styles.staffelTitel}>{tk.standgeld}</caption>
                <tbody>
                  {SONDERFELD_GEBUEHR.slice(1).map((betrag, i) => (
                    <tr key={i}>
                      <th scope="row">{tk.felderImBesitz(i + 1)}</th>
                      <td>{zahl(betrag)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className={styles.fuss}>
                <div>
                  <dt>{tk.kaufpreis}</dt>
                  <dd>{zahl(kaufpreis(feldId))}</dd>
                </div>
              </dl>
            </>
          )}

          {feldId && besitz && istVerband(feldId) && (
            <>
              <table className={styles.staffel}>
                <caption className={styles.staffelTitel}>{tk.standgeld}</caption>
                <tbody>
                  <tr>
                    <th scope="row">{tk.einVerband}</th>
                    <td>{tk.wuerfelMal(VERBAND_FAKTOR_EINER)}</td>
                  </tr>
                  <tr>
                    <th scope="row">{tk.beideVerbaende}</th>
                    <td>{tk.wuerfelMal(VERBAND_FAKTOR_BEIDE)}</td>
                  </tr>
                </tbody>
              </table>
              <dl className={styles.fuss}>
                <div>
                  <dt>{tk.kaufpreis}</dt>
                  <dd>{zahl(kaufpreis(feldId))}</dd>
                </div>
              </dl>
            </>
          )}

          {feldId && besitz && (
            <p className={styles.besitzZeile}>
              {besitzer ? (
                <>
                  {/*
                    Dieselbe Marke wie auf dem Brett: Farbe und Figur. Ein Name
                    allein verlangt, dass man sich merkt, wer welche Farbe hat.
                  */}
                  <span
                    className={styles.besitzMarke}
                    style={{ background: figur(besitzer.figurId).farbe }}
                    aria-hidden="true"
                  >
                    {figur(besitzer.figurId).icon}
                  </span>
                  {tk.imBesitzVon} <strong>{besitzer.name}</strong>
                  {istGrundstueck(feldId) &&
                    besitz.stufe > 0 &&
                    ` · ${ausbauName(t, besitz.stufe)}`}
                </>
              ) : (
                tk.nochFrei
              )}
            </p>
          )}

          {!feldId && <p className={styles.sonderText}>{beschreibeSonderfeld(t, feld)}</p>}

          {g && <p className={styles.fakt}>{g.fakt}</p>}

          {/*
            Beim Zug des Rechners sind die Knöpfe gesperrt -- man soll ihm
            zusehen, nicht für ihn entscheiden. Blass wie ein unerreichbarer
            Knopf sollen sie deshalb trotzdem nicht aussehen; das regelt
            `data-fremd` in der CSS.
          */}
          <div className={styles.aktionen} data-fremd={akteur ? 'ja' : undefined}>
            {akteur && (
              <p className={styles.amZug}>
                <span
                  className={styles.besitzMarke}
                  style={{ background: akteur.farbe }}
                  aria-hidden="true"
                >
                  {akteur.icon}
                </span>
                {aktionen?.length ? tk.entscheidet(akteur.name) : tk.stehtHier(akteur.name)}
              </p>
            )}
            {aktionen?.map((a) => (
              <button
                key={a.id}
                type="button"
                data-haupt={a.haupt ? 'ja' : undefined}
                /*
                 * Der gedrückte Knopf bleibt sichtbar gedrückt, bis die Karte
                 * zurückgeschwungen ist -- sonst wäre beim Zug des Rechners
                 * nie zu sehen, wofür er sich entschieden hat. Als Merkmal
                 * und nicht als Klasse, damit auch ein Test danach greifen
                 * kann; die Gestaltung hängt in der CSS daran.
                 */
                data-gedrueckt={gedrueckt === a.id ? 'ja' : undefined}
                disabled={a.gesperrt || !a.onKlick}
                onClick={a.onKlick}
              >
                {a.text}
              </button>
            ))}
            <button type="button" className={styles.schliessen} onClick={onSchliessen}>
              {aktionen?.length ? tk.weglegen : tk.schliessen}
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

/** Die Zeile über dem Namen, wenn es kein Grundstück ist. */
function feldArt(t: Texte, feld: BrettFeld): string {
  const art = t.schuetzenopoly.karte.feldArt
  switch (feld.typ) {
    case 'start':
      return art.start
    case 'strafbank':
    case 'zur_strafbank':
      return art.strafbank
    case 'freies_fest':
      return art.freies_fest
    case 'ereignis':
      return art.ereignis
    case 'vereinskarte':
      return art.vereinskarte
    case 'minispiel':
      return art.minispiel
    case 'sonderfeld':
      // Die vier Umzüge stehen an der Stelle, an der klassische Bretter
      // Bahnhöfe haben. "Feld" stand hier vorher, und das sagt nichts.
      return art.sonderfeld
    case 'verband':
      return art.verband
    default:
      return art.feld
  }
}

function beschreibeSonderfeld(t: Texte, feld: BrettFeld): string {
  const text = t.schuetzenopoly.karte.beschreibung
  switch (feld.typ) {
    case 'start':
    case 'strafbank':
    case 'freies_fest':
    case 'zur_strafbank':
    case 'ereignis':
    case 'vereinskarte':
    case 'minispiel':
      return text[feld.typ]
    default:
      return ''
  }
}
