/**
 * Kleine Zustandsmaschine mit Enter/Exit-Hooks.
 * Wird für den Spielzustand (Titel → Spiel → Tod → Ergebnis …)
 * und den Tag/Nacht-Zyklus verwendet.
 */
export interface StateHandlers<S extends string> {
  enter?: (from: S | null) => void
  exit?: (to: S) => void
}

export class StateMachine<S extends string> {
  private current: S
  private readonly handlers: Partial<Record<S, StateHandlers<S>>>
  private readonly onChange?: (from: S | null, to: S) => void

  constructor(
    initial: S,
    handlers: Partial<Record<S, StateHandlers<S>>> = {},
    onChange?: (from: S | null, to: S) => void,
  ) {
    this.current = initial
    this.handlers = handlers
    this.onChange = onChange
    this.handlers[initial]?.enter?.(null)
    this.onChange?.(null, initial)
  }

  get state(): S {
    return this.current
  }

  is(state: S): boolean {
    return this.current === state
  }

  transition(to: S): void {
    if (to === this.current) return
    const from = this.current
    this.handlers[from]?.exit?.(to)
    this.current = to
    this.handlers[to]?.enter?.(from)
    this.onChange?.(from, to)
  }
}
