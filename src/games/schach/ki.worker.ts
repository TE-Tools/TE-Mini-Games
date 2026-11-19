/**
 * Der Computergegner im eigenen Faden.
 *
 * Die schwere Stufe rechnet gut eine Sekunde. Im Faden der Seite stünde
 * so lange alles still -- kein Antippen, keine Animation, und auf dem
 * Handy sieht das nach einem Absturz aus. Hier rechnet er nebenher.
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
