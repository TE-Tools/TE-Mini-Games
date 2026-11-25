/**
 * Kategorie wählen, ohne `<select>`: Auf der Seite steht die gewählte als
 * großer Knopf mit Bild, ein Tipp öffnet von unten ein Blatt mit allen
 * Kategorien als Chips. Für zwanzig Einträge ist das kürzer als ein Raster
 * mitten auf der Seite und angenehmer als die Liste des Systems.
 *
 * Wählen per Tipp schließt das Blatt; mit den Pfeiltasten wandert die Wahl,
 * ohne zu schließen. Escape, „Fertig" und ein Tipp daneben schließen auch.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSprache } from '@/i18n/sprache'
import { ChipAuswahl, type ChipOption } from './Chips'
import { EIGENE_ICON, kategorieIcon } from './kategorieIcons'
import styles from './KategorieWahl.module.css'

export interface KategorieEintrag {
  id: string
  label: string
  /** Nur bei eigenen Listen: wie viele Wörter drinstehen. */
  anzahl?: number
}

export function KategorieWahl({
  beschriftung,
  eingebaut,
  eigene,
  titelEingebaut,
  titelEigene,
  wert,
  onWahl,
}: {
  beschriftung: string
  eingebaut: readonly KategorieEintrag[]
  eigene: readonly KategorieEintrag[]
  titelEingebaut: string
  titelEigene: string
  wert: string
  onWahl: (id: string) => void
}) {
  const { t } = useSprache()
  const [offen, setOffen] = useState(false)
  /** Das Blatt hängt am Ende von <body> -- die Farbe des Spiels nimmt es von hier mit. */
  const [akzent, setAkzent] = useState('')
  const ausloeser = useRef<HTMLButtonElement>(null)
  const blatt = useRef<HTMLDivElement>(null)
  const titelId = useId()

  const gewaehlt = [...eingebaut, ...eigene].find((k) => k.id === wert)
  const istEigene = eigene.some((k) => k.id === wert)

  const schliessen = () => {
    setOffen(false)
    ausloeser.current?.focus()
  }

  useEffect(() => {
    if (!offen) return
    const radios = blatt.current?.querySelector<HTMLButtonElement>(
      '[role="radio"][aria-checked="true"]',
    )
    ;(radios ?? blatt.current?.querySelector<HTMLButtonElement>('[role="radio"]'))?.focus()
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = vorher
    }
  }, [offen])

  const alsChips = (liste: readonly KategorieEintrag[], eigen: boolean): ChipOption<string>[] =>
    liste.map((k) => ({
      wert: k.id,
      text: k.label,
      icon: eigen ? EIGENE_ICON : kategorieIcon(k.id),
      zusatz: k.anzahl !== undefined ? ` (${k.anzahl})` : undefined,
    }))

  return (
    <>
      <button
        ref={ausloeser}
        type="button"
        className={styles.ausloeser}
        aria-haspopup="dialog"
        aria-expanded={offen}
        data-wert={wert}
        onClick={(e) => {
          setAkzent(getComputedStyle(e.currentTarget).getPropertyValue('--akzent').trim())
          setOffen(true)
        }}
      >
        <span className={styles.bild} aria-hidden="true">
          {istEigene ? EIGENE_ICON : kategorieIcon(wert)}
        </span>
        <span className={styles.texte}>
          <span className={styles.was}>{beschriftung}</span>{' '}
          <span className={styles.wert}>
            {gewaehlt?.label ?? wert}
            {gewaehlt?.anzahl !== undefined && ` (${gewaehlt.anzahl})`}
          </span>
        </span>
        <span className={styles.pfeil} aria-hidden="true">
          ›
        </span>
      </button>

      {offen &&
        createPortal(
          <div
            className={styles.huelle}
            style={akzent ? { ['--akzent' as string]: akzent } : undefined}
            onClick={(e) => {
              if (e.target === e.currentTarget) schliessen()
            }}
          >
            <div
              ref={blatt}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titelId}
              className={styles.blatt}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  schliessen()
                }
              }}
            >
              <span className={styles.griff} aria-hidden="true" />
              <div className={styles.kopf}>
                <h2 id={titelId} className={styles.titel}>
                  {beschriftung}
                </h2>
                <button type="button" className={styles.fertig} onClick={schliessen}>
                  {t.partyGruppe.fertig}
                </button>
              </div>
              {/* Ein Tipp auf einen Chip wählt und schließt; Pfeiltasten nur wählen. */}
              <div
                className={styles.inhalt}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[role="radio"]')) schliessen()
                }}
              >
                {eigene.length > 0 && <h3 className={styles.gruppe}>{titelEingebaut}</h3>}
                <ChipAuswahl
                  beschriftung={titelEingebaut}
                  optionen={alsChips(eingebaut, false)}
                  wert={wert}
                  onWahl={onWahl}
                  anordnung={2}
                />
                {eigene.length > 0 && (
                  <>
                    <h3 className={styles.gruppe}>{titelEigene}</h3>
                    <ChipAuswahl
                      beschriftung={titelEigene}
                      optionen={alsChips(eigene, true)}
                      wert={wert}
                      onWahl={onWahl}
                      anordnung={2}
                    />
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
