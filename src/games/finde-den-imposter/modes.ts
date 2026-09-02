import type { ImposterModeId, ImposterSees } from './types'

export interface ModeDef {
  id: ImposterModeId
  label: string
  description: string
  /** Steht der Modus im Menü zur Wahl? */
  available: boolean
  /** Nur am einen Gerät spielbar (Duell braucht zwei getrennte Anklagen). */
  localOnly?: boolean
  /** Mindestzahl an Mitspielenden für diesen Modus. */
  minPlayers: number
}

export const MODES: ModeDef[] = [
  {
    id: 'classic',
    label: 'Klassisch',
    description: 'Ein geheimes Wort. Der Imposter kennt es nicht und sieht nur ein Hilfswort.',
    available: true,
    minPlayers: 3,
  },
  {
    id: 'double',
    label: 'Doppel-Imposter',
    description: 'Zwei Imposter (ab 6 Mitspielenden). Sie wissen nicht voneinander.',
    available: true,
    minPlayers: 6,
  },
  {
    id: 'blank',
    label: 'Leer',
    description:
      'Der Imposter sieht gar nichts – kein Hilfswort, keine Kategorie. Die Kategorie bleibt deshalb für alle verborgen. Der härteste Modus.',
    available: true,
    minPlayers: 3,
  },
  {
    id: 'categories_only',
    label: 'Nur Kategorie',
    description:
      'Der Imposter sieht nur, worum es geht („Tiere“), aber kein Hilfswort. Zwischen Klassisch und Leer.',
    available: true,
    minPlayers: 3,
  },
  {
    id: 'speed',
    label: 'Tempo',
    description: 'Wie Klassisch, aber die Uhr läuft: nach 90 Sekunden wird getippt.',
    available: true,
    minPlayers: 3,
  },
  {
    id: 'chaos',
    label: 'Chaos',
    description:
      'Jede Runde eine andere Sonderregel – sie wird allen angesagt, aber erst wenn ausgeteilt ist.',
    available: true,
    minPlayers: 3,
  },
  {
    id: 'duel',
    label: 'Duell',
    description:
      'Zwei Teams, in jedem genau ein Imposter. Jedes Team tippt auf einen aus den eigenen Reihen.',
    available: true,
    localOnly: true,
    minPlayers: 6,
  },
]

/** Der Satz zu einer Chaos-Regel -- auch für die Kennungen, die online kommen. */
export function chaosRuleLabel(id: string | null): string | null {
  if (!id) return null
  return CHAOS_RULES.find((r) => r.id === id)?.label ?? id
}

export function modeOf(id: ImposterModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0]!
}

/** Modi, die auch online funktionieren. */
export const ONLINE_MODES = MODES.filter((m) => m.available && !m.localOnly)

export interface ModeRules {
  imposterSees: ImposterSees
  showCategory: boolean
  timerSeconds: number | null
  /** Feste Imposter-Zahl des Modus, sonst null (dann entscheidet die Gruppengröße). */
  fixedImposters: number | null
  teams: boolean
}

const TEMPO_SEKUNDEN = 90

export function rulesOf(mode: ImposterModeId): ModeRules {
  switch (mode) {
    case 'blank':
      return {
        imposterSees: 'nothing',
        showCategory: false,
        timerSeconds: null,
        fixedImposters: null,
        teams: false,
      }
    case 'categories_only':
      return {
        imposterSees: 'category',
        showCategory: true,
        timerSeconds: null,
        fixedImposters: null,
        teams: false,
      }
    case 'speed':
      return {
        imposterSees: 'helper',
        showCategory: true,
        timerSeconds: TEMPO_SEKUNDEN,
        fixedImposters: null,
        teams: false,
      }
    case 'duel':
      return {
        imposterSees: 'helper',
        showCategory: true,
        timerSeconds: null,
        fixedImposters: 2,
        teams: true,
      }
    case 'double':
      return {
        imposterSees: 'helper',
        showCategory: true,
        timerSeconds: null,
        fixedImposters: 2,
        teams: false,
      }
    // 'classic' und 'chaos' -- Chaos zieht seine Regel pro Runde selbst.
    default:
      return {
        imposterSees: 'helper',
        showCategory: true,
        timerSeconds: null,
        fixedImposters: null,
        teams: false,
      }
  }
}

export interface ChaosRule {
  id: string
  label: string
  rules: ModeRules
  /** Ab wie vielen Mitspielenden die Regel gezogen werden darf. */
  minPlayers: number
}

/**
 * Die Sonderregeln des Chaos-Modus. Sie werden angesagt: Wer nicht weiß,
 * wonach er sucht, rät bloß herum -- der Reiz liegt darin, dass die Regel
 * jede Runde wechselt, nicht darin, dass sie geheim ist.
 */
export const CHAOS_RULES: ChaosRule[] = [
  {
    id: 'normal',
    label: 'Ganz normal – der Imposter bekommt ein Hilfswort.',
    rules: rulesOf('classic'),
    minPlayers: 3,
  },
  {
    id: 'blind',
    label: 'Blindflug – der Imposter sieht gar nichts, auch die Kategorie bleibt geheim.',
    rules: rulesOf('blank'),
    minPlayers: 3,
  },
  {
    id: 'kategorie',
    label: 'Nur Kategorie – der Imposter weiß, worum es geht, mehr nicht.',
    rules: rulesOf('categories_only'),
    minPlayers: 3,
  },
  {
    id: 'doppelt',
    label: 'Doppelt – zwei Imposter sind unterwegs.',
    rules: rulesOf('double'),
    minPlayers: 6,
  },
  {
    id: 'uhr',
    label: `Die Uhr läuft – nach ${TEMPO_SEKUNDEN} Sekunden wird getippt.`,
    rules: rulesOf('speed'),
    minPlayers: 3,
  },
]

/**
 * Wie viele Imposter standardmäßig, je nach Gruppengröße und Modus. Modi mit
 * fester Zahl (Doppel, Duell) fallen unterhalb ihrer Mindestgröße auf einen
 * zurück -- zwei Imposter unter fünf Leuten wäre kein Spiel mehr.
 */
export function defaultImposterCount(playerCount: number, mode: ImposterModeId = 'classic'): number {
  const fest = rulesOf(mode).fixedImposters
  if (fest !== null) return playerCount < modeOf(mode).minPlayers ? 1 : fest
  if (playerCount <= 8) return 1
  return 2
}
