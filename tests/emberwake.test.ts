/**
 * EMBERWAKE — Simulation ohne Browser.
 *
 * Die Spiellogik kennt kein Three.js und kein DOM; deshalb kann ein Bot hier
 * Level 1 und 2 komplett durchspielen. Das ist der eigentliche Nachweis, dass
 * ein Level schaffbar ist -- nicht eine Meinung, sondern ein Testergebnis.
 */
import { describe, it, expect } from 'vitest'
import { generateWorld } from '@/games/emberwake/world/WorldGen'
import { Simulation } from '@/games/emberwake/systems/Simulation'
import { emptyInput } from '@/games/emberwake/systems/PlayerSystem'
import { GreedyBot } from '@/games/emberwake/dev/Bot'
import { getLevel, getWorldForLevel, LEVELS } from '@/games/emberwake/data/levels'
import { Rng } from '@/games/emberwake/core/Rng'
import { exposureAt } from '@/games/emberwake/systems/EmberSystem'
import { CAMP_POS } from '@/games/emberwake/world/World'
import {
  addToInventory,
  canCarry,
  depositAll,
  dropHeaviest,
  speedFactor,
  weightOf,
} from '@/games/emberwake/systems/InventorySystem'

const STEP = 1 / 30
const LEER = { buildings: {}, stock: {}, tools: [] as never[] }

function mitBot(levelId: number, maxSekunden: number) {
  const level = getLevel(levelId)!
  const world = generateWorld(level, getWorldForLevel(level), LEER)
  const sim = new Simulation(world)
  const bot = new GreedyBot(world)
  const input = emptyInput()
  const spur: number[] = []

  const schritte = Math.ceil(maxSekunden / STEP)
  for (let i = 0; i < schritte && world.status === 'running'; i++) {
    bot.decide(input)
    sim.step(input, STEP)
    if (i % 30 === 0)
      spur.push(Math.round(world.player.pos.x * 100), Math.round(world.player.pos.z * 100))
  }
  return { world, spur: Rng.hash(spur.join(',')) }
}

describe('Emberwake – Zufall', () => {
  it('ist deterministisch bei gleichem Seed', () => {
    const a = new Rng(1234)
    const b = new Rng(1234)
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next())
  })

  it('fork() liefert unabhängige, aber reproduzierbare Ströme', () => {
    const a = new Rng(42).fork('worldgen')
    const b = new Rng(42).fork('worldgen')
    const c = new Rng(42).fork('ai')
    expect(a.next()).toBe(b.next())
    expect(a.next()).not.toBe(c.next())
  })
})

describe('Emberwake – Welt', () => {
  it('erzeugt aus gleichem Seed exakt dieselbe Welt', () => {
    const level = getLevel(1)!
    const a = generateWorld(level, getWorldForLevel(level), LEER)
    const b = generateWorld(level, getWorldForLevel(level), LEER)
    expect(a.nodes.map((n) => [n.pos.x, n.pos.z, n.amount])).toEqual(
      b.nodes.map((n) => [n.pos.x, n.pos.z, n.amount]),
    )
    expect(a.obstacles.length).toBe(b.obstacles.length)
    expect(a.secret.pos).toEqual(b.secret.pos)
  })

  it('legt keine Ressource ins Lager und keine über den Rand', () => {
    for (const level of LEVELS) {
      const w = generateWorld(level, getWorldForLevel(level), LEER)
      for (const n of w.nodes) {
        expect(Math.hypot(n.pos.x, n.pos.z)).toBeGreaterThan(5)
        expect(Math.abs(n.pos.x)).toBeLessThan(w.half)
        expect(Math.abs(n.pos.z)).toBeLessThan(w.half)
      }
    }
  })

  it('macht jeden Ressourcenknoten auf gerader Linie vom Lager erreichbar', () => {
    for (const level of LEVELS) {
      const w = generateWorld(level, getWorldForLevel(level), LEER)
      for (const n of w.nodes) {
        for (let i = 1; i < 40; i++) {
          const t = i / 40
          const x = CAMP_POS.x + (n.pos.x - CAMP_POS.x) * t
          const z = CAMP_POS.z + (n.pos.z - CAMP_POS.z) * t
          if (Math.hypot(n.pos.x - x, n.pos.z - z) < n.radius + 0.6) break
          // Der Kern selbst ist absichtlich ein Hindernis.
          if (Math.hypot(x, z) < 1.6) continue
          expect(w.collision.isFree(x, z, 0.42), `Level ${level.id}, Knoten ${n.id}`).toBe(true)
        }
      }
    }
  })
})

