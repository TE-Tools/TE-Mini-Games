/**
 * Zwei kleine Tafeln, die nur zeitweise auftauchen: das Bauen am Zugende
 * und die Auswahl, die manche Vereinskarten verlangen.
 */

import {
  AUSBAU_NAMEN,
  besitzVon,
  feldName,
  grundstueck,
  gruppe,
  istGrundstueck,
  kannBauen,
  rueckkaufwert,
  baukosten,
  kaufpreis,
  tauschKandidaten,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import styles from './Aktionen.module.css'

/* ------------------------------------------------------------------ Bauen */

interface BauPanelProps {
  zustand: SpielZustand
  spielerId: string
  onBauen: (feldId: string) => void
  onAbreissen: (feldId: string) => void
  onVerkaufen: (feldId: string) => void
  onSchliessen: () => void
}

export function BauPanel({
  zustand,
  spielerId,
  onBauen,
  onAbreissen,
  onVerkaufen,
  onSchliessen,
}: BauPanelProps) {
  const eigene = besitzVon(zustand, spielerId)

  return (
    <div className={styles.hintergrund} onClick={onSchliessen} role="presentation">
      <div
        className={styles.tafel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Bauen und verkaufen"
      >
        <h3 className={styles.titel}>🏗️ Dein Besitz</h3>
        {eigene.length === 0 && <p className={styles.leer}>Du besitzt noch nichts.</p>}

        <ul className={styles.liste}>
          {eigene.map((b) => {
            const g = grundstueck(b.feldId)
            const pruefung = istGrundstueck(b.feldId)
              ? kannBauen(zustand, spielerId, b.feldId)
              : { erlaubt: false, grund: 'Kein Grundstück', kosten: 0 }
            return (
              <li key={b.feldId} className={styles.eintrag}>
                <div className={styles.zeile}>
                  {g && (
                    <span
                      className={styles.punkt}
                      style={{ background: gruppe(g.gruppe)?.farbe }}
                      aria-hidden="true"
                    />
                  )}
                  <span className={styles.feldName}>{feldName(b.feldId)}</span>
                  <span className={styles.stufe}>
                    {istGrundstueck(b.feldId) ? AUSBAU_NAMEN[b.stufe] : 'Sonderfeld'}
                  </span>
                </div>
                <div className={styles.knoepfe}>
                  {istGrundstueck(b.feldId) && (
                    <button
                      type="button"
                      className={styles.bauen}
                      disabled={!pruefung.erlaubt}
                      onClick={() => onBauen(b.feldId)}
                      title={pruefung.grund}
                    >
                      Bauen · {pruefung.kosten.toLocaleString('de-DE')} 🪙
                    </button>
                  )}
                  {istGrundstueck(b.feldId) && b.stufe > 0 && (
                    <button
                      type="button"
                      className={styles.zurueckbauen}
                      onClick={() => onAbreissen(b.feldId)}
                    >
                      Rückbau · +{rueckkaufwert(baukosten(b.feldId)).toLocaleString('de-DE')} 🪙
                    </button>
                  )}
                  {b.stufe === 0 && (
                    <button
                      type="button"
                      className={styles.zurueckbauen}
                      onClick={() => onVerkaufen(b.feldId)}
                    >
                      Verkauf · +{rueckkaufwert(kaufpreis(b.feldId)).toLocaleString('de-DE')} 🪙
                    </button>
                  )}
                </div>
                {istGrundstueck(b.feldId) && !pruefung.erlaubt && pruefung.grund && (
                  <p className={styles.grund}>{pruefung.grund}</p>
                )}
              </li>
            )
          })}
        </ul>

        <button type="button" className={styles.fertig} onClick={onSchliessen}>
          Fertig
        </button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Wahlen */

interface WahlPanelProps {
  zustand: SpielZustand
  spielerId: string
  onBaustopp: (gegnerId: string) => void
  onSchutz: (feldId: string) => void
  onTausch: (meinFeldId: string, fremdFeldId: string) => void
  onUeberspringen: () => void
}

export function WahlPanel({
  zustand,
  spielerId,
  onBaustopp,
  onSchutz,
  onTausch,
  onUeberspringen,
}: WahlPanelProps) {
  const wahl = zustand.offeneWahl
  if (!wahl) return null

  return (
    <div className={styles.hintergrund} role="presentation">
      <div className={styles.tafel} role="dialog" aria-label="Karte: Auswahl">
        {wahl.art === 'baustopp' && (
          <>
            <h3 className={styles.titel}>🚧 Wen trifft der Baustopp?</h3>
            <ul className={styles.liste}>
              {zustand.spieler
                .filter((s) => s.id !== spielerId && !s.insolvent)
                .map((s) => (
                  <li key={s.id}>
                    <button type="button" className={styles.wahlKnopf} onClick={() => onBaustopp(s.id)}>
                      {s.name}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        {wahl.art === 'schutz' && (
          <>
            <h3 className={styles.titel}>🛡️ Welches Grundstück schützen?</h3>
            <ul className={styles.liste}>
              {besitzVon(zustand, spielerId)
                .filter((b) => istGrundstueck(b.feldId))
                .map((b) => (
                  <li key={b.feldId}>
                    <button
                      type="button"
                      className={styles.wahlKnopf}
                      onClick={() => onSchutz(b.feldId)}
                    >
                      {feldName(b.feldId)}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        {wahl.art === 'tausch' && (
          <>
            <h3 className={styles.titel}>🔄 Welchen Tausch?</h3>
            <ul className={styles.liste}>
              {tauschKandidaten(zustand, spielerId)
                .slice(0, 10)
                .map((p) => (
                  <li key={`${p.meinFeldId}-${p.fremdFeldId}`}>
                    <button
                      type="button"
                      className={styles.wahlKnopf}
                      onClick={() => onTausch(p.meinFeldId, p.fremdFeldId)}
                    >
                      {feldName(p.meinFeldId)} → {feldName(p.fremdFeldId)}
                      {p.ausgleich !== 0 && (
                        <small>
                          {p.ausgleich > 0
                            ? ` (du zahlst ${p.ausgleich} 🪙)`
                            : ` (du erhältst ${-p.ausgleich} 🪙)`}
                        </small>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        <button type="button" className={styles.fertig} onClick={onUeberspringen}>
          Verfallen lassen
        </button>
      </div>
    </div>
  )
}
