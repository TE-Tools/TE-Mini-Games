import * as THREE from 'three'
import { clamp, damp, lerp } from '@/games/emberwake/core/math'

/**
 * Verfolgerkamera (MOBILE.md §3).
 * Folgt automatisch. Ziehen dreht, Zwei-Finger zoomt. Das Spiel muss
 * ohne eine einzige Kameraeingabe vollständig spielbar sein.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera

  /** Drehung um die Hochachse. 0 = Kamera steht bei +z und blickt nach −z. */
  yaw = 0
  private pitch = 0.92 // ~53°
  private distance = 11
  private targetDistance = 11

  private readonly target = new THREE.Vector3()
  private readonly smoothTarget = new THREE.Vector3()
  private first = true

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.3, 260)
  }

  rotate(deltaYaw: number): void {
    this.yaw -= deltaYaw
  }

  zoom(delta: number): void {
    this.targetDistance = clamp(this.targetDistance + delta, 7, 17)
  }

  /** Welt-Richtung für „Bildschirm nach oben" und „Bildschirm nach rechts". */
  forward(out: { x: number; z: number }): void {
    out.x = -Math.sin(this.yaw)
    out.z = -Math.cos(this.yaw)
  }

  right(out: { x: number; z: number }): void {
    out.x = Math.cos(this.yaw)
    out.z = -Math.sin(this.yaw)
  }

  update(px: number, py: number, pz: number, dt: number): void {
    this.target.set(px, py + 1.0, pz)
    if (this.first) {
      this.smoothTarget.copy(this.target)
      this.first = false
    } else {
      this.smoothTarget.x = damp(this.smoothTarget.x, this.target.x, 9, dt)
      this.smoothTarget.y = damp(this.smoothTarget.y, this.target.y, 6, dt)
      this.smoothTarget.z = damp(this.smoothTarget.z, this.target.z, 9, dt)
    }
    this.distance = damp(this.distance, this.targetDistance, 6, dt)

    // Steilerer Blick bei nahem Zoom hält den Boden lesbar.
    const pitch = lerp(0.78, 1.0, (this.distance - 7) / 10)
    this.pitch = pitch

    const horiz = Math.cos(this.pitch) * this.distance
    this.camera.position.set(
      this.smoothTarget.x + Math.sin(this.yaw) * horiz,
      this.smoothTarget.y + Math.sin(this.pitch) * this.distance,
      this.smoothTarget.z + Math.cos(this.yaw) * horiz,
    )
    this.camera.lookAt(this.smoothTarget)
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect
    // Im Hochformat weiter aufziehen, damit genug Spielfeld sichtbar bleibt.
    this.camera.fov = aspect < 1 ? 62 : 48
    this.camera.updateProjectionMatrix()
  }

  reset(): void {
    this.first = true
    this.yaw = 0
    this.targetDistance = 11
    this.distance = 11
  }
}
