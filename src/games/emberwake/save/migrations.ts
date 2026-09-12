import { SAVE_SCHEMA_VERSION, defaultProfile, type ProfileData } from './schema'

/**
 * Migrationskette. Ein Spielstand darf durch ein Update niemals unlesbar
 * werden (SAVE_SYSTEM.md §5). Jede Funktion hebt von Version n auf n+1.
 * Unbekannte Felder werden erhalten, nicht verworfen.
 */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>

const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2 würde hier stehen, z. B.:
  // 1: (d) => ({ ...d, achievements: d.achievements ?? [] }),
}

export function migrateProfile(raw: unknown, fromVersion: number): ProfileData {
  let data = (raw ?? {}) as Record<string, unknown>
  let version = fromVersion

  while (version < SAVE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(`Keine Migration von Schema-Version ${version}`)
    data = step(data)
    version++
  }

  // Fehlende Felder mit Standardwerten auffüllen — robust gegen Teilverluste.
  const base = defaultProfile()
  const merged = {
    ...base,
    ...data,
    camp: { ...base.camp, ...((data.camp as object) ?? {}) },
    settings: { ...base.settings, ...((data.settings as object) ?? {}) },
    stats: { ...base.stats, ...((data.stats as object) ?? {}) },
  } as ProfileData

  if (typeof merged.lives !== 'number' || !Number.isFinite(merged.lives)) merged.lives = base.lives
  if (typeof merged.unlockedLevelId !== 'number') merged.unlockedLevelId = 1
  if (!merged.levels || typeof merged.levels !== 'object') merged.levels = {}
  if (!Array.isArray(merged.achievements)) merged.achievements = []
  if (!Array.isArray(merged.camp.tools)) merged.camp.tools = []

  return merged
}
