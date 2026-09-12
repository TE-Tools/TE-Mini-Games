import * as THREE from 'three'
import type { World, EnemyState } from '@/games/emberwake/world/World'
import { CAMP_POS } from '@/games/emberwake/world/World'
import type { QualitySettings } from '@/games/emberwake/platform/Capabilities'
import type { ResourceId } from '@/games/emberwake/data/schema/types'
import { ITEMS } from '@/games/emberwake/data/items'
import { visibilityRange } from '@/games/emberwake/systems/DayNightSystem'
import { lanternRadius } from '@/games/emberwake/systems/EmberSystem'
import { lerp, clamp01 } from '@/games/emberwake/core/math'
import { Rng } from '@/games/emberwake/core/Rng'
import { Particles } from './Particles'
import {
  coreModel,
  enemyModel,
  foodNodeGeometry,
  genericNodeGeometry,
  playerModel,
  rockGeometry,
  secretGeometry,
  slotMarkerGeometry,
  stoneNodeGeometry,
  stumpGeometry,
  treeGeometry,
  vertexMaterial,
  woodNodeGeometry,
  workbenchGeometry,
  type CoreModel,
  type EnemyModel,
  type PlayerModel,
} from './models'

/**
 * Spiegelt den Simulationszustand in eine Three.js-Szene.
 * Liest nur — schreibt nie in die Welt (ARCHITECTURE.md §3.2).
 * Positionen werden zwischen zwei Sim-Schritten interpoliert.
 */

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _axisY = new THREE.Vector3(0, 1, 0)
const _colA = new THREE.Color()
const _colB = new THREE.Color()

interface EnemyVisual extends EnemyModel {
  id: number
}

export class GameView {
  readonly scene = new THREE.Scene()
  private readonly hemi: THREE.HemisphereLight
  private readonly sun: THREE.DirectionalLight
  private readonly coreLight: THREE.PointLight
  private readonly lanternLight: THREE.PointLight
  private readonly fog: THREE.Fog
  readonly particles: Particles

  private terrain: THREE.Mesh | null = null
  private treeTrunks: THREE.InstancedMesh[] = []
  private rocks: THREE.InstancedMesh[] = []
  private nodeMeshes = new Map<ResourceId, THREE.InstancedMesh>()
  private stumps: THREE.InstancedMesh | null = null
  private player: PlayerModel
  private core: CoreModel
  private slotMarkers: THREE.Mesh[] = []
  private buildingMeshes = new Map<string, THREE.Mesh>()
  private secretMesh: THREE.Mesh | null = null
  private enemyPool: EnemyVisual[] = []
  private enemyActive = new Map<number, EnemyVisual>()
  private readonly staticMaterial = vertexMaterial()
  private readonly disposables: Array<{ dispose(): void }> = []
  private world: World | null = null
  private emberTimer = 0
  private time = 0

