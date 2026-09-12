import type { World } from '@/games/emberwake/world/World'
import { CAMP_POS } from '@/games/emberwake/world/World'
import type { InputFrame } from '@/games/emberwake/systems/PlayerSystem'
import { dist2 } from '@/games/emberwake/core/math'
import { ITEMS } from '@/games/emberwake/data/items'
import { canCarry, loadRatio } from '@/games/emberwake/systems/InventorySystem'
import { refuelCore } from '@/games/emberwake/systems/EmberSystem'
import { build, canBuild } from '@/games/emberwake/systems/BaseSystem'
import { enemyInAttackRange } from '@/games/emberwake/systems/PlayerSystem'

/**
 * Gieriger Bot — spielt wie ein vorsichtiger Anfänger.
 *
 * Er ist gleichzeitig: Testspieler für automatisierte Level-Tests,
 * Motor der Balancing-Simulation (§45) und der Prototyp der späteren
 * KI-Spieler (§41, AI.md §10). Er benutzt dieselben Systeme wie die UI.
 */
export class GreedyBot {
  private targetNodeId: number | null = null

  constructor(private readonly world: World) {}

  decide(out: InputFrame): void {
    const w = this.world
    const p = w.player
    out.moveX = 0
    out.moveZ = 0
    out.sprint = false
    out.actionHeld = false
    out.actionPressed = false
    out.attackPressed = false
    out.dropPressed = false

    if (!p.alive || w.status !== 'running') return

    if (enemyInAttackRange(w)) {
      out.attackPressed = true
    }

    const nightSoon = w.clock.phase === 'dusk' || w.clock.phase === 'night'
    const heavy = loadRatio(w) >= 0.85
    const coreLow = w.ember.charge < 30 && (w.camp.stock.wood ?? 0) > 0
    const dCamp2 = dist2(p.pos, CAMP_POS)

    if (nightSoon || heavy || coreLow || (this.targetNodeId === null && !this.pickTarget())) {
      // Zurück zum Lager
      if (dCamp2 > 2.2 * 2.2) {
        this.moveToward(CAMP_POS.x, CAMP_POS.z, out)
        out.sprint = !heavy
      } else {
        if (w.interactable?.kind === 'core' && Object.keys(p.inventory).length > 0) {
          out.actionPressed = true
        }
        // Lagerentscheidungen wie ein Spieler im Menü: Kern nähren, bis er gut gefüllt ist
        if (w.ember.charge < 92 && (w.camp.stock.wood ?? 0) > 0) {
          refuelCore(w, Math.min(3, w.camp.stock.wood ?? 0))
        }
        if (canBuild(w, 'workbench').ok && w.ember.charge > 50) build(w, 'workbench')
        if (nightSoon) {
          // In der Nacht in Kernnähe bleiben, leicht kreisen
          const a = w.clock.elapsed * 0.4
          this.moveToward(Math.cos(a) * 1.6, Math.sin(a) * 1.6, out, 0.4)
        } else if (!this.pickTarget()) {
          // Nichts mehr zu holen
        }
      }
      return
    }

    const node = w.nodes.find((n) => n.id === this.targetNodeId)
    if (!node || node.amount <= 0 || !canCarry(w, node.resource)) {
      this.targetNodeId = null
      return
    }
    const reach = 1.6 + node.radius
    if (dist2(p.pos, node.pos) <= reach * reach) {
      out.actionHeld = true
    } else {
      this.moveToward(node.pos.x, node.pos.z, out)
    }
  }

  private pickTarget(): boolean {
    const w = this.world
    let best: number | null = null
    let bestScore = Number.POSITIVE_INFINITY
    const wantWood = (w.camp.stock.wood ?? 0) < 20
    for (const n of w.nodes) {
      if (n.amount <= 0 || !canCarry(w, n.resource)) continue
      const d = Math.sqrt(dist2(n.pos, w.player.pos))
      // Holz zuerst, alles andere nur wenn nah
      const weight = n.resource === 'wood' && wantWood ? 1 : 2.5
      const score = d * weight + ITEMS[n.resource].weight
      if (score < bestScore) {
        bestScore = score
        best = n.id
      }
    }
    this.targetNodeId = best
    return best !== null
  }

  private moveToward(x: number, z: number, out: InputFrame, strength = 1): void {
    const p = this.world.player
    const dx = x - p.pos.x
    const dz = z - p.pos.z
    const d = Math.sqrt(dx * dx + dz * dz)
    if (d < 0.05) return
    out.moveX = (dx / d) * strength
    out.moveZ = (dz / d) * strength
  }
}
