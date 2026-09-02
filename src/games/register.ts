import { registerGame } from './registry'
import { perfectSecondGame } from './perfect-second'
import { whatIsMissingGame } from './what-is-missing'
import { schuetzenrundeGame } from './schuetzenrunde'
import { findeDenImposterGame } from './finde-den-imposter'
import { reihenfolgeGame } from './reihenfolge'
import { kopfrechnenGame } from './kopfrechnen'
import { werBinIchGame } from './wer-bin-ich'
import { stadtLandFlussGame } from './stadt-land-fluss'

/** Register all built-in games. Call once at app startup. */
export function registerAllGames(): void {
  registerGame(perfectSecondGame)
  registerGame(whatIsMissingGame)
  registerGame(schuetzenrundeGame)
  registerGame(findeDenImposterGame)
  registerGame(reihenfolgeGame)
  registerGame(kopfrechnenGame)
  registerGame(werBinIchGame)
  registerGame(stadtLandFlussGame)
}
