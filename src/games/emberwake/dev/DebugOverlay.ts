import type { World } from '@/games/emberwake/world/World'
import { spawnEnemy } from '@/games/emberwake/systems/WaveSystem'
import { enterPhase } from '@/games/emberwake/systems/DayNightSystem'
import { logging } from '@/games/emberwake/core/Logger'

/**
 * Entwicklermodus (§47). Wird nur bei `?dev` geladen und ist im
 * Produktionsbuild nicht enthalten (dynamischer Import in App.ts).
 */
export interface DebugStats {
  fps: number
  frameMs: number
  simMs: number
  calls: number
  triangles: number
}

export class DebugOverlay {
  private readonly panel: HTMLElement
  private readonly actions: HTMLElement
  private frames = 0
  private acc = 0
  private fps = 0
  private minFps = 999
  god = false

  constructor(
    root: HTMLElement,
    private readonly getWorld: () => World | null,
  ) {
    this.panel = document.createElement('div')
    this.panel.id = 'debug'
    root.appendChild(this.panel)

    this.actions = document.createElement('div')
    this.actions.id = 'debug-actions'
    root.appendChild(this.actions)

    this.button('+10 Holz', (w) => {
      w.camp.stock.wood = (w.camp.stock.wood ?? 0) + 10
    })
    this.button('+10 Stein', (w) => {
      w.camp.stock.stone = (w.camp.stock.stone ?? 0) + 10
    })
    this.button('Kern 100', (w) => {
      w.ember.charge = w.ember.capacity
    })
    this.button('Kern 15', (w) => {
      w.ember.charge = 15
    })
    this.button('Dämmerung', (w) => {
      enterPhase(w, 'dusk')
    })
    this.button('Nacht', (w) => {
      enterPhase(w, 'night')
    })
    this.button('Morgen', (w) => {
      enterPhase(w, 'dawn')
    })
    this.button('Schleicher', (w) => {
      spawnEnemy(w, 'schleicher', w.player.pos.x + 8, w.player.pos.z)
    })
    this.button('Hetzer', (w) => {
      spawnEnemy(w, 'hetzer', w.player.pos.x - 10, w.player.pos.z + 4)
    })
    this.button('Brecher', (w) => {
      spawnEnemy(w, 'brecher', w.player.pos.x, w.player.pos.z - 12)
    })
    this.button('Teleport Geheimnis', (w) => {
      w.player.pos.x = w.secret.pos.x + 1.5
      w.player.pos.z = w.secret.pos.z
    })
    this.button('Teleport Lager', (w) => {
      w.player.pos.x = 0
      w.player.pos.z = 3
    })
    this.button('Unsterblich', (w) => {
      this.god = !this.god
      w.player.hp = w.player.maxHp
    })
    this.button('Log → Konsole', () => {
      console.table(logging.entries().slice(-30))
    })
  }

  /** Zusätzliche Aktion von außen (z. B. Autoplay aus der App). */
  addAction(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    b.addEventListener('click', fn)
    this.actions.prepend(b)
    return b
  }

  private button(label: string, fn: (w: World) => void): void {
    const b = document.createElement('button')
    b.textContent = label
    b.addEventListener('click', () => {
      const w = this.getWorld()
      if (w) fn(w)
    })
    this.actions.appendChild(b)
  }

  frame(frameDt: number, stats: Omit<DebugStats, 'fps'>): void {
    this.frames++
    this.acc += frameDt
    if (this.acc >= 0.5) {
      this.fps = this.frames / this.acc
      this.minFps = Math.min(this.minFps, this.fps)
      this.frames = 0
      this.acc = 0
    }
    const w = this.getWorld()
    if (this.god && w) w.player.hp = w.player.maxHp
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
      ?.usedJSHeapSize
    let text =
      `FPS ${this.fps.toFixed(0)} (min ${this.minFps === 999 ? '–' : this.minFps.toFixed(0)})  Frame ${stats.frameMs.toFixed(1)} ms\n` +
      `Sim ${stats.simMs.toFixed(2)} ms  Draws ${stats.calls}  Tris ${(stats.triangles / 1000).toFixed(1)}k\n`
    if (heap) text += `Heap ${(heap / 1048576).toFixed(0)} MB\n`
    if (w) {
      const alive = w.enemies.filter((e) => e.alive).length
      text +=
        `Gegner ${alive}/${w.enemies.length}  Knoten ${w.nodes.filter((n) => n.amount > 0).length}/${w.nodes.length}\n` +
        `Kern ${w.ember.charge.toFixed(1)}%  −${w.ember.drainRate.toFixed(3)}/s  R ${w.ember.lightRadius.toFixed(1)}m\n` +
        `Phase ${w.clock.phase} ${w.clock.phaseTime.toFixed(0)}/${w.clock.phaseDuration.toFixed(0)}  Nacht ${w.clock.night}\n` +
        `Pos ${w.player.pos.x.toFixed(1)}, ${w.player.pos.z.toFixed(1)}  HP ${w.player.hp.toFixed(0)}  Last ${w.player.weight.toFixed(1)}/${w.player.carryCapacity}\n` +
        `Status ${w.status}${this.god ? '  GOD' : ''}`
      const modes = new Map<string, number>()
      for (const e of w.enemies) if (e.alive) modes.set(e.mode, (modes.get(e.mode) ?? 0) + 1)
      if (modes.size)
        text += `\nKI ${Array.from(modes)
          .map(([m, n]) => `${m}:${n}`)
          .join(' ')}`
    }
    this.panel.textContent = text
  }

  setVisible(v: boolean): void {
    this.panel.hidden = !v
    this.actions.hidden = !v
  }
}
