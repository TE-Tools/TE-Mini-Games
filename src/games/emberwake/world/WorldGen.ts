import type { Rng } from '@/games/emberwake/core/Rng'
import type { LevelDef, ResourceCluster, WorldDef } from '@/games/emberwake/data/schema/types'
import { angleDelta, TAU } from '@/games/emberwake/core/math'
import { distToSegment } from './Collision'
import {
  CAMP_POS,
  START_FACING,
  createEmptyWorld,
  type CampSnapshot,
  type Obstacle,
  type ResourceNodeState,
  type World,
} from './World'
import { recomputeCampEffects } from '@/games/emberwake/systems/BaseSystem'
import { scheduleWavesForLevel } from '@/games/emberwake/systems/WaveSystem'

/**
 * Seeded Weltgenerierung (LEVEL_DESIGN.md §6).
 *
 * Garantien, die der Generator einhält:
 * - Kein Hindernis im Lagerbereich
 * - Jeder Ressourcenknoten ist auf gerader Linie vom Lager erreichbar
 * - Der erste Cluster liegt in der anfänglichen Blickrichtung (Tutorial)
 * - Das Geheimnis liegt frei und weit außen
 */

const CAMP_CLEAR_RADIUS = 7.5
const PATH_CLEARANCE = 1.6
const NODE_RADIUS: Record<string, number> = {
  wood: 0.55,
  stone: 0.7,
  food: 0.5,
  resin: 0.45,
  moss: 0.4,
  metal: 0.6,
  crystal: 0.4,
  artifact: 0.5,
}

export function generateWorld(level: LevelDef, worldDef: WorldDef, camp: CampSnapshot): World {
  const w = createEmptyWorld(level, worldDef, camp)
  const rng = w.rng.fork('worldgen')

  placeResourceNodes(w, rng.fork('nodes'))
  placeSecret(w, rng.fork('secret'))
  placeObstacles(w, rng.fork('obstacles'))
  carvePaths(w)
  buildCollision(w)

  recomputeCampEffects(w)
  scheduleWavesForLevel(w)

  return w
}

function placeResourceNodes(w: World, rng: Rng): void {
  const clusters: ResourceCluster[] = w.level.resources
  const placed: ResourceNodeState[] = []

  clusters.forEach((cluster, clusterIndex) => {
    for (let i = 0; i < cluster.count; i++) {
      let x = 0
      let z = 0
      let ok = false
      for (let attempt = 0; attempt < 40 && !ok; attempt++) {
        let angle = rng.angle()
        // Tutorial: Der erste Cluster liegt vor dem Spieler.
        if (clusterIndex === 0) {
          angle = START_FACING + rng.range(-0.6, 0.6)
        }
        const d = rng.range(cluster.minDist, cluster.maxDist)
        x = CAMP_POS.x + Math.cos(angle) * d
        z = CAMP_POS.z + Math.sin(angle) * d
        if (Math.abs(x) > w.half - 4 || Math.abs(z) > w.half - 4) continue
        ok = true
        for (const p of placed) {
          const dx = p.pos.x - x
          const dz = p.pos.z - z
          if (dx * dx + dz * dz < 3.2 * 3.2) {
            ok = false
            break
          }
        }
      }
      if (!ok) continue
      const amount = rng.int(cluster.amount[0], cluster.amount[1])
      const node: ResourceNodeState = {
        id: w.nextId++,
        resource: cluster.resource,
        pos: { x, z },
        amount,
        maxAmount: amount,
        radius: NODE_RADIUS[cluster.resource] ?? 0.5,
        shake: 0,
      }
      placed.push(node)
    }
  })

  w.nodes = placed
}

function placeSecret(w: World, rng: Rng): void {
  const d = w.level.secret.distance * w.half * 0.92
  // Nicht in Blickrichtung — das Geheimnis soll gesucht werden.
  let angle = rng.angle()
  if (Math.abs(angleDelta(angle, START_FACING)) < 0.9) angle += Math.PI
  const x = Math.cos(angle) * d
  const z = Math.sin(angle) * d
  w.secret.pos.x = Math.max(-w.half + 5, Math.min(w.half - 5, x))
  w.secret.pos.z = Math.max(-w.half + 5, Math.min(w.half - 5, z))
}

function placeObstacles(w: World, rng: Rng): void {
  const area = (w.size / 10) ** 2
  const treeCount = Math.round(area * w.level.terrain.treeDensity * 1.6)
  const rockCount = Math.round(area * w.level.terrain.rockDensity * 0.7)
  const obstacles: Obstacle[] = []

  const tryPlace = (kind: 'tree' | 'rock'): void => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = rng.range(-w.half + 2, w.half - 2)
      const z = rng.range(-w.half + 2, w.half - 2)
      const dCamp2 = x * x + z * z
      if (dCamp2 < CAMP_CLEAR_RADIUS * CAMP_CLEAR_RADIUS) continue

      const scale = kind === 'tree' ? rng.range(0.8, 1.35) : rng.range(0.6, 1.6)
      const r = kind === 'tree' ? 0.45 * scale : 0.7 * scale

      let ok = true
      for (const n of w.nodes) {
        const dx = n.pos.x - x
        const dz = n.pos.z - z
        if (dx * dx + dz * dz < (r + n.radius + 1.4) ** 2) {
          ok = false
          break
        }
      }
      if (!ok) continue
      const sx = w.secret.pos.x - x
      const sz = w.secret.pos.z - z
      if (sx * sx + sz * sz < (r + 2.2) ** 2) continue

      for (const o of obstacles) {
        const dx = o.x - x
        const dz = o.z - z
        if (dx * dx + dz * dz < (r + o.r + 0.5) ** 2) {
          ok = false
          break
        }
      }
      if (!ok) continue

      obstacles.push({
        x,
        z,
        r,
        kind,
        scale,
        rotation: rng.next() * TAU,
        variant: rng.int(0, 2),
      })
      return
    }
  }

  for (let i = 0; i < treeCount; i++) tryPlace('tree')
  for (let i = 0; i < rockCount; i++) tryPlace('rock')

  w.obstacles = obstacles
}

/** Entfernt Hindernisse, die den direkten Weg Lager → Knoten versperren. */
function carvePaths(w: World): void {
  const targets = w.nodes.map((n) => n.pos).concat([w.secret.pos])
  w.obstacles = w.obstacles.filter((o) => {
    for (const t of targets) {
      const d = distToSegment(o.x, o.z, CAMP_POS.x, CAMP_POS.z, t.x, t.z)
      if (d < o.r + PATH_CLEARANCE) return false
    }
    return true
  })
}

function buildCollision(w: World): void {
  w.collision.clear()
  for (const o of w.obstacles) w.collision.insert({ x: o.x, z: o.z, r: o.r })
  // Kern selbst ist ein Hindernis
  w.collision.insert({ x: CAMP_POS.x, z: CAMP_POS.z, r: 0.9 })
  // Gebaute Slots werden in BaseSystem nachgetragen
  for (const slot of w.camp.slots) {
    if ((w.camp.buildings[slot.building] ?? 0) > 0) {
      w.collision.insert({ x: slot.pos.x, z: slot.pos.z, r: 0.8 })
    }
  }
}
