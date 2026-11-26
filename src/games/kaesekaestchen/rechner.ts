/**
 * Den Computer fragen -- im eigenen Faden, wo es den gibt (wie bei Schach).
 *
 * Ohne Worker (in Tests, in sehr alten Browsern) rechnet er im Faden der
 * Seite, aber erst nach einem Takt: So kommt die eigene Linie noch aufs
 * Blatt, bevor es kurz stillsteht.
 */
import { waehleLinie, type KiAuftrag } from './ki'

export interface Rechner {
  frage(auftrag: KiAuftrag): Promise<number | null>
  /** Beendet den Faden. Eine offene Frage wird nicht mehr beantwortet. */
  beende(): void
}

export function erstelleRechner(): Rechner {
  let faden: Worker | null = null
  let naechste = 1
  const offen = new Map<number, (linie: number | null) => void>()

  function holeFaden(): Worker | null {
    if (faden) return faden
    if (typeof Worker === 'undefined') return null
    try {
      faden = new Worker(new URL('./ki.worker.ts', import.meta.url), { type: 'module' })
      faden.onmessage = (e: MessageEvent<{ id: number; linie: number | null }>) => {
        offen.get(e.data.id)?.(e.data.linie)
        offen.delete(e.data.id)
      }
      faden.onerror = () => {
        // Fällt der Faden aus, rechnet die Seite selbst weiter.
        for (const [id, antworte] of offen) {
          offen.delete(id)
          antworte(null)
        }
        faden?.terminate()
        faden = null
      }
      return faden
    } catch {
      return null
    }
  }

  return {
    frage(auftrag) {
      const f = holeFaden()
      if (!f) {
        return new Promise((antworte) => setTimeout(() => antworte(waehleLinie(auftrag)), 20))
      }
      const id = naechste++
      return new Promise((antworte) => {
        offen.set(id, (linie) => antworte(linie ?? waehleLinie(auftrag)))
        f.postMessage({ id, ...auftrag })
      })
    },
    beende() {
      offen.clear()
      faden?.terminate()
      faden = null
    },
  }
}
