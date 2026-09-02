import { registerGame } from './registry'
import { perfectSecondGame } from './perfect-second'
import { whatIsMissingGame } from './what-is-missing'
import { schuetzenrundeGame } from './schuetzenrunde'
import { findeDenImposterGame } from './finde-den-imposter'

/** Register all built-in games. Call once at app startup. */
export function registerAllGames(): void {
  registerGame(perfectSecondGame)
  registerGame(whatIsMissingGame)
  registerGame(schuetzenrundeGame)
  registerGame(findeDenImposterGame)
}
