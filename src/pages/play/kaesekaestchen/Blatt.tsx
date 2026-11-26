/**
 * Das Blatt: Punkte, Linien zum Antippen, Kästchen in der Farbe dessen,
 * dem sie gehören.
 *
 * Jede Linie ist ein eigener Knopf mit großer Trefferfläche (gut zwei
 * Drittel einer Kästchenbreite lang, gut die Hälfte breit) -- auf dem
 * Handy trifft man so auch auf dem 6×6-Blatt mit dem Daumen. Die jüngste
 * Linie leuchtet kurz, frisch geschlossene Kästchen springen auf; beides
 * schweigt bei prefers-reduced-motion (Blatt.module.css).
 *
 * Das Blatt entscheidet nichts: Es zeigt die Partie und meldet Tipper.
 */
import type { CSSProperties } from 'react'
import { lageVon, type Partie } from '@/games/kaesekaestchen'
import { useSprache } from '@/i18n/sprache'
import { farbeVon, initiale } from './farben'
import styles from './Blatt.module.css'

interface Props {
  partie: Partie
  /** Namen je Spieler in Zugreihenfolge. */
  namen: readonly string[]
  gesperrt: boolean
  onLinie: (linie: number) => void
}

const prozent = (n: number) => `${(n * 100).toFixed(4)}%`

export function Blatt({ partie, namen, gesperrt, onLinie }: Props) {
  const { t } = useSprache()
  const tk = t.kaesekaestchen
  const r = partie.raster
  // Ein halbes Kästchen Rand rundherum, damit die äußeren Linien Platz haben.
  const breite = r.breite + 1
  const hoehe = r.hoehe + 1
  const x = (spalte: number) => prozent((spalte + 0.5) / breite)
  const y = (zeile: number) => prozent((zeile + 0.5) / hoehe)
  const letzter = partie.zuege.at(-1)
  const nameVon = (i: number) => namen[i] ?? `${i + 1}`

  const stil = {
    aspectRatio: `${breite} / ${hoehe}`,
    '--farbe-dran': farbeVon(partie.amZug),
  } as CSSProperties

  return (
    <div
      className={styles.blatt}
      style={stil}
      role="group"
      aria-label={tk.blatt}
      data-gesperrt={gesperrt || undefined}
    >
      {partie.besitzer.map((wer, k) => {
        if (wer < 0) return null
        const spalte = k % r.breite
        const zeile = Math.floor(k / r.breite)
        const neu = letzter?.geschlossen.includes(k)
        return (
          <div
            key={`k${k}`}
            className={`${styles.kaestchen} ${neu ? styles.neu : ''}`}
            style={
              {
                left: x(spalte),
                top: y(zeile),
                width: prozent(1 / breite),
                height: prozent(1 / hoehe),
                '--farbe': farbeVon(wer),
              } as CSSProperties
            }
            role="img"
            aria-label={tk.kaestchenVon(nameVon(wer))}
            data-kaestchen={k}
            data-besitzer={wer}
          >
            <span aria-hidden="true">{initiale(nameVon(wer))}</span>
          </div>
        )
      })}

      {partie.linien.map((wer, l) => {
        const lage = lageVon(r, l)
        const waagrecht = lage.art === 'waagrecht'
        const frei = wer < 0
        const beschriftung = waagrecht
          ? tk.linieWaagrecht(lage.zeile + 1, lage.spalte + 1)
          : tk.linieSenkrecht(lage.zeile + 1, lage.spalte + 1)
        const ort: CSSProperties = waagrecht
          ? {
              left: prozent((lage.spalte + 0.65) / breite),
              top: prozent((lage.zeile + 0.5 - 0.28) / hoehe),
              width: prozent(0.7 / breite),
              height: prozent(0.56 / hoehe),
            }
          : {
              left: prozent((lage.spalte + 0.5 - 0.28) / breite),
              top: prozent((lage.zeile + 0.65) / hoehe),
              width: prozent(0.56 / breite),
              height: prozent(0.7 / hoehe),
            }
        return (
          <button
            key={`l${l}`}
            type="button"
            className={[
              styles.linie,
              waagrecht ? styles.waagrecht : styles.senkrecht,
              frei ? '' : styles.gezogen,
              letzter?.linie === l ? styles.frisch : '',
            ].join(' ')}
            style={{ ...ort, ...(frei ? {} : { '--farbe': farbeVon(wer) }) } as CSSProperties}
            disabled={!frei || gesperrt}
            aria-label={frei ? beschriftung : `${beschriftung}, ${tk.gezogenVon(nameVon(wer))}`}
            data-linie={l}
            onClick={() => onLinie(l)}
          >
            <span className={styles.strich} aria-hidden="true" />
          </button>
        )
      })}

      {Array.from({ length: (r.breite + 1) * (r.hoehe + 1) }, (_, i) => (
        <span
          key={`p${i}`}
          className={styles.punkt}
          style={{ left: x(i % (r.breite + 1)), top: y(Math.floor(i / (r.breite + 1))) }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
