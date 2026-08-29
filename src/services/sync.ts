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

import { getPendingOutbox, markOutboxSuccess, markOutboxFailure, outboxCount } from '@/offline/outbox'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncResult {
  processed: number
  failed: number
  remaining: number
  status: SyncStatus
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
    return { processed: 0, failed: 0, remaining: await outboxCount(), status: 'offline' }
  }

  if (!remoteAdapter) {
    // Phase 2: no remote – keep items in queue
    return { processed: 0, failed: 0, remaining: await outboxCount(), status: 'idle' }
  }

  const pending = await getPendingOutbox()
  let processed = 0
  let failed = 0

  for (const item of pending) {
    try {
      await remoteAdapter({ type: item.type, payload: item.payload })
      await markOutboxSuccess(item.id)
      processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown sync error'
      await markOutboxFailure(item.id, message)
      failed++
    }
  }

  const remaining = await outboxCount()
  return {
    processed,
    failed,
    remaining,
    status: failed > 0 ? 'error' : remaining > 0 ? 'idle' : 'idle',
  }
}

export async function getSyncPendingCount(): Promise<number> {
  return outboxCount()
}
