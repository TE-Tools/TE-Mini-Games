/**
 * Laufende Partie speichern und fortsetzen.
 *
 * Der Zustand ist ein einfaches Objekt, also reicht JSON. Gespeichert wird
 * nach jedem abgeschlossenen Zug -- wer das Handy weglegt, findet die
 * Partie wieder vor. Ein Spielstand aus einer älteren Version wird
 * verworfen statt geraten: halb passende Regeln sind schlimmer als ein
 * neues Spiel.
 */

import { db } from '@/offline/db'
import { ZUSTAND_VERSION, type SpielZustand } from './zustand'

const SPIELSTAND_ID = 'schuetzenopoly'

export interface Spielstand {
  id: string
  gameId: string
  zustand: string
  updatedAt: string
}

export async function speicherePartie(zustand: SpielZustand): Promise<void> {
  try {
    await db.boardSaves.put({
      id: SPIELSTAND_ID,
      gameId: 'schuetzenopoly',
      zustand: JSON.stringify(zustand),
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    // Ein fehlgeschlagener Speicherversuch darf die laufende Partie nicht
    // abbrechen -- gespielt wird weiter, nur eben ohne Netz und doppelten Boden.
    console.warn('[schuetzenopoly] Spielstand konnte nicht gespeichert werden', err)
  }
}

export async function ladePartie(): Promise<SpielZustand | null> {
  try {
    const eintrag = await db.boardSaves.get(SPIELSTAND_ID)
    if (!eintrag) return null
    const zustand = JSON.parse(eintrag.zustand) as SpielZustand
    if (zustand.version !== ZUSTAND_VERSION) {
      await loeschePartie()
      return null
    }
    if (zustand.phase === 'ende') return null
    return zustand
  } catch (err) {
    console.warn('[schuetzenopoly] Spielstand nicht lesbar', err)
    return null
  }
}

export async function loeschePartie(): Promise<void> {
  try {
    await db.boardSaves.delete(SPIELSTAND_ID)
  } catch (err) {
    console.warn('[schuetzenopoly] Spielstand konnte nicht gelöscht werden', err)
  }
}
