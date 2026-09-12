/**
 * Generisches Objekt-Pooling.
 *
 * Partikel, Gegner, Projektile und Treffer-Ereignisse werden nie im
 * Simulationstakt neu erzeugt — sie kommen aus einem Pool und gehen
 * dorthin zurück. Das verhindert Mikroruckler durch die Garbage
 * Collection, die auf Mobilgeräten besonders spürbar sind.
 * Siehe docs/PERFORMANCE.md §3.5.
 */
export class Pool<T> {
  private readonly free: T[] = []
  private activeCount = 0

  constructor(
    private readonly create: () => T,
    private readonly reset?: (item: T) => void,
    prealloc = 0,
  ) {
    for (let i = 0; i < prealloc; i++) this.free.push(create())
  }

  acquire(): T {
    this.activeCount++
    const item = this.free.pop()
    if (item !== undefined) {
      this.reset?.(item)
      return item
    }
    return this.create()
  }

  release(item: T): void {
    this.activeCount = Math.max(0, this.activeCount - 1)
    this.free.push(item)
  }

  get active(): number {
    return this.activeCount
  }

  get available(): number {
    return this.free.length
  }
}
