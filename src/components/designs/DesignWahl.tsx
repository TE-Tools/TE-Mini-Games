/**
 * Die Auswahl im Menü eines Spiels: welches Würfel- oder Kartendesign.
 *
 * Freie Designs sind einfach wählbar. Gesperrte stehen nur da, wenn die
 * App überhaupt Werbung kennt (`werbungAktiv()`), und tragen „per Video
 * freischalten“. Ein Tippen merkt eines vor; darunter steht dann der eine
 * Belohnungsknopf -- der erscheint nur, wenn wirklich ein Video bereitsteht.
 * Ein zu Ende geschautes Video schaltet genau dieses eine Design frei.
 *
 * Ohne Werbung und ohne freigeschaltete Designs zeigt die Auswahl nichts:
 * Das Menü sieht dann aus wie immer.
 */

import { useState, type CSSProperties } from 'react'
import { BelohnungsKnopf } from '@/components/werbung/BelohnungsKnopf'
import { useSprache } from '@/i18n/sprache'
import {
  DESIGNS,
  schalteFrei,
  waehleDesign,
  type DesignArt,
  type RueckenDesignId,
  type WuerfelDesignId,
} from '@/services/sammlung'
import { werbungAktiv } from '@/services/werbung'
import { rueckenStil, wuerfelStil } from './designs'
import { useDesign, useFreieDesigns } from './useDesign'
import styles from './DesignWahl.module.css'

interface Props {
  art: DesignArt
  /** Die Stelle, für AdSense-Berichte: 'kniffel-wuerfel' oder 'karten-ruecken'. */
  name: string
  /** Überschrift, schon übersetzt. */
  titel: string
  /** Die Fläche des Standardrückens in diesem Spiel, für die Vorschau. */
  standardFlaeche?: string
}

function Vorschau({
  art,
  id,
  standardFlaeche,
}: {
  art: DesignArt
  id: string
  standardFlaeche?: string
}) {
  if (art === 'wuerfel') {
    return (
      <span
        className={styles.wuerfel}
        style={wuerfelStil(id as WuerfelDesignId)}
        aria-hidden="true"
      >
        {[0, 2, 4, 6, 8].map((p) => (
          <span
            key={p}
            className={styles.auge}
            style={{ gridArea: `${Math.floor(p / 3) + 1} / ${(p % 3) + 1}` }}
          />
        ))}
      </span>
    )
  }
  const stil: CSSProperties = {
    ...(standardFlaeche ? ({ '--ruecken-standard': standardFlaeche } as CSSProperties) : {}),
    ...rueckenStil(id as RueckenDesignId),
  }
  return (
    <span className={styles.karte} style={stil} aria-hidden="true">
      <span className={styles.muster} />
    </span>
  )
}

export function DesignWahl({ art, name, titel, standardFlaeche }: Props) {
  const { t } = useSprache()
  const gewaehlt = useDesign(art)
  const frei = useFreieDesigns(art).split(',')
  const mitWerbung = werbungAktiv()
  const alle = DESIGNS[art] as readonly string[]
  const gesperrt = mitWerbung ? alle.filter((id) => !frei.includes(id)) : []
  const sichtbar = alle.filter((id) => frei.includes(id) || gesperrt.includes(id))

  const [wunsch, setWunsch] = useState<string | null>(null)
  const vorgemerkt = wunsch && gesperrt.includes(wunsch) ? wunsch : (gesperrt[0] ?? null)

  if (sichtbar.length < 2) return null

  const namen = t.designs[art] as Record<string, string>

  return (
    <section className={styles.wahl} aria-label={titel}>
      <h2 className={styles.titel}>{titel}</h2>
      <div className={styles.reihe}>
        {sichtbar.map((id) => {
          const offen = frei.includes(id)
          const designName = namen[id] ?? id
          return (
            <button
              key={id}
              type="button"
              className={[
                styles.feld,
                offen && id === gewaehlt ? styles.gewaehlt : '',
                !offen ? styles.gesperrt : '',
                !offen && id === vorgemerkt ? styles.vorgemerkt : '',
              ].join(' ')}
              aria-pressed={offen ? id === gewaehlt : id === vorgemerkt}
              aria-label={offen ? designName : t.designs.gesperrt(designName)}
              data-design={id}
              onClick={() => (offen ? waehleDesign(art, id) : setWunsch(id))}
            >
              <Vorschau art={art} id={id} standardFlaeche={standardFlaeche} />
              <span className={styles.name}>{designName}</span>
              <small className={styles.zusatz}>
                {offen ? (id === gewaehlt ? t.designs.gewaehlt : ' ') : `🔒 ${t.designs.perVideo}`}
              </small>
            </button>
          )
        })}
      </div>
      {vorgemerkt && (
        <BelohnungsKnopf
          name={name}
          aktiv
          belohnung={t.designs.belohnung(namen[vorgemerkt] ?? vorgemerkt)}
          onBelohnt={() => schalteFrei(art, vorgemerkt)}
        />
      )}
      <p className={styles.hinweis}>{t.designs.hinweis}</p>
    </section>
  )
}
