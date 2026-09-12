import { createLogger } from '@/games/emberwake/core/Logger'

/**
 * Schlüssel/Wert-Speicher: IndexedDB mit localStorage-Ausweichlösung.
 * Im Privatmodus oder bei blockiertem IndexedDB fällt alles auf
 * localStorage zurück — das Spiel bleibt spielbar (SAVE_SYSTEM.md §8).
 */

const log = createLogger('storage')
const DB_NAME = 'te-emberwake'
const STORE = 'kv'
const LS_PREFIX = 'emberwake:'

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  readonly kind: 'indexeddb' | 'localstorage' | 'memory'
}

class IndexedDbStore implements KeyValueStore {
  readonly kind = 'indexeddb' as const
  constructor(private readonly db: IDBDatabase) {}

  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, mode).objectStore(STORE)
  }

  get<T>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const req = this.tx('readonly').get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  set(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.tx('readwrite')
      const req = store.put(value, key)
      req.onerror = () => reject(req.error)
      store.transaction.oncomplete = () => resolve()
      store.transaction.onerror = () => reject(store.transaction.error)
    })
  }

  remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.tx('readwrite').delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

class LocalStorageStore implements KeyValueStore {
  readonly kind = 'localstorage' as const

  async get<T>(key: string): Promise<T | undefined> {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  }

  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(LS_PREFIX + key)
  }
}

/** Für Tests und als letzte Ausweichlösung. */
export class MemoryStore implements KeyValueStore {
  readonly kind = 'memory' as const
  private readonly map = new Map<string, string>()

  async get<T>(key: string): Promise<T | undefined> {
    const raw = this.map.get(key)
    return raw === undefined ? undefined : (JSON.parse(raw) as T)
  }

  async set(key: string, value: unknown): Promise<void> {
    this.map.set(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    this.map.delete(key)
  }
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nicht verfügbar'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('IndexedDB blockiert'))
  })
}

export async function openStore(): Promise<KeyValueStore> {
  try {
    const db = await openIndexedDb()
    return new IndexedDbStore(db)
  } catch (err) {
    log.warn('IndexedDB nicht nutzbar, weiche auf localStorage aus', err)
  }
  try {
    localStorage.setItem(LS_PREFIX + 'probe', '1')
    localStorage.removeItem(LS_PREFIX + 'probe')
    return new LocalStorageStore()
  } catch (err) {
    log.error('Kein dauerhafter Speicher verfügbar', err)
    return new MemoryStore()
  }
}

/** Kleiner Notfall-Spiegel, unabhängig vom Hauptspeicher. */
export const mirror = {
  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(LS_PREFIX + 'mirror:' + key, JSON.stringify(value))
    } catch {
      /* Spiegel ist optional */
    }
  },
  read<T>(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(LS_PREFIX + 'mirror:' + key)
      return raw === null ? undefined : (JSON.parse(raw) as T)
    } catch {
      return undefined
    }
  },
}

/** Bittet den Browser, den Speicher nicht automatisch zu räumen. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist()
      log.info(granted ? 'Speicher als dauerhaft markiert' : 'Dauerhafter Speicher nicht gewährt')
      return granted
    }
  } catch {
    /* nicht kritisch */
  }
  return false
}
