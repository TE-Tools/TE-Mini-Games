import { db, type SyncOutboxItem } from './db'

function generateId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

export async function enqueueOutbox(
  type: SyncOutboxItem['type'],
  payload: Record<string, unknown>,
): Promise<SyncOutboxItem> {
  const item: SyncOutboxItem = {
    id: generateId(),
    type,
    payload,
    createdAt: nowIso(),
    attempts: 0,
    lastError: null,
  }
  await db.syncOutbox.put(item)
  return item
}

export async function getPendingOutbox(limit = 50): Promise<SyncOutboxItem[]> {
  return db.syncOutbox.orderBy('createdAt').limit(limit).toArray()
}

export async function markOutboxSuccess(id: string): Promise<void> {
  await db.syncOutbox.delete(id)
}

export async function markOutboxFailure(id: string, error: string): Promise<void> {
  const item = await db.syncOutbox.get(id)
  if (!item) return
  await db.syncOutbox.put({
    ...item,
    attempts: item.attempts + 1,
    lastError: error,
  })
}

export async function clearOutbox(): Promise<void> {
  await db.syncOutbox.clear()
}

export async function outboxCount(): Promise<number> {
  return db.syncOutbox.count()
}