  constructor(private quality: QualitySettings) {
    this.hemi = new THREE.HemisphereLight(0xb9c4d6, 0x3a3f36, 0.9)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.4)
    this.sun.position.set(30, 50, 20)
    this.sun.castShadow = quality.shadows
    this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize)
    this.sun.shadow.camera.near = 5
    this.sun.shadow.camera.far = 120
    this.sun.shadow.camera.left = -22
    this.sun.shadow.camera.right = 22
    this.sun.shadow.camera.top = 22
    this.sun.shadow.camera.bottom = -22
    this.sun.shadow.bias = -0.0015
    this.scene.add(this.hemi, this.sun, this.sun.target)

    this.coreLight = new THREE.PointLight(0xff9a4d, 60, 24, 1.6)
    this.coreLight.position.set(0, 1.4, 0)
    this.lanternLight = new THREE.PointLight(0xffb96a, 6, 7, 1.8)
    this.scene.add(this.coreLight, this.lanternLight)

    this.fog = new THREE.Fog(0xa8b2bf, 20, 90)
    this.scene.fog = this.fog
    this.scene.background = new THREE.Color(0x9aa7b8)

    this.particles = new Particles(quality.particleBudget)
    this.scene.add(this.particles.points)

    this.player = playerModel()
    this.scene.add(this.player.group)
    this.core = coreModel()
    this.scene.add(this.core.group)
  }

  // -------------------------------------------------------------------------
  // Welt laden
  // -------------------------------------------------------------------------

  load(world: World): void {
    this.unload()
    this.world = world
    const pal = world.worldDef.palette

    this.buildTerrain(world)
    this.buildObstacles(world)
    this.buildNodes(world)
    this.buildCamp(world)

    this.secretMesh = new THREE.Mesh(secretGeometry(), this.staticMaterial)
    this.secretMesh.position.set(
      world.secret.pos.x,
      world.terrain.heightAt(world.secret.pos.x, world.secret.pos.z),
      world.secret.pos.z,
    )
    this.scene.add(this.secretMesh)

    this.scene.background = new THREE.Color(pal.skyDay)
    this.fog.color.setHex(pal.fogDay)
    this.core.group.position.set(CAMP_POS.x, 0, CAMP_POS.z)
    this.player.group.position.set(world.player.pos.x, 0, world.player.pos.z)
  }

  private buildTerrain(w: World): void {
    const pal = w.worldDef.palette
    const segments = Math.min(96, Math.round(w.size / 1.4))
    const geo = new THREE.PlaneGeometry(w.size, w.size, segments, segments)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const rng = new Rng(w.level.seed ^ 0x51ee)
    _colA.setHex(pal.ground)
    _colB.setHex(pal.groundDark)
    const warm = new THREE.Color(0x8a7a5a)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = w.terrain.heightAt(x, z)
      pos.setY(i, h)
      const t = clamp01((h + w.level.terrain.elevation) / (w.level.terrain.elevation * 2 + 0.01))
      const c = _colA
        .clone()
        .lerp(_colB, 1 - t)
        .multiplyScalar(0.92 + rng.next() * 0.16)
      // Um das Lager wärmer — Lichtfarbe bedeutet Sicherheit.
      const dCamp = Math.hypot(x, z)
      if (dCamp < 9) c.lerp(warm, (1 - dCamp / 9) * 0.45)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()

    this.terrain = new THREE.Mesh(geo, this.staticMaterial)
    this.terrain.receiveShadow = true
    this.scene.add(this.terrain)
    this.disposables.push(geo)
  }

  private buildObstacles(w: World): void {
    const pal = w.worldDef.palette
    const byVariant: Record<number, typeof w.obstacles> = { 0: [], 1: [], 2: [] }
    const rocks: typeof w.obstacles = []
    for (const o of w.obstacles) {
      if (o.kind === 'tree') byVariant[o.variant]!.push(o)
      else rocks.push(o)
    }

    for (let v = 0; v < 3; v++) {
      const list = byVariant[v]!
      if (list.length === 0) continue
      const geo = treeGeometry(0x4a3b2c, pal.tree, pal.treeDark, v)
      const mesh = new THREE.InstancedMesh(geo, this.staticMaterial, list.length)
      mesh.castShadow = this.quality.shadows
      mesh.receiveShadow = true
      list.forEach((o, i) => {
        _p.set(o.x, w.terrain.heightAt(o.x, o.z) - 0.05, o.z)
        _q.setFromAxisAngle(_axisY, o.rotation)
        _s.set(o.scale, o.scale * (0.9 + (i % 3) * 0.08), o.scale)
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(i, _m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
      this.treeTrunks.push(mesh)
      this.disposables.push(geo)
    }

    if (rocks.length > 0) {
      const geo = rockGeometry(pal.rock, 0)
      const mesh = new THREE.InstancedMesh(geo, this.staticMaterial, rocks.length)
      mesh.castShadow = this.quality.shadows
      mesh.receiveShadow = true
      rocks.forEach((o, i) => {
        _p.set(o.x, w.terrain.heightAt(o.x, o.z) - 0.1, o.z)
        _q.setFromAxisAngle(_axisY, o.rotation)
        _s.set(o.scale, o.scale, o.scale)
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(i, _m)
      })
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
      this.rocks.push(mesh)
      this.disposables.push(geo)
    }
  }

  private buildNodes(w: World): void {
    const groups = new Map<ResourceId, number>()
    for (const n of w.nodes) groups.set(n.resource, (groups.get(n.resource) ?? 0) + 1)

    for (const [resource, count] of groups) {
      let geo: THREE.BufferGeometry
      switch (resource) {
        case 'wood':
          geo = woodNodeGeometry()
          break
        case 'stone':
          geo = stoneNodeGeometry()
          break
        case 'food':
          geo = foodNodeGeometry()
          break
        default:
          geo = genericNodeGeometry(ITEMS[resource].color)
      }
      const mesh = new THREE.InstancedMesh(geo, this.staticMaterial, count)
      mesh.castShadow = this.quality.shadows
      this.scene.add(mesh)
      this.nodeMeshes.set(resource, mesh)
      this.disposables.push(geo)
    }

    const stumpGeo = stumpGeometry()
    this.stumps = new THREE.InstancedMesh(
      stumpGeo,
      this.staticMaterial,
      Math.max(1, w.nodes.length),
    )
    this.stumps.count = 0
    this.scene.add(this.stumps)
    this.disposables.push(stumpGeo)
    this.syncNodes(w)
  }

  private syncNodes(w: World): void {
    const counters = new Map<ResourceId, number>()
    let stumpCount = 0
    for (const n of w.nodes) {
      const y = w.terrain.heightAt(n.pos.x, n.pos.z)
      if (n.amount <= 0) {
        if (this.stumps) {
          _p.set(n.pos.x, y, n.pos.z)
          _q.identity()
          _s.set(1, 1, 1)
          _m.compose(_p, _q, _s)
          this.stumps.setMatrixAt(stumpCount++, _m)
        }
        continue
      }
      const mesh = this.nodeMeshes.get(n.resource)
      if (!mesh) continue
      const i = counters.get(n.resource) ?? 0
      counters.set(n.resource, i + 1)
      const fill = 0.55 + 0.45 * (n.amount / n.maxAmount)
      const shake = n.shake > 0 ? Math.sin(n.shake * 40) * 0.06 * n.shake : 0
      _p.set(n.pos.x + shake, y, n.pos.z)
      _q.setFromAxisAngle(_axisY, n.id * 1.7)
      _s.set(fill, fill, fill)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    }
    for (const [resource, mesh] of this.nodeMeshes) {
      mesh.count = counters.get(resource) ?? 0
      mesh.instanceMatrix.needsUpdate = true
    }
    if (this.stumps) {
      this.stumps.count = stumpCount
      this.stumps.instanceMatrix.needsUpdate = true
    }
  }

  private buildCamp(w: World): void {
    const markerGeo = slotMarkerGeometry()
    this.disposables.push(markerGeo)
    for (const slot of w.camp.slots) {
      const marker = new THREE.Mesh(markerGeo, this.staticMaterial)
      marker.position.set(slot.pos.x, w.terrain.heightAt(slot.pos.x, slot.pos.z), slot.pos.z)
      this.scene.add(marker)
      this.slotMarkers.push(marker)
    }
    this.syncBuildings(w)
  }

  private syncBuildings(w: World): void {
    w.camp.slots.forEach((slot, i) => {
      const built = (w.camp.buildings[slot.building] ?? 0) > 0
      const unlocked = w.level.camp.unlockedBuildings.includes(slot.building)
      const marker = this.slotMarkers[i]
      if (marker) marker.visible = !built && unlocked
      if (built && !this.buildingMeshes.has(slot.building)) {
        let geo: THREE.BufferGeometry
        switch (slot.building) {
          case 'workbench':
            geo = workbenchGeometry()
            break
          default:
            geo = workbenchGeometry()
        }
        const mesh = new THREE.Mesh(geo, this.staticMaterial)
        mesh.castShadow = this.quality.shadows
        mesh.position.set(slot.pos.x, w.terrain.heightAt(slot.pos.x, slot.pos.z), slot.pos.z)
        mesh.rotation.y = Math.atan2(-slot.pos.x, -slot.pos.z)
        this.scene.add(mesh)
        this.buildingMeshes.set(slot.building, mesh)
        this.disposables.push(geo)
      }
    })
  }

  // -------------------------------------------------------------------------
  // Pro Bild
  // -------------------------------------------------------------------------

  sync(w: World, alpha: number, dt: number): void {
    this.time += dt
    const pal = w.worldDef.palette
    const sun = w.clock.sun

    // Himmel, Nebel, Sonne
    _colA.setHex(pal.skyNight).lerp(_colB.setHex(pal.skyDay), sun)
    ;(this.scene.background as THREE.Color).copy(_colA)
    _colA.setHex(pal.fogNight).lerp(_colB.setHex(pal.fogDay), sun)
    this.fog.color.copy(_colA)
    const range = Math.min(visibilityRange(w), this.quality.drawDistance)
    this.fog.near = range * 0.28
    this.fog.far = range

    this.sun.intensity = lerp(0.12, 1.5, sun)
    this.sun.color.setHex(sun > 0.5 ? 0xfff1dc : 0x7d8fc4)
    this.hemi.intensity = lerp(0.18, 0.95, sun)

    // Spieler (interpoliert)
    const p = w.player
    const px = lerp(p.prevPos.x, p.pos.x, alpha)
    const pz = lerp(p.prevPos.z, p.pos.z, alpha)
    const py = w.terrain.heightAt(px, pz)
    this.player.group.position.set(px, py, pz)
    this.player.group.rotation.y = -p.facing + Math.PI / 2
    this.player.group.visible = p.alive

    const moving = Math.hypot(p.vel.x, p.vel.z) > 0.2
    const bob = moving ? Math.sin(p.stride * 5) * 0.06 : 0
    this.player.body.position.y = 0.05 + Math.abs(bob)
    this.player.head.position.y = 1.5 + bob * 1.4
    this.player.arm.rotation.z =
      0.5 - p.attackAnim * 1.9 + (moving ? Math.sin(p.stride * 5) * 0.25 : 0)
    this.player.arm.rotation.x = -p.attackAnim * 1.2

    const lantern = lanternRadius(w)
    this.lanternLight.position.set(px, py + 1.0, pz)
    this.lanternLight.distance = lantern * 1.9
    this.lanternLight.intensity = p.alive ? lerp(9, 4, sun) : 0
    this.player.lanternMaterial.color.setHex(0xffb35c)

    // Schattenkamera folgt dem Spieler
    this.sun.position.set(px + 30, 50, pz + 20)
    this.sun.target.position.set(px, py, pz)
    this.sun.target.updateMatrixWorld()

    // Kern
    const charge = clamp01(w.ember.charge / 100)
    const pulse = 1 + Math.sin(this.time * 2.2) * 0.04 * (0.4 + charge)
    this.core.crystal.scale.setScalar(pulse * (0.75 + charge * 0.4))
    this.core.crystal.rotation.y = this.time * 0.6
    this.core.crystal.position.y = 1.05 + Math.sin(this.time * 1.3) * 0.05
    _colA.setHex(0x5a3020).lerp(_colB.setHex(0xffa85a), Math.sqrt(charge))
    this.core.crystalMaterial.color.copy(_colA)
    this.coreLight.intensity = lerp(4, 70, charge) * lerp(1.0, 0.75, sun)
    this.coreLight.distance = w.ember.lightRadius * 2.2
    this.core.glowMaterial.opacity = lerp(0.05, 0.4, charge) * lerp(1, 0.35, sun)
    this.core.glowRing.scale.setScalar(0.4 + charge * 0.8)
    this.core.lightRing.scale.setScalar(w.ember.lightRadius)
    ;(this.core.lightRing.material as THREE.MeshBasicMaterial).opacity =
      lerp(0.55, 0.12, sun) * (0.4 + charge * 0.6)
    if (w.ember.threshold === 'critical') {
      ;(this.core.lightRing.material as THREE.MeshBasicMaterial).opacity *=
        0.6 + Math.sin(this.time * 8) * 0.4
    }

    this.emberTimer -= dt
    if (this.emberTimer <= 0) {
      this.emberTimer = lerp(0.35, 0.06, charge)
      this.particles.ember(CAMP_POS.x, 1.1, CAMP_POS.z, 0xff9a4d, 0.5)
    }

    // Gegner
    this.syncEnemies(w, alpha)

    // Knoten und Gebäude
    this.syncNodes(w)
    this.syncBuildings(w)
    if (this.secretMesh) this.secretMesh.visible = !w.secret.found

    this.particles.update(dt)
  }

  private syncEnemies(w: World, alpha: number): void {
    // Aktive Visuals markieren
    for (const v of this.enemyActive.values()) v.group.visible = false

    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i]!
      let v = this.enemyActive.get(e.id)
      if (!v) {
        v = this.acquireEnemyVisual(e)
        this.enemyActive.set(e.id, v)
      }
      v.group.visible = true
      const ex = lerp(e.prevPos.x, e.pos.x, alpha)
      const ez = lerp(e.prevPos.z, e.pos.z, alpha)
      v.group.position.set(ex, w.terrain.heightAt(ex, ez), ez)
      v.group.rotation.y = -e.facing
      const s = e.def.scale * (0.6 + 0.4 * e.dissolve)
      v.group.scale.setScalar(s)
      v.bodyMaterial.opacity = e.dissolve
      v.eyeMaterial.opacity = e.dissolve
      v.bodyMaterial.color.setHex(e.hitFlash > 0 ? 0xffffff : e.def.color)
      v.eyeMaterial.color.setHex(e.def.eyeColor)
      // Angriffsanimation: Vorstoß
      v.body.position.x = Math.max(0, e.attackAnim) * 0.35
      // Im Licht leiden sie sichtbar
      if (e.exposure > e.def.lightTolerance && e.alive) {
        v.bodyMaterial.color.lerp(_colA.setHex(0xff6a3c), 0.5)
      }
    }

    // Verschwundene freigeben
    for (const [id, v] of this.enemyActive) {
      if (!v.group.visible) {
        this.enemyActive.delete(id)
        this.enemyPool.push(v)
      }
    }
  }

  private acquireEnemyVisual(e: EnemyState): EnemyVisual {
    let v = this.enemyPool.pop()
    if (!v) {
      const model = enemyModel()
      this.scene.add(model.group)
      v = { ...model, id: e.id }
    }
    v.id = e.id
    v.group.position.set(e.pos.x, 0, e.pos.z)
    return v
  }

  /** Höhe des Bodens an einer Stelle — für Kamera und Partikel. */
  groundHeight(x: number, z: number): number {
    return this.world ? this.world.terrain.heightAt(x, z) : 0
  }

  setQuality(q: QualitySettings): void {
    this.quality = q
    this.sun.castShadow = q.shadows
  }

  unload(): void {
    if (!this.world) return
    for (const m of [
      this.terrain,
      ...this.treeTrunks,
      ...this.rocks,
      ...this.nodeMeshes.values(),
      this.stumps,
      ...this.slotMarkers,
      ...this.buildingMeshes.values(),
      this.secretMesh,
    ]) {
      if (m) this.scene.remove(m)
    }
    for (const d of this.disposables) d.dispose()
    this.disposables.length = 0
    this.terrain = null
    this.treeTrunks = []
    this.rocks = []
    this.nodeMeshes.clear()
    this.stumps = null
    this.slotMarkers = []
    this.buildingMeshes.clear()
    this.secretMesh = null
    for (const v of this.enemyActive.values()) {
      v.group.visible = false
      this.enemyPool.push(v)
    }
    this.enemyActive.clear()
    this.world = null
  }
}
