/**
 * Vereinheitlichte Eingabe: Touch (dynamischer Joystick, Tasten,
 * Kamera-Ziehen), Tastatur und Maus (Entwicklung).
 *
 * Der Joystick erscheint dort, wo der Daumen aufsetzt (MOBILE.md §3).
 * Ausgabe ist eine Absicht in Bildschirmkoordinaten — die Umrechnung
 * in Weltkoordinaten (Kamera-Drehung) macht die App.
 */

export interface InputSnapshot {
  /** Bildschirm-Bewegungsvektor, Länge ≤ 1. x rechts, y unten. */
  moveX: number
  moveY: number
  sprint: boolean
  actionHeld: boolean
  actionPressed: boolean
  attackPressed: boolean
  dropPressed: boolean
  pausePressed: boolean
  /** Kamera-Drehung in Radiant seit dem letzten Abruf. */
  camYaw: number
  camZoom: number
}

export interface InputElements {
  touchLayer: HTMLElement
  joystickBase: HTMLElement
  joystickKnob: HTMLElement
  actionButton: HTMLElement
  attackButton: HTMLElement
  sprintButton: HTMLElement
  dropButton: HTMLElement
}

const JOY_RADIUS = 52
const YAW_PER_PIXEL = 0.0065

export class InputManager {
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

  private joyPointer: number | null = null
  private joyOrigin = { x: 0, y: 0 }
  private camPointer: number | null = null
  private camLast = { x: 0, y: 0 }
  private pinchPointers = new Map<number, { x: number; y: number }>()
  private pinchLastDist = 0
  private sprintToggle = false
  private readonly keys = new Set<string>()
  private readonly cleanup: Array<() => void> = []
  enabled = true
  /** Gedrückt gehalten (Taste/Maus) — für Sammeln. */
  private actionHeldPointer = false

  constructor(private readonly els: InputElements) {
    this.bindTouch()
    this.bindButtons()
    this.bindKeyboard()
  }

  /** Liest den Zustand und setzt alle Flanken/Deltas zurück. */
  consume(out: InputSnapshot): void {
    const s = this.snap
    this.updateFromKeys()
    out.moveX = s.moveX
    out.moveY = s.moveY
    out.sprint = s.sprint || this.sprintToggle
    out.actionHeld = s.actionHeld || this.actionHeldPointer
    out.actionPressed = s.actionPressed
    out.attackPressed = s.attackPressed
    out.dropPressed = s.dropPressed
    out.pausePressed = s.pausePressed
    out.camYaw = s.camYaw
    out.camZoom = s.camZoom

    s.actionPressed = false
    s.attackPressed = false
    s.dropPressed = false
    s.pausePressed = false
    s.camYaw = 0
    s.camZoom = 0
  }

  get hasTouchJoystick(): boolean {
    return this.joyPointer !== null
  }

  // -------------------------------------------------------------------------

  private bindTouch(): void {
    const layer = this.els.touchLayer
    layer.style.touchAction = 'none'

    const down = (e: PointerEvent): void => {
      if (!this.enabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      try {
        layer.setPointerCapture?.(e.pointerId)
      } catch {
        /* synthetische Zeiger */
      }
      const leftHalf = e.clientX < window.innerWidth * 0.45

      if (e.pointerType !== 'mouse' && leftHalf && this.joyPointer === null) {
        this.joyPointer = e.pointerId
        this.joyOrigin = { x: e.clientX, y: e.clientY }
        this.showJoystick(e.clientX, e.clientY)
        this.setKnob(0, 0)
        return
      }

      if (this.camPointer === null) {
        this.camPointer = e.pointerId
        this.camLast = { x: e.clientX, y: e.clientY }
      }
      this.pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.pinchPointers.size === 2) this.pinchLastDist = this.pinchDistance()
    }

    const move = (e: PointerEvent): void => {
      if (e.pointerId === this.joyPointer) {
        const dx = e.clientX - this.joyOrigin.x
        const dy = e.clientY - this.joyOrigin.y
        const d = Math.hypot(dx, dy)
        const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1
        const nx = (dx * k) / JOY_RADIUS
        const ny = (dy * k) / JOY_RADIUS
        this.snap.moveX = nx
        this.snap.moveY = ny
        this.setKnob(dx * k, dy * k)
        return
      }
      if (this.pinchPointers.has(e.pointerId)) {
        this.pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (this.pinchPointers.size === 2) {
          const d = this.pinchDistance()
          this.snap.camZoom += (this.pinchLastDist - d) * 0.02
          this.pinchLastDist = d
          return
        }
      }
      if (e.pointerId === this.camPointer) {
        this.snap.camYaw += (e.clientX - this.camLast.x) * YAW_PER_PIXEL
        this.camLast = { x: e.clientX, y: e.clientY }
      }
    }

    const up = (e: PointerEvent): void => {
      if (e.pointerId === this.joyPointer) {
        this.joyPointer = null
        this.snap.moveX = 0
        this.snap.moveY = 0
        this.hideJoystick()
      }
      if (e.pointerId === this.camPointer) this.camPointer = null
      this.pinchPointers.delete(e.pointerId)
    }

    layer.addEventListener('pointerdown', down)
    layer.addEventListener('pointermove', move)
    layer.addEventListener('pointerup', up)
    layer.addEventListener('pointercancel', up)
    layer.addEventListener('lostpointercapture', up)
    layer.addEventListener(
      'wheel',
      (e) => {
        this.snap.camZoom += Math.sign(e.deltaY) * 0.8
        e.preventDefault()
      },
      { passive: false },
    )
    layer.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private pinchDistance(): number {
    const pts = Array.from(this.pinchPointers.values())
    if (pts.length < 2) return 0
    return Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y)
  }

