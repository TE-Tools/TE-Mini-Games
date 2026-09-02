import type { ImposterModeId } from './types'

export interface ModeDef {
  id: ImposterModeId
  label: string
  description: string
  /** Implemented in MVP? */
  available: boolean
}

export const MODES: ModeDef[] = [
  {
    id: 'classic',
    label: 'Klassisch',
    description: 'Ein geheimes Wort. Imposter sehen es nicht und müssen bluffen.',
    available: true,
  },
  {
    id: 'double',
    label: 'Doppel-Imposter',
    description: 'Zwei Imposter (ab 6 Spielern empfohlen). Sie kennen sich nicht.',
    available: true,
  },
  {
    id: 'blank',
    label: 'Leer',
    description: 'Imposter sieht gar nichts – härter zu bluffen.',
    available: false,
  },
  {
    id: 'duel',
    label: 'Duell',
    description: 'Zwei Teams, je ein Imposter – später.',
    available: false,
  },
  {
    id: 'categories_only',
    label: 'Nur Kategorie',
    description: 'Alle sehen nur die Kategorie, nicht das Wort.',
    available: false,
  },
  {
    id: 'speed',
    label: 'Tempo',
    description: 'Kurze Timer, schnelle Hinweise.',
    available: false,
  },
  {
    id: 'chaos',
    label: 'Chaos',
    description: 'Zufällige Sonderregeln – später.',
    available: false,
  },
]

export function modeOf(id: ImposterModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0]!
}

/** Default imposter count by player count (classic). */
export function defaultImposterCount(playerCount: number, mode: ImposterModeId = 'classic'): number {
  if (mode === 'double') {
    if (playerCount < 6) return 1
    if (playerCount <= 9) return 2
    return 2
  }
  if (playerCount <= 8) return 1
  return 2
}
