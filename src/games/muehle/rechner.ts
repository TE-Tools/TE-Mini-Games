/**
 * Den Computer fragen -- im eigenen Faden, wo es den gibt. Wie bei Dame:
 * Ohne Worker (in Tests, in sehr alten Browsern) rechnet er im Faden der
 * Seite, aber erst nach einem Takt, damit der eigene Zug noch aufs Brett
 * kommt.
 */
import { waehleZug, type KiAuftrag } from './ki'

export interface Rechner {
  frage(auftrag: KiAuftrag): Promise<string | null>
  /** Beendet den Faden. Eine offene Frage wird nicht mehr beantwortet. */
  beende(): void
}

export function erstelleRechner(): Rechner {
  let faden: Worker | null = null
  let naechste = 1
  const offen = new Map<number, (zug: string | null) => void>()

  function holeFaden(): Worker | null {
    if (faden) return faden
    if (typeof Worker === 'undefined') return null
    try {
      faden = new Worker(new URL('./ki.worker.ts', import.meta.url), { type: 'module' })
      faden.onmessage = (e: MessageEvent<{ id: number; zug: string | null }>) => {
        offen.get(e.data.id)?.(e.data.zug)
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
        return new Promise((antworte) => setTimeout(() => antworte(waehleZug(auftrag)), 30))
      }
      const id = naechste++
      return new Promise((antworte) => {
        offen.set(id, (zug) => antworte(zug ?? waehleZug(auftrag)))
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
