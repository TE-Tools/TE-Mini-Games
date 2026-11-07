import type { World } from '@/games/emberwake/world/World'
import { CAMP_POS, buildingLevel } from '@/games/emberwake/world/World'
import type { ProfileData, Settings } from '@/games/emberwake/save/schema'
import { MAX_LIVES } from '@/games/emberwake/save/schema'
import { LEVELS } from '@/games/emberwake/data/levels'
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
import {
  aktionText,
  emberwakeTexte,
  gebaeudeName,
  gebaeudeStufe,
  gegenstandName,
  grundText,
  hauptziel,
  levelName,
  levelUntertitel,
  rezeptBeschreibung,
  rezeptName,
  weltName,
  werbeTexte,
  zusatzziel,
  type EmberwakeTexte,
} from '@/games/emberwake/ui/texte'

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

export class UiRoot {
  /**
   * Die Texte in der Sprache der App, einmal beim Start gelesen. Ein
   * Sprachwechsel greift beim nächsten Start von Emberwake.
   */
  readonly tx: EmberwakeTexte = emberwakeTexte()
  /** Beschriftung der Werbevideos, wie in der App. */
  private readonly wx = werbeTexte()
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
    const tx = this.tx
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
            <span class="label">${tx.kern}</span>
            <div class="bar core-bar" data-el="coreBar"><i data-el="core"></i></div>
            <span class="core-pct" data-el="corePct">–</span>
            <span class="core-drain" data-el="coreDrain"></span>
          </div>
          <div class="hud-clock">
            <div class="phase" data-el="phase"></div>
            <button id="btn-pause" aria-label="${tx.pause}">❙❙</button>
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
            <div class="label"><span>${tx.ballast}</span><span data-el="weightVal"></span></div>
            <div class="bar weight-bar" data-el="weightBar"><i data-el="weight"></i></div>
          </div>
          <div class="inv-list" data-el="inv"></div>
          <button id="btn-drop">${tx.abwerfen}</button>
        </div>
        <div class="hud-buttons">
          <button id="btn-sprint">${tx.sprint}</button>
          <button id="btn-attack" aria-label="${tx.angriff}">⚔</button>
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
    const tx = this.tx
    if (w.level.cycle.nights === 0)
      label = `${tx.phasen[c.phase]}<b>${formatElapsed(c.elapsed)}</b>`
    else if (c.phase === 'day') label = `${tx.nachtIn}<b>${formatElapsed(remaining)}</b>`
    else if (c.phase === 'night')
      label = `${tx.nachtNummer(c.night)}<b>${formatElapsed(remaining)}</b>`
    else label = `${tx.phasen[c.phase]}<b>${formatElapsed(remaining)}</b>`
    if (this.el.phase!.innerHTML !== label) this.el.phase!.innerHTML = label
    this.el.phase!.classList.toggle('is-night', c.phase === 'night' || c.phase === 'dusk')

