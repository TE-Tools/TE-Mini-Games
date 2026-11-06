/**
 * Kategorie-Auswahl für Imposter, Wer bin ich? und Scharade.
 *
 * Die eingebauten Wortlisten gibt es je Sprache (words.ts / words.en.ts); die
 * Auswahl zeigt nur die der Oberflächensprache. Gemerkt wird die Kennung --
 * gehört sie nach einem Sprachwechsel zur anderen Sprache, gilt die erste
 * Kategorie der neuen. Eigene Listen bleiben, wie sie sind.
 */
import { useEffect, useMemo, useState } from 'react'
import type { CategoryDef } from '@/games/finde-den-imposter'
import type { Sprache } from '@/i18n/sprache'
import { englischeKategorienAufDemServer, onlineKategorien } from '@/services/imposterKategorien'

/** Die gültige Wahl: eigene Liste oder angebotene Kategorie, sonst die erste. */
export function gueltigeKategorie(
  categoryId: string,
  angeboten: readonly CategoryDef[],
  istEigene: (id: string) => boolean,
): string {
  if (istEigene(categoryId) || angeboten.some((c) => c.id === categoryId)) return categoryId
  return angeboten[0]?.id ?? categoryId
}

/**
 * Die Kategorien für die Online-Seiten: Englisch nur, wenn der Server die
 * englischen schon kennt (Migration 029), sonst Deutsch wie bisher.
 */
export function useOnlineKategorien(sprache: Sprache): CategoryDef[] {
  const [aufDemServer, setAufDemServer] = useState<ReadonlySet<string> | null>(null)
  useEffect(() => {
    if (sprache !== 'en') return
    let abbruch = false
    void englischeKategorienAufDemServer().then((ids) => {
      if (!abbruch) setAufDemServer(ids)
    })
    return () => {
      abbruch = true
    }
  }, [sprache])
  return useMemo(() => onlineKategorien(sprache, aufDemServer), [sprache, aufDemServer])
}
