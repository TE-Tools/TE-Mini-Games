import type { World } from '@/games/emberwake/world/World'
import { updateClock } from './DayNightSystem'
import { updatePlayer, type InputFrame } from './PlayerSystem'
import { updateInteraction } from './InteractionSystem'
import { updateEnemies } from '@/games/emberwake/ai/EnemyAI'
import { compactEnemies, onDawnStarted, onNightStarted, updateWaves } from './WaveSystem'
import { updateEmber } from './EmberSystem'
import { updateHealth } from './HealthSystem'
import { updateObjectives } from './ObjectiveSystem'
import { triggerHint, updateHints } from './HintSystem'

/**
 * Ein Simulationsschritt in fester Reihenfolge.
 * Kennt kein Three.js, kein DOM — läuft headless in Node.
 */
export class Simulation {
  private readonly unsubscribe: Array<() => void> = []

  constructor(readonly world: World) {
    const w = world
    this.unsubscribe.push(
      w.events.on('phase_changed', ({ phase }) => {
        if (phase === 'night') onNightStarted(w)
        if (phase === 'dawn') onDawnStarted(w)
      }),
      w.events.on('enemy_seen', () => triggerHint(w, 'enemy_seen')),
    )
    // Level, die in der Nacht beginnen
    if (w.clock.phase === 'night') onNightStarted(w)
  }

  step(input: InputFrame, dt: number): void {
    const w = this.world
    if (w.status !== 'running') {
      // Auflösende Gegner und Animationen dürfen ausklingen.
      updateEnemies(w, dt)
      compactEnemies(w)
      decayVisuals(w, dt)
      return
    }

    updateClock(w, dt)
    updatePlayer(w, input, dt)
    updateInteraction(w, input, dt)
    updateEnemies(w, dt)
    updateWaves(w)
    updateEmber(w, dt)
    updateHealth(w, dt)
    updateObjectives(w)
    updateHints(w)
    compactEnemies(w)
    decayVisuals(w, dt)
  }

  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.world.events.clear()
  }
}

function decayVisuals(w: World, dt: number): void {
  for (let i = 0; i < w.nodes.length; i++) {
    const n = w.nodes[i]!
    if (n.shake > 0) n.shake = Math.max(0, n.shake - dt * 4)
  }
}
