/**
 * Protokoll mit Ringpuffer.
 * Die letzten Einträge stehen dem Entwicklermodus und dem
 * Fehler-Wiederherstellungsbildschirm zur Verfügung.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  time: number
  level: LogLevel
  scope: string
  message: string
  data?: unknown
}

const BUFFER_SIZE = 200
const buffer: LogEntry[] = []
let listeners: Array<(e: LogEntry) => void> = []

/** Auch außerhalb von Vite lauffähig (tsx-Werkzeuge, Tests). */
const IS_DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)
  } catch {
    return false
  }
})()

let minLevel: LogLevel = IS_DEV ? 'debug' : 'info'

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function push(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (ORDER[level] < ORDER[minLevel]) return
  const entry: LogEntry = { time: Date.now(), level, scope, message, data }
  buffer.push(entry)
  if (buffer.length > BUFFER_SIZE) buffer.shift()
  for (const fn of listeners) fn(entry)

  if (IS_DEV) {
    const line = `[${scope}] ${message}`
    if (level === 'error') console.error(line, data ?? '')
    else if (level === 'warn') console.warn(line, data ?? '')
    else console.log(line, data ?? '')
  }
}

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, d) => push('debug', scope, m, d),
    info: (m, d) => push('info', scope, m, d),
    warn: (m, d) => push('warn', scope, m, d),
    error: (m, d) => push('error', scope, m, d),
  }
}

export const logging = {
  entries: (): readonly LogEntry[] => buffer,
  setLevel: (level: LogLevel): void => {
    minLevel = level
  },
  subscribe: (fn: (e: LogEntry) => void): (() => void) => {
    listeners.push(fn)
    return () => {
      listeners = listeners.filter((l) => l !== fn)
    }
  },
}
