/**
 * Ob 3D gezeichnet werden soll, als Hook -- folgt der Wahl, wenn sie sich
 * ändert, und der Systemeinstellung „Bewegung reduzieren".
 */

import { useEffect, useState } from 'react'
import { EFFEKTE_GEAENDERT, effekte3dAn } from '@/services/effekte'

export function useEffekte3d(): boolean {
  const [an, setAn] = useState(effekte3dAn)

  useEffect(() => {
    const neu = () => setAn(effekte3dAn())
    const medien = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    window.addEventListener(EFFEKTE_GEAENDERT, neu)
    medien?.addEventListener('change', neu)
    return () => {
      window.removeEventListener(EFFEKTE_GEAENDERT, neu)
      medien?.removeEventListener('change', neu)
    }
  }, [])

  return an
}
