/**
 * Das gewählte Design als Hook -- folgt der Auswahl, wenn sie sich ändert,
 * auch aus einem anderen Tab.
 */

import { useSyncExternalStore } from 'react'
import {
  SAMMLUNG_GEAENDERT,
  freieDesigns,
  gewaehltesDesign,
  type DesignArt,
  type DesignIds,
} from '@/services/sammlung'

function abonniere(neu: () => void): () => void {
  window.addEventListener(SAMMLUNG_GEAENDERT, neu)
  window.addEventListener('storage', neu)
  return () => {
    window.removeEventListener(SAMMLUNG_GEAENDERT, neu)
    window.removeEventListener('storage', neu)
  }
}

export function useDesign<A extends DesignArt>(art: A): DesignIds[A] {
  return useSyncExternalStore(
    abonniere,
    () => gewaehltesDesign(art),
    () => 'standard' as DesignIds[A],
  )
}

/** Die freien Designs, als eine Zeichenkette -- stabil für useSyncExternalStore. */
export function useFreieDesigns(art: DesignArt): string {
  return useSyncExternalStore(
    abonniere,
    () => freieDesigns(art).join(','),
    () => 'standard',
  )
}
