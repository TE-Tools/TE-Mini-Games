/**
 * Spielschleife mit fester Simulations-Schrittweite.
 *
 * Die Simulation läuft in festen Schritten (Standard 30 Hz) und ist damit
 * unabhängig von der Bildrate. Das Rendering läuft so oft, wie der
 * Bildschirm es erlaubt, und erhält einen Interpolationsfaktor `alpha`
 * zwischen dem letzten und dem aktuellen Simulationszustand.
 * Siehe docs/ARCHITECTURE.md §3.1.
 */
export interface LoopCallbacks {
  /** Ein Simulationsschritt. `dt` ist immer exakt die feste Schrittweite. */
  step: (dt: number) => void
  /** Ein Bild. `alpha` ∈ [0,1) Anteil des angebrochenen nächsten Schritts. */
  render: (alpha: number, frameDt: number) => void
}

export class GameLoop {
  readonly stepSeconds: number

  private running = false
  private paused = false
  private accumulator = 0
  private lastTime = 0
  private rafId = 0

  /** Schutz vor der „Spirale des Todes" nach einem langen Aussetzer. */
  private static readonly MAX_ACCUMULATED = 0.25

  /**
   * Nur für die Entwicklung: In einem verborgenen Tab feuert
   * requestAnimationFrame nicht. Damit automatisierte Tests im
   * eingeklappten Browser weiterlaufen, tickt ein Timer-Fallback.
   * In Produktion bleibt es bei: verborgen = Pause.
   */
  private readonly tickWhenHidden: boolean
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly callbacks: LoopCallbacks,
    stepHz = 30,
    options: { tickWhenHidden?: boolean } = {},
  ) {
    this.stepSeconds = 1 / stepHz
    this.tickWhenHidden = options.tickWhenHidden ?? false
  }

  get isRunning(): boolean {
    return this.running
  }

  get isPaused(): boolean {
    return this.paused
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.paused = false
    this.accumulator = 0
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
    this.armHiddenTimer()
  }

  /** Siehe `tickWhenHidden`: Im verborgenen Tab feuert rAF nie — Timer nachlegen. */
  private armHiddenTimer(): void {
    if (!this.tickWhenHidden) return
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer)
    this.hiddenTimer = setTimeout(() => {
      this.hiddenTimer = null
      if (this.running && typeof document !== 'undefined' && document.hidden)
        this.frame(performance.now())
    }, 40)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
    if (this.hiddenTimer) {
      clearTimeout(this.hiddenTimer)
      this.hiddenTimer = null
    }
  }

  /** Simulation anhalten, weiter rendern (Pausenmenü, App im Hintergrund). */
  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (!this.paused) return
    this.paused = false
    this.accumulator = 0
    this.lastTime = performance.now()
    this.armHiddenTimer()
  }

  /**
   * Führt genau einen Simulationsschritt aus, ohne Bild.
   * Für Tests und die headless Balancing-Simulation.
   */
  stepOnce(): void {
    this.callbacks.step(this.stepSeconds)
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return
    this.rafId = requestAnimationFrame(this.frame)
    this.armHiddenTimer()

    const frameDt = Math.min((now - this.lastTime) / 1000, GameLoop.MAX_ACCUMULATED)
    this.lastTime = now

    if (!this.paused) {
      this.accumulator += frameDt
      // Vertane Zeit wird nicht nachgeholt, Pause bedeutet Pause (MOBILE.md §5).
      if (this.accumulator > GameLoop.MAX_ACCUMULATED) {
        this.accumulator = GameLoop.MAX_ACCUMULATED
      }
      while (this.accumulator >= this.stepSeconds) {
        this.callbacks.step(this.stepSeconds)
        this.accumulator -= this.stepSeconds
      }
    }

    const alpha = this.paused ? 0 : this.accumulator / this.stepSeconds
    this.callbacks.render(alpha, frameDt)
  }
}
