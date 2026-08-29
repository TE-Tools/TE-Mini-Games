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

export type AvatarId = (typeof AVATARS)[number]['id']

export const DEFAULT_AVATAR_ID: AvatarId = 'face-1'

export function getAvatar(id: string | null | undefined) {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}
