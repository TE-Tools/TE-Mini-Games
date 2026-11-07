import { PLAYER_START, START_FACING, type World } from '@/games/emberwake/world/World'
import type { ItemId } from '@/games/emberwake/data/schema/types'
import type { LevelRecord, ProfileData } from '@/games/emberwake/save/schema'
import { STERNE_MIT_WERBEHILFE } from '@/games/werbehilfe'
import { recomputeWeight } from './InventorySystem'

/**
 * Wiederbeleben -- die Belohnung eines Werbevideos, einmal je Anlauf.
 *
 * Was es heißt, ist hier festgelegt und nirgends sonst:
 *
 *  - Der Spieler steht wieder im Lager, mit voller Gesundheit und kurz
 *    unverwundbar, damit ihn nicht derselbe Schatten sofort wieder fällt.
 *  - Vom Getragenen bleibt die Hälfte -- dieselbe Regel wie beim Tod; sie
 *    landet im Lager, der Rucksack ist leer.
 *  - Ist der Kern erloschen, glimmt er wieder mit der Hälfte seiner
 *    Kapazität. Brennt er noch, bleibt er, wie er ist: Das Video füllt
 *    keine Vorräte auf.
 *  - Uhr, Nacht, Gegner, Lager und Ziele laufen weiter, wo sie waren.
 *
 * Deterministisch: kein Zufall, keine Uhr -- gleiche Welt, gleiches
 * Ergebnis. Ein so geretteter Anlauf trägt `revived` und schreibt beim
 * Abschluss keinen Rekord (siehe App.onComplete und src/games/werbehilfe.ts).
 */

/** So lange ist der Spieler nach dem Wiederbeleben unverwundbar (Sekunden). */
export const REVIVE_INVULNERABLE = 3
/** Auf diesen Anteil der Kapazität glimmt ein erloschener Kern wieder auf. */
export const REVIVE_CORE_SHARE = 0.5

/**
 * Einen Levelabschluss in den Levelrekord eintragen.
 *
 * Ohne Wiederbelebung wie bisher. Mit: höchstens ein Stern, keine Bestzeit,
 * kein Extraleben für drei Sterne. Das Geheimnis bleibt gefunden (es ist ein
 * Fund, kein Rekord), der Abschluss zählt. Liefert die Sterne, die gelten.
 */
export function bookCompletion(
  rec: LevelRecord,
  r: { stars: number; time: number; secret: boolean; revived: boolean },
): { stars: number; firstThree: boolean } {
  const stars = r.revived ? Math.min(STERNE_MIT_WERBEHILFE, r.stars) : r.stars
  rec.completions++
  const firstThree = !r.revived && stars === 3 && rec.stars < 3
  rec.stars = Math.max(rec.stars, stars)
  if (!r.revived) rec.bestTime = rec.bestTime === null ? r.time : Math.min(rec.bestTime, r.time)
  rec.secret = rec.secret || r.secret
  return { stars, firstThree }
}

/** Was der Tod am Profil geändert hat und das Wiederbeleben zurücknimmt. */
export interface BeforeDeath {
  lives: number
  unlockedLevelId: number
}

/**
 * Den Lebensverlust zurücknehmen: Der Anlauf geht weiter, also hat er kein
 * Leben gekostet -- auch nicht das letzte, das sonst die Welt zurücksetzt.
 * Der Tod selbst bleibt gezählt (Statistik), der gerettete Rucksack im Lager.
 */
export function undoDeathPenalty(
  profile: Pick<ProfileData, 'lives' | 'unlockedLevelId'>,
  before: BeforeDeath,
): void {
  profile.lives = before.lives
  profile.unlockedLevelId = Math.max(profile.unlockedLevelId, before.unlockedLevelId)
}

/** Darf wiederbelebt werden? Nur nach dem Tod und nur einmal je Anlauf. */
export function canRevive(w: World): boolean {
  return w.status === 'dead' && !w.revived
}

/** Belebt wieder. Liefert false, wenn es nicht erlaubt ist (dann ändert sich nichts). */
export function revivePlayer(w: World): boolean {
  if (!canRevive(w)) return false
  const p = w.player

  // Die Hälfte des Getragenen ins Lager, wie beim Tod.
  for (const key in p.inventory) {
    const id = key as ItemId
    const half = Math.floor((p.inventory[id] ?? 0) / 2)
    if (half > 0) w.camp.stock[id] = (w.camp.stock[id] ?? 0) + half
  }
  p.inventory = {}
  recomputeWeight(w)

  p.pos.x = PLAYER_START.x
  p.pos.z = PLAYER_START.z
  p.prevPos.x = PLAYER_START.x
  p.prevPos.z = PLAYER_START.z
  p.vel.x = 0
  p.vel.z = 0
  p.facing = START_FACING
  p.hp = p.maxHp
  p.alive = true
  p.invulnerable = REVIVE_INVULNERABLE
  p.attackCooldown = 0
  p.attackAnim = 0
  p.gatherProgress = 0
  p.sprinting = false

  const e = w.ember
  if (e.charge <= 0) e.charge = e.capacity * REVIVE_CORE_SHARE

  w.status = 'running'
  w.deathCause = null
  w.revived = true
  w.interactable = null
  return true
}
