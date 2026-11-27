/**
 * Der Computergegner im eigenen Faden -- wie bei Dame. Die schwere
 * Stufe rechnet knapp eine Sekunde; im Faden der Seite stünde so lange alles
 * still, und auf dem Handy sähe das nach einem Absturz aus.
 */
import { waehleZug, type KiAuftrag } from './ki'

interface Anfrage extends KiAuftrag {
  id: number
}

const faden = self as unknown as {
  onmessage: ((e: MessageEvent<Anfrage>) => void) | null
  postMessage: (nachricht: { id: number; zug: string | null }) => void
}

faden.onmessage = (e) => {
  const { id, ...auftrag } = e.data
  faden.postMessage({ id, zug: waehleZug(auftrag) })
}
