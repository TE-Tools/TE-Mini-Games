/**
 * Passt eine Medienabfrage gerade? Folgt dem Fenster, wenn das Gerät gedreht
 * oder das Fenster gezogen wird.
 */

import { useSyncExternalStore } from 'react'

/** Groß genug, dass mehrere am selben Gerät sitzen können: ein Tablet. */
export const TISCH_ABFRAGE = '(min-width: 700px) and (min-height: 560px)'

export function useMedienAbfrage(abfrage: string): boolean {
  return useSyncExternalStore(
    (melden) => {
      const liste = window.matchMedia?.(abfrage)
      if (!liste) return () => {}
      liste.addEventListener('change', melden)
      return () => liste.removeEventListener('change', melden)
    },
    () => window.matchMedia?.(abfrage).matches ?? false,
    () => false,
  )
}
