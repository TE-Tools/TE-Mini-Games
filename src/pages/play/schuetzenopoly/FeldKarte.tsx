/**
 * Die Feldkarte: alles, was auf dem winzigen Brettfeld keinen Platz hat --
 * Veranstaltung, Gruppe, Preis, Gebührenstaffel, Besitzer, Ausbau.
 *
 * Hier steht auch der recherchierte Satz zur echten Veranstaltung. Wer
 * spielt, soll nebenbei etwas über die Feste erfahren; wer nachschlägt,
 * soll nichts Falsches finden.
 */

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
  onSchliessen: () => void
}

const ART_TEXT: Record<string, string> = {
  schuetzenfest: 'Schützenfest',
  kirmes: 'Kirmes',
  umzug: 'Umzug',
  volksfest: 'Volksfest',
}

export function FeldKarte({ feld, zustand, onSchliessen }: FeldKarteProps) {
  const feldId = feld.grundstueckId
  const besitz = feldId ? zustand.besitz[feldId] : undefined
  const besitzer = besitz?.besitzerId ? spielerMit(zustand, besitz.besitzerId) : null
  const g = feldId ? grundstueck(feldId) : undefined
  const gr = g ? gruppe(g.gruppe) : undefined
  const komplett = feldId && istGrundstueck(feldId) ? gruppeKomplett(zustand, feldId) : false
  const gruppenFaktor = komplett ? (gr?.premium ? GRUPPEN_FAKTOR_PREMIUM : GRUPPEN_FAKTOR) : 1

  return (
    <div className={styles.hintergrund} onClick={onSchliessen} role="presentation">
      <div
        className={styles.karte}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={feld.name}
      >
        {gr && <span className={styles.kopfstreifen} style={{ background: gr.farbe }} />}

        <header className={styles.kopf}>
          <span className={styles.icon} aria-hidden="true">
            {feld.icon}
          </span>
          <div>
            <h3 className={styles.titel}>{g?.veranstaltung ?? feld.name}</h3>
            {g && (
              <p className={styles.unterzeile}>
                {ART_TEXT[g.art] ?? 'Veranstaltung'} · {gr?.name}
              </p>
            )}
          </div>
        </header>

        {g && <p className={styles.fakt}>{g.fakt}</p>}

        {feldId && besitz && (
          <>
            <dl className={styles.werte}>
              <div>
                <dt>Kaufpreis</dt>
                <dd>{kaufpreis(feldId).toLocaleString('de-DE')} 🪙</dd>
              </div>
              {istGrundstueck(feldId) && (
                <div>
                  <dt>Ausbau je Stufe</dt>
                  <dd>{baukosten(feldId).toLocaleString('de-DE')} 🪙</dd>
                </div>
              )}
              <div>
                <dt>Besitzer</dt>
                <dd>{besitzer ? besitzer.name : 'noch frei'}</dd>
              </div>
              {istGrundstueck(feldId) && (
                <div>
                  <dt>Ausbaustufe</dt>
                  <dd>{AUSBAU_NAMEN[besitz.stufe]}</dd>
                </div>
              )}
            </dl>

            {istGrundstueck(feldId) && g && (
              <table className={styles.tabelle}>
                <caption className={styles.tabellenTitel}>
                  Gebühren{komplett ? ' (Gruppe komplett)' : ''}
                </caption>
                <tbody>
                  {AUSBAU_NAMEN.map((name, stufe) => (
                    <tr key={name} className={besitz.stufe === stufe ? styles.aktuell : undefined}>
                      <th scope="row">{name}</th>
                      <td>
                        {Math.round(
                          g.grundgebuehr * AUSBAU_FAKTOR[stufe as 0 | 1 | 2 | 3 | 4] * gruppenFaktor,
                        ).toLocaleString('de-DE')}{' '}
                        🪙
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {istSonderfeld(feldId) && (
              <table className={styles.tabelle}>
                <caption className={styles.tabellenTitel}>Gebühr nach Anzahl im Besitz</caption>
                <tbody>
                  {SONDERFELD_GEBUEHR.slice(1).map((betrag, i) => (
                    <tr key={i}>
                      <th scope="row">
                        {i + 1} Feld{i > 0 ? 'er' : ''}
                      </th>
                      <td>{betrag.toLocaleString('de-DE')} 🪙</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {istVerband(feldId) && (
              <table className={styles.tabelle}>
                <caption className={styles.tabellenTitel}>Gebühr nach Würfelsumme</caption>
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
            )}
          </>
        )}

        {!feldId && <p className={styles.fakt}>{beschreibeSonderfeld(feld)}</p>}

        <button type="button" className={styles.schliessen} onClick={onSchliessen}>
          Schließen
        </button>
      </div>
    </div>
  )
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
