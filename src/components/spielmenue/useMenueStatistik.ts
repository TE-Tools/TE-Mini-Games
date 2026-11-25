import { useEffect, useState } from 'react'
import {
  LEERE_STATISTIK,
  ladeMenueStatistik,
  type MenueSpiel,
  type MenueStatistik,
} from './statistik'

/**
 * Die Bilanz eines Spiels, sobald sie aus dem Gerät gelesen ist.
 * `null` heißt: wird noch gelesen. Geht das Lesen schief (kein
 * IndexedDB, privates Fenster), gilt die Bilanz als leer -- das Menü
 * bleibt bedienbar, es fehlt nur die Leiste.
 */
export function useMenueStatistik(spiel: MenueSpiel): MenueStatistik | null {
  const [statistik, setStatistik] = useState<MenueStatistik | null>(null)
  useEffect(() => {
    let abbruch = false
    ladeMenueStatistik(spiel)
      .then((s) => {
        if (!abbruch) setStatistik(s)
      })
      .catch(() => {
        if (!abbruch) setStatistik(LEERE_STATISTIK)
      })
    return () => {
      abbruch = true
    }
  }, [spiel])
  return statistik
}
