import { GameLoop } from '@/games/emberwake/core/GameLoop'
import { createLogger } from '@/games/emberwake/core/Logger'
import {
  detectCapabilities,
  QUALITY_PRESETS,
  type Capabilities,
  type QualitySettings,
} from '@/games/emberwake/platform/Capabilities'
import { openStore, requestPersistence } from '@/games/emberwake/platform/Storage'
import { attachLifecycle } from '@/games/emberwake/platform/Lifecycle'
import { Haptics } from '@/games/emberwake/platform/Haptics'
import {
  keepScreenAwake,
  lockLandscape,
  releaseScreenAwake,
  requestFullscreen,
  isPortrait,
} from '@/games/emberwake/platform/Fullscreen'
import { SaveManager } from '@/games/emberwake/save/SaveManager'
import {
  MAX_LIVES,
  START_LIVES,
  emptyLevelRecord,
  type Settings,
} from '@/games/emberwake/save/schema'
import { restoreRun, snapshotRun } from '@/games/emberwake/save/runSnapshot'
import { getLevel, getNextLevelId, getWorldForLevel, LEVELS } from '@/games/emberwake/data/levels'
import type { BuildingId, RecipeDef, ItemId } from '@/games/emberwake/data/schema/types'
import { ITEMS } from '@/games/emberwake/data/items'
import { generateWorld } from '@/games/emberwake/world/WorldGen'
import { CAMP_POS, type World } from '@/games/emberwake/world/World'
import { Simulation } from '@/games/emberwake/systems/Simulation'
import { emptyInput, type InputFrame } from '@/games/emberwake/systems/PlayerSystem'
import { refuelCore, refuelWithCrystal } from '@/games/emberwake/systems/EmberSystem'
import { build, craft } from '@/games/emberwake/systems/BaseSystem'
import { eatFood } from '@/games/emberwake/systems/HealthSystem'
import { InputManager, type InputSnapshot } from '@/games/emberwake/input/InputManager'
import { Renderer } from '@/games/emberwake/render/Renderer'
import { GameView } from '@/games/emberwake/render/GameView'
import { CameraRig } from '@/games/emberwake/render/CameraRig'
import { AudioManager } from '@/games/emberwake/audio/AudioManager'
import { UiRoot, type UiCallbacks } from '@/games/emberwake/ui/UiRoot'
import type { DebugOverlay } from '@/games/emberwake/dev/DebugOverlay'

/**
 * Verklebt alle Schichten: Zustand, Simulation, Rendering, UI, Speichern.
 * Die einzige Stelle, die alle Module kennt.
 */

const log = createLogger('app')
type AppState = 'title' | 'levels' | 'playing' | 'paused' | 'camp' | 'dead' | 'results'
const RUN_SAVE_INTERVAL = 20

/** Was ein abgeschlossenes Level nach außen meldet (z. B. an TE-Mini Games). */
export interface LevelOutcome {
  levelId: number
  levelName: string
  stars: number
  timeSeconds: number
  secondary: boolean
  secret: boolean
  damageTaken: number
  enemiesKilled: number
}

/** Wie das Spiel in eine umgebende App eingebettet wird. Alles optional. */
export interface AppOptions {
  /** Zurück-Taste im Titelbild. Ohne Angabe gibt es keine. */
  onExit?: () => void
  /** Nach jedem Levelabschluss. Darf Punkte und XP zurückgeben, die im Ergebnis erscheinen. */
  onLevelCompleted?: (outcome: LevelOutcome) => Promise<{ score: number; xp: number } | void> | void
  /** Ton in der umgebenden App aus? Dann startet auch das Spiel stumm. */
  soundEnabled?: boolean
}

export class App {
  private caps!: Capabilities
  private quality!: QualitySettings
  private save!: SaveManager
  private readonly haptics = new Haptics()
  private readonly audio = new AudioManager()
  private ui!: UiRoot
  private input!: InputManager
  private renderer!: Renderer
  private view!: GameView
  private cam!: CameraRig
  private loop!: GameLoop
  private debug: DebugOverlay | null = null
  /** Entwicklung: Der Bot spielt sichtbar im Browser. */
  private autoplay: { decide: (out: InputFrame) => void } | null = null
  private autoplayButton: HTMLButtonElement | null = null

