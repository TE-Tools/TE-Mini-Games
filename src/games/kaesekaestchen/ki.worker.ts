/**
 * Der Computergegner im eigenen Faden -- wie bei Schach.
 *
 * Meist ist er nach Millisekunden fertig. Rechnet die schwere Stufe die
 * letzten sicheren Züge durch, kann es auf einem alten Handy einen
 * Augenblick dauern; hier steht derweil die Seite nicht still.
 */
import { waehleLinie, type KiAuftrag } from './ki'

interface Anfrage extends KiAuftrag {
  id: number
}

const faden = self as unknown as {
  onmessage: ((e: MessageEvent<Anfrage>) => void) | null
  postMessage: (nachricht: { id: number; linie: number | null }) => void
}

faden.onmessage = (e) => {
  const { id, ...auftrag } = e.data
  faden.postMessage({ id, linie: waehleLinie(auftrag) })
}
