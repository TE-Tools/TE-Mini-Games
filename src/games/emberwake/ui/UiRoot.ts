import type { World } from '@/games/emberwake/world/World'
import { CAMP_POS, buildingLevel } from '@/games/emberwake/world/World'
import type { ProfileData, Settings } from '@/games/emberwake/save/schema'
import { MAX_LIVES } from '@/games/emberwake/save/schema'
import { LEVELS } from '@/games/emberwake/data/levels'
import { ITEMS } from '@/games/emberwake/data/items'
import { BUILDINGS } from '@/games/emberwake/data/buildings'
import type {
  BuildingId,
  ItemId,
  RecipeDef,
  ResourceCost,
} from '@/games/emberwake/data/schema/types'
import { availableRecipes, canBuild, canCraft } from '@/games/emberwake/systems/BaseSystem'
import { loadRatio } from '@/games/emberwake/systems/InventorySystem'
import { interactionProgress } from '@/games/emberwake/systems/InteractionSystem'
import { enemyInAttackRange } from '@/games/emberwake/systems/PlayerSystem'
import { formatElapsed } from '@/games/emberwake/systems/EmberSystem'
import type { InputElements } from '@/games/emberwake/input/InputManager'

/**
 * Gesamte Benutzeroberfläche in reinem DOM (ARCHITECTURE.md §2).
 * Liest Zustand, sendet Absichten über Callbacks. Enthält keine Spiellogik.
 */

export interface UiCallbacks {
  onContinue: () => void
  onNewRun: () => void
  onSelectLevel: (id: number) => void
  onShowLevels: () => void
  onBackToTitle: () => void
  /** Verlässt das Spiel in Richtung der umgebenden App. */
  onExit: () => void
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
  onNext: () => void
  onCloseCamp: () => void
  onRefuel: (amount: number | 'all') => void
  onRefuelCrystal: () => void
  onEat: () => void
  onBuild: (id: BuildingId) => void
  onCraft: (recipe: RecipeDef) => void
  onSettings: (patch: Partial<Settings>) => void
  onExport: () => void
  onImport: (file: File) => void
  onReset: () => void
  onUpdateApp: () => void
}

export type ScreenName =
  'title' | 'levels' | 'pause' | 'camp' | 'death' | 'results' | 'update' | null
type CampTab = 'core' | 'build' | 'craft' | 'stock'

const PHASE_NAMES = { day: 'Tag', dusk: 'Dämmerung', night: 'Nacht', dawn: 'Morgen' } as const

export class UiRoot {
  readonly root: HTMLElement
  readonly canvas: HTMLCanvasElement
  private readonly hud: HTMLElement
  private readonly screens: HTMLElement
  private readonly el: Record<string, HTMLElement> = {}
  private campTab: CampTab = 'core'
  private campWorld: World | null = null
  private hintTimer: ReturnType<typeof setTimeout> | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null
  private warningTimer: ReturnType<typeof setTimeout> | null = null
  private currentScreen: ScreenName = null
  private lastHudKey = ''

