/**
 * Sync abstraction.
 * Phase 2: local-only queue. Phase 7: push to Supabase when online.
 *
 * Conflict rules (documented for Phase 7):
 * - Personal records: keep the better score
 * - XP: never blindly overwrite; merge by taking max totalXp / highest confirmed progress
 * - Progress: use highest confirmed level
 * - Results: append-only, dedupe by id
 */

import {
  getPendingOutbox,
  markOutboxSuccess,
  markOutboxFailure,
  dropOutboxItem,
  outboxCount,
} from '@/offline/outbox'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncResult {
  processed: number
  failed: number
  /** Endgültig aussortierte Einträge – siehe isPermanentFailure(). */
  dropped: number
  remaining: number
  status: SyncStatus
}

/**
 * Nach so vielen Fehlversuchen gilt ein Eintrag als hoffnungslos.
 * Vorübergehende Gründe (offline, nicht angemeldet) zählen nicht mit,
 * die werden vor dem Zählen abgefangen.
 */
const MAX_ATTEMPTS = 5

/** Postgres-Fehlercodes, die sich durch Wiederholen nie von selbst lösen. */
const PERMANENT_PG_CODES = new Set([
  '23503', // foreign_key_violation – z. B. Abzeichen fehlt im Katalog
  '23514', // check_violation – Wert außerhalb der erlaubten Grenzen
  '23502', // not_null_violation
  '22P02', // invalid_text_representation
  '42501', // insufficient_privilege (RLS verbietet es dauerhaft)
])

/**
 * Fehlt nur die Anmeldung oder das Netz, muss der Eintrag liegen bleiben –
 * er ist gültig, es fehlt bloß die Gelegenheit ihn hochzuladen.
 */
function isTemporaryFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /not authenticated|not configured|fetch|network|timeout|offline/i.test(message)
}

/**
 * Ein Eintrag, den der Server nie akzeptieren wird, darf die Warteschlange
 * nicht verstopfen: sie wird von den ältesten Einträgen her abgearbeitet, ein
 * Dauerfehler an der Spitze hält sonst alle späteren Ergebnisse auf.
 */
function isPermanentFailure(err: unknown, attempts: number): boolean {
  if (isTemporaryFailure(err)) return false
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === 'string' && PERMANENT_PG_CODES.has(code)) return true
  return attempts + 1 >= MAX_ATTEMPTS
}

/**
 * Attempt to flush the outbox.
 * In Phase 2 there is no remote backend – items stay queued until Phase 7.
 * This function is safe to call; it only processes when a remote adapter is registered.
 */
let remoteAdapter: ((item: {
  type: string
  payload: Record<string, unknown>
}) => Promise<void>) | null = null

export function registerSyncAdapter(
  adapter: (item: { type: string; payload: Record<string, unknown> }) => Promise<void>,
): void {
  remoteAdapter = adapter
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export async function processSyncQueue(): Promise<SyncResult> {
  if (!isOnline()) {
    return { processed: 0, failed: 0, dropped: 0, remaining: await outboxCount(), status: 'offline' }
  }

  if (!remoteAdapter) {
    // Phase 2: no remote – keep items in queue
    return { processed: 0, failed: 0, dropped: 0, remaining: await outboxCount(), status: 'idle' }
  }

  const pending = await getPendingOutbox()
  let processed = 0
  let failed = 0
  let dropped = 0

  for (const item of pending) {
    try {
      await remoteAdapter({ type: item.type, payload: item.payload })
      await markOutboxSuccess(item.id)
      processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error'
      if (isPermanentFailure(err, item.attempts)) {
        await dropOutboxItem(item.id, message)
        dropped++
      } else {
        await markOutboxFailure(item.id, message)
        failed++
      }
    }
  }

  const remaining = await outboxCount()
  return {
    processed,
    failed,
    dropped,
    remaining,
    status: failed > 0 ? 'error' : 'idle',
  }
}

export async function getSyncPendingCount(): Promise<number> {
  return outboxCount()
}
