/** Selectable face avatars for the level map (max 15). */
export const AVATARS = [
  { id: 'face-1', emoji: '😀', label: 'Lachen' },
  { id: 'face-2', emoji: '😎', label: 'Cool' },
  { id: 'face-3', emoji: '🤓', label: 'Nerd' },
  { id: 'face-4', emoji: '🦊', label: 'Fuchs' },
  { id: 'face-5', emoji: '🐼', label: 'Panda' },
  { id: 'face-6', emoji: '🦁', label: 'Löwe' },
  { id: 'face-7', emoji: '🦄', label: 'Einhorn' },
  { id: 'face-8', emoji: '🐸', label: 'Frosch' },
  { id: 'face-9', emoji: '🐯', label: 'Tiger' },
  { id: 'face-10', emoji: '🐰', label: 'Hase' },
  { id: 'face-11', emoji: '🐶', label: 'Hund' },
  { id: 'face-12', emoji: '🐱', label: 'Katze' },
  { id: 'face-13', emoji: '🐵', label: 'Affe' },
  { id: 'face-14', emoji: '🌟', label: 'Stern' },
  { id: 'face-15', emoji: '🚀', label: 'Rakete' },
] as const

/**
 * Gesichter, die es nur per Belohnungsvideo gibt -- eines je Video
 * (siehe src/profile/videoGesichter.ts). Reine Optik, kein Vorteil im Spiel.
 * Einmal freigeschaltet, sind sie ganz normale Gesichter.
 */
export const VIDEO_AVATARS = [
  { id: 'video-1', emoji: '🐲', label: 'Drache' },
  { id: 'video-2', emoji: '🦉', label: 'Eule' },
  { id: 'video-3', emoji: '🐙', label: 'Krake' },
  { id: 'video-4', emoji: '🤖', label: 'Roboter' },
  { id: 'video-5', emoji: '👽', label: 'Außerirdischer' },
  { id: 'video-6', emoji: '🦖', label: 'Dino' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']
export type VideoAvatarId = (typeof VIDEO_AVATARS)[number]['id']

export const DEFAULT_AVATAR_ID: AvatarId = 'face-1'

export function istVideoAvatar(id: string | null | undefined): id is VideoAvatarId {
  return VIDEO_AVATARS.some((a) => a.id === id)
}

/**
 * Das Gesicht zur Kennung. Kennt auch die Video-Gesichter: Ein freigeschaltetes
 * kann über das Profil auf ein anderes Gerät kommen und soll dort genauso
 * erscheinen.
 */
export function getAvatar(id: string | null | undefined) {
  return AVATARS.find((a) => a.id === id) ?? VIDEO_AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}