  private state: AppState = 'title'
  private world: World | null = null
  private sim: Simulation | null = null
  private currentLevelId = 1
  private readonly frame: InputFrame = emptyInput()
  private readonly snap: InputSnapshot = {
    moveX: 0,
    moveY: 0,
    sprint: false,
    actionHeld: false,
    actionPressed: false,
    attackPressed: false,
    dropPressed: false,
    pausePressed: false,
    camYaw: 0,
    camZoom: 0,
  }
  private hudAcc = 0
  private runSaveAcc = 0
  private waveAngle: number | null = null
  private simMs = 0
  private unsubs: Array<() => void> = []
  private updateSW: (() => Promise<void>) | null = null
  private readonly fwd = { x: 0, z: 0 }
  private readonly rgt = { x: 0, z: 0 }
  private lifecycleOff: (() => void) | null = null
  private readonly onResize = (): void => this.resize()

  private constructor(private readonly options: AppOptions) {}

  static async boot(root: HTMLElement, options: AppOptions = {}): Promise<App> {
    const app = new App(options)
    await app.init(root)
    return app
  }

  /** Alles abbauen — beim Verlassen der Seite in einer umgebenden App. */
  dispose(): void {
    if (this.world && this.state === 'playing') void this.save.saveRun(snapshotRun(this.world))
    void this.save.flush()
    this.loop.stop()
    this.teardownWorld()
    this.lifecycleOff?.()
    this.lifecycleOff = null
    window.removeEventListener('resize', this.onResize)
    this.input.dispose()
    this.audio.suspend()
    this.renderer.dispose()
    void releaseScreenAwake()
  }

  private async init(root: HTMLElement): Promise<void> {
    this.caps = detectCapabilities()
    const store = await openStore()
    this.save = new SaveManager(store)
    await this.save.load()
    void requestPersistence()

    const settings = this.save.data.settings
    this.quality = this.resolveQuality(settings)
    this.haptics.enabled = settings.haptics
    this.audio.setVolumes(settings.sfxVolume, settings.musicVolume)
    if (this.options.soundEnabled === false) this.audio.muted = true

    this.ui = new UiRoot(root, this.callbacks())
    this.ui.setSettings(settings)
    this.ui.pauseRequested = () => this.pause()
    this.input = new InputManager(this.ui.inputElements())

    this.renderer = new Renderer(this.ui.canvas, this.quality)
    this.view = new GameView(this.quality)
    this.cam = new CameraRig(window.innerWidth / window.innerHeight)
    this.renderer.onQualityChanged = (q) => this.view.setQuality(q)
    this.renderer.onContextLost = () => this.pause()
    this.resize()
    window.addEventListener('resize', this.onResize)

    this.loop = new GameLoop(
      {
        step: (dt) => this.step(dt),
        render: (alpha, dt) => this.render(alpha, dt),
      },
      30,
      { tickWhenHidden: import.meta.env.DEV },
    )

    this.lifecycleOff = attachLifecycle({
      onHidden: () => this.onHidden(),
      onVisible: () => this.audio.resume(),
    })

    // Audio erst nach der ersten Berührung
    const unlock = (): void => {
      this.audio.unlock()
      root.removeEventListener('pointerdown', unlock)
    }
    root.addEventListener('pointerdown', unlock)

    if (new URLSearchParams(location.search).has('dev') || import.meta.env.DEV) {
      const mod = await import('@/games/emberwake/dev/DebugOverlay')
      this.debug = new mod.DebugOverlay(root, () => this.world)
      this.debug.setVisible(new URLSearchParams(location.search).has('dev'))
      this.autoplayButton = this.debug.addAction('Bot: aus', () => void this.toggleAutoplay())
    }

    const hasRun = (await this.save.loadRun()) !== null
    this.ui.showTitle(this.save.data, hasRun, isPortrait(), Boolean(this.options.onExit))
    this.loop.start()
    log.info('EMBERWAKE bereit', { quality: this.quality.tier, store: store.kind })
  }

  private resolveQuality(settings: Settings): QualitySettings {
    const tier = settings.quality === 'auto' ? this.caps.suggestedTier : settings.quality
    return { ...QUALITY_PRESETS[tier] }
  }

