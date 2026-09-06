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

  return (
    <div className={styles.huelle}>
      <table className={styles.block}>
        <thead>
          <tr>
            <th scope="col" className={styles.ecke}>
              Block
            </th>
            {spalten.map((s) => (
              <th
                key={s.id}
                scope="col"
                className={`${styles.kopf} ${s.amZug ? styles.kopfAmZug : ''}`}
              >
                {s.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {KATEGORIEN.filter((k) => k.teil === 'oben').map((k) => (
            <Zeile
              key={k.id}
              feld={k.id}
              name={k.name}
              kurz={k.kurz}
              spalten={spalten}
              wuerfel={wuerfel}
              gewuerfelt={gewuerfelt}
              eintragbar={eintragbar}
              onEintragen={onEintragen}
            />
          ))}

          <tr className={styles.summeZeile}>
            <th scope="row" className={styles.summeName}>
              Zwischensumme
            </th>
            {spalten.map((s) => (
              <td key={s.id} className={styles.summeWert}>
                {obenSumme(s.block)}
              </td>
            ))}
          </tr>

          <tr className={styles.bonusZeile}>
            <th scope="row" className={styles.summeName}>
              Bonus ab {BONUS_GRENZE}
              <span className={styles.kurz}>{BONUS_PUNKTE} Punkte</span>
            </th>
            {spalten.map((s) => (
              <td key={s.id} className={styles.summeWert}>
                {bonusErreicht(s.block) ? (
                  <strong className={styles.bonusDa}>+{BONUS_PUNKTE}</strong>
                ) : (
                  <span className={styles.bonusFehlt}>noch {bisZumBonus(s.block)}</span>
                )}
              </td>
            ))}
          </tr>

          {KATEGORIEN.filter((k) => k.teil === 'unten').map((k) => (
            <Zeile
              key={k.id}
              feld={k.id}
              name={k.name}
              kurz={k.kurz}
              spalten={spalten}
              wuerfel={wuerfel}
              gewuerfelt={gewuerfelt}
              eintragbar={eintragbar}
              onEintragen={onEintragen}
            />
          ))}

          <tr className={styles.summeZeile}>
            <th scope="row" className={styles.summeName}>
              Unterer Block
            </th>
            {spalten.map((s) => (
              <td key={s.id} className={styles.summeWert}>
                {untenSumme(s.block)}
              </td>
            ))}
          </tr>
        </tbody>

        <tfoot>
          <tr className={styles.gesamtZeile}>
            <th scope="row" className={styles.summeName}>
              Gesamt
            </th>
            {spalten.map((s) => (
              <td key={s.id} className={styles.gesamtWert}>
                {gesamtpunkte(s.block)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
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
