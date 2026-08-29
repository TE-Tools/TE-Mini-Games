/**
 * High-precision timing for Perfect Second.
 * Uses performance.now() – never setInterval / CSS animations as time source.
 */

export interface TimerHandle {
  /** Start timestamp (performance.now()) */
  start: number
  /** Elapsed seconds since start (live) */
  elapsed: () => number
  /** Stop and return final elapsed seconds */
  stop: () => number
}

export function createTimer(): TimerHandle {
  const start = performance.now()
  let stoppedAt: number | null = null

  return {
    start,
    elapsed: () => {
      const end = stoppedAt ?? performance.now()
      return (end - start) / 1000
    },
    stop: () => {
      if (stoppedAt === null) {
        stoppedAt = performance.now()
      }
      return (stoppedAt - start) / 1000
    },
  }
}

/** Format seconds for display, e.g. 10.037 */
export function formatTime(seconds: number, decimals = 3): string {
  if (!Number.isFinite(seconds)) return '—'
  return seconds.toFixed(decimals)
}

export function formatDeviation(seconds: number, decimals = 3): string {
  if (!Number.isFinite(seconds)) return '—'
  const sign = seconds > 0 ? '+' : seconds < 0 ? '' : ''
  // absoluteDeviation is always >= 0; signed variant for display if needed
  return `${sign}${Math.abs(seconds).toFixed(decimals)}`
}
