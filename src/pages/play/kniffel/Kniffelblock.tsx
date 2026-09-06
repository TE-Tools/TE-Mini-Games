/**
 * Der Block.
 *
 * Links die dreizehn Felder, rechts je eine Spalte pro Mitspieler. Wer am
 * Zug ist, sieht in seiner Spalte, was der aktuelle Wurf in jedem freien
 * Feld brächte -- blass, damit man Vorschlag und Eingetragenes nicht
 * verwechselt. Antippen trägt ein.
 *
 * Auf dem Handy ist die Namensspalte festgepinnt und der Rest scrollt
 * seitwärts; bei vier Mitspielern passt sonst nichts mehr auf den Schirm.
 */

import {
  BONUS_GRENZE,
  BONUS_PUNKTE,
  KATEGORIEN,
  bisZumBonus,
  bonusErreicht,
  gesamtpunkte,
  obenSumme,
  untenSumme,
  punkteFuer,
  type Block,
  type KategorieId,
} from '@/games/kniffel'
import styles from './Kniffelblock.module.css'

export interface BlockSpalte {
  id: string
  name: string
  block: Block
  /** Ist das die Spalte des Geräts, an dem gerade jemand sitzt? */
  ichSelbst: boolean
  amZug: boolean
}

interface KniffelblockProps {
  spalten: BlockSpalte[]
  /** Der aktuelle Wurf -- für die Vorschau. Leer, solange nicht gewürfelt. */
  wuerfel: readonly number[]
  /** Darf gerade eingetragen werden? */
  eintragbar: boolean
  onEintragen: (feld: KategorieId) => void
}

export function Kniffelblock({
  spalten,
  wuerfel,
  eintragbar,
  onEintragen,
}: KniffelblockProps) {
  const gewuerfelt = wuerfel.some((w) => w > 0)
  const zeilenProps = { spalten, wuerfel, gewuerfelt, eintragbar, onEintragen }

  /*
   * Zwei Tabellen statt einer -- so, wie ein Kniffelblock auf Papier auch
   * aufgebaut ist: oben die Zahlen, unten die Kombinationen. Auf breiten
   * Schirmen stehen sie nebeneinander, auf dem Handy untereinander. Als
   * eine einzige Tabelle liesse sich das nicht aufteilen.
   */
  return (
    /*
     * Wie viele Mitspieler in den Tabellen stehen, entscheidet mit, ab
     * wann die beiden Hälften nebeneinander passen: Bei vier Spalten
     * braucht jede Hälfte fast doppelt so viel Platz wie bei einer.
     * Ohne das wurde die letzte Spalte abgeschnitten.
     */
    <div className={styles.rahmen} data-spalten={Math.min(spalten.length, 4)}>
      <div className={styles.haelfte}>
        <div className={styles.huelle}>
          <table className={styles.block}>
            <caption className={styles.blockTitel}>Oberer Block</caption>
            <Kopfzeile spalten={spalten} />
            <tbody>
              {KATEGORIEN.filter((k) => k.teil === 'oben').map((k) => (
                <Zeile key={k.id} feld={k.id} name={k.name} kurz={k.kurz} {...zeilenProps} />
              ))}

              <tr className={styles.summeZeile}>
                <th scope="row" className={styles.summeName}>
                  Zwischensumme
                </th>
                {spalten.map((sp) => (
                  <td key={sp.id} className={styles.summeWert}>
                    {obenSumme(sp.block)}
                  </td>
                ))}
              </tr>

              <tr className={styles.bonusZeile}>
                <th scope="row" className={styles.summeName}>
                  Bonus ab {BONUS_GRENZE}
                  <span className={styles.kurz}>{BONUS_PUNKTE} Punkte</span>
                </th>
                {spalten.map((sp) => (
                  <td key={sp.id} className={styles.summeWert}>
                    {bonusErreicht(sp.block) ? (
                      <strong className={styles.bonusDa}>+{BONUS_PUNKTE}</strong>
                    ) : (
                      <span className={styles.bonusFehlt}>noch {bisZumBonus(sp.block)}</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.haelfte}>
        <div className={styles.huelle}>
          <table className={styles.block}>
            <caption className={styles.blockTitel}>Unterer Block</caption>
            <Kopfzeile spalten={spalten} />
            <tbody>
              {KATEGORIEN.filter((k) => k.teil === 'unten').map((k) => (
                <Zeile key={k.id} feld={k.id} name={k.name} kurz={k.kurz} {...zeilenProps} />
              ))}

              <tr className={styles.summeZeile}>
                <th scope="row" className={styles.summeName}>
                  Zwischensumme
                </th>
                {spalten.map((sp) => (
                  <td key={sp.id} className={styles.summeWert}>
                    {untenSumme(sp.block)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Die Endsumme steht unter beiden Haelften -- sie gehoert zu keiner. */}
      <div className={styles.gesamt}>
        <span className={styles.gesamtName}>Gesamt</span>
        <div className={styles.gesamtWerte}>
          {spalten.map((sp) => (
            <span key={sp.id} className={styles.gesamtWert}>
              <span className={styles.gesamtSpieler}>{sp.name}</span>
              {gesamtpunkte(sp.block)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Kopfzeile({ spalten }: { spalten: BlockSpalte[] }) {
  return (
    <thead>
      <tr>
        <th scope="col" className={styles.ecke}>
          Feld
        </th>
        {spalten.map((sp) => (
          <th
            key={sp.id}
            scope="col"
            className={`${styles.kopf} ${sp.amZug ? styles.kopfAmZug : ''}`}
          >
            {sp.name}
          </th>
        ))}
      </tr>
    </thead>
  )
}

interface ZeileProps {
  feld: KategorieId
  name: string
  kurz: string
  spalten: BlockSpalte[]
  wuerfel: readonly number[]
  gewuerfelt: boolean
  eintragbar: boolean
  onEintragen: (feld: KategorieId) => void
}

function Zeile({
  feld,
  name,
  kurz,
  spalten,
  wuerfel,
  gewuerfelt,
  eintragbar,
  onEintragen,
}: ZeileProps) {
  return (
    <tr>
      <th scope="row" className={styles.feldName}>
        {name}
        <span className={styles.kurz}>{kurz}</span>
      </th>
      {spalten.map((s) => {
        const eingetragen = s.block[feld]
        if (eingetragen !== null) {
          return (
            <td key={s.id} className={eingetragen === 0 ? styles.gestrichen : styles.wert}>
              {eingetragen === 0 ? '–' : eingetragen}
            </td>
          )
        }

        // Vorschau nur in der eigenen Spalte, und nur nach einem Wurf.
        const zeigeVorschau = s.amZug && s.ichSelbst && gewuerfelt
        if (!zeigeVorschau) return <td key={s.id} className={styles.frei} />

        const punkte = punkteFuer(feld, wuerfel)
        return (
          <td key={s.id} className={styles.frei}>
            <button
              type="button"
              className={punkte > 0 ? styles.vorschlag : styles.vorschlagNull}
              onClick={() => onEintragen(feld)}
              disabled={!eintragbar}
              aria-label={`${name} mit ${punkte} Punkten eintragen`}
            >
              {punkte}
            </button>
          </td>
        )
      })}
    </tr>
  )
}
