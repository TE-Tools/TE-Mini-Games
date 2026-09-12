/**
 * Vollbild und Ausrichtung. Beides darf fehlschlagen (iOS) — das Spiel
 * funktioniert in beiden Ausrichtungen und auch ohne Vollbild.
 */
export async function requestFullscreen(): Promise<void> {
  try {
    const el = document.documentElement
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' })
    }
  } catch {
    /* iOS Safari: nicht verfügbar */
  }
}

export async function lockLandscape(): Promise<boolean> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>
    }
    if (orientation?.lock) {
      await orientation.lock('landscape')
      return true
    }
  } catch {
    /* nicht unterstützt oder nicht im Vollbild */
  }
  return false
}

export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth
}

let wakeLock: { release: () => Promise<void> } | null = null

export async function keepScreenAwake(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> }
    }
    if (nav.wakeLock && !wakeLock) {
      wakeLock = await nav.wakeLock.request('screen')
    }
  } catch {
    /* optional */
  }
}

export async function releaseScreenAwake(): Promise<void> {
  try {
    await wakeLock?.release()
  } catch {
    /* optional */
  } finally {
    wakeLock = null
  }
}
