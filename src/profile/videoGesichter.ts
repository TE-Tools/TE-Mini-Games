/**
 * Welche Video-Gesichter auf diesem Gerät freigeschaltet sind.
 *
 * Eines je zu Ende geschautem Belohnungsvideo (Stelle `gesicht-freischalten`).
 * Die Freischaltung ist dauerhaft und liegt nur auf dem Gerät: Ein Konto
 * braucht es dafür nicht, und offline bleibt alles, wie es ist. Das
 * gewählte Gesicht selbst steht wie bisher im Profil.
 *
 * Kommt ein Video-Gesicht über das Konto als gewähltes Gesicht auf ein
 * Gerät, gilt es dort ebenfalls als freigeschaltet (`freigeschaltetMit`) --
 * es wurde ja schon einmal per Video geholt.
 */
import { VIDEO_AVATARS, istVideoAvatar, type VideoAvatarId } from './avatars'

const SCHLUESSEL = 'te-gesichter-per-video'

function lesen(): VideoAvatarId[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return []
    const liste: unknown = JSON.parse(roh)
    if (!Array.isArray(liste)) return []
    return liste.filter((id): id is VideoAvatarId => typeof id === 'string' && istVideoAvatar(id))
  } catch {
    return []
  }
}

/** Die freigeschalteten Video-Gesichter, in der Reihenfolge der Liste. */
export function freigeschalteteGesichter(): VideoAvatarId[] {
  const da = new Set(lesen())
  return VIDEO_AVATARS.map((a) => a.id).filter((id) => da.has(id))
}

/** Wie `freigeschalteteGesichter`, dazu das gerade gewählte Gesicht, falls es eines ist. */
export function freigeschaltetMit(gewaehlt: string | null | undefined): VideoAvatarId[] {
  const liste = freigeschalteteGesichter()
  if (istVideoAvatar(gewaehlt) && !liste.includes(gewaehlt)) {
    return VIDEO_AVATARS.map((a) => a.id).filter((id) => id === gewaehlt || liste.includes(id))
  }
  return liste
}

/** Schaltet ein Gesicht dauerhaft frei. Doppelt freischalten ändert nichts. */
export function gesichtFreischalten(id: VideoAvatarId): VideoAvatarId[] {
  const neu = Array.from(new Set([...lesen(), id]))
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(neu))
  } catch {
    // Speicher voll oder gesperrt: Die Freischaltung gilt dann bis zum
    // Neuladen. Ein Spiel hängt nicht daran.
  }
  return VIDEO_AVATARS.map((a) => a.id).filter((x) => neu.includes(x))
}

/** Das nächste noch gesperrte Gesicht -- oder null, wenn alle frei sind. */
export function naechstesGesperrtes(frei: readonly string[]): VideoAvatarId | null {
  return VIDEO_AVATARS.find((a) => !frei.includes(a.id))?.id ?? null
}
