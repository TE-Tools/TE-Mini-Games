/**
 * Darf dieses Gerät 3D zeichnen?
 *
 * Die 3D-Effekte (Startseite, Kniffelwürfel) sind Schmuck, kein Spiel.
 * Auf einem schwachen Handy sollen sie deshalb gar nicht erst laden: kein
 * Three.js, kein WebGL-Kontext, kein Akku. Dann bleibt die flache
 * Darstellung stehen, und die sieht ebenfalls fertig aus.
 *
 * Wer es anders will, schaltet es selbst um -- die Wahl gilt für das Gerät,
 * nicht für das Konto, weil es um die Hardware geht.
 */

export type EffektWahl = 'auto' | 'an' | 'aus'

const SCHLUESSEL = 'te-effekte-3d'
export const EFFEKTE_GEAENDERT = 'te-effekte-3d-geaendert'

export function effektWahl(): EffektWahl {
  try {
    const wert = localStorage.getItem(SCHLUESSEL)
    return wert === 'an' || wert === 'aus' ? wert : 'auto'
  } catch {
    return 'auto'
  }
}

export function setzeEffektWahl(wahl: EffektWahl): void {
  try {
    if (wahl === 'auto') localStorage.removeItem(SCHLUESSEL)
    else localStorage.setItem(SCHLUESSEL, wahl)
  } catch {
    // Privates Fenster o. Ä. -- dann gilt die Wahl nur bis zum Neuladen nicht.
  }
  window.dispatchEvent(new Event(EFFEKTE_GEAENDERT))
}

let webglErgebnis: boolean | null = null

/** Einmal nachsehen, ob WebGL überhaupt geht. Der Testkontext wird gleich wieder freigegeben. */
export function webglMoeglich(): boolean {
  if (webglErgebnis !== null) return webglErgebnis
  try {
    const leinwand = document.createElement('canvas')
    const gl = leinwand.getContext('webgl2') ?? leinwand.getContext('webgl')
    webglErgebnis = gl !== null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    webglErgebnis = false
  }
  return webglErgebnis
}

export function bewegungReduziert(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * Sieht das Gerät nach genug Leistung aus? Grob, aber ohne Messung: Kerne,
 * Speicher und der Datensparmodus. Ein Gerät, das nichts verrät, gilt als
 * stark genug -- iPhones geben weder Speicher noch Sparmodus an.
 */
export function geraetStarkGenug(): boolean {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  if (nav.connection?.saveData) return false
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 3) return false
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency < 4) return false
  return true
}

/** Die eine Frage, die die Oberfläche stellt. */
export function effekte3dAn(): boolean {
  if (typeof window === 'undefined') return false
  const wahl = effektWahl()
  if (wahl === 'aus') return false
  if (!webglMoeglich()) return false
  if (wahl === 'an') return true
  return !bewegungReduziert() && geraetStarkGenug()
}
