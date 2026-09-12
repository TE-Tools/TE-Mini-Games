import { createLogger } from '@/games/emberwake/core/Logger'
import { Rng } from '@/games/emberwake/core/Rng'
import type { KeyValueStore } from '@/games/emberwake/platform/Storage'
import { mirror } from '@/games/emberwake/platform/Storage'
import { migrateProfile } from './migrations'
import {
  SAVE_SCHEMA_VERSION,
  defaultProfile,
  type ProfileData,
  type RunSnapshot,
  type SaveEnvelope,
} from './schema'

/**
 * Speichern ohne Beschädigungsrisiko (SAVE_SYSTEM.md §4).
 *
 * Doppelpuffer: Es wird immer in den gerade NICHT aktiven Slot
 * geschrieben, zurückgelesen und geprüft — erst danach wird der
 * Zeiger umgelegt. Es gibt kein Zeitfenster, in dem beide Slots
 * ungültig sind.
 */

const log = createLogger('save')
const KEY_POINTER = 'profile:active'
const KEY_SLOT_A = 'profile:a'
const KEY_SLOT_B = 'profile:b'
const KEY_RUN = 'run:current'
const MIRROR_KEY = 'profile'

const GAME_VERSION = (import.meta.env.VITE_GAME_VERSION as string | undefined) ?? '0.0.1'

export class SaveManager {
  private profile: ProfileData
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private pending = false
  private writing: Promise<void> = Promise.resolve()

  constructor(private readonly store: KeyValueStore) {
    this.profile = defaultProfile()
  }

  get data(): ProfileData {
    return this.profile
  }

  // -------------------------------------------------------------------------
  // Laden
  // -------------------------------------------------------------------------

  async load(): Promise<ProfileData> {
    const active = (await this.safeGet<'a' | 'b'>(KEY_POINTER)) ?? 'a'
    const order = active === 'a' ? [KEY_SLOT_A, KEY_SLOT_B] : [KEY_SLOT_B, KEY_SLOT_A]

    for (const key of order) {
      const env = await this.safeGet<SaveEnvelope<unknown>>(key)
      const parsed = this.verify(env)
      if (parsed) {
        this.profile = parsed
        log.info(`Profil geladen aus ${key}`)
        return this.profile
      }
    }

    const mirrored = mirror.read<SaveEnvelope<unknown>>(MIRROR_KEY)
    const fromMirror = this.verify(mirrored)
    if (fromMirror) {
      this.profile = fromMirror
      log.warn('Profil aus Notfall-Spiegel wiederhergestellt')
      return this.profile
    }

    this.profile = defaultProfile()
    log.info('Neues Profil angelegt')
    return this.profile
  }

  private verify(env: SaveEnvelope<unknown> | undefined): ProfileData | null {
    if (!env || typeof env !== 'object' || !('data' in env)) return null
    try {
      if (env.version > SAVE_SCHEMA_VERSION) {
        log.error(`Spielstand aus der Zukunft (v${env.version}). Wird nicht überschrieben.`)
        throw new Error('future-version')
      }
      const expected = checksum(env.data)
      if (env.checksum !== expected) {
        log.warn('Prüfsumme stimmt nicht — Slot verworfen')
        return null
      }
      return migrateProfile(env.data, env.version)
    } catch (err) {
      if ((err as Error).message === 'future-version') throw err
      log.warn('Spielstand ungültig', err)
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Speichern
  // -------------------------------------------------------------------------

  /** Gesammelt, höchstens einmal pro Sekunde. */
  requestSave(): void {
    this.pending = true
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.flush()
    }, 1000)
  }

  /** Sofort schreiben — bei Lifecycle-Ereignissen. */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (!this.pending) return
    this.pending = false
    this.writing = this.writing.then(() => this.writeProfile())
    await this.writing
  }

  private async writeProfile(): Promise<void> {
    this.profile.updatedAt = Date.now()
    const env: SaveEnvelope<ProfileData> = {
      version: SAVE_SCHEMA_VERSION,
      checksum: checksum(this.profile),
      savedAt: this.profile.updatedAt,
      gameVersion: GAME_VERSION,
      data: this.profile,
    }

    try {
      const active = (await this.safeGet<'a' | 'b'>(KEY_POINTER)) ?? 'a'
      const targetKey = active === 'a' ? KEY_SLOT_B : KEY_SLOT_A
      const targetPointer = active === 'a' ? 'b' : 'a'

      await this.store.set(targetKey, env)
      const back = await this.store.get<SaveEnvelope<ProfileData>>(targetKey)
      if (!back || back.checksum !== env.checksum) {
        throw new Error('Verifikation nach dem Schreiben fehlgeschlagen')
      }
      await this.store.set(KEY_POINTER, targetPointer)
      mirror.write(MIRROR_KEY, env)
    } catch (err) {
      log.error('Speichern fehlgeschlagen — alter Stand bleibt gültig', err)
      mirror.write(MIRROR_KEY, env)
      this.pending = true
    }
  }

  // -------------------------------------------------------------------------
  // Laufender Levelversuch
  // -------------------------------------------------------------------------

  async saveRun(snapshot: RunSnapshot): Promise<void> {
    try {
      await this.store.set(KEY_RUN, {
        version: SAVE_SCHEMA_VERSION,
        checksum: checksum(snapshot),
        data: snapshot,
      })
    } catch (err) {
      log.warn('Laufzustand konnte nicht gespeichert werden', err)
    }
  }

  async loadRun(): Promise<RunSnapshot | null> {
    const env = await this.safeGet<{ version: number; checksum: string; data: RunSnapshot }>(
      KEY_RUN,
    )
    if (!env || env.version !== SAVE_SCHEMA_VERSION) return null
    if (checksum(env.data) !== env.checksum) {
      log.warn('Laufzustand beschädigt, wird verworfen')
      await this.clearRun()
      return null
    }
    return env.data
  }

  async clearRun(): Promise<void> {
    try {
      await this.store.remove(KEY_RUN)
    } catch {
      /* ignorieren */
    }
  }

  // -------------------------------------------------------------------------
  // Export / Import
  // -------------------------------------------------------------------------

  exportJson(): string {
    const env: SaveEnvelope<ProfileData> = {
      version: SAVE_SCHEMA_VERSION,
      checksum: checksum(this.profile),
      savedAt: Date.now(),
      gameVersion: GAME_VERSION,
      data: this.profile,
    }
    return JSON.stringify(env, null, 2)
  }

  importJson(json: string): ProfileData {
    const env = JSON.parse(json) as SaveEnvelope<unknown>
    const parsed = this.verify(env)
    if (!parsed) throw new Error('Die Datei enthält keinen gültigen Spielstand.')
    this.profile = parsed
    this.requestSave()
    return parsed
  }

  /** Alles zurücksetzen — nur auf ausdrücklichen Wunsch des Spielers. */
  async reset(): Promise<void> {
    this.profile = defaultProfile()
    this.pending = true
    await this.flush()
    await this.clearRun()
  }

  private async safeGet<T>(key: string): Promise<T | undefined> {
    try {
      return await this.store.get<T>(key)
    } catch (err) {
      log.warn(`Lesen von ${key} fehlgeschlagen`, err)
      return undefined
    }
  }
}

/** Stabile Prüfsumme über die JSON-Darstellung. */
export function checksum(data: unknown): string {
  return Rng.hash(JSON.stringify(data)).toString(16).padStart(8, '0')
}
