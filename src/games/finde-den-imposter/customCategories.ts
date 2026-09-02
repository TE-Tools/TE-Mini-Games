/**
 * Eigene Kategorien für "Finde den Imposter".
 *
 * Sie liegen bewusst nur auf diesem Gerät (localStorage), nicht im Konto:
 * Das Spiel am einen Gerät braucht kein Login, und wer seine Liste auf ein
 * anderes Handy holen will, exportiert sie und schickt sie sich selbst.
 * Genau dafür sind Export und Import da.
 *
 * Online lassen sich eigene Kategorien nicht verwenden -- dort zieht der
 * Server das geheime Wort, und der kennt nur den eingebauten Wortschatz.
 * Würde der Browser die Wörter mitschicken, kennte der Gastgeber das Wort
 * auch dann, wenn er selbst Imposter ist.
 */

export interface CustomCategory {
  id: string
  label: string
  words: string[]
}

const KEY = 'fdi.custom-categories.v1'
/** Präfix, damit eine eigene Kategorie nie eine eingebaute überschreibt. */
export const CUSTOM_PREFIX = 'eigene:'
/** Weniger Wörter lohnen nicht: eins ist das Geheimnis, eins das Hilfswort. */
export const MIN_WORDS = 5
export const MAX_WORDS = 500
export const MAX_CATEGORIES = 50

export function isCustomCategory(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX)
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    // Privater Modus, blockierte Cookies -- dann gibt es eben keine eigenen
    // Kategorien, aber das Spiel läuft weiter.
    return null
  }
}

function sane(entry: unknown): CustomCategory | null {
  if (!entry || typeof entry !== 'object') return null
  const o = entry as Record<string, unknown>
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  const words = Array.isArray(o.words)
    ? cleanWords(o.words.filter((w): w is string => typeof w === 'string'))
    : []
  if (!label || words.length < MIN_WORDS) return null
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : idFor(label)
  return { id: isCustomCategory(id) ? id : CUSTOM_PREFIX + id, label, words }
}

export function loadCustomCategories(): CustomCategory[] {
  const s = storage()
  if (!s) return []
  try {
    const raw = s.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(sane)
      .filter((c): c is CustomCategory => c !== null)
      .slice(0, MAX_CATEGORIES)
  } catch {
    return []
  }
}

function persist(cats: CustomCategory[]): void {
  const s = storage()
  if (!s) return
  try {
    s.setItem(KEY, JSON.stringify(cats.slice(0, MAX_CATEGORIES)))
  } catch {
    /* Speicher voll oder gesperrt -- lieber nichts tun als abstürzen. */
  }
}

/** Aus einem Namen eine stabile, kurze Kennung machen. */
export function idFor(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return CUSTOM_PREFIX + (slug || `liste-${Date.now().toString(36)}`)
}

/**
 * Wörter aus einem Textfeld holen: eine Zeile pro Wort, Kommas und
 * Semikolons gehen aber auch. Doppeltes fliegt raus (ohne auf Groß- und
 * Kleinschreibung zu achten), die Reihenfolge bleibt.
 */
export function parseWords(text: string): string[] {
  return cleanWords(text.split(/[\n,;]+/))
}

function cleanWords(list: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const w = raw.trim().replace(/\s+/g, ' ')
    if (!w || w.length > 60) continue
    const key = w.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
    if (out.length >= MAX_WORDS) break
  }
  return out
}

/** Slugs können kollidieren ("Verein!" und "Verein?") -- dann durchzählen. */
function freieKennung(wunsch: string, alle: CustomCategory[]): string {
  if (!alle.some((c) => c.id === wunsch)) return wunsch
  for (let n = 2; n < 100; n++) {
    const kandidat = `${wunsch}-${n}`
    if (!alle.some((c) => c.id === kandidat)) return kandidat
  }
  return `${wunsch}-${Date.now().toString(36)}`
}

export interface SaveInput {
  /** Beim Bearbeiten die bestehende Kennung mitgeben, sonst leer lassen. */
  id?: string
  label: string
  words: string[]
}

