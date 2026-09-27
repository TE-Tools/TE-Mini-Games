import type { Rng } from '@/games/emberwake/core/Rng'
import type { LevelDef, ResourceCluster, WorldDef } from '@/games/emberwake/data/schema/types'
import { angleDelta, TAU } from '@/games/emberwake/core/math'
import { distToSegment } from './Collision'
import {
  CAMP_POS,
  START_FACING,
  createEmptyWorld,
  type CampSnapshot,
  type NodeForm,
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
 * - Jeder GEPLANTE Ressourcenknoten ist auf gerader Linie vom Lager erreichbar
 * - Der erste Cluster liegt in der anfänglichen Blickrichtung (Tutorial)
 * - Das Geheimnis liegt frei und weit außen
 *
 * Holz ist seit dem 27.09.2026 kein Haufen mehr, der herumliegt, sondern der
 * Wald selbst: Jeder Baum ist ein Holzknoten und wird gefällt. Deshalb gilt
 * die Linie-zum-Lager-Garantie nur noch für die Knoten, die das Level plant --
 * für die Bäume des Waldes wäre sie das Ende des Waldes.
 */

const CAMP_CLEAR_RADIUS = 7.5
/**
 * So weit ist rund ums Lager schon gerodet.
 *
 * Nah am Lager steht nur, was das Level ausdrücklich setzt. Der Wald
 * beginnt weiter draußen -- sonst stünde das nächste Holz sieben Meter vom
 * Kern entfernt, und die Lichtschuld (GAME_DESIGN §2.1) hätte nichts mehr
 * zu wiegen: Sie lebt davon, dass Holz weit weg ist. Erzählt wird dasselbe:
 * Wer hier lagert, hat das Nächstliegende längst verbrannt.
 */
const WALD_AB = 11
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

/** Holz kommt aus Bäumen, alles andere liegt am Boden. */
function formFuer(resource: string): NodeForm {
  return resource === 'wood' ? 'baum' : 'haufen'
}

/**
 * Wie viel Holz ein Baum trägt.
 *
 * Ein ganzer Baum gibt mehr her als ein Haufen Reisig, und ein dicker mehr
 * als ein dünner. Größe mal 3,2: ein kleiner Baum drei Scheite, ein großer
 * vier. Nachgemessen am 27.09.2026 -- mit zwei bis drei je Baum lief der
 * Bot für dieselbe Menge Holz deutlich weiter, und jeder Meter kostet
 * Kernladung (Lichtschuld).
 */
function holzFuerBaum(scale: number): number {
  return Math.max(3, Math.round(scale * 3.2))
}

export function generateWorld(level: LevelDef, worldDef: WorldDef, camp: CampSnapshot): World {
  const w = createEmptyWorld(level, worldDef, camp)
  const rng = w.rng.fork('worldgen')

  placeResourceNodes(w, rng.fork('nodes'))
  placeSecret(w, rng.fork('secret'))
  placeWald(w, rng.fork('obstacles'))
  carvePaths(w)
  buildCollision(w)

  recomputeCampEffects(w)
  scheduleWavesForLevel(w)

  return w
}

function neuerKnoten(
  w: World,
  resource: string,
  x: number,
  z: number,
  amount: number,
  geplant: boolean,
  rng: Rng,
  scale = 1,
): ResourceNodeState {
  const form = formFuer(resource)
  return {
    id: w.nextId++,
    resource: resource as ResourceNodeState['resource'],
    pos: { x, z },
    amount,
    maxAmount: amount,
    radius: form === 'baum' ? 0.45 * scale : (NODE_RADIUS[resource] ?? 0.5),
    shake: 0,
    form,
    geplant,
    scale,
    rotation: rng.next() * TAU,
    variant: rng.int(0, 2),
    fall: 0,
    fallDir: 0,
  }
}

function placeResourceNodes(w: World, rng: Rng): void {
  const clusters: ResourceCluster[] = w.level.resources
  const placed: ResourceNodeState[] = []

  /*
   * Verstellt etwas die Linie Lager → Ziel?
   *
   * Nötig, seit Holz auf Bäumen wächst: Ein Holzhaufen hatte keine
   * Kollision, ein Baum hat eine. Ein geplanter Baum darf deshalb weder den
   * Weg zu einem anderen geplanten Knoten verstellen noch selbst hinter
   * einem stehen -- sonst schlägt man sich zum Tutorial-Holz durchs
   * Unterholz.
   */
  const verstellt = (hx: number, hz: number, r: number, zx: number, zz: number): boolean =>
    distToSegment(hx, hz, CAMP_POS.x, CAMP_POS.z, zx, zz) < r + PATH_CLEARANCE

  clusters.forEach((cluster, clusterIndex) => {
    const baumCluster = formFuer(cluster.resource) === 'baum'
    for (let i = 0; i < cluster.count; i++) {
      let x = 0
      let z = 0
      let ok = false
      // Geplante Bäume stehen größer da: Sie sind das, was das Level meint.
      const scale = baumCluster ? rng.range(1.1, 1.45) : 1
      const radius = baumCluster ? 0.45 * scale : (NODE_RADIUS[cluster.resource] ?? 0.5)
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
          if (p.form === 'baum' && verstellt(p.pos.x, p.pos.z, p.radius, x, z)) {
            ok = false
            break
          }
          if (baumCluster && verstellt(x, z, radius, p.pos.x, p.pos.z)) {
            ok = false
            break
          }
        }
      }
      if (!ok) continue
      const amount = rng.int(cluster.amount[0], cluster.amount[1])
      // Das Größere von beidem, nicht die Summe -- die hätte die Mengen der
      // Level still verdoppelt, und die stehen dort nicht zufällig.
      const menge = baumCluster ? Math.max(amount, holzFuerBaum(scale)) : amount
      placed.push(neuerKnoten(w, cluster.resource, x, z, menge, true, rng, scale))
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

/**
 * Der Wald: Bäume zum Fällen, Felsen als Hindernis.
 *
 * Die Bäume wandern in `w.nodes` -- sie sind Holz, keine Kulisse. Ihre
 * Kollision steht wie vorher, sie fällt erst, wenn der Baum liegt.
 */
function placeWald(w: World, rng: Rng): void {
  const area = (w.size / 10) ** 2
  const treeCount = Math.round(area * w.level.terrain.treeDensity * 1.6)
  const rockCount = Math.round(area * w.level.terrain.rockDensity * 0.7)
  const obstacles: Obstacle[] = []

  const belegt = (x: number, z: number, r: number): boolean => {
    for (const n of w.nodes) {
      const dx = n.pos.x - x
      const dz = n.pos.z - z
      // Zu geplanten Knoten Abstand halten, damit sie erkennbar bleiben.
      const noetig = n.geplant ? r + n.radius + 1.4 : r + n.radius + 0.5
      if (dx * dx + dz * dz < noetig * noetig) return true
    }
    for (const o of obstacles) {
      const dx = o.x - x
      const dz = o.z - z
      if (dx * dx + dz * dz < (r + o.r + 0.5) ** 2) return true
    }
    return false
  }

  const tryPlace = (kind: 'tree' | 'rock'): void => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = rng.range(-w.half + 2, w.half - 2)
      const z = rng.range(-w.half + 2, w.half - 2)
      const dCamp2 = x * x + z * z
      const mindest = kind === 'tree' ? WALD_AB : CAMP_CLEAR_RADIUS
      if (dCamp2 < mindest * mindest) continue

      const scale = kind === 'tree' ? rng.range(0.8, 1.35) : rng.range(0.6, 1.6)
      const r = kind === 'tree' ? 0.45 * scale : 0.7 * scale

      if (belegt(x, z, r)) continue
      const sx = w.secret.pos.x - x
      const sz = w.secret.pos.z - z
      if (sx * sx + sz * sz < (r + 2.2) ** 2) continue

      if (kind === 'tree') {
        w.nodes.push(neuerKnoten(w, 'wood', x, z, holzFuerBaum(scale), false, rng, scale))
      } else {
        obstacles.push({
          x,
          z,
          r,
          kind,
          scale,
          rotation: rng.next() * TAU,
          variant: rng.int(0, 2),
        })
      }
      return
    }
  }

  for (let i = 0; i < treeCount; i++) tryPlace('tree')
  for (let i = 0; i < rockCount; i++) tryPlace('rock')

  w.obstacles = obstacles
}

/**
 * Räumt frei, was den direkten Weg Lager → geplanter Knoten versperrt.
 *
 * Bäume des Waldes zählen hier mit: Ein Wald vor dem Stein, den das Level
 * meint, wäre eine Mauer. Die geplanten Knoten selbst bleiben stehen.
 */
function carvePaths(w: World): void {
  const targets = w.nodes
    .filter((n) => n.geplant)
    .map((n) => n.pos)
    .concat([w.secret.pos])
  const blockiert = (x: number, z: number, r: number): boolean => {
    for (const t of targets) {
      const d = distToSegment(x, z, CAMP_POS.x, CAMP_POS.z, t.x, t.z)
      if (d < r + PATH_CLEARANCE) return true
    }
    return false
  }

  w.obstacles = w.obstacles.filter((o) => !blockiert(o.x, o.z, o.r))
  w.nodes = w.nodes.filter((n) => n.geplant || !blockiert(n.pos.x, n.pos.z, n.radius))
}

export function buildCollision(w: World): void {
  w.collision.clear()
  for (const o of w.obstacles) w.collision.insert({ x: o.x, z: o.z, r: o.r })
  // Stehende Bäume versperren den Weg. Gefallene nicht mehr.
  for (const n of w.nodes) {
    if (n.form === 'baum' && n.fall < 1) w.collision.insert({ x: n.pos.x, z: n.pos.z, r: n.radius })
  }
  // Kern selbst ist ein Hindernis
  w.collision.insert({ x: CAMP_POS.x, z: CAMP_POS.z, r: 0.9 })
  // Gebaute Slots werden in BaseSystem nachgetragen
  for (const slot of w.camp.slots) {
    if ((w.camp.buildings[slot.building] ?? 0) > 0) {
      w.collision.insert({ x: slot.pos.x, z: slot.pos.z, r: 0.8 })
    }
  }
}
