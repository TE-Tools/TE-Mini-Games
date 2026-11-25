/**
 * Die Feierschicht: einmal in der App-Hülle, für alle Spiele.
 *
 * Hört auf `aufFeiern` (gemeldet von `processAfterResult`) und zeigt jede
 * Feier als kurze Karte unten am Rand -- mit Konfetti und einem Ton. Sie
 * verdeckt den Ergebnisbildschirm nicht, geht nach ein paar Sekunden von
 * selbst und mit einem Tipp sofort. Kommen mehrere auf einmal (Aufgabe
 * plus Aufstieg), stehen sie nacheinander da.
 *
 * Kein Druck: keine Uhr, die abläuft, kein „nur noch heute", nichts zu
 * kaufen. Mit „Bewegung reduzieren" fällt kein Konfetti und die Karte
 * gleitet nicht; ist der Ton aus, bleibt es still (das regelt `spiele`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { aufFeiern, type Feier } from '@/progression/feier'
import { ACHIEVEMENTS } from '@/progression/achievements'
import { useSprache } from '@/i18n/sprache'
import { Konfetti } from '@/components/konfetti/Konfetti'
import { spiele } from '@/services/sound'
import { aufgabenText } from './aufgabenText'
import styles from './FeierSchicht.module.css'

/** So lange steht eine Karte, wenn niemand tippt. */
export const FEIER_DAUER_MS = 4200

interface Eintrag {
  nr: number
  feier: Feier
}

export function FeierSchicht() {
  const { t } = useSprache()
  const [schlange, setSchlange] = useState<Eintrag[]>([])
  const zaehler = useRef(0)

  useEffect(
    () =>
      aufFeiern((feiern) => {
        setSchlange((alt) => [...alt, ...feiern.map((feier) => ({ nr: ++zaehler.current, feier }))])
      }),
    [],
  )

  const aktuell = schlange[0]
  const weiter = useCallback(() => setSchlange((alt) => alt.slice(1)), [])

  useEffect(() => {
    if (!aktuell) return
    spiele('erfolg')
    const uhr = window.setTimeout(weiter, FEIER_DAUER_MS)
    return () => window.clearTimeout(uhr)
  }, [aktuell, weiter])

  if (!aktuell) return null

  const { icon, titel, text } = inhalt(aktuell.feier, t)

  return (
    <div
      className={styles.schicht}
      role="status"
      aria-live="polite"
      aria-label={t.bindung.feier.bereich}
    >
      <div key={aktuell.nr} className={styles.karte} data-art={aktuell.feier.art} onClick={weiter}>
        {/* Auf schwachen Geräten oder mit „Effekte aus" (data-sparsam) kein
            Konfetti; „Bewegung reduzieren" blendet es im Konfetti selbst aus. */}
        {!sparsam() && <Konfetti anzahl={aktuell.feier.art === 'aufstieg' ? 64 : 36} />}
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.text}>
          <strong className={styles.titel}>{titel}</strong>
          <span className={styles.zeile}>{text}</span>
        </span>
        <button
          type="button"
          className={styles.weiter}
          onClick={(e) => {
            e.stopPropagation()
            weiter()
          }}
        >
          {t.bindung.feier.weiter}
        </button>
      </div>
    </div>
  )
}

function sparsam(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-sparsam')
}

function inhalt(
  feier: Feier,
  t: ReturnType<typeof useSprache>['t'],
): { icon: string; titel: string; text: string } {
  switch (feier.art) {
    case 'aufstieg':
      return {
        icon: '⭐',
        titel: t.bindung.feier.aufstiegTitel,
        text: t.bindung.feier.aufstiegText(feier.level),
      }
    case 'abzeichen': {
      const def = ACHIEVEMENTS.find((a) => a.id === feier.id)
      return {
        icon: def?.icon ?? '🏅',
        titel: t.bindung.feier.abzeichenTitel,
        text: t.abzeichen[feier.id]?.name ?? feier.id,
      }
    }
    case 'aufgabe':
      return {
        icon: '✅',
        titel: t.bindung.feier.aufgabeTitel,
        text: `${aufgabenText(feier.aufgabe, t)} · ${t.bindung.belohnung(feier.xp)}`,
      }
    case 'alleAufgaben':
      return {
        icon: '🏆',
        titel: t.bindung.feier.alleTitel,
        text: t.bindung.feier.alleText(feier.xp),
      }
  }
}
