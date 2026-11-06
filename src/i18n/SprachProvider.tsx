/**
 * Hält die gewählte Sprache und stellt sie der ganzen App bereit.
 *
 * Eigene Datei, damit Fast Refresh beim Ändern von Texten nicht den
 * Zustand der Seite verwirft -- siehe sprache.ts.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  SPEICHER_SCHLUESSEL,
  SprachContext,
  WOERTERBUECHER,
  gespeicherteSprache,
  sprachenWahlAusUmgebung,
  type Sprache,
} from './sprache'

export function SprachProvider({ children }: { children: ReactNode }) {
  const [sprache, setzeSpracheRoh] = useState<Sprache>(
    () => gespeicherteSprache() ?? sprachenWahlAusUmgebung(navigator.languages ?? []),
  )

  const setzeSprache = useCallback((neu: Sprache) => {
    setzeSpracheRoh(neu)
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL, neu)
    } catch {
      // Dann hält die Wahl eben nur diese Sitzung.
    }
  }, [])

  // Vorlesegeräte und die Silbentrennung des Browsers richten sich
  // danach. Ohne das liest eine englische Stimme deutschen Text vor.
  useEffect(() => {
    document.documentElement.lang = sprache
  }, [sprache])

  const lage = useMemo(
    () => ({ sprache, setzeSprache, t: WOERTERBUECHER[sprache] }),
    [sprache, setzeSprache],
  )

  return <SprachContext.Provider value={lage}>{children}</SprachContext.Provider>
}
