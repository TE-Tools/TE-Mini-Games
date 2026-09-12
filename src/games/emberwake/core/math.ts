/**
 * Mathematik-Hilfen ohne Allokation.
 *
 * Die Simulation ist 2,5D: Positionen liegen in der Ebene (x, z),
 * die Höhe y ergibt sich aus dem Terrain. Alle Funktionen schreiben
 * in ein übergebenes `out`-Objekt, statt neue zu erzeugen — im
 * Simulationstakt wird nichts alloziert (PERFORMANCE.md §3.5).
 */
export interface Vec2 {
  x: number
  z: number
}

export const TAU = Math.PI * 2

export function vec2(x = 0, z = 0): Vec2 {
  return { x, z }
}

export function set(out: Vec2, x: number, z: number): Vec2 {
  out.x = x
  out.z = z
  return out
}

export function copy(out: Vec2, a: Vec2): Vec2 {
  out.x = a.x
  out.z = a.z
  return out
}

export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x + b.x
  out.z = a.z + b.z
  return out
}

export function sub(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x - b.x
  out.z = a.z - b.z
  return out
}

export function scale(out: Vec2, a: Vec2, s: number): Vec2 {
  out.x = a.x * s
  out.z = a.z * s
  return out
}

export function addScaled(out: Vec2, a: Vec2, b: Vec2, s: number): Vec2 {
  out.x = a.x + b.x * s
  out.z = a.z + b.z * s
  return out
}

export function len2(a: Vec2): number {
  return a.x * a.x + a.z * a.z
}

export function len(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.z * a.z)
}

export function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt(dist2(a, b))
}

/** Normalisiert in place. Nullvektor bleibt Nullvektor. */
export function normalize(out: Vec2): Vec2 {
  const l = len(out)
  if (l > 1e-8) {
    out.x /= l
    out.z /= l
  }
  return out
}

/** Begrenzt die Länge auf `max`. */
export function limit(out: Vec2, max: number): Vec2 {
  const l2 = len2(out)
  if (l2 > max * max) {
    const f = max / Math.sqrt(l2)
    out.x *= f
    out.z *= f
  }
  return out
}

export function lerpVec(out: Vec2, a: Vec2, b: Vec2, t: number): Vec2 {
  out.x = a.x + (b.x - a.x) * t
  out.z = a.z + (b.z - a.z) * t
  return out
}

export function fromAngle(out: Vec2, angle: number, length = 1): Vec2 {
  out.x = Math.cos(angle) * length
  out.z = Math.sin(angle) * length
  return out
}

/** Winkel des Vektors in der Ebene, in Radiant. */
export function angleOf(a: Vec2): number {
  return Math.atan2(a.z, a.x)
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function inverseLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : clamp01((v - a) / (b - a))
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Kürzeste Winkeldifferenz in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

/** Exponentielle Annäherung, bildratenunabhängig. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}