  private resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.resize(w, h)
    this.cam.resize(w / h)
  }

  // -------------------------------------------------------------------------
  // Level-Lebenszyklus
  // -------------------------------------------------------------------------

  private async startLevel(levelId: number, resume = false): Promise<void> {
    const level = getLevel(levelId)
    if (!level) {
      log.error(`Level ${levelId} existiert nicht`)
      this.ui.toast('Dieses Level gibt es noch nicht.')
      return
    }
    this.teardownWorld()
    this.currentLevelId = levelId
    const profile = this.save.data

    const world = generateWorld(level, getWorldForLevel(level), profile.camp)
    let restored = false
    if (resume) {
      const snap = await this.save.loadRun()
      if (snap && snap.levelId === levelId) {
        try {
          restoreRun(world, snap)
          restored = true
        } catch (err) {
          log.warn('Laufzustand nicht wiederherstellbar, Level startet neu', err)
        }
      }
    }
    if (!restored) {
      const rec = (profile.levels[levelId] ??= emptyLevelRecord())
      rec.attempts++
      this.save.requestSave()
    }

    this.world = world
    this.sim = new Simulation(world)
    this.subscribeWorld(world)
    if (this.autoplay) {
      const { GreedyBot } = await import('@/games/emberwake/dev/Bot')
      this.autoplay = new GreedyBot(world)
    }
    this.view.load(world)
    this.cam.reset()
    this.input.resetToggles()
    this.waveAngle = null
    this.runSaveAcc = 0

    this.ui.closeScreen()
    this.ui.showHud()
    this.setState('playing')
    this.loop.resume()
    void keepScreenAwake()

    if (!restored && level.lore[0]) {
      setTimeout(() => this.ui.toast(level.lore[0]!, 3500, true), 600)
    }
  }

  private teardownWorld(): void {
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.sim?.dispose()
    this.sim = null
    this.world = null
    this.view.unload()
  }

  private subscribeWorld(w: World): void {
    const ev = w.events
    const profile = this.save.data
    const syncStock = (): void => {
      profile.camp.stock = { ...w.camp.stock }
      this.save.requestSave()
    }

    this.unsubs.push(
      ev.on('resource_gathered', ({ resource, x, z }) => {
        this.haptics.play('gather')
        this.audio.play('gather')
        this.view.particles.burst(
          x,
          w.terrain.heightAt(x, z) + 0.6,
          z,
          ITEMS[resource].color,
          8,
          1.4,
          0.5,
        )
      }),
      ev.on('inventory_full', () => this.ui.hint('Rucksack voll')),
      ev.on('deposited', ({ items }) => {
        const n = Object.values(items).reduce((a, b) => a + (b ?? 0), 0)
        if (n > 0) {
          this.audio.play('deposit')
          this.haptics.play('ui')
          this.view.particles.burst(CAMP_POS.x, 1.2, CAMP_POS.z, 0xffc38c, 14, 1.2, 0.7)
        }
        syncStock()
      }),
      ev.on('camp_opened', ({ atWorkbench }) => this.openCamp(atWorkbench ? 'craft' : 'core')),
      ev.on('core_refueled', ({ charge }) => {
        this.audio.play('refuel')
        this.view.particles.burst(CAMP_POS.x, 1.3, CAMP_POS.z, 0xff9a4d, 20, 1.6, 0.8, 2.2)
        syncStock()
        if (charge >= 100) this.ui.toast('Der Kern ist voll.')
      }),
      ev.on('built', ({ building, level }) => {
        this.audio.play('build')
        this.haptics.play('hit')
        profile.camp.buildings = { ...w.camp.buildings }
        syncStock()
        this.ui.toast(
          `${ITEMS.wood.name === '' ? '' : ''}${building === 'core' ? 'Kernstelle' : building === 'workbench' ? 'Werkbank' : building === 'storage' ? 'Speicher' : 'Wachturm'} · Stufe ${level}`,
        )
      }),
      ev.on('crafted', ({ item }) => {
        this.audio.play('build')
        profile.camp.tools = Array.from(w.player.tools)
        syncStock()
        this.ui.toast(`${ITEMS[item].name} hergestellt`)
      }),
      ev.on('core_threshold', ({ state }) => {
        if (state === 'low') {
          this.ui.warning('Der Kern wird schwach', 4000)
          this.audio.play('coreLow')
          this.haptics.play('coreLow')
        }
        if (state === 'critical') {
          this.ui.warning('Der Kern erlischt!', 6000)
          this.audio.play('coreLow')
          this.haptics.play('coreLow')
        }
      }),
      ev.on('core_damaged', () => {
        this.haptics.play('hurt')
        this.audio.play('hit')
        this.view.particles.burst(CAMP_POS.x, 1.2, CAMP_POS.z, 0x6f7fbf, 10, 2, 0.5)
      }),
      ev.on('player_damaged', ({ amount }) => {
        this.haptics.play('hurt')
        this.audio.play('hurt')
        this.view.particles.burst(
          w.player.pos.x,
          w.terrain.heightAt(w.player.pos.x, w.player.pos.z) + 1,
          w.player.pos.z,
          0xe8705f,
          Math.min(12, 4 + amount),
          1.6,
          0.4,
        )
      }),
      ev.on('player_attacked', ({ hit }) => {
        this.audio.play(hit ? 'hit' : 'swing')
        if (hit) this.haptics.play('hit')
      }),
      ev.on('enemy_damaged', ({ x, z, byLight }) => {
        this.view.particles.burst(
          x,
          w.terrain.heightAt(x, z) + 1,
          z,
          byLight ? 0xff9a4d : 0xd9e0ff,
          byLight ? 3 : 7,
          1.2,
          0.4,
        )
      }),
      ev.on('enemy_died', ({ x, z }) => {
        this.view.particles.burst(x, w.terrain.heightAt(x, z) + 0.8, z, 0x8fb3ff, 18, 2.2, 0.8)
        this.audio.play('hit')
      }),
      ev.on('enemy_seen', () => this.audio.play('ui')),
      ev.on('phase_changed', ({ phase, night }) => {
        if (phase === 'dusk') {
          this.ui.toast('Es dämmert.')
          this.audio.play('night')
        }
        if (phase === 'night') {
          this.ui.toast(`Nacht ${night}`, 2200)
          this.haptics.play('coreLow')
        }
        if (phase === 'dawn') {
          this.ui.toast('Morgen. Sie ziehen sich zurück.')
          this.audio.play('dawn')
          this.waveAngle = null
        }
      }),
      ev.on('wave_incoming', ({ inSeconds, direction, count }) => {
        this.waveAngle = direction
        this.ui.warning(
          `${count} ${count === 1 ? 'Stiller' : 'Stille'} nähern sich · ${Math.round(inSeconds)} s`,
          inSeconds * 1000,
        )
        this.audio.play('wave')
        this.haptics.play('coreLow')
      }),
      ev.on('wave_started', () => {
        this.waveAngle = null
      }),
      ev.on('hint', ({ text }) => this.ui.hint(text)),
      ev.on('secret_found', ({ text }) => {
        this.audio.play('secret')
        this.haptics.play('hit')
        this.ui.toast(text, 5000, true)
      }),
      ev.on('item_dropped', ({ item, amount }) =>
        this.ui.toast(`${amount} ${ITEMS[item].name} abgeworfen`),
      ),
      ev.on('player_died', ({ cause }) => this.onDeath(cause)),
      ev.on('level_completed', (r) =>
        this.onComplete(r.stars, r.timeSeconds, r.secondary, r.secret),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // Schleife
  // -------------------------------------------------------------------------

  private step(dt: number): void {
    const w = this.world
    const sim = this.sim
    this.input.consume(this.snap)

    if (this.snap.pausePressed) {
      if (this.state === 'playing') this.pause()
      else if (this.state === 'paused') this.resume()
    }

    if (!w || !sim) return

    // Kamera-Eingaben laufen auch außerhalb des Spiels weiter
    this.cam.rotate(this.snap.camYaw)
    this.cam.zoom(this.snap.camZoom)

    if (this.state !== 'playing') return

    const f = this.frame
    if (Math.abs(this.snap.moveX) > 0.02 || Math.abs(this.snap.moveY) > 0.02) {
      this.cam.forward(this.fwd)
      this.cam.right(this.rgt)
      f.moveX = this.rgt.x * this.snap.moveX - this.fwd.x * this.snap.moveY
      f.moveZ = this.rgt.z * this.snap.moveX - this.fwd.z * this.snap.moveY
    } else {
      f.moveX = 0
      f.moveZ = 0
    }
    f.sprint = this.snap.sprint
    f.actionHeld = this.snap.actionHeld
    f.actionPressed = this.snap.actionPressed
    f.attackPressed = this.snap.attackPressed
    f.dropPressed = this.snap.dropPressed

    if (this.autoplay) this.autoplay.decide(f)

    const t0 = performance.now()
    sim.step(f, dt)
    this.simMs = performance.now() - t0

    this.save.data.stats.totalPlaytime += dt
    this.runSaveAcc += dt
    if (this.runSaveAcc >= RUN_SAVE_INTERVAL && w.status === 'running') {
      this.runSaveAcc = 0
      void this.save.saveRun(snapshotRun(w))
    }
  }

  private render(alpha: number, frameDt: number): void {
    const w = this.world
    if (w) {
      const p = w.player
      const px = p.prevPos.x + (p.pos.x - p.prevPos.x) * alpha
      const pz = p.prevPos.z + (p.pos.z - p.prevPos.z) * alpha
      this.cam.update(px, w.terrain.heightAt(px, pz), pz, frameDt)
      this.view.sync(w, alpha, frameDt)
      this.audio.setAtmosphere(w.clock.sun, Math.min(1, w.ember.charge / 100))

      this.hudAcc += frameDt
      if (this.hudAcc >= 0.1 && this.state !== 'title' && this.state !== 'levels') {
        this.hudAcc = 0
        this.ui.updateHud(
          w,
          this.screenAngleTo(CAMP_POS.x, CAMP_POS.z),
          this.waveAngle === null
            ? null
            : this.screenAngleOfWorldDir(Math.cos(this.waveAngle), Math.sin(this.waveAngle)),
          this.save.data.lives,
        )
      }
    }
    this.renderer.render(this.view.scene, this.cam.camera)
    this.renderer.observeFrame(frameDt)
    if (this.debug) {
      const info = this.renderer.info
      this.debug.frame(frameDt, {
        frameMs: frameDt * 1000,
        simMs: this.simMs,
        calls: info.calls,
        triangles: info.triangles,
      })
    }
  }

  /** Bildschirmwinkel (0 = oben) eines Weltpunkts relativ zum Spieler. */
  private screenAngleTo(x: number, z: number): number {
    const w = this.world!
    return this.screenAngleOfWorldDir(x - w.player.pos.x, z - w.player.pos.z)
  }

  private screenAngleOfWorldDir(dx: number, dz: number): number {
    this.cam.forward(this.fwd)
    this.cam.right(this.rgt)
    const sx = dx * this.rgt.x + dz * this.rgt.z
    const sy = -(dx * this.fwd.x + dz * this.fwd.z)
    return Math.atan2(sx, -sy)
  }

  // -------------------------------------------------------------------------
  // Zustandswechsel
  // -------------------------------------------------------------------------

  private setState(s: AppState): void {
    this.state = s
    this.input.enabled = s === 'playing'
  }

  private pause(): void {
    if (this.state !== 'playing' || !this.world) return
    this.setState('paused')
    this.loop.pause()
    this.ui.showPause(this.save.data.settings, this.haptics.supported)
    void this.save.saveRun(snapshotRun(this.world))
    void this.save.flush()
  }

  private resume(): void {
    if (this.state !== 'paused' && this.state !== 'camp') return
    this.ui.closeScreen()
    this.setState('playing')
    this.loop.resume()
    this.audio.resume()
  }

  private openCamp(tab: 'core' | 'build' | 'craft' | 'stock'): void {
    if (!this.world || this.state !== 'playing' || this.world.status !== 'running') return
    // Der Bot trifft seine Lagerentscheidungen selbst — kein Panel im Autoplay.
    if (this.autoplay) return
    this.setState('camp')
    this.loop.pause()
    this.ui.showCamp(this.world, tab)
  }

  private onHidden(): void {
    if (this.world && this.state === 'playing') {
      void this.save.saveRun(snapshotRun(this.world))
      this.pause()
    }
    void this.save.flush()
    this.audio.suspend()
  }

  private onDeath(cause: string): void {
    const w = this.world!
    const profile = this.save.data
    this.setState('dead')
    this.audio.play('death')
    this.haptics.play('death')

    profile.lives = Math.max(0, profile.lives - 1)
    profile.stats.totalDeaths++
    const rec = (profile.levels[this.currentLevelId] ??= emptyLevelRecord())
    rec.deaths++

    // Ins Lager Gebrachtes bleibt. Vom Getragenen bleibt die Hälfte.
    profile.camp.stock = { ...w.camp.stock }
    let kept = 0
    for (const key in w.player.inventory) {
      const id = key as ItemId
      const half = Math.floor((w.player.inventory[id] ?? 0) / 2)
      if (half > 0) {
        profile.camp.stock[id] = (profile.camp.stock[id] ?? 0) + half
        kept += half
      }
    }
    const carriedNote = Object.keys(w.player.inventory).length
      ? `${kept} Einheiten gerettet, Rest verloren`
      : null

    let resetNote: string | null = null
    if (profile.lives <= 0) {
      profile.lives = START_LIVES
      const first = LEVELS[0]!.id
      profile.unlockedLevelId = Math.min(profile.unlockedLevelId, first)
      resetNote = 'Alle Leben verbraucht. Die Welt beginnt von vorn — dein Lager bleibt.'
      this.currentLevelId = first
    }

    this.save.requestSave()
    void this.save.flush()
    void this.save.clearRun()
    void releaseScreenAwake()

    setTimeout(() => {
      this.ui.hideHud()
      this.ui.showDeath(cause, profile.lives, resetNote, carriedNote)
    }, 1100)
  }

  private onComplete(stars: number, time: number, secondary: boolean, secret: boolean): void {
    const w = this.world!
    const profile = this.save.data
    const level = w.level
    this.setState('results')
    this.audio.play('complete')
    this.haptics.play('hit')

    const rec = (profile.levels[level.id] ??= emptyLevelRecord())
    rec.completions++
    const firstThree = stars === 3 && rec.stars < 3
    rec.stars = Math.max(rec.stars, stars)
    rec.bestTime = rec.bestTime === null ? time : Math.min(rec.bestTime, time)
    rec.secret = rec.secret || secret

    // Belohnung ins Lager
    for (const key in level.rewards.resources) {
      const id = key as ItemId
      w.camp.stock[id] =
        (w.camp.stock[id] ?? 0) +
        (level.rewards.resources[id as keyof typeof level.rewards.resources] ?? 0)
    }
    // Was noch im Rucksack ist, wird eingelagert — der Weg zurück ist geschafft.
    for (const key in w.player.inventory) {
      const id = key as ItemId
      w.camp.stock[id] = (w.camp.stock[id] ?? 0) + (w.player.inventory[id] ?? 0)
    }
    profile.camp = {
      buildings: { ...w.camp.buildings },
      stock: { ...w.camp.stock },
      tools: Array.from(w.player.tools),
    }

    const next = getNextLevelId(level.id)
    if (next !== undefined) profile.unlockedLevelId = Math.max(profile.unlockedLevelId, next)
    profile.stats.nightsSurvived += w.clock.nightsSurvived
    profile.stats.enemiesKilled += w.stats.enemiesKilled
    profile.stats.totalGathered += w.stats.gathered

    let lifeGained = false
    if (firstThree && profile.lives < MAX_LIVES) {
      profile.lives++
      lifeGained = true
    }

    this.save.requestSave()
    void this.save.flush()
    void this.save.clearRun()
    void releaseScreenAwake()

    // Rückkanal an die umgebende App (Punkte, XP, Rangliste)
    const outcome = this.options.onLevelCompleted?.({
      levelId: level.id,
      levelName: level.name,
      stars,
      timeSeconds: time,
      secondary,
      secret,
      damageTaken: w.stats.damageTaken,
      enemiesKilled: w.stats.enemiesKilled,
    })

    setTimeout(() => {
      this.ui.hideHud()
      this.ui.showResults({
        levelName: level.name,
        stars,
        time,
        secondary,
        secondaryText: level.objectives.secondary.text,
        secret,
        rewards: level.rewards.resources,
        lifeGained,
        hasNext: next !== undefined,
      })
      void Promise.resolve(outcome)
        .then((r) => {
          if (r) this.ui.appendResultNote(`${r.score} Punkte · +${r.xp} XP`)
        })
        .catch((err: unknown) => log.warn('Ergebnis konnte nicht gemeldet werden', err))
    }, 1200)
  }

  private quitToTitle(): void {
    this.teardownWorld()
    this.ui.hideHud()
    this.setState('title')
    void releaseScreenAwake()
    void this.save.flush()
    void this.save
      .loadRun()
      .then((run) =>
        this.ui.showTitle(this.save.data, run !== null, isPortrait(), Boolean(this.options.onExit)),
      )
  }

  private applySettings(patch: Partial<Settings>): void {
    const s = this.save.data.settings
    Object.assign(s, patch)
    this.haptics.enabled = s.haptics
    this.audio.setVolumes(s.sfxVolume, s.musicVolume)
    this.audio.muted = s.sfxVolume === 0
    if (patch.quality !== undefined) {
      this.quality = this.resolveQuality(s)
      this.view.setQuality(this.quality)
      this.renderer.quality = { ...this.quality }
      this.renderer.gl.shadowMap.enabled = this.quality.shadows
      this.renderer.gl.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, this.quality.pixelRatioCap),
      )
    }
    this.ui.setSettings(s)
    this.save.requestSave()
  }

  /** Entwicklung: Bot übernimmt die Eingabe. Wird beim Levelwechsel neu erzeugt. */
  async toggleAutoplay(): Promise<void> {
    if (this.autoplay) {
      this.autoplay = null
    } else if (this.world) {
      const { GreedyBot } = await import('@/games/emberwake/dev/Bot')
      this.autoplay = new GreedyBot(this.world)
    }
    if (this.autoplayButton)
      this.autoplayButton.textContent = this.autoplay ? 'Bot: AN' : 'Bot: aus'
  }

  setServiceWorkerUpdater(fn: () => Promise<void>): void {
    this.updateSW = fn
  }

  /** Neue Version verfügbar — nur außerhalb einer Runde fragen (MOBILE.md §7). */
  notifyUpdateAvailable(): void {
    if (this.state === 'title' || this.state === 'levels' || this.state === 'results')
      this.ui.showUpdate()
    else this.ui.toast('Neue Version verfügbar — nach dem Level.', 4000)
  }

  private callbacks(): UiCallbacks {
    return {
      onContinue: () => {
        void requestFullscreen().then(() => lockLandscape())
        void this.save.loadRun().then((run) => {
          if (run && getLevel(run.levelId)) void this.startLevel(run.levelId, true)
          else
            void this.startLevel(
              Math.min(this.save.data.unlockedLevelId, LEVELS[LEVELS.length - 1]!.id),
            )
        })
      },
      onNewRun: () => void this.startLevel(this.save.data.unlockedLevelId),
      onShowLevels: () => {
        this.setState('levels')
        this.ui.showLevels(this.save.data)
      },
      onSelectLevel: (id) => {
        void requestFullscreen().then(() => lockLandscape())
        void this.startLevel(id)
      },
      onBackToTitle: () => this.quitToTitle(),
      onExit: () => {
        void this.save.flush()
        this.options.onExit?.()
      },
      onResume: () => this.resume(),
      onRestart: () => void this.startLevel(this.currentLevelId),
      onQuit: () => this.quitToTitle(),
      onNext: () => {
        const next = getNextLevelId(this.currentLevelId)
        if (next !== undefined) void this.startLevel(next)
        else this.quitToTitle()
      },
      onCloseCamp: () => this.resume(),
      onRefuel: (amount) => {
        if (!this.world) return
        refuelCore(this.world, amount === 'all' ? (this.world.camp.stock.wood ?? 0) : amount)
        this.ui.refreshCamp()
      },
      onRefuelCrystal: () => {
        if (this.world) {
          refuelWithCrystal(this.world, 1)
          this.ui.refreshCamp()
        }
      },
      onEat: () => {
        if (this.world && eatFood(this.world)) {
          this.audio.play('gather')
          this.ui.refreshCamp()
        }
      },
      onBuild: (id: BuildingId) => {
        if (this.world) {
          build(this.world, id)
          this.ui.refreshCamp()
        }
      },
      onCraft: (recipe: RecipeDef) => {
        if (this.world) {
          craft(this.world, recipe)
          this.ui.refreshCamp()
        }
      },
      onSettings: (patch) => this.applySettings(patch),
      onExport: () => {
        const blob = new Blob([this.save.exportJson()], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `emberwake-${new Date().toISOString().slice(0, 10)}.ewsave`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      },
      onImport: (file) => {
        void file.text().then((json) => {
          try {
            this.save.importJson(json)
            this.ui.toast('Spielstand importiert')
            this.quitToTitle()
          } catch (err) {
            this.ui.toast((err as Error).message)
          }
        })
      },
      onReset: () => {
        void this.save.reset().then(() => this.quitToTitle())
      },
      onUpdateApp: () => {
        void this.updateSW?.()
      },
    }
  }
}
