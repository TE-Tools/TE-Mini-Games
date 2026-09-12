/**
 * App-Lebenszyklus (MOBILE.md §5).
 *
 * `visibilitychange` ist auf Mobilgeräten die letzte verlässliche
 * Gelegenheit zum Speichern. `beforeunload` ist dort NICHT verlässlich.
 */
export interface LifecycleHandlers {
  onHidden: () => void
  onVisible: () => void
}

export function attachLifecycle(handlers: LifecycleHandlers): () => void {
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') handlers.onHidden()
    else handlers.onVisible()
  }
  const onPageHide = (): void => handlers.onHidden()
  const onBlur = (): void => {
    // Auf manchen Android-Browsern kommt nur blur, kein visibilitychange.
    if (document.visibilityState === 'visible') handlers.onHidden()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('blur', onBlur)

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('blur', onBlur)
  }
}