    // Ziele
    const prim = w.level.objectives.primary
    let primText = hauptziel(tx, w.level)
    if (prim.kind === 'store_resource')
      primText += ` (${Math.min(prim.amount, w.camp.stock[prim.resource] ?? 0)}/${prim.amount})`
    if (prim.kind === 'core_charge')
      primText += ` (${Math.min(prim.threshold, Math.floor(w.ember.charge))}/${prim.threshold})`
    if (prim.kind === 'survive_nights') primText += ` (${w.clock.nightsSurvived}/${prim.nights})`
    this.el.objPrimary!.textContent = primText
    this.el.objPrimary!.classList.toggle('obj-done', w.objectives.primary >= 1)
    const sec = w.level.objectives.secondary
    this.el.objSecondary!.textContent = `★★ ${zusatzziel(tx, w.level)}`
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
      this.el.compassDist!.textContent = tx.lagerEntfernung(Math.round(dCamp))
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
        .map(([id, n]) => `${n} ${gegenstandName(tx, id as ItemId)}`)
        .join(' · ')
    }
    const dropBtn = this.root.querySelector<HTMLElement>('#btn-drop')!
    dropBtn.hidden = p.weight <= 0

    // Tasten
    const action = this.root.querySelector<HTMLElement>('#btn-action')!
    const actionLabel = aktionText(tx, w)
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
    const tx = this.tx
    const s = this.open(
      'title',
      'is-solid',
      `
      <div class="card">
        <p class="eyebrow">${tx.untertitel}</p>
        <h1 class="title">EMBERWAKE</h1>
        <p class="lede is-ember">${tx.leitsatz}</p>
        ${portrait ? `<p class="orientation-hint">${tx.querformatTipp}</p>` : ''}
        <button class="btn is-primary" data-act="continue">${hasRun ? tx.fortsetzen : profile.unlockedLevelId > 1 ? tx.weiterMitLevel(profile.unlockedLevelId) : tx.spielen}</button>
        <button class="btn" data-act="levels">${tx.levelWaehlen}</button>
        <dl class="kv">
          <dt>${tx.leben}</dt><dd>${'♥'.repeat(profile.lives)}<span style="opacity:.25">${'♥'.repeat(Math.max(0, MAX_LIVES - profile.lives))}</span></dd>
          <dt>${tx.sterne}</dt><dd>${Object.values(profile.levels).reduce((n, l) => n + l.stars, 0)} / ${LEVELS.length * 3}</dd>
        </dl>
        ${showExit ? `<button class="btn is-ghost" data-act="exit">${tx.zurueckZurUebersicht}</button>` : ''}
        <p class="small center">${tx.versionZeile}</p>
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
    const tx = this.tx
    const items = LEVELS.map((l) => {
      const rec = profile.levels[l.id]
      const locked = l.id > profile.unlockedLevelId
      const stars = rec?.stars ?? 0
      const st = `${'★'.repeat(stars)}<span class="off">${'★'.repeat(3 - stars)}</span>`
      return `<button class="level-item" data-level="${l.id}" ${locked ? 'disabled' : ''}>
        <span class="num">${String(l.id).padStart(2, '0')}</span>
        <span><span class="name">${levelName(tx, l)}</span><br><span class="sub">${locked ? tx.gesperrt : levelUntertitel(tx, l)}</span></span>
        <span class="st">${st}</span>
      </button>`
    }).join('')
    const s = this.open(
      'levels',
      'is-solid',
      `
      <div class="card">
        <p class="eyebrow">${tx.weltZeile(1, weltName(tx, 1))}</p>
        <div class="level-list">${items}</div>
        <button class="btn is-ghost" data-act="back">${tx.zurueck}</button>
      </div>
    `,
    )
    s.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
      b.addEventListener('click', () => this.cb.onSelectLevel(Number(b.dataset.level)))
    })
    s.querySelector('[data-act="back"]')!.addEventListener('click', () => this.cb.onBackToTitle())
  }

  showPause(settings: Settings, hasVibration: boolean): void {
    const tx = this.tx
    const s = this.open(
      'pause',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">${tx.pause}</p>
        <button class="btn is-primary" data-act="resume">${tx.weiterSpielen}</button>
        <div class="settings-row"><span>${tx.haptik}${hasVibration ? '' : ` <span class="small">${tx.haptikFehlt}</span>`}</span><button class="toggle ${settings.haptics ? 'is-on' : ''}" data-set="haptics" aria-label="${tx.haptik}"></button></div>
        <div class="settings-row"><span>${tx.grafik}</span>
          <select data-set="quality">
            <option value="auto" ${settings.quality === 'auto' ? 'selected' : ''}>${tx.qualitaet.auto}</option>
            <option value="low" ${settings.quality === 'low' ? 'selected' : ''}>${tx.qualitaet.low}</option>
            <option value="medium" ${settings.quality === 'medium' ? 'selected' : ''}>${tx.qualitaet.medium}</option>
            <option value="high" ${settings.quality === 'high' ? 'selected' : ''}>${tx.qualitaet.high}</option>
          </select>
        </div>
        <div class="settings-row"><span>${tx.ton}</span><button class="toggle ${settings.sfxVolume > 0 ? 'is-on' : ''}" data-set="sound" aria-label="${tx.ton}"></button></div>
        <div class="btn-row">
          <button class="btn" data-act="restart">${tx.levelNeu}</button>
          <button class="btn" data-act="quit">${tx.zumMenue}</button>
        </div>
        <div class="btn-row">
          <button class="btn is-ghost" data-act="export">${tx.exportieren}</button>
          <label class="btn is-ghost" style="cursor:pointer">${tx.importieren}<input type="file" accept=".ewsave,application/json" hidden data-act="import"></label>
        </div>
        <button class="btn is-ghost is-danger" data-act="reset">${tx.allesZuruecksetzen}</button>
        <p class="small center">${tx.tastatur}</p>
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
      if (confirm(tx.zuruecksetzenFrage)) this.cb.onReset()
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
    const tx = this.tx
    const s = this.open(
      'death',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">${tx.erloschen}</p>
        <p class="cause">${cause}.</p>
        <dl class="kv">
          <dt>${tx.lebenUebrig}</dt><dd>${'♥'.repeat(livesLeft)}<span style="opacity:.25">${'♥'.repeat(Math.max(0, MAX_LIVES - livesLeft))}</span></dd>
          ${carriedNote ? `<dt>${tx.rucksack}</dt><dd>${carriedNote}</dd>` : ''}
        </dl>
        <p class="lede">${resetNote ?? tx.lagerBleibt}</p>
        <button class="btn is-primary" data-act="retry">${tx.nochmal}</button>
        <button class="btn is-ghost" data-act="quit">${tx.zumMenue}</button>
      </div>
    `,
    )
    s.querySelector('[data-act="retry"]')!.addEventListener('click', () => this.cb.onRestart())
    s.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit())
  }

  /**
   * Belohnungsvideo im Todesbildschirm anbieten. Wird nur aufgerufen, wenn
   * wirklich ein Video bereitsteht -- sonst sieht der Bildschirm aus wie
   * immer. Beschriftet als Werbevideo, wie der `BelohnungsKnopf` der App.
   * `ansehen` liefert, ob das Video zu Ende geschaut wurde.
   */
  offerRevive(ansehen: () => Promise<boolean>): void {
    if (this.currentScreen !== 'death') return
    const card = this.screens.querySelector('.card')
    if (!card || card.querySelector('[data-act="revive"]')) return
    const wx = this.wx
    const rahmen = document.createElement('div')
    const knopf = document.createElement('button')
    knopf.type = 'button'
    knopf.className = 'btn is-ad'
    knopf.dataset.act = 'revive'
    const text = document.createElement('span')
    text.textContent = `▶ ${wx.videoAnsehen(this.tx.wiederbelebenBelohnung)}`
    const hinweis = document.createElement('small')
    hinweis.className = 'ad-note'
    hinweis.textContent = wx.hinweis
    knopf.append(text, hinweis)
    knopf.addEventListener('click', () => {
      knopf.disabled = true
      text.textContent = wx.laeuft
      void ansehen().then((geschaut) => {
        if (geschaut) return
        const status = document.createElement('p')
        status.className = 'small center'
        status.setAttribute('role', 'status')
        status.textContent = wx.abgebrochen
        rahmen.replaceChildren(status)
      })
    })
    rahmen.append(knopf)
    card.insertBefore(rahmen, card.querySelector('[data-act="retry"]'))
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
    /** Mit Wiederbelebung per Video geschafft: Hinweis, warum es weniger gibt. */
    revived?: boolean
  }): void {
    const tx = this.tx
    const stars = `${'★'.repeat(r.stars)}<span class="off">${'★'.repeat(3 - r.stars)}</span>`
    const rewards =
      Object.entries(r.rewards)
        .map(([id, n]) => `${n} ${gegenstandName(tx, id as ItemId)}`)
        .join(', ') || '–'
    const s = this.open(
      'results',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">${tx.geschafft}</p>
        <h2 class="title is-small">${r.levelName}</h2>
        <p class="stars">${stars}</p>
        <dl class="kv">
          <dt>${tx.zeit}</dt><dd>${formatElapsed(r.time)}</dd>
          <dt>★★ ${r.secondaryText}</dt><dd class="${r.secondary ? 'ok' : 'bad'}">${r.secondary ? tx.erfuellt : tx.verfehlt}</dd>
          <dt>★★★ ${tx.geheimnis}</dt><dd class="${r.secret ? 'ok' : 'bad'}">${r.secret ? tx.gefunden : tx.nichtGefunden}</dd>
          <dt>${tx.belohnung}</dt><dd>${rewards}</dd>
          ${r.lifeGained ? `<dt>${tx.dreiSterne}</dt><dd class="ok">${tx.einLebenMehr}</dd>` : ''}
        </dl>
        ${r.revived ? `<p class="small center">${tx.mitWiederbelebung}</p>` : ''}
        ${r.hasNext ? `<button class="btn is-primary" data-act="next">${tx.naechstesLevel}</button>` : `<p class="lede is-ember">${tx.mehrLevelFolgen}</p>`}
        <div class="btn-row">
          <button class="btn" data-act="retry">${tx.nochmal}</button>
          <button class="btn" data-act="quit">${tx.zumMenue}</button>
        </div>
      </div>
    `,
    )
    s.querySelector('[data-act="next"]')?.addEventListener('click', () => this.cb.onNext())
    s.querySelector('[data-act="retry"]')!.addEventListener('click', () => this.cb.onRestart())
    s.querySelector('[data-act="quit"]')!.addEventListener('click', () => this.cb.onQuit())
  }

  showUpdate(): void {
    const tx = this.tx
    const s = this.open(
      'update',
      'is-dim',
      `
      <div class="card">
        <p class="eyebrow">${tx.neueVersion}</p>
        <p class="lede">${tx.neueVersionFrage}</p>
        <button class="btn is-primary" data-act="update">${tx.neuStarten}</button>
        <button class="btn is-ghost" data-act="later">${tx.spaeter}</button>
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
    const tx = this.tx
    const tabs: Array<[CampTab, string]> = [
      ['core', tx.reiter.core],
      ['build', tx.reiter.build],
      ['craft', tx.reiter.craft],
      ['stock', tx.reiter.stock],
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
      <p class="eyebrow">${tx.lager}</p>
      <div class="tabs">${tabHtml}</div>
      ${body}
      <button class="btn is-primary" data-act="close">${tx.zurueckInsSpiel}</button>
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
    const tx = this.tx
    return `
      <div class="core-status">
        <div class="bar core-bar"><i style="width:${Math.min(100, (w.ember.charge / w.ember.capacity) * 100)}%"></i></div>
        <span class="pct">${pct} %</span>
      </div>
      <p class="small">${tx.kernWerte(w.ember.capacity, w.ember.lightRadius.toFixed(1), w.level.ember.drainBase.toFixed(2))}</p>
      <div class="row">
        <div><div class="name">${tx.kernNaehren}</div><div class="desc">${tx.jeHolz(per, wood)}</div></div>
        <div class="btn-row">
          <button class="btn" data-refuel="1" ${wood < 1 ? 'disabled' : ''}>+1</button>
          <button class="btn" data-refuel="5" ${wood < 1 ? 'disabled' : ''}>+5</button>
          <button class="btn" data-refuel="all" ${wood < 1 ? 'disabled' : ''}>${tx.alles}</button>
        </div>
      </div>
      ${crystal > 0 ? `<div class="row"><div><div class="name">${tx.kristallEinsetzen}</div><div class="desc">${tx.kristallVorrat(crystal)}</div></div><button class="btn" data-act="crystal">${tx.einsetzen}</button></div>` : ''}
      <div class="row">
        <div><div class="name">${tx.essen}</div><div class="desc">${tx.essenVorrat(food)}</div></div>
        <button class="btn" data-act="eat" ${food < 1 || !dmg ? 'disabled' : ''}>${tx.essen}</button>
      </div>
    `
  }

  private costHtml(w: World, cost: ResourceCost, ember: number): string {
    const parts = Object.entries(cost).map(([id, n]) => {
      const have = w.camp.stock[id as ItemId] ?? 0
      return `<span class="${have < (n ?? 0) ? 'lack' : ''}">${n} ${gegenstandName(this.tx, id as ItemId)}</span>`
    })
    if (ember > 0) parts.push(`<span class="ember">${this.tx.kernKosten(ember)}</span>`)
    return parts.join(' · ')
  }

  private campBuildHtml(w: World): string {
    const tx = this.tx
    const ids = (Object.keys(BUILDINGS) as BuildingId[]).filter(
      (id) => w.level.camp.unlockedBuildings.includes(id) || buildingLevel(w, id) > 0,
    )
    const rows = ids.map((id) => {
      const def = BUILDINGS[id]
      const name = gebaeudeName(tx, id)
      const lvl = buildingLevel(w, id)
      const next = def.levels[lvl]
      const check = canBuild(w, id)
      if (!next) {
        return `<div class="row"><div><div class="name">${name} · ${tx.stufe(lvl)}</div><div class="desc">${gebaeudeStufe(tx, id, lvl - 1)}</div></div><span class="reason">${tx.ausgebaut}</span></div>`
      }
      return `<div class="row">
        <div>
          <div class="name">${name} ${lvl > 0 ? `· ${tx.stufeAuf(lvl, lvl + 1)}` : ''}</div>
          <div class="desc">${gebaeudeStufe(tx, id, lvl)}</div>
          <div class="cost">${this.costHtml(w, next.cost, next.emberCost)}</div>
        </div>
        <div style="text-align:right">
          <button class="btn ${check.ok ? 'is-primary' : ''}" data-build="${id}" ${check.ok ? '' : 'disabled'}>${lvl > 0 ? tx.ausbauen : tx.bauenKnopf}</button>
          ${check.reason ? `<div class="reason">${grundText(tx, check.reason)}</div>` : ''}
        </div>
      </div>`
    })
    return `<div class="list">${rows.join('') || `<p class="small">${tx.nichtsFreigeschaltet}</p>`}</div>`
  }

  private campCraftHtml(w: World): string {
    const tx = this.tx
    const rows = availableRecipes(w).map((r) => {
      const check = canCraft(w, r)
      return `<div class="row">
        <div>
          <div class="name">${rezeptName(tx, r)}</div>
          <div class="desc">${rezeptBeschreibung(tx, r)}</div>
          <div class="cost">${this.costHtml(w, r.cost, r.emberCost)}</div>
        </div>
        <div style="text-align:right">
          <button class="btn ${check.ok ? 'is-primary' : ''}" data-craft="${r.id}" ${check.ok ? '' : 'disabled'}>${tx.herstellen}</button>
          ${check.reason ? `<div class="reason">${grundText(tx, check.reason)}</div>` : ''}
        </div>
      </div>`
    })
    return `<div class="list">${rows.join('') || `<p class="small">${tx.keineRezepte}</p>`}</div>`
  }

  private campStockHtml(w: World): string {
    const tx = this.tx
    const items = Object.entries(w.camp.stock).filter(([, n]) => (n ?? 0) > 0)
    const tools = Array.from(w.player.tools)
    return `
      <div class="stock">${items.map(([id, n]) => `<div class="item"><b>${n}</b><span>${gegenstandName(tx, id as ItemId)}</span></div>`).join('') || `<p class="small">${tx.lagerLeer}</p>`}</div>
      <p class="small">${tx.werkzeuge(tools.length ? tools.map((werkzeug) => gegenstandName(tx, werkzeug)).join(', ') : tx.keineWerkzeuge)}</p>
    `
  }
}
