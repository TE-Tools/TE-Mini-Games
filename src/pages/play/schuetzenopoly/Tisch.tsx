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
  STRAFBANK_MAX_VERSUCHE,
  aktiverSpieler,
  besitzVon,
  figur,
  handkarten,
  rolle as rolleMit,
  rollenBonus,
  type OnlineAktion,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import { useSprache } from '@/i18n/sprache'
import { karteText, protokollZeile, rollenText } from './texte'
import styles from '../SchuetzenopolyPage.module.css'

/** Die Kacheln der Mitspieler: Farbe, Geld, Besitz. */
export function SpielerLeiste({ zustand }: { zustand: SpielZustand }) {
  const { t, sprache } = useSprache()
  const tx = t.schuetzenopoly.tisch
  const aktiv = aktiverSpieler(zustand)
  return (
    <ul className={styles.spielerLeiste} aria-label={tx.mitspieler}>
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
            {s.insolvent ? tx.raus : `${s.taler.toLocaleString(sprache)} 🪙`}
          </span>
          <span className={styles.spielerBesitz}>
            {tx.felder(besitzVon(zustand, s.id).length)}
            {s.aufStrafbank && ' · 🚧'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Die Mitte des Bretts: Würfel und wer gerade dran ist. */
export function BrettMitte({ zustand }: { zustand: SpielZustand }) {
  const { t, sprache } = useSprache()
  const aktiv = aktiverSpieler(zustand)
  return (
    <>
      <p className={styles.mitteName}>
        <span aria-hidden="true">{figur(aktiv.figurId).icon}</span> {aktiv.name}
      </p>
      <div
        key={zustand.wuerfel ? zustand.wuerfel.join('-') + '-' + zustand.runde : 'leer'}
        className={styles.wuerfelPaar}
        role="img"
        aria-label={t.schuetzenopoly.tisch.wuerfel}
      >
        <span className={styles.wuerfel}>{zustand.wuerfel ? augen(zustand.wuerfel[0]) : '·'}</span>
        <span className={styles.wuerfel}>{zustand.wuerfel ? augen(zustand.wuerfel[1]) : '·'}</span>
      </div>
      <p className={styles.mitteGeld}>{aktiv.taler.toLocaleString(sprache)} 🪙</p>
      <p className={styles.mitteRunde}>
        {t.schuetzenopoly.tisch.runde(zustand.runde, zustand.rundenLimit)}
      </p>
    </>
  )
}

/** Die letzten drei Zeilen aus dem Spielprotokoll. */
export function Protokoll({ zustand }: { zustand: SpielZustand }) {
  const { t, sprache } = useSprache()
  return (
    <div className={styles.protokoll} aria-live="polite">
      {zustand.protokoll.slice(-3).map((eintrag, i) => (
        <p key={`${zustand.protokoll.length}-${i}`} className={styles.logZeile}>
          {protokollZeile(t, sprache, eintrag)}
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
  const { t, sprache } = useSprache()
  const tx = t.schuetzenopoly.tisch
  const aktiv = aktiverSpieler(zustand)
  const bonus = rollenBonus(aktiv.rolle)
  const rollenDaten = rollenText(t, aktiv.rolle)
  const rollenIcon = rolleMit(aktiv.rolle).icon
  const meineHandkarten = handkarten(zustand, aktiv.id)
  const offeneKarte = zustand.offeneKarte ? karteText(t, zustand.offeneKarte) : null

  return (
    <div className={styles.leiste}>
      {!darfZiehen && <p className={styles.wartet}>{tx.istAmZug(aktiv.name)}</p>}

      {darfZiehen && zustand.phase === 'wuerfeln' && (
        <>
          {aktiv.aufStrafbank && (
            <p className={styles.hinweisZeile}>
              {tx.aufDerStrafbank(aktiv.strafbankVersuche + 1, STRAFBANK_MAX_VERSUCHE)}
            </p>
          )}
          <button
            type="button"
            className={styles.hauptKnopf}
            onClick={() => onAktion({ art: 'wuerfeln' })}
          >
            {tx.wuerfeln}
          </button>
          {aktiv.aufStrafbank && (
            <div className={styles.nebenKnoepfe}>
              {meineHandkarten.some((k) => k.wirkung.art === 'freikarte') && (
                <button
                  type="button"
                  className={styles.nebenKnopf}
                  onClick={() => onAktion({ art: 'freikarte' })}
                >
                  {tx.fuersprache}
                </button>
              )}
              <button
                type="button"
                className={styles.nebenKnopf}
                disabled={aktiv.taler < STRAFBANK_GEBUEHR}
                onClick={() => onAktion({ art: 'strafbank_frei' })}
              >
                {tx.freikaufen(STRAFBANK_GEBUEHR.toLocaleString(sprache))}
              </button>
            </div>
          )}
          {bonus.koenigsaktion && !aktiv.koenigsaktionGenutzt && (
            <button
              type="button"
              className={styles.nebenKnopf}
              onClick={() => onAktion({ art: 'koenigsaktion' })}
            >
              {tx.koenigsaktion(bonus.koenigsaktion.toLocaleString(sprache))}
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
            {tx.nochFrei(zustand.kaufAngebot.preis.toLocaleString(sprache))}
          </p>
          <button type="button" className={styles.hauptKnopf} onClick={onKarteAnsehen}>
            {tx.karteAnsehen}
          </button>
        </>
      )}

      {darfZiehen && zustand.offeneKarte && offeneKarte && (
        <div className={styles.karte}>
          <p className={styles.karteTitel}>
            <span aria-hidden="true">{zustand.offeneKarte.icon}</span> {offeneKarte.titel}
          </p>
          <p className={styles.karteText}>{offeneKarte.text}</p>
          <div className={styles.nebenKnoepfe}>
            <button
              type="button"
              className={styles.hauptKnopf}
              onClick={() => onAktion({ art: 'karte' })}
            >
              {tx.weiter}
            </button>
            {bonus.karteNeuJePartie && !aktiv.karteNeuGenutzt && (
              <button
                type="button"
                className={styles.nebenKnopf}
                onClick={() => onAktion({ art: 'karte_neu' })}
              >
                {tx.neuZiehen}
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
                {tx.bauen}
              </button>
            )}
            {onHandeln && (
              <button type="button" className={styles.nebenKnopf} onClick={onHandeln}>
                {tx.handeln}
              </button>
            )}
            {bonus.duellJePartie && !aktiv.duellGenutzt && (
              <button
                type="button"
                className={styles.nebenKnopf}
                onClick={() => onAktion({ art: 'duell' })}
              >
                {tx.duell}
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.hauptKnopf}
            onClick={() => onAktion({ art: 'zug_ende' })}
          >
            {zustand.paschSerie > 0 ? tx.paschNochmal : tx.zugBeenden}
          </button>
        </>
      )}

      <p className={styles.rollenZeile}>
        {rollenIcon} {rollenDaten.name}: {rollenDaten.beschreibung}
      </p>
    </div>
  )
}

const AUGEN = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
function augen(wert: number): string {
  return AUGEN[wert - 1] ?? '·'
}