  private showJoystick(x: number, y: number): void {
    const b = this.els.joystickBase
    b.style.left = `${x}px`
    b.style.top = `${y}px`
    b.classList.add('is-active')
  }

  private hideJoystick(): void {
    this.els.joystickBase.classList.remove('is-active')
    this.setKnob(0, 0)
  }

  private setKnob(dx: number, dy: number): void {
    this.els.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`
  }

  private bindButtons(): void {
    const hold = (el: HTMLElement, onDown: () => void, onUp: () => void): void => {
      const down = (e: PointerEvent): void => {
        e.preventDefault()
        e.stopPropagation()
        try {
          el.setPointerCapture?.(e.pointerId)
        } catch {
          /* synthetische oder bereits beendete Zeiger */
        }
        el.classList.add('is-down')
        onDown()
      }
      const up = (e: PointerEvent): void => {
        e.preventDefault()
        e.stopPropagation()
        el.classList.remove('is-down')
        onUp()
      }
      el.addEventListener('pointerdown', down)
      el.addEventListener('pointerup', up)
      el.addEventListener('pointercancel', up)
      el.addEventListener('lostpointercapture', up)
      el.addEventListener('contextmenu', (e) => e.preventDefault())
    }

    hold(
      this.els.actionButton,
      () => {
        this.snap.actionHeld = true
        this.snap.actionPressed = true
      },
      () => {
        this.snap.actionHeld = false
      },
    )
    hold(
      this.els.attackButton,
      () => {
        this.snap.attackPressed = true
      },
      () => undefined,
    )
    hold(
      this.els.dropButton,
      () => {
        this.snap.dropPressed = true
      },
      () => undefined,
    )
    hold(
      this.els.sprintButton,
      () => {
        this.sprintToggle = !this.sprintToggle
        this.els.sprintButton.classList.toggle('is-on', this.sprintToggle)
      },
      () => undefined,
    )
  }

  /** Sprint-Umschalter von außen zurücksetzen (z. B. bei Levelstart). */
  resetToggles(): void {
    this.sprintToggle = false
    this.els.sprintButton.classList.remove('is-on')
  }

  private bindKeyboard(): void {
    const down = (e: KeyboardEvent): void => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      this.keys.add(k)
      switch (k) {
        case 'e':
        case 'enter':
          this.snap.actionPressed = true
          this.actionHeldPointer = true
          break
        case ' ':
        case 'f':
        case 'j':
          this.snap.attackPressed = true
          e.preventDefault()
          break
        case 'q':
          this.snap.dropPressed = true
          break
        case 'escape':
        case 'p':
          this.snap.pausePressed = true
          break
      }
    }
    const up = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase()
      this.keys.delete(k)
      if (k === 'e' || k === 'enter') this.actionHeldPointer = false
    }
    const blur = (): void => {
      this.keys.clear()
      this.actionHeldPointer = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    this.cleanup.push(() => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    })
  }

  private updateFromKeys(): void {
    if (this.joyPointer !== null) return
    let x = 0
    let y = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y)
      this.snap.moveX = x / l
      this.snap.moveY = y / l
    } else if (this.joyPointer === null) {
      this.snap.moveX = 0
      this.snap.moveY = 0
    }
    this.snap.sprint = this.keys.has('shift')
  }

  dispose(): void {
    for (const fn of this.cleanup) fn()
  }
}
