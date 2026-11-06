import {
  WOERTERBUECHER,
  gespeicherteSprache,
  sprachenWahlAusUmgebung,
  type Sprache,
  type Texte,
} from '@/i18n/sprache'
import type { World } from '@/games/emberwake/world/World'
import type {
  BuildingId,
  EnemyId,
  ItemId,
  LevelDef,
  RecipeDef,
} from '@/games/emberwake/data/schema/types'
import { ITEMS } from '@/games/emberwake/data/items'
import { BUILDINGS } from '@/games/emberwake/data/buildings'
import { ENEMIES } from '@/games/emberwake/data/enemies'
import { WORLDS } from '@/games/emberwake/data/levels'
import { hasAnyResources } from '@/games/emberwake/systems/InventorySystem'

/**
 * Die Texte von Emberwake in der Sprache der App.
 *
 * Emberwake ist reines DOM, kein React -- `useSprache()` gibt es hier
 * nicht. Die Texte stehen trotzdem im Wörterbuch der App
 * (`src/i18n/texte/de.ts`, Abschnitt `emberwake`), damit TypeScript beide
 * Sprachen verlangt. Die Sprache wird gelesen wie in `SprachProvider`.
 *
 * Gelesen wird einmal beim Start des Spiels. Wer die Sprache umschaltet,
 * während Emberwake offen ist, bekommt sie beim nächsten Start.
 *
 * Die Simulation bleibt dabei deutsch und kopflos: Gegenstände, Gebäude
 * und Level behalten in `data/` ihre deutschen Namen als Kennung, und was
 * die Systeme an Text liefern (Gründe, Todesursache, Hinweise), wird hier
 * beim Anzeigen erkannt und nachgeschlagen. Was kein Muster kennt, bleibt
 * deutsch statt leer.
 */

export type EmberwakeTexte = Texte['emberwake']

/** Die Texte eines Levels im Wörterbuch. */
interface LevelTexte {
  name: string
  untertitel: string
  hauptziel: string
  zusatzziel: string
  geheimnis: string
  hinweise: Partial<Record<string, string>>
  lore: readonly string[]
}

const DE = WOERTERBUECHER.de.emberwake

export function emberwakeSprache(): Sprache {
  const umgebung = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [])
  return gespeicherteSprache() ?? sprachenWahlAusUmgebung(umgebung)
}

export function emberwakeTexte(sprache: Sprache = emberwakeSprache()): EmberwakeTexte {
  return WOERTERBUECHER[sprache].emberwake
}

// ---------------------------------------------------------------------------
// Inhalte aus data/, über die Kennung nachgeschlagen
// ---------------------------------------------------------------------------

export function gegenstandName(tx: EmberwakeTexte, id: ItemId): string {
  // Die Zuweisung prüft, dass das Wörterbuch jede Kennung kennt.
  const namen: Record<ItemId, string> = tx.gegenstaende
  return namen[id] ?? ITEMS[id].name
}

export function gebaeudeName(tx: EmberwakeTexte, id: BuildingId): string {
  const gebaeude: Record<BuildingId, { name: string; stufen: readonly string[] }> = tx.gebaeude
  return gebaeude[id]?.name ?? BUILDINGS[id].name
}

/** Beschreibung der Stufe `index` (0 = erste Stufe). */
export function gebaeudeStufe(tx: EmberwakeTexte, id: BuildingId, index: number): string {
  const gebaeude: Record<BuildingId, { name: string; stufen: readonly string[] }> = tx.gebaeude
  return gebaeude[id]?.stufen[index] ?? BUILDINGS[id].levels[index]?.description ?? ''
}

export function rezeptName(tx: EmberwakeTexte, r: RecipeDef): string {
  return gegenstandName(tx, r.result)
}

export function rezeptBeschreibung(tx: EmberwakeTexte, r: RecipeDef): string {
  return (tx.rezepte as Partial<Record<string, string>>)[r.id] ?? r.description
}

