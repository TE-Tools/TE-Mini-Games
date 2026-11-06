/**
 * Zwei kleine Tafeln, die nur zeitweise auftauchen: das Bauen am Zugende
 * und die Auswahl, die manche Vereinskarten verlangen.
 */

import {
  besitzVon,
  grundstueck,
  gruppe,
  istGrundstueck,
  kannBauen,
  rueckkaufwert,
  baukosten,
  kaufpreis,
  tauschKandidaten,
  type BauPruefung,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import { useSprache } from '@/i18n/sprache'
import { ausbauName, feldNameIn } from './texte'
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
  const { t, sprache } = useSprache()
  const ta = t.schuetzenopoly.aktionen
  const eigene = besitzVon(zustand, spielerId)

  return (
    <div className={styles.hintergrund} onClick={onSchliessen} role="presentation">
      <div
        className={styles.tafel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={ta.bauenLabel}
      >
        <h3 className={styles.titel}>{ta.deinBesitz}</h3>
        {eigene.length === 0 && <p className={styles.leer}>{ta.nichts}</p>}

        <ul className={styles.liste}>
          {eigene.map((b) => {
            const g = grundstueck(b.feldId)
            const pruefung: BauPruefung = istGrundstueck(b.feldId)
              ? kannBauen(zustand, spielerId, b.feldId)
              : { erlaubt: false, grund: ta.keinGrundstueck, kosten: 0 }
            // Der Grund kommt als Kennung; der deutsche Satz der Engine ist nur der Rückfall.
            const grund = pruefung.code ? ta.bauGrund[pruefung.code] : pruefung.grund
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
                  <span className={styles.feldName}>{feldNameIn(t, b.feldId)}</span>
                  <span className={styles.stufe}>
                    {istGrundstueck(b.feldId) ? ausbauName(t, b.stufe) : ta.sonderfeld}
                  </span>
                </div>
                <div className={styles.knoepfe}>
                  {istGrundstueck(b.feldId) && (
                    <button
                      type="button"
                      className={styles.bauen}
                      disabled={!pruefung.erlaubt}
                      onClick={() => onBauen(b.feldId)}
                      title={grund}
                    >
                      {ta.bauen(pruefung.kosten.toLocaleString(sprache))}
                    </button>
                  )}
                  {istGrundstueck(b.feldId) && b.stufe > 0 && (
                    <button
                      type="button"
                      className={styles.zurueckbauen}
                      onClick={() => onAbreissen(b.feldId)}
                    >
                      {ta.rueckbau(rueckkaufwert(baukosten(b.feldId)).toLocaleString(sprache))}
                    </button>
                  )}
                  {b.stufe === 0 && (
                    <button
                      type="button"
                      className={styles.zurueckbauen}
                      onClick={() => onVerkaufen(b.feldId)}
                    >
                      {ta.verkauf(rueckkaufwert(kaufpreis(b.feldId)).toLocaleString(sprache))}
                    </button>
                  )}
                </div>
                {istGrundstueck(b.feldId) && !pruefung.erlaubt && grund && (
                  <p className={styles.grund}>{grund}</p>
                )}
              </li>
            )
          })}
        </ul>

        <button type="button" className={styles.fertig} onClick={onSchliessen}>
          {ta.fertig}
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
  const { t, sprache } = useSprache()
  const ta = t.schuetzenopoly.aktionen
  const wahl = zustand.offeneWahl
  if (!wahl) return null

  return (
    <div className={styles.hintergrund} role="presentation">
      <div className={styles.tafel} role="dialog" aria-label={ta.wahlLabel}>
        {wahl.art === 'baustopp' && (
          <>
            <h3 className={styles.titel}>{ta.wenBaustopp}</h3>
            <ul className={styles.liste}>
              {zustand.spieler
                .filter((s) => s.id !== spielerId && !s.insolvent)
                .map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={styles.wahlKnopf}
                      onClick={() => onBaustopp(s.id)}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        {wahl.art === 'schutz' && (
          <>
            <h3 className={styles.titel}>{ta.welchesSchuetzen}</h3>
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
                      {feldNameIn(t, b.feldId)}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        {wahl.art === 'tausch' && (
          <>
            <h3 className={styles.titel}>{ta.welcherTausch}</h3>
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
                      {feldNameIn(t, p.meinFeldId)} → {feldNameIn(t, p.fremdFeldId)}
                      {p.ausgleich !== 0 && (
                        <small>
                          {' '}
                          {p.ausgleich > 0
                            ? ta.duZahlst(p.ausgleich.toLocaleString(sprache))
                            : ta.duErhaeltst((-p.ausgleich).toLocaleString(sprache))}
                        </small>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        <button type="button" className={styles.fertig} onClick={onUeberspringen}>
          {ta.verfallen}
        </button>
      </div>
    </div>
  )
}
