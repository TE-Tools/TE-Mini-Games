/**
 * Emberwake: Wiederbeleben per Belohnungsvideo (`emberwake-wiederbeleben`).
 *
 * Die Regel liegt in systems/ReviveSystem.ts und läuft hier kopflos -- ohne
 * Three.js, ohne DOM: eine echte Welt, ein echter Tod, ein Wiederbeleben.
 * Dazu die Buchung: Ein wiederbelebter Anlauf bringt keine Punkte, keinen
 * Rekord und höchstens einen Stern.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UiRoot, type UiCallbacks } from '@/games/emberwake/ui/UiRoot'
import { generateWorld } from '@/games/emberwake/world/WorldGen'
import { Simulation } from '@/games/emberwake/systems/Simulation'
import { emptyInput } from '@/games/emberwake/systems/PlayerSystem'
import { killPlayer, damagePlayer } from '@/games/emberwake/systems/HealthSystem'
import { getLevel, getWorldForLevel } from '@/games/emberwake/data/levels'
import { PLAYER_START, type World } from '@/games/emberwake/world/World'
import {
  REVIVE_CORE_SHARE,
  REVIVE_INVULNERABLE,
  bookCompletion,
  canRevive,
  revivePlayer,
  undoDeathPenalty,
} from '@/games/emberwake/systems/ReviveSystem'
import { restoreRun, snapshotRun } from '@/games/emberwake/save/runSnapshot'
import { emptyLevelRecord } from '@/games/emberwake/save/schema'
import { db } from '@/offline/db'
import { getOrCreateGameProgress, getPersonalRecord, saveGameResult } from '@/offline'
import { bucheEmberwake } from '@/pages/play/emberwakeBuchung'
import type { LevelOutcome } from '@/games/emberwake/App'

const LEER = { buildings: {}, stock: {}, tools: [] as never[] }

function neueWelt(): World {
  const level = getLevel(1)!
  return generateWorld(level, getWorldForLevel(level), LEER)
}

/** Ein Stück laufen, etwas tragen, dann von einem Schatten gefällt werden. */
function gestorben(): World {
  const w = neueWelt()
  w.player.pos.x = 9
  w.player.pos.z = -7
  w.player.inventory = { wood: 5, stone: 3 }
  w.camp.stock = { wood: 2 }
  damagePlayer(w, w.player.maxHp + 10, 'Ein Schatten')
  return w
}

