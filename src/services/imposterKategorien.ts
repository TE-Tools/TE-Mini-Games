/**
 * Welche eingebauten Kategorien kennt der Server?
 *
 * Die englischen Wortlisten (`en-…`) kommen online erst mit Migration 029 auf
 * den Server -- Thomas spielt sie von Hand ein, die App geht vorher live.
 * Bis dahin würde fdi_create_match / wbi_create_match eine englische
 * Kategorie ablehnen. Deshalb fragt die Seite hier nach, und solange der
 * Server keine englische Kategorie kennt (oder die Frage scheitert), bietet
 * sie wie bisher die deutschen an.
 *
 * fdi_categories ist für alle lesbar (Migration 011, `fdi_categories_read`);
 * nur Kennungen werden gelesen. Das Ergebnis gilt für die Sitzung.
 */
import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { categoriesFor, type CategoryDef, type WortSprache } from '@/games/finde-den-imposter'

const PRAEFIX_EN = 'en-'

let cache: Promise<ReadonlySet<string>> | null = null

async function hole(): Promise<ReadonlySet<string>> {
  if (!isSupabaseConfigured || !supabase) return new Set()
  const { data, error } = await supabase
    .from('fdi_categories')
    .select('id')
    .like('id', `${PRAEFIX_EN}%`)
  if (error || !data) throw error ?? new Error('keine Antwort')
  return new Set((data as { id: string }[]).map((z) => z.id))
}

/**
 * Die Kennungen der englischen Kategorien, die der Server schon kennt.
 * Ein Fehlschlag gibt eine leere Menge und wird nicht gemerkt -- beim
 * nächsten Öffnen wird noch einmal gefragt.
 */
export function englischeKategorienAufDemServer(): Promise<ReadonlySet<string>> {
  if (!cache) {
    cache = hole().catch(() => {
      cache = null
      return new Set<string>()
    })
  }
  return cache
}

/** Nur für Tests: vergisst die gemerkte Antwort. */
export function vergissServerKategorien(): void {
  cache = null
}

/**
 * Die Kategorien, die eine Online-Seite anbietet: auf Englisch die
 * englischen, die der Server kennt -- kennt er keine (oder ist die Antwort
 * noch nicht da), die deutschen wie bisher.
 */
export function onlineKategorien(
  sprache: WortSprache,
  aufDemServer: ReadonlySet<string> | null,
): CategoryDef[] {
  if (sprache === 'en' && aufDemServer) {
    const bekannt = categoriesFor('en').filter((c) => aufDemServer.has(c.id))
    if (bekannt.length > 0) return bekannt
  }
  return categoriesFor('de')
}
