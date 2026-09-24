/**
 * Was am Tisch immer gleich aussieht -- ob gegen den Rechner oder online.
 *
 * Anlass (24.09.2026): Mit dem Online-Modus gäbe es die Handlungsleiste
 * zweimal, und damit zweimal die Antwort auf die Frage "was kann ich gerade
 * tun". Eine davon wäre über kurz oder lang falsch. Also steht sie hier
 * einmal, und beide Seiten reichen nur herein, was passieren soll.
 *
 * Die Leiste kennt keine Regel: Sie liest den Zustand und meldet eine
 * Absicht als `OnlineAktion` zurück. Was daraus wird, entscheidet die Seite
 * -- offline die Engine, online der Server mit dem Zugbuch. Genau dieselbe
 * Liste von Absichten steht im Zugbuch, und das ist kein Zufall: Es ist die
 * vollständige Aufzählung dessen, was ein Mensch in diesem Spiel tun kann.
 */

import {
  STRAFBANK_GEBUEHR,
  aktiverSpieler,
  besitzVon,
  figur,
  handkarten,
  rolle as rolleMit,
  rollenBonus,
  type OnlineAktion,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import styles from '../SchuetzenopolyPage.module.css'

/** Die Kacheln der Mitspieler: Farbe, Geld, Besitz. */
export function SpielerLeiste({ zustand }: { zustand: SpielZustand }) {
  const aktiv = aktiverSpieler(zustand)
  return (
    <ul className={styles.spielerLeiste} aria-label="Mitspieler">
      {zustand.spieler.map((s) => (
        <li
          key={s.id}
          className={`${styles.spielerKachel} ${s.id === aktiv.id ? styles.amZug : ''} ${
            s.insolvent ? styles.raus : ''
          }`}
          style={{ borderColor: figur(s.figurId).farbe }}
        >
          <span className={styles.spielerKopf}>
            <span aria-hidden="true">{figur(s.figurId).icon}</span> {s.name}
            {s.typ === 'ki' && <small className={styles.kiMarke}>🤖</small>}
          </span>
          <span className={styles.spielerGeld}>
            {s.insolvent ? 'raus' : `${s.taler.toLocaleString('de-DE')} 🪙`}
          </span>
          <span className={styles.spielerBesitz}>
            {besitzVon(zustand, s.id).length} Felder
            {s.aufStrafbank && ' · 🚧'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Die Mitte des Bretts: Würfel und wer gerade dran ist. */
export function BrettMitte({ zustand }: { zustand: SpielZustand }) {
  const aktiv = aktiverSpieler(zustand)
  return (
    <>
      <p className={styles.mitteName}>
        <span aria-hidden="true">{figur(aktiv.figurId).icon}</span> {aktiv.name}
      </p>
      <div className={styles.wuerfelPaar} aria-label="Würfel">
        <span className={styles.wuerfel}>{zustand.wuerfel ? augen(zustand.wuerfel[0]) : '·'}</span>
        <span className={styles.wuerfel}>{zustand.wuerfel ? augen(zustand.wuerfel[1]) : '·'}</span>
      </div>
      <p className={styles.mitteGeld}>{aktiv.taler.toLocaleString('de-DE')} 🪙</p>
      <p className={styles.mitteRunde}>
        Runde {zustand.runde} von {zustand.rundenLimit}
      </p>
    </>
  )
}

/** Die letzten drei Zeilen aus dem Spielprotokoll. */
export function Protokoll({ zustand }: { zustand: SpielZustand }) {
  return (
    <div className={styles.protokoll} aria-live="polite">
      {zustand.protokoll.slice(-3).map((eintrag, i) => (
        <p key={`${zustand.protokoll.length}-${i}`} className={styles.logZeile}>
          {eintrag.text}
        </p>
      ))}
    </div>
  )
}

interface LeisteProps {
  zustand: SpielZustand
  /** Darf ich gerade handeln? Offline: ein Mensch ist dran. Online: ich bin es. */
  darfZiehen: boolean
  onAktion: (aktion: OnlineAktion) => void
  /** Liegt die Besitzkarte schon vor? Dann führt hier kein zweiter Weg hin. */
  karteOffen?: boolean
  onKarteAnsehen?: () => void
  onBauen?: () => void
  /** Fehlt online: Ein Handel braucht ein Gegenüber, das antworten kann. */
  onHandeln?: () => void
}

export function Handlungsleiste({
  zustand,
  darfZiehen,
  onAktion,
  karteOffen,
  onKarteAnsehen,
  onBauen,
  onHandeln,
}: LeisteProps) {
  const aktiv = aktiverSpieler(zustand)
  const bonus = rollenBonus(aktiv.rolle)
  const rollenDaten = rolleMit(aktiv.rolle)
  const meineHandkarten = handkarten(zustand, aktiv.id)

  return (
    <div className={styles.leiste}>
      {!darfZiehen && <p className={styles.wartet}>{aktiv.name} ist am Zug…</p>}

      {darfZiehen && zustand.phase === 'wuerfeln' && (
        <>
          {aktiv.aufStrafbank && (
            <p className={styles.hinweisZeile}>
              Du sitzt auf der Strafbank (Versuch {aktiv.strafbankVersuche + 1} von 3). Ein Pasch
              bringt dich frei.
            </p>
          )}
          <button
            type="button"
            className={styles.hauptKnopf}
            onClick={() => onAktion({ art: 'wuerfeln' })}
          >
            🎲 Würfeln
          </button>
          {aktiv.aufStrafbank && (
            <div className={styles.nebenKnoepfe}>
              {meineHandkarten.some((k) => k.wirkung.art === 'freikarte') && (
                <button
                  type="button"
                  className={styles.nebenKnopf}
                  onClick={() => onAktion({ art: 'freikarte' })}
                >
                  🎫 Fürsprache einsetzen
                </button>
              )}
              <button
                type="button"
                className={styles.nebenKnopf}
                disabled={aktiv.taler < STRAFBANK_GEBUEHR}
                onClick={() => onAktion({ art: 'strafbank_frei' })}
              >
                Freikaufen · {STRAFBANK_GEBUEHR} 🪙
              </button>
            </div>
          )}
          {bonus.koenigsaktion && !aktiv.koenigsaktionGenutzt && (
            <button
              type="button"
              className={styles.nebenKnopf}
              onClick={() => onAktion({ art: 'koenigsaktion' })}
            >
              👑 Königsaktion · +{bonus.koenigsaktion} 🪙
            </button>
          )}
        </>
      )}

      {/*
        Gekauft wird auf der Karte, nicht hier.

        Vorher standen Preis und Knöpfe in dieser Leiste, und die Karte mit
        den Gebühren war ein eigener Dialog daneben -- man entschied über
        etwas, das man gerade nicht sah. Jetzt trägt die Karte beides. Bleibt
        hier nur der Weg zurück, falls sie weggelegt wurde.
      */}
      {darfZiehen && zustand.phase === 'feld' && zustand.kaufAngebot && !karteOffen && (
        <>
          <p className={styles.hinweisZeile}>
            Noch frei – {zustand.kaufAngebot.preis.toLocaleString('de-DE')} 🪙
          </p>
          <button type="button" className={styles.hauptKnopf} onClick={onKarteAnsehen}>
            🪪 Karte ansehen
          </button>
        </>
      )}

      {darfZiehen && zustand.offeneKarte && (
        <div className={styles.karte}>
          <p className={styles.karteTitel}>
            <span aria-hidden="true">{zustand.offeneKarte.icon}</span> {zustand.offeneKarte.titel}
          </p>
          <p className={styles.karteText}>{zustand.offeneKarte.text}</p>
          <div className={styles.nebenKnoepfe}>
            <button
              type="button"
              className={styles.hauptKnopf}
              onClick={() => onAktion({ art: 'karte' })}
            >
              Weiter
            </button>
            {bonus.karteNeuJePartie && !aktiv.karteNeuGenutzt && (
              <button
                type="button"
                className={styles.nebenKnopf}
                onClick={() => onAktion({ art: 'karte_neu' })}
              >
                🃏 Neu ziehen
              </button>
            )}
          </div>
        </div>
      )}

      {darfZiehen && zustand.phase === 'zug_ende' && !zustand.offeneKarte && (
        <>
          <div className={styles.nebenKnoepfe}>
            {onBauen && (
              <button type="button" className={styles.nebenKnopf} onClick={onBauen}>
                🏗️ Bauen
              </button>
            )}
            {onHandeln && (
              <button type="button" className={styles.nebenKnopf} onClick={onHandeln}>
                🤝 Handeln
              </button>
            )}
            {bonus.duellJePartie && !aktiv.duellGenutzt && (
              <button
                type="button"
                className={styles.nebenKnopf}
                onClick={() => onAktion({ art: 'duell' })}
              >
                ⚔️ Duell
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.hauptKnopf}
            onClick={() => onAktion({ art: 'zug_ende' })}
          >
            {zustand.paschSerie > 0 ? 'Pasch – noch mal würfeln' : 'Zug beenden'}
          </button>
        </>
      )}

      <p className={styles.rollenZeile}>
        {rollenDaten.icon} {rollenDaten.name}: {rollenDaten.beschreibung}
      </p>
    </div>
  )
}

const AUGEN = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function augen(wert: number): string {
  return AUGEN[wert - 1] ?? '·'
}