export function saveCustomCategory(input: SaveInput): CustomCategory {
  const label = input.label.trim()
  if (!label) throw new Error('Die Kategorie braucht einen Namen')
  if (label.length > 40) throw new Error('Der Name ist zu lang (höchstens 40 Zeichen)')
  const words = cleanWords(input.words)
  if (words.length < MIN_WORDS) {
    throw new Error(`Mindestens ${MIN_WORDS} verschiedene Wörter – es sind ${words.length}`)
  }

  const alle = loadCustomCategories()
  // Beim Bearbeiten kommt die Kennung von außen; beim Anlegen wird sie aus
  // dem Namen gebaut. Wichtig ist der Unterschied, weil "Verein" und "verein"
  // dieselbe Kennung ergeben -- ohne diese Prüfung würde die zweite Liste die
  // erste stillschweigend überschreiben.
  const bearbeitet = input.id ?? null
  const namensDoppel = alle.find(
    (c) => c.id !== bearbeitet && c.label.toLowerCase() === label.toLowerCase(),
  )
  if (namensDoppel) throw new Error(`„${label}" gibt es schon`)

  const id = bearbeitet ?? freieKennung(idFor(label), alle)

  const neu: CustomCategory = { id, label, words }
  const index = alle.findIndex((c) => c.id === id)
  if (index >= 0) alle[index] = neu
  else {
    if (alle.length >= MAX_CATEGORIES) {
      throw new Error(`Mehr als ${MAX_CATEGORIES} eigene Kategorien gehen nicht`)
    }
    alle.push(neu)
  }
  persist(alle)
  return neu
}

export function deleteCustomCategory(id: string): void {
  persist(loadCustomCategories().filter((c) => c.id !== id))
}

export function customCategoryById(id: string): CustomCategory | undefined {
  return loadCustomCategories().find((c) => c.id === id)
}

/* ----------------------------- Import / Export ---------------------------- */

export const EXPORT_FORMAT = 'te-mini-games/finde-den-imposter/kategorien'

interface ExportFile {
  format: string
  version: number
  exportedAt: string
  categories: CustomCategory[]
}

export function exportCustomCategories(cats = loadCustomCategories()): string {
  const datei: ExportFile = {
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: cats,
  }
  return JSON.stringify(datei, null, 2)
}

export interface ImportResult {
  added: number
  updated: number
  /** Einträge, die nicht übernommen wurden, mit Grund. */
  skipped: string[]
}

/**
 * Eine exportierte Datei wieder einlesen. Nimmt auch eine nackte Liste von
 * Kategorien an -- wer die Datei von Hand zusammenbaut, soll nicht am
 * Drumherum scheitern.
 */
export function importCustomCategories(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Das ist kein gültiges JSON – hast du den ganzen Text eingefügt?')
  }

  let roh: unknown[]
  if (Array.isArray(parsed)) roh = parsed
  else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as ExportFile).categories)) {
    roh = (parsed as ExportFile).categories
  } else {
    throw new Error('In der Datei stecken keine Kategorien')
  }

  const bestand = loadCustomCategories()
  const result: ImportResult = { added: 0, updated: 0, skipped: [] }

  for (const eintrag of roh) {
    const c = sane(eintrag)
    if (!c) {
      const name =
        eintrag && typeof eintrag === 'object' && typeof (eintrag as CustomCategory).label === 'string'
          ? (eintrag as CustomCategory).label
          : 'Namenloser Eintrag'
      result.skipped.push(`${name}: braucht einen Namen und mindestens ${MIN_WORDS} Wörter`)
      continue
    }
    const index = bestand.findIndex(
      (x) => x.id === c.id || x.label.toLowerCase() === c.label.toLowerCase(),
    )
    if (index >= 0) {
      bestand[index] = { ...c, id: bestand[index]!.id }
      result.updated += 1
    } else if (bestand.length >= MAX_CATEGORIES) {
      result.skipped.push(`${c.label}: mehr als ${MAX_CATEGORIES} Kategorien gehen nicht`)
    } else {
      bestand.push(c)
      result.added += 1
    }
  }

  persist(bestand)
  return result
}