describe('Emberwake – Lichtschuld und Ballast', () => {
  it('lässt den Kern weit draußen deutlich schneller sinken', () => {
    const level = getLevel(1)!
    const w = generateWorld(level, getWorldForLevel(level), LEER)
    const sim = new Simulation(w)
    const input = emptyInput()
    sim.step(input, STEP)
    const nah = w.ember.drainRate
    w.player.pos.x = 50
    sim.step(input, STEP)
    expect(w.ember.drainRate).toBeGreaterThan(nah * 3)
  })

  it('ist am Kern hell und weit draußen dunkel', () => {
    const level = getLevel(2)!
    const w = generateWorld(level, getWorldForLevel(level), LEER)
    w.player.pos.x = 40
    w.player.pos.z = 40
    expect(exposureAt(w, { x: 0.5, z: 0.5 })).toBeGreaterThan(0.7)
    expect(exposureAt(w, { x: 30, z: -30 })).toBe(0)
  })

  it('rechnet Gewicht als Einheiten × Einzelgewicht', () => {
    expect(weightOf({ wood: 4, stone: 2 })).toBeCloseTo(4 * 1.0 + 2 * 2.5)
  })

  it('bremst voll beladen um 55 %', () => {
    const level = getLevel(1)!
    const w = generateWorld(level, getWorldForLevel(level), LEER)
    expect(speedFactor(w)).toBe(1)
    addToInventory(w, 'wood', w.player.carryCapacity)
    expect(speedFactor(w)).toBeCloseTo(1 - 0.55)
  })

  it('lässt nichts über die Traglast hinaus aufnehmen', () => {
    const level = getLevel(1)!
    const w = generateWorld(level, getWorldForLevel(level), LEER)
    addToInventory(w, 'wood', w.player.carryCapacity - 1)
    expect(canCarry(w, 'wood')).toBe(true)
    expect(canCarry(w, 'stone')).toBe(false)
  })

  it('lagert den ganzen Rucksack ein und wirft den schwersten Posten halb ab', () => {
    const level = getLevel(1)!
    const w = generateWorld(level, getWorldForLevel(level), LEER)
    addToInventory(w, 'wood', 5)
    addToInventory(w, 'food', 2)
    expect(depositAll(w)).toEqual({ wood: 5, food: 2 })
    expect(w.camp.stock.wood).toBe(5)
    expect(w.player.weight).toBe(0)

    addToInventory(w, 'wood', 3)
    addToInventory(w, 'stone', 4)
    expect(dropHeaviest(w)).toEqual({ item: 'stone', amount: 2 })
  })
})

describe('Emberwake – Level sind schaffbar', () => {
  it('spielt bei gleichen Eingaben exakt gleich ab', () => {
    const a = mitBot(1, 120)
    const b = mitBot(1, 120)
    expect(a.spur).toBe(b.spur)
    expect(a.world.ember.charge).toBe(b.world.ember.charge)
  })

  it('Level 1 „Erste Glut" wird vom Bot geschafft', () => {
    const { world } = mitBot(1, 600)
    expect(world.status).toBe('complete')
    expect(world.clock.elapsed).toBeLessThan(600)
  })

  it('Level 2 „Die erste Nacht" überlebt der Bot', () => {
    const { world } = mitBot(2, 900)
    if (world.status !== 'complete') {
      throw new Error(
        `Level 2 nicht geschafft: status=${world.status}, cause=${world.deathCause}, ` +
          `t=${world.clock.elapsed.toFixed(0)}s, charge=${world.ember.charge.toFixed(0)}, hp=${world.player.hp}`,
      )
    }
    expect(world.clock.nightsSurvived).toBe(1)
  })
})