describe('Emberwake: Wiederbeleben -- die Regel', () => {
  it('gibt es nur nach dem Tod', () => {
    const w = neueWelt()
    expect(canRevive(w)).toBe(false)
    expect(revivePlayer(w)).toBe(false)
    expect(w.status).toBe('running')
  })

  it('stellt den Spieler mit voller Gesundheit ins Lager und rettet die Hälfte des Rucksacks', () => {
    const w = gestorben()
    expect(w.status).toBe('dead')
    expect(canRevive(w)).toBe(true)

    expect(revivePlayer(w)).toBe(true)
    expect(w.status).toBe('running')
    expect(w.deathCause).toBeNull()
    expect(w.revived).toBe(true)
    expect(w.player.alive).toBe(true)
    expect(w.player.hp).toBe(w.player.maxHp)
    expect(w.player.pos).toMatchObject({ x: PLAYER_START.x, z: PLAYER_START.z })
    expect(w.player.invulnerable).toBe(REVIVE_INVULNERABLE)
    // 5 Holz → 2 gerettet, 3 Stein → 1 gerettet; der Rucksack ist leer.
    expect(w.player.inventory).toEqual({})
    expect(w.player.weight).toBe(0)
    expect(w.camp.stock).toEqual({ wood: 4, stone: 1 })
  })

  it('höchstens einmal je Anlauf', () => {
    const w = gestorben()
    revivePlayer(w)
    damagePlayer(w, w.player.maxHp + 10, 'Ein Schatten')
    // Unverwundbar nach dem Wiederbeleben -- erst danach trifft es.
    expect(w.status).toBe('running')
    w.player.invulnerable = 0
    damagePlayer(w, w.player.maxHp + 10, 'Ein Schatten')
    expect(w.status).toBe('dead')
    expect(canRevive(w)).toBe(false)
    expect(revivePlayer(w)).toBe(false)
    expect(w.status).toBe('dead')
  })

  it('zündet einen erloschenen Kern auf die Hälfte -- einen brennenden füllt es nicht auf', () => {
    const erloschen = neueWelt()
    erloschen.ember.charge = 0
    killPlayer(erloschen, 'Der Kern erlosch')
    revivePlayer(erloschen)
    expect(erloschen.ember.charge).toBe(erloschen.ember.capacity * REVIVE_CORE_SHARE)

    const brennt = gestorben()
    brennt.ember.charge = 37
    revivePlayer(brennt)
    expect(brennt.ember.charge).toBe(37)
  })

  it('ist deterministisch: gleiche Welt, gleiches Ergebnis', () => {
    const a = gestorben()
    const b = gestorben()
    revivePlayer(a)
    revivePlayer(b)
    // Die Uhr springt bei jedem Blick eine Millisekunde weiter. Damit
    // läuft der Grenzfall immer durch, statt nur manchmal: snapshotRun
    // setzt savedAt bei jedem Aufruf neu auf Date.now(), also darf jeder
    // Schnappschuss nur einmal genommen werden. Die alte Fassung rief
    // snapshotRun(a) zweimal auf -- für die linke Seite und für die
    // Ausnahme -- und verglich so zwei verschiedene Zeitpunkte. In der CI
    // ist sie daran gefallen (ein Unterschied von 1 ms).
    let tick = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => tick++)
    try {
      const schnappA = snapshotRun(a)
      const schnappB = snapshotRun(b)
      expect(schnappA).toEqual({ ...schnappB, savedAt: schnappA.savedAt })
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('läuft danach weiter -- die Simulation nimmt den Anlauf wieder auf', () => {
    const w = gestorben()
    const sim = new Simulation(w)
    revivePlayer(w)
    const vorher = w.clock.elapsed
    const eingabe = emptyInput()
    for (let i = 0; i < 30; i++) sim.step(eingabe, 1 / 30)
    expect(w.clock.elapsed).toBeGreaterThan(vorher)
    expect(w.status).toBe('running')
    sim.dispose()
  })

  it('übersteht Speichern und Laden: kein zweites Video nach dem Neuladen', () => {
    const w = gestorben()
    revivePlayer(w)
    const sicherung = snapshotRun(w)
    expect(sicherung.revived).toBe(true)
    const neu = neueWelt()
    restoreRun(neu, sicherung)
    expect(neu.revived).toBe(true)

    // Ältere Sicherungen kennen das Feld nicht: dann war es nicht.
    const alt = { ...snapshotRun(neueWelt()) }
    delete alt.revived
    const frisch = neueWelt()
    restoreRun(frisch, alt)
    expect(frisch.revived).toBe(false)
  })

  it('nimmt den Lebensverlust zurück, auch das letzte Leben', () => {
    const profil = { lives: 3, unlockedLevelId: 1 }
    undoDeathPenalty(profil, { lives: 1, unlockedLevelId: 4 })
    expect(profil).toEqual({ lives: 1, unlockedLevelId: 4 })
  })
})

describe('Emberwake: Wertung nach dem Wiederbeleben', () => {
  it('ohne Hilfe wie bisher: Sterne, Bestzeit, Extraleben', () => {
    const rec = emptyLevelRecord()
    const r = bookCompletion(rec, { stars: 3, time: 200, secret: true, revived: false })
    expect(r).toEqual({ stars: 3, firstThree: true })
    expect(rec).toMatchObject({ stars: 3, bestTime: 200, secret: true, completions: 1 })
  })

  it('mit Hilfe: höchstens ein Stern, keine Bestzeit, kein Extraleben', () => {
    const rec = emptyLevelRecord()
    const r = bookCompletion(rec, { stars: 3, time: 120, secret: true, revived: true })
    expect(r).toEqual({ stars: 1, firstThree: false })
    expect(rec).toMatchObject({ stars: 1, bestTime: null, completions: 1 })

    // Ein alter, echter Rekord bleibt stehen.
    const alt = { ...emptyLevelRecord(), stars: 2, bestTime: 300 }
    bookCompletion(alt, { stars: 3, time: 100, secret: false, revived: true })
    expect(alt).toMatchObject({ stars: 2, bestTime: 300 })
  })
})

describe('Emberwake: der Knopf im Todesbildschirm', () => {
  function todesbildschirm() {
    localStorage.setItem('te-sprache', 'de')
    // Die Oberfläche sucht ihre Knöpfe im Dokument -- also immer nur eine.
    document.body.innerHTML = ''
    const wurzel = document.createElement('div')
    wurzel.className = 'ew-root'
    document.body.append(wurzel)
    const leer = () => undefined
    const ui = new UiRoot(wurzel, new Proxy({} as UiCallbacks, { get: () => leer }))
    ui.showDeath('Ein Schatten', 2, null, null)
    return { ui, wurzel }
  }

  it('fehlt, solange kein Video angeboten wird -- der Bildschirm bleibt wie immer', () => {
    const { wurzel } = todesbildschirm()
    expect(wurzel.querySelector('[data-act="revive"]')).toBeNull()
    expect(wurzel.querySelector('[data-act="retry"]')).not.toBeNull()
  })

  it('ist als Werbevideo beschriftet und meldet ein abgebrochenes Video', async () => {
    const { ui, wurzel } = todesbildschirm()
    let antwort: (geschaut: boolean) => void = () => {}
    const ansehen = vi.fn(() => new Promise<boolean>((r) => (antwort = r)))
    ui.offerRevive(ansehen)
    const knopf = wurzel.querySelector<HTMLButtonElement>('[data-act="revive"]')!
    expect(knopf.textContent).toContain('Video ansehen: Wiederbeleben')
    expect(knopf.textContent).toContain('Werbevideo – freiwillig')

    knopf.click()
    expect(ansehen).toHaveBeenCalledTimes(1)
    expect(knopf.disabled).toBe(true)
    antwort(false)
    await vi.waitFor(() =>
      expect(wurzel.querySelector('[role="status"]')?.textContent).toMatch(/Video abgebrochen/),
    )
    expect(wurzel.querySelector('[data-act="revive"]')).toBeNull()
  })

  it('erscheint nicht außerhalb des Todesbildschirms', () => {
    const { ui, wurzel } = todesbildschirm()
    ui.closeScreen()
    ui.offerRevive(async () => true)
    expect(wurzel.querySelector('[data-act="revive"]')).toBeNull()
  })
})

describe('Emberwake: Buchung in der App', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  const ausgang = (mitWerbehilfe: boolean): LevelOutcome => ({
    levelId: 1,
    levelName: 'Glut',
    stars: 3,
    timeSeconds: 180,
    secondary: true,
    secret: true,
    damageTaken: 0,
    enemiesKilled: 2,
    mitWerbehilfe,
  })

  it('wiederbelebt: keine Punkte, keine XP, höchstens ein Stern, kein Rekord -- aber das nächste Level', async () => {
    const r = await bucheEmberwake(ausgang(true))
    expect(r).toEqual({ score: 0, xp: 0 })
    const [ergebnis] = await db.gameResults.toArray()
    expect(ergebnis).toMatchObject({ score: 0, xp: 0, isPersonalRecord: false })
    expect(ergebnis!.stars).toBeLessThanOrEqual(1)
    expect(ergebnis!.resultData['mitWerbehilfe']).toBe(true)
    expect(await getPersonalRecord('emberwake', 1)).toBeUndefined()
    expect((await getOrCreateGameProgress('emberwake')).currentLevel).toBe(2)
  })

  it('ohne Hilfe wie bisher, und ein späterer Anlauf mit Hilfe überschreibt den Rekord nicht', async () => {
    const r = await bucheEmberwake(ausgang(false))
    expect(r.score).toBeGreaterThan(0)
    const rekord = await getPersonalRecord('emberwake', 1)
    expect(rekord?.bestScore).toBe(r.score)

    // Selbst wer der Buchung Punkte mitgibt: mit Werbehilfe zählen sie nicht.
    await saveGameResult({
      gameId: 'emberwake',
      level: 1,
      score: 99999,
      xp: 500,
      stars: 3,
      resultData: {},
      mitWerbehilfe: true,
    })
    expect((await getPersonalRecord('emberwake', 1))?.bestScore).toBe(r.score)
    const letzte = (await db.gameResults.toArray()).find((e) => e.resultData['mitWerbehilfe'])
    expect(letzte).toMatchObject({ score: 0, xp: 0, stars: 1, isPersonalRecord: false })
  })
})
