/**
 * High-precision timing for Perfect Second.
 * Uses performance.now() – never setInterval / CSS animations as time source.
 */

export interface TimerHandle {
  start: () => void
  elapsed: () => number
  stop: () => number
}

export function createTimer(): TimerHandle {
  let startAt = performance.now()
  let stoppedAt: number | null = null

  return {
    start: () => {
      startAt = performance.now()
      stoppedAt = null
    },
    elapsed: () => {
      const end = stoppedAt ?? performance.now()
      return (end - startAt) / 1000
    },
    stop: () => {
      if (stoppedAt === null) {
        stoppedAt = performance.now()
      }
      return (stoppedAt - startAt) / 1000
    },
  }
}

export function formatTime(seconds: number, decimals = 3): string {
  if (!Number.isFinite(seconds)) return '—'
  return seconds.toFixed(decimals)
}

/**
 * Target times and tolerances are round numbers – show them without the
 * millisecond zeros ("5", "1,5"), unlike measured times where every digit counts.
 */
export function formatTargetTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  return String(Math.round(seconds * 1000) / 1000)
}

export function formatDeviation(seconds: number, decimals = 3): string {
  if (!Number.isFinite(seconds)) return '—'
  const sign = seconds > 0 ? '+' : seconds < 0 ? '' : ''
  return `${sign}${Math.abs(seconds).toFixed(decimals)}`
}