export function weltName(tx: EmberwakeTexte, id: number): string {
  return (
    (tx.welten as Partial<Record<number, string>>)[id] ??
    WORLDS.find((w) => w.id === id)?.name ??
    ''
  )
}

function levelTexte(tx: EmberwakeTexte, id: number): LevelTexte | undefined {
  return (tx.level as Partial<Record<number, LevelTexte>>)[id]
}

export function levelName(tx: EmberwakeTexte, level: LevelDef): string {
  return levelTexte(tx, level.id)?.name ?? level.name
}

export function levelUntertitel(tx: EmberwakeTexte, level: LevelDef): string {
  return levelTexte(tx, level.id)?.untertitel ?? level.subtitle
}

export function hauptziel(tx: EmberwakeTexte, level: LevelDef): string {
  return levelTexte(tx, level.id)?.hauptziel ?? level.objectives.primary.text
}

export function zusatzziel(tx: EmberwakeTexte, level: LevelDef): string {
  return levelTexte(tx, level.id)?.zusatzziel ?? level.objectives.secondary.text
}

export function geheimnisText(tx: EmberwakeTexte, level: LevelDef): string {
  return levelTexte(tx, level.id)?.geheimnis ?? level.secret.text
}

export function loreText(tx: EmberwakeTexte, level: LevelDef, index: number): string | undefined {
  return levelTexte(tx, level.id)?.lore[index] ?? level.lore[index]
}

/** Ein Hinweis kommt als deutscher Text aus der Simulation; der Auslöser steht im Level. */
export function hinweisText(tx: EmberwakeTexte, level: LevelDef, text: string): string {
  const def = level.hints.find((h) => h.text === text)
  if (!def) return text
  return levelTexte(tx, level.id)?.hinweise[def.trigger] ?? text
}

// ---------------------------------------------------------------------------
// Texte aus der Simulation, beim Anzeigen erkannt
// ---------------------------------------------------------------------------

/** Die Todesursache aus `killPlayer` -- ein Gegner oder der erloschene Kern. */
export function todesursache(tx: EmberwakeTexte, ursache: string): string {
  const getoetet: Record<EnemyId, string> = tx.getoetetVon
  for (const id of Object.keys(ENEMIES) as EnemyId[]) {
    if (ENEMIES[id].killVerb === ursache) return getoetet[id]
  }
  const kern = DE.kernErlosch('')
  if (ursache.startsWith(kern)) return tx.kernErlosch(ursache.slice(kern.length))
  return ursache
}

/** Warum etwas nicht gebaut oder hergestellt werden kann (`canBuild`, `canCraft`). */
export function grundText(tx: EmberwakeTexte, grund: string): string {
  for (const schluessel of [
    'hoechsteStufe',
    'nichtFreigeschaltet',
    'zuWenigMaterial',
    'kernZuSchwach',
    'bereitsVorhanden',
  ] as const) {
    if (DE.gruende[schluessel] === grund) return tx.gruende[schluessel]
  }
  for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
    if (DE.gruende.gebaeudeNoetig(BUILDINGS[id].name) === grund)
      return tx.gruende.gebaeudeNoetig(gebaeudeName(tx, id))
  }
  return grund
}

/** Die Beschriftung des Aktionsknopfs, aus dem, was gerade in Reichweite ist. */
export function aktionText(tx: EmberwakeTexte, w: World): string {
  const ziel = w.interactable
  if (!ziel) return ''
  switch (ziel.kind) {
    case 'node': {
      const knoten = w.nodes.find((n) => n.id === ziel.id)
      if (!knoten) return ziel.label
      return knoten.form === 'baum'
        ? tx.baumFaellen
        : tx.sammeln(gegenstandName(tx, knoten.resource))
    }
    case 'core':
      return hasAnyResources(w) ? tx.einlagern : tx.lager
    case 'slot': {
      const platz = w.camp.slots[ziel.id]
      if (!platz) return ziel.label
      const name = gebaeudeName(tx, platz.building)
      return (w.camp.buildings[platz.building] ?? 0) > 0 ? name : tx.bauen(name)
    }
    case 'secret':
      return tx.untersuchen
  }
}