  constructor(
    root: HTMLElement,
    private readonly cb: UiCallbacks,
  ) {
    this.root = root
    root.innerHTML = `
      <canvas id="game"></canvas>
      <div id="touch-layer"></div>
      <div id="joystick"><div id="joystick-knob"></div></div>
      <div id="hud" hidden>
        <div class="hud-top">
          <div class="hud-vitals">
            <div class="lives" data-el="lives"></div>
            <div class="bar hp-bar"><i data-el="hp"></i></div>
          </div>
          <div class="hud-core">
            <span class="label">Kern</span>
            <div class="bar core-bar" data-el="coreBar"><i data-el="core"></i></div>
            <span class="core-pct" data-el="corePct">–</span>
            <span class="core-drain" data-el="coreDrain"></span>
          </div>
          <div class="hud-clock">
            <div class="phase" data-el="phase"></div>
            <button id="btn-pause" aria-label="Pause">❙❙</button>
          </div>
        </div>
        <div class="hud-objective">
          <span class="obj-primary" data-el="objPrimary"></span>
          <span class="obj-secondary" data-el="objSecondary"></span>
        </div>
        <div class="hud-compass" data-el="compass" hidden>
          <div class="arrow" data-el="compassArrow">▲</div>
          <span class="dist" data-el="compassDist"></span>
        </div>
        <div class="hud-center">
          <div class="hud-warning" data-el="warning" hidden><span class="arrow" data-el="warningArrow">▲</span><span data-el="warningText"></span></div>
          <div class="hud-toast" data-el="toast" hidden></div>
        </div>
        <div class="hud-hint" data-el="hint" hidden></div>
        <div class="hud-bottom-left">
          <div class="weight">
            <div class="label"><span>Ballast</span><span data-el="weightVal"></span></div>
            <div class="bar weight-bar" data-el="weightBar"><i data-el="weight"></i></div>
          </div>
          <div class="inv-list" data-el="inv"></div>
          <button id="btn-drop">Abwerfen</button>
        </div>
        <div class="hud-buttons">
          <button id="btn-sprint">SPRINT</button>
          <button id="btn-attack" aria-label="Angriff">⚔</button>
          <button id="btn-action"><span class="ring"></span><span class="label" data-el="actionLabel">…</span></button>
        </div>
      </div>
      <div id="screens"></div>
    `
    this.canvas = root.querySelector('#game')!
    this.hud = root.querySelector('#hud')!
    this.screens = root.querySelector('#screens')!
    root.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => {
      this.el[e.dataset.el!] = e
    })
    root
      .querySelector('#btn-pause')!
      .addEventListener('click', () =>
        this.cb.onResume === undefined ? undefined : this.pauseRequested?.(),
      )
  }

  /** Von der App gesetzt: Pause-Taste im HUD. */
  pauseRequested: (() => void) | null = null

  inputElements(): InputElements {
    const q = (s: string): HTMLElement => this.root.querySelector(s)!
    return {
      touchLayer: q('#touch-layer'),
      joystickBase: q('#joystick'),
      joystickKnob: q('#joystick-knob'),
      actionButton: q('#btn-action'),
      attackButton: q('#btn-attack'),
      sprintButton: q('#btn-sprint'),
      dropButton: q('#btn-drop'),
    }
  }

  setSettings(s: Settings): void {
    this.hud.classList.toggle('hide-touch', s.showTouchControls === 'never')
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  showHud(): void {
    this.hud.hidden = false
  }

  hideHud(): void {
    this.hud.hidden = true
    this.hideTransient()
  }

  updateHud(w: World, compassAngle: number, waveAngle: number | null, lives: number): void {
    const p = w.player
    // Leben
    let hearts = ''
    for (let i = 0; i < MAX_LIVES; i++) hearts += i < lives ? '♥' : '<span class="lost">♥</span>'
    if (this.el.lives!.innerHTML !== hearts) this.el.lives!.innerHTML = hearts
    this.el.hp!.style.width = `${(p.hp / p.maxHp) * 100}%`

    // Kern
    const pct = Math.round(w.ember.charge)
    this.el.core!.style.width = `${Math.min(100, (w.ember.charge / w.ember.capacity) * 100)}%`
    this.el.corePct!.textContent = `${pct} %`
    this.el.coreBar!.classList.toggle('is-low', w.ember.threshold === 'low')
    this.el.coreBar!.classList.toggle('is-critical', w.ember.threshold === 'critical')
    const drain = w.ember.drainRate - w.ember.regen
    this.el.coreDrain!.textContent =
      drain > 0.01 ? `−${drain.toFixed(2)}/s` : drain < -0.01 ? `+${(-drain).toFixed(2)}/s` : ''

    // Uhr
    const c = w.clock
    const remaining = Math.max(0, c.phaseDuration - c.phaseTime)
    let label: string
    if (w.level.cycle.nights === 0)
      label = `${PHASE_NAMES[c.phase]}<b>${formatElapsed(c.elapsed)}</b>`
    else if (c.phase === 'day') label = `Nacht in<b>${formatElapsed(remaining)}</b>`
    else if (c.phase === 'night') label = `Nacht ${c.night}<b>${formatElapsed(remaining)}</b>`
    else label = `${PHASE_NAMES[c.phase]}<b>${formatElapsed(remaining)}</b>`
    if (this.el.phase!.innerHTML !== label) this.el.phase!.innerHTML = label
    this.el.phase!.classList.toggle('is-night', c.phase === 'night' || c.phase === 'dusk')

    // Ziele
    const prim = w.level.objectives.primary
    let primText = prim.text
    if (prim.kind === 'store_resource')
      primText += ` (${Math.min(prim.amount, w.camp.stock[prim.resource] ?? 0)}/${prim.amount})`
    if (prim.kind === 'core_charge')
      primText += ` (${Math.min(prim.threshold, Math.floor(w.ember.charge))}/${prim.threshold})`
    if (prim.kind === 'survive_nights') primText += ` (${w.clock.nightsSurvived}/${prim.nights})`
    this.el.objPrimary!.textContent = primText
    this.el.objPrimary!.classList.toggle('obj-done', w.objectives.primary >= 1)
    const sec = w.level.objectives.secondary
    this.el.objSecondary!.textContent = `★★ ${sec.text}`
    this.el.objSecondary!.classList.toggle('is-failed', w.objectives.secondaryFailed)
    this.el.objSecondary!.classList.toggle(
      'obj-done',
      !w.objectives.secondaryFailed && w.objectives.secondary >= 1 && sec.kind !== 'time_under',
    )

    // Kompass zum Lager
    const dCamp = Math.hypot(p.pos.x - CAMP_POS.x, p.pos.z - CAMP_POS.z)
    const showCompass = dCamp > 9
    this.el.compass!.hidden = !showCompass
    if (showCompass) {
      this.el.compassArrow!.style.transform = `rotate(${compassAngle}rad)`
      this.el.compassDist!.textContent = `Lager · ${Math.round(dCamp)} m`
    }
    if (waveAngle !== null) this.el.warningArrow!.style.transform = `rotate(${waveAngle}rad)`

    // Ballast
    const ratio = loadRatio(w)
    this.el.weight!.style.width = `${Math.min(100, ratio * 100)}%`
    this.el.weightVal!.textContent = `${p.weight.toFixed(1)} / ${p.carryCapacity}`
    this.el.weightBar!.classList.toggle('is-heavy', ratio >= 0.8 && ratio <= 1)
    this.el.weightBar!.classList.toggle('is-over', ratio > 1)
    const invKey = JSON.stringify(p.inventory)
    if (invKey !== this.lastHudKey) {
      this.lastHudKey = invKey
      this.el.inv!.textContent = Object.entries(p.inventory)
        .filter(([, n]) => (n ?? 0) > 0)
        .map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`)
        .join(' · ')
    }
    const dropBtn = this.root.querySelector<HTMLElement>('#btn-drop')!
    dropBtn.hidden = p.weight <= 0

    // Tasten
    const action = this.root.querySelector<HTMLElement>('#btn-action')!
    const actionLabel = w.interactable?.label ?? ''
    action.classList.toggle('is-idle', !actionLabel)
    this.el.actionLabel!.textContent = actionLabel || '·'
    action.style.setProperty('--p', String(interactionProgress(w)))
    const attack = this.root.querySelector<HTMLElement>('#btn-attack')!
    attack.classList.toggle('is-ready', enemyInAttackRange(w))
  }

  hint(text: string): void {
    const e = this.el.hint!
    e.textContent = text
    e.hidden = false
    if (this.hintTimer) clearTimeout(this.hintTimer)
    this.hintTimer = setTimeout(() => {
      e.hidden = true
    }, 3800)
  }

  toast(text: string, ms = 2600, lore = false): void {
    const e = this.el.toast!
    e.textContent = text
    e.classList.toggle('is-lore', lore)
    e.hidden = false
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      e.hidden = true
    }, ms)
  }

  warning(text: string, ms = 10000): void {
    const e = this.el.warning!
    this.el.warningText!.textContent = text
    e.hidden = false
    if (this.warningTimer) clearTimeout(this.warningTimer)
    this.warningTimer = setTimeout(() => {
      e.hidden = true
    }, ms)
  }

  private hideTransient(): void {
    this.el.hint!.hidden = true
    this.el.toast!.hidden = true
    this.el.warning!.hidden = true
  }

  // -------------------------------------------------------------------------
  // Bildschirme
  // -------------------------------------------------------------------------

  get screen(): ScreenName {
    return this.currentScreen
  }

  closeScreen(): void {
    this.currentScreen = null
    this.screens.innerHTML = ''
    this.campWorld = null
  }

  private open(name: ScreenName, cls: string, html: string): HTMLElement {
    this.currentScreen = name
    this.screens.innerHTML = `<div class="screen ${cls}">${html}</div>`
    return this.screens.firstElementChild as HTMLElement
  }

  showTitle(profile: ProfileData, hasRun: boolean, portrait: boolean, showExit = false): void {
    const s = this.open(
      'title',
      'is-solid',
      `
      <div class="card">
        <p class="eyebrow">Der letzte Funke</p>
        <h1 class="title">EMBERWAKE</h1>
        <p class="lede is-ember">Jeder Schritt vom Lager weg macht dein Lager dunkler.</p>
        ${portrait ? '<p class="orientation-hint">Tipp: Im Querformat siehst du mehr vom Wald.</p>' : ''}
        <button class="btn is-primary" data-act="continue">${hasRun ? 'Fortsetzen' : profile.unlockedLevelId > 1 ? `Weiter · Level ${profile.unlockedLevelId}` : 'Spielen'}</button>
        <button class="btn" data-act="levels">Level wählen</button>
        <dl class="kv">
          <dt>Leben</dt><dd>${'♥'.repeat(profile.lives)}<span style="opacity:.25">${'♥'.repeat(Math.max(0, MAX_LIVES - profile.lives))}</span></dd>
          <dt>Sterne</dt><dd>${Object.values(profile.levels).reduce((n, l) => n + l.stars, 0)} / ${LEVELS.length * 3}</dd>
        </dl>
        ${showExit ? '<button class="btn is-ghost" data-act="exit">← Zurück zur Übersicht</button>' : ''}
        <p class="small center">Version 0.1.0 · Vertical Slice · Offline spielbar</p>
      </div>
    `,
    )
    s.querySelector('[data-act="continue"]')!.addEventListener('click', () => this.cb.onContinue())
    s.querySelector('[data-act="levels"]')!.addEventListener('click', () => this.cb.onShowLevels())
    s.querySelector('[data-act="exit"]')?.addEventListener('click', () => this.cb.onExit())
  }

  /** Zusätzliche Zeile im Ergebnis, z. B. Punkte/XP der umgebenden App. */
  appendResultNote(text: string): void {
    if (this.currentScreen !== 'results') return
    const kv = this.screens.querySelector('.kv')
    if (!kv) return
    const dt = document.createElement('dt')
    dt.textContent = 'TE-Mini Games'
    const dd = document.createElement('dd')
    dd.className = 'ok'
    dd.textContent = text
    kv.append(dt, dd)
  }

  showLevels(profile: ProfileData): void {
    const items = LEVELS.map((l) => {
      const rec = profile.levels[l.id]
      const locked = l.id > profile.unlockedLevelId
      const stars = rec?.stars ?? 0
      const st = `${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span>`
      return `<button class="level-item" data-level="${l.id}" ${locked ? 'disabled' : ''}>
        <span class="num">${String(l.id).padStart(2, '0')}</span>
        <span><span class="name">${l.name}</span><br><span class="sub">${locked ? 'Gesperrt' : l.subtitle}</span></span>
        <span class="st">${st}</span>
      </button>`
    }).join('')
    const s = this.open(
      'levels',
      'is-solid',
      `
      <div class="card">
        <p class="eyebrow">Welt 1 · Der Aschenwald</p>
        <div class="level-list">${items}</div>
        <button class="btn is-ghost" data-act="back">Zurück</button>
      </div>
    `,
    )
    s.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
      b.addEventListener('click', () => this.cb.onSelectLevel(Number(b.dataset.level)))
    })
    s.querySelector('[data-act="back"]')!.addEventListener('click', () => this.cb.onBackToTitle())
  }

  showPause(settings: Settings, hasVibration: boolean): void {
    const s = this.open(
      'pause',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">Pause</p>
        <button class="btn is-primary" data-act="resume">Weiter</button>
        <div class="settings-row"><span>Haptik${hasVibration ? '' : ' <span class="small">(auf diesem Gerät nicht verfügbar)</span>'}</span><button class="toggle ${settings.haptics ? 'is-on' : ''}" data-set="haptics" aria-label="Haptik"></button></div>
        <div class="settings-row"><span>Grafik</span>
          <select data-set="quality">
            <option value="auto" ${settings.quality === 'auto' ? 'selected' : ''}>Automatisch</option>
            <option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Niedrig</option>
            <option value="medium" ${settings.quality === 'medium' ? 'selected' : ''}>Mittel</option>
            <option value="high" ${settings.quality === 'high' ? 'selected' : ''}>Hoch</option>
          </select>
        </div>
        <div class="settings-row"><span>Ton</span><button class="toggle ${settings.sfxVolume > 0 ? 'is-on' : ''}" data-set="sound" aria-label="Ton"></button></div>
        <div class="btn-row">
          <button class="btn" data-act="restart">Level neu</button>
          <button class="btn" data-act="quit">Zum Menü</button>
        </div>
        <div class="btn-row">
          <button class="btn is-ghost" data-act="export">Spielstand exportieren</button>
          <label class="btn is-ghost" style="cursor:pointer">Importieren<input type="file" accept=".ewsave,application/json" hidden data-act="import"></label>
        </div>
        <button class="btn is-ghost is-danger" data-act="reset">Alles zurücksetzen</button>
        <p class="small center">Tastatur: WASD bewegen · E sammeln · Leertaste Angriff · Shift Sprint · Q abwerfen · Esc Pause</p>
      </div>
    `,
    )
    s.querySelector('[data-act="resume"]')!.addEventListener('click', () => this.cb.onResume())
    s.querySelector('[data-act="restart"]')!.addEventListener('click', () => this.cb.onRestart())
    s.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit())
    s.querySelector('[data-act="export"]')!.addEventListener('click', () => this.cb.onExport())
    s.querySelector<HTMLInputElement>('[data-act="import"]')!.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) this.cb.onImport(file)
    })
    s.querySelector('[data-act="reset"]')!.addEventListener('click', () => {
      if (confirm('Wirklich alles zurücksetzen? Lager, Sterne und Leben gehen verloren.'))
        this.cb.onReset()
    })
    s.querySelector<HTMLElement>('[data-set="haptics"]')!.addEventListener('click', (e) => {
      const t = e.currentTarget as HTMLElement
      t.classList.toggle('is-on')
      this.cb.onSettings({ haptics: t.classList.contains('is-on') })
    })
    s.querySelector<HTMLElement>('[data-set="sound"]')!.addEventListener('click', (e) => {
      const t = e.currentTarget as HTMLElement
      t.classList.toggle('is-on')
      const on = t.classList.contains('is-on')
      this.cb.onSettings({ sfxVolume: on ? 0.8 : 0, musicVolume: on ? 0.6 : 0 })
    })
    s.querySelector<HTMLSelectElement>('[data-set="quality"]')!.addEventListener('change', (e) => {
      this.cb.onSettings({ quality: (e.target as HTMLSelectElement).value as Settings['quality'] })
    })
  }

  showDeath(
    cause: string,
    livesLeft: number,
    resetNote: string | null,
    carriedNote: string | null,
  ): void {
    const s = this.open(
      'death',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">Erloschen</p>
        <p class="cause">${cause}.</p>
        <dl class="kv">
          <dt>Leben übrig</dt><dd>${'♥'.repeat(livesLeft)}<span style="opacity:.25">${'♥'.repeat(Math.max(0, MAX_LIVES - livesLeft))}</span></dd>
          ${carriedNote ? `<dt>Rucksack</dt><dd>${carriedNote}</dd>` : ''}
        </dl>
        ${resetNote ? `<p class="lede">${resetNote}</p>` : '<p class="lede">Lager, Gebäude und Vorräte bleiben erhalten.</p>'}
        <button class="btn is-primary" data-act="retry">Nochmal</button>
        <button class="btn is-ghost" data-act="quit">Zum Menü</button>
      </div>
    `,
    )
    s.querySelector('[data-act="retry"]')!.addEventListener('click', () => this.cb.onRestart())
    s.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit())
  }

  showResults(r: {
    levelName: string
    stars: number
    time: number
    secondary: boolean
    secondaryText: string
    secret: boolean
    rewards: ResourceCost
    lifeGained: boolean
    hasNext: boolean
  }): void {
    const stars = `${'★'.repeat(r.stars)}<span class="off">${'★'.repeat(3 - r.stars)}</span>`
    const rewards =
      Object.entries(r.rewards)
        .map(([id, n]) => `${n} ${ITEMS[id as ItemId].name}`)
        .join(', ') || '–'
    const s = this.open(
      'results',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">Geschafft</p>
        <h2 class="title is-small">${r.levelName}</h2>
        <p class="stars">${stars}</p>
        <dl class="kv">
          <dt>Zeit</dt><dd>${formatElapsed(r.time)}</dd>
          <dt>★★ ${r.secondaryText}</dt><dd class="${r.secondary ? 'ok' : 'bad'}">${r.secondary ? 'erfüllt' : 'verfehlt'}</dd>
          <dt>★★★ Geheimnis</dt><dd class="${r.secret ? 'ok' : 'bad'}">${r.secret ? 'gefunden' : 'nicht gefunden'}</dd>
          <dt>Belohnung ins Lager</dt><dd>${rewards}</dd>
          ${r.lifeGained ? '<dt>Drei Sterne</dt><dd class="ok">+1 Leben</dd>' : ''}
        </dl>
        ${r.hasNext ? '<button class="btn is-primary" data-act="next">Weiter</button>' : '<p class="lede is-ember">Mehr Level folgen. Das war der Vertical Slice.</p>'}
        <div class="btn-row">
          <button class="btn" data-act="retry">Nochmal</button>
          <button class="btn" data-act="quit">Zum Menü</button>
        </div>
      </div>
    `,
    )
    s.querySelector('[data-act="next"]')?.addEventListener('click', () => this.cb.onNext())
    s.querySelector('[data-act="retry"]')!.addEventListener('click', () => this.cb.onRestart())
    s.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit())
  }

  showUpdate(): void {
    const s = this.open(
      'update',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">Neue Version</p>
        <p class="lede">Eine neue Version von EMBERWAKE ist bereit. Jetzt neu starten?</p>
        <button class="btn is-primary" data-act="update">Neu starten</button>
        <button class="btn is-ghost" data-act="later">Später</button>
      </div>
    `,
    )
    s.querySelector('[data-act="update"]')!.addEventListener('click', () => this.cb.onUpdateApp())
    s.querySelector('[data-act="later"]')!.addEventListener('click', () => this.cb.onResume())
  }

  // -------------------------------------------------------------------------
  // Lager
  // -------------------------------------------------------------------------

  showCamp(w: World, tab: CampTab): void {
    this.campWorld = w
    this.campTab = tab
    this.open('camp', 'is-dim', '<div class="card is-wide" data-el="campCard"></div>')
    this.renderCamp()
  }

  refreshCamp(): void {
    if (this.currentScreen === 'camp' && this.campWorld) this.renderCamp()
  }

  private renderCamp(): void {
    const w = this.campWorld!
    const card = this.screens.querySelector<HTMLElement>('[data-el="campCard"]')!
    const tabs: Array<[CampTab, string]> = [
      ['core', 'Kern'],
      ['build', 'Bauen'],
      ['craft', 'Werkstatt'],
      ['stock', 'Vorrat'],
    ]
    const showCraft = buildingLevel(w, 'workbench') > 0
    const tabHtml = tabs
      .filter(([t]) => t !== 'craft' || showCraft)
      .map(
        ([t, label]) =>
          `<button class="tab ${t === this.campTab ? 'is-active' : ''}" data-tab="${t}">${label}</button>`,
      )
      .join('')

    let body = ''
    switch (this.campTab) {
      case 'core':
        body = this.campCoreHtml(w)
        break
      case 'build':
        body = this.campBuildHtml(w)
        break
      case 'craft':
        body = this.campCraftHtml(w)
        break
      case 'stock':
        body = this.campStockHtml(w)
        break
    }

    card.innerHTML = `
      <p class="eyebrow">Lager</p>
      <div class="tabs">${tabHtml}</div>
      ${body}
      <button class="btn is-primary" data-act="close">Zurück ins Spiel</button>
    `
    card.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        this.campTab = b.dataset.tab as CampTab
        this.renderCamp()
      })
    })
    card.querySelector('[data-act="close"]')!.addEventListener('click', () => this.cb.onCloseCamp())
    card.querySelectorAll<HTMLElement>('[data-refuel]').forEach((b) => {
      b.addEventListener('click', () => {
        const v = b.dataset.refuel!
        this.cb.onRefuel(v === 'all' ? 'all' : Number(v))
      })
    })
    card
      .querySelector('[data-act="crystal"]')
      ?.addEventListener('click', () => this.cb.onRefuelCrystal())
    card.querySelector('[data-act="eat"]')?.addEventListener('click', () => this.cb.onEat())
    card.querySelectorAll<HTMLElement>('[data-build]').forEach((b) => {
      b.addEventListener('click', () => this.cb.onBuild(b.dataset.build as BuildingId))
    })
    card.querySelectorAll<HTMLElement>('[data-craft]').forEach((b) => {
      const recipe = availableRecipes(w).find((r) => r.id === b.dataset.craft)
      if (recipe) b.addEventListener('click', () => this.cb.onCraft(recipe))
    })
  }

  private campCoreHtml(w: World): string {
    const wood = w.camp.stock.wood ?? 0
    const crystal = w.camp.stock.crystal ?? 0
    const food = w.camp.stock.food ?? 0
    const per = w.level.ember.regenPerWood
    const pct = Math.round(w.ember.charge)
    const dmg = w.player.hp < w.player.maxHp
    return `
      <div class="core-status">
        <div class="bar core-bar"><i style="width:${Math.min(100, (w.ember.charge / w.ember.capacity) * 100)}%"></i></div>
        <span class="pct">${pct} %</span>
      </div>
      <p class="small">Kapazität ${w.ember.capacity} · Lichtradius ${w.ember.lightRadius.toFixed(1)} m · Grundlast −${w.level.ember.drainBase.toFixed(2)}/s</p>
      <div class="row">
        <div><div class="name">Kern nähren</div><div class="desc">+${per} % je Zunderholz · ${wood} Holz im Lager</div></div>
        <div class="btn-row">
          <button class="btn" data-refuel="1" ${wood < 1 ? 'disabled' : ''}>+1</button>
          <button class="btn" data-refuel="5" ${wood < 1 ? 'disabled' : ''}>+5</button>
          <button class="btn" data-refuel="all" ${wood < 1 ? 'disabled' : ''}>Alles</button>
        </div>
      </div>
      ${crystal > 0 ? `<div class="row"><div><div class="name">Glutkristall einsetzen</div><div class="desc">+25 % · ${crystal} vorhanden</div></div><button class="btn" data-act="crystal">Einsetzen</button></div>` : ''}
      <div class="row">
        <div><div class="name">Essen</div><div class="desc">+30 Gesundheit · ${food} Nahrung im Lager</div></div>
        <button class="btn" data-act="eat" ${food < 1 || !dmg ? 'disabled' : ''}>Essen</button>
      </div>
    `
  }

  private costHtml(w: World, cost: ResourceCost, ember: number): string {
    const parts = Object.entries(cost).map(([id, n]) => {
      const have = w.camp.stock[id as ItemId] ?? 0
      return `<span class="${have < (n ?? 0) ? 'lack' : ''}">${n} ${ITEMS[id as ItemId].name}</span>`
    })
    if (ember > 0) parts.push(`<span class="ember">${ember} % Kern</span>`)
    return parts.join(' · ')
  }

  private campBuildHtml(w: World): string {
    const ids = (Object.keys(BUILDINGS) as BuildingId[]).filter(
      (id) => w.level.camp.unlockedBuildings.includes(id) || buildingLevel(w, id) > 0,
    )
    const rows = ids.map((id) => {
      const def = BUILDINGS[id]
      const lvl = buildingLevel(w, id)
      const next = def.levels[lvl]
      const check = canBuild(w, id)
      if (!next) {
        return `<div class="row"><div><div class="name">${def.name} · Stufe ${lvl}</div><div class="desc">${def.levels[lvl - 1]?.description ?? ''}</div></div><span class="reason">Ausgebaut</span></div>`
      }
      return `<div class="row">
        <div>
          <div class="name">${def.name} ${lvl > 0 ? `· Stufe ${lvl} → ${lvl + 1}` : ''}</div>
          <div class="desc">${next.description}</div>
          <div class="cost">${this.costHtml(w, next.cost, next.emberCost)}</div>
        </div>
        <div style="text-align:right">
          <button class="btn ${check.ok ? 'is-primary' : ''}" data-build="${id}" ${check.ok ? '' : 'disabled'}>${lvl > 0 ? 'Ausbauen' : 'Bauen'}</button>
          ${check.reason ? `<div class="reason">${check.reason}</div>` : ''}
        </div>
      </div>`
    })
    return `<div class="list">${rows.join('') || '<p class="small">Hier ist noch nichts freigeschaltet.</p>'}</div>`
  }

  private campCraftHtml(w: World): string {
    const rows = availableRecipes(w).map((r) => {
      const check = canCraft(w, r)
      return `<div class="row">
        <div>
          <div class="name">${r.name}</div>
          <div class="desc">${r.description}</div>
          <div class="cost">${this.costHtml(w, r.cost, r.emberCost)}</div>
        </div>
        <div style="text-align:right">
          <button class="btn ${check.ok ? 'is-primary' : ''}" data-craft="${r.id}" ${check.ok ? '' : 'disabled'}>Herstellen</button>
          ${check.reason ? `<div class="reason">${check.reason}</div>` : ''}
        </div>
      </div>`
    })
    return `<div class="list">${rows.join('') || '<p class="small">Keine Rezepte verfügbar.</p>'}</div>`
  }

  private campStockHtml(w: World): string {
    const items = Object.entries(w.camp.stock).filter(([, n]) => (n ?? 0) > 0)
    const tools = Array.from(w.player.tools)
    return `
      <div class="stock">${items.map(([id, n]) => `<div class="item"><b>${n}</b><span>${ITEMS[id as ItemId].name}</span></div>`).join('') || '<p class="small">Das Lager ist leer.</p>'}</div>
      <p class="small">Werkzeuge: ${tools.length ? tools.map((t) => ITEMS[t].name).join(', ') : 'keine'}</p>
    `
  }
}
