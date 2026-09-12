import type { HintTrigger } from '@/games/emberwake/data/schema/types'
import type { World } from '@/games/emberwake/world/World'
import { hasAnyResources, loadRatio } from './InventorySystem'
import { canBuild } from './BaseSystem'

/**
 * Kontextuelle Hinweise — höchstens fünf Wörter, jeder genau einmal (§49).
 * Level 1 lehrt durch Notwendigkeit; die Hinweise bestätigen nur.
 */

export function updateHints(w: World): void {
  if (w.status !== 'running') return

  if (w.clock.elapsed > 0.6) tryHint(w, 'start')
  if (w.stats.gathered >= 1) tryHint(w, 'first_pickup')
  if (loadRatio(w) >= 0.8) tryHint(w, 'heavy')
  if (w.interactable?.kind === 'core' && hasAnyResources(w)) tryHint(w, 'at_core_with_loot')
  if (w.ember.threshold !== 'ok') tryHint(w, 'core_low')
  if (w.clock.phase === 'dusk') tryHint(w, 'dusk')
  if (w.level.camp.unlockedBuildings.includes('workbench') && canBuild(w, 'workbench').ok) {
    tryHint(w, 'workbench_available')
  }
}

/** Von außen ausgelöste Hinweise (z. B. erster Gegner gesehen). */
export function triggerHint(w: World, trigger: HintTrigger): void {
  tryHint(w, trigger)
}

function tryHint(w: World, trigger: HintTrigger): void {
  if (w.hintsShown.has(trigger)) return
  const def = w.level.hints.find((h) => h.trigger === trigger)
  w.hintsShown.add(trigger)
  if (!def) return
  w.events.emit('hint', { text: def.text })
}
