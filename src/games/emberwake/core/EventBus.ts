/**
 * Typisiertes Publish/Subscribe.
 *
 * UI, Audio und Rendering reagieren auf Ereignisse der Simulation,
 * statt sie zu pollen. Die Simulation kennt ihre Zuhörer nicht.
 */
export type Listener<T> = (payload: T) => void

export class EventBus<E extends object> {
  private readonly listeners = new Map<keyof E, Set<Listener<never>>>()

  /** Registriert einen Zuhörer und gibt die Abmeldefunktion zurück. */
  on<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(fn as Listener<never>)
    return () => this.off(event, fn)
  }

  /** Einmaliger Zuhörer. */
  once<K extends keyof E>(event: K, fn: Listener<E[K]>): () => void {
    const off = this.on(event, (payload) => {
      off()
      fn(payload)
    })
    return off
  }

  off<K extends keyof E>(event: K, fn: Listener<E[K]>): void {
    this.listeners.get(event)?.delete(fn as Listener<never>)
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    // Kopie, damit Abmeldungen während des Aufrufs sicher sind.
    for (const fn of Array.from(set)) {
      ;(fn as Listener<E[K]>)(payload)
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
