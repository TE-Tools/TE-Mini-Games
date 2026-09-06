/**
 * Kurze Tonsignale, im Browser erzeugt.
 *
 * Bewusst keine Audiodateien: Musik und Geräusche müssten lizenziert,
 * geladen und offline vorgehalten werden. Ein paar synthetisierte Töne
 * kosten nichts, funktionieren ohne Netz und lassen sich nicht falsch
 * lizenzieren. Sollte es später echte Festzeltmusik geben, wird hier eine
 * zweite Quelle eingehängt -- der Rest der App ruft weiter nur `spiele()`.
 *
 * Der AudioContext wird erst beim ersten Ton erzeugt. Browser erlauben Ton
 * ohnehin erst nach einer Berührung, und ein Kontext, der beim Laden
 * angelegt wird, bleibt auf manchen Geräten für immer stumm.
 */

export type Klang =
  | 'wuerfel'
  | 'muenze'
  | 'kauf'
  | 'bau'
  | 'karte'
  | 'erfolg'
  | 'niederlage'
  | 'treffer'
  | 'fehlschuss'
  | 'tick'

interface Ton {
  frequenz: number
  dauer: number
  typ: OscillatorType
  lautstaerke: number
  /** Zielfrequenz für ein Gleiten -- ohne Angabe bleibt der Ton stehen. */
  nach?: number
  /** Verzögerung ab Start der Folge, in Sekunden. */
  ab?: number
}

const KLAENGE: Record<Klang, Ton[]> = {
  wuerfel: [
    { frequenz: 180, dauer: 0.05, typ: 'square', lautstaerke: 0.18 },
    { frequenz: 240, dauer: 0.05, typ: 'square', lautstaerke: 0.15, ab: 0.07 },
    { frequenz: 160, dauer: 0.07, typ: 'square', lautstaerke: 0.12, ab: 0.15 },
  ],
  muenze: [
    { frequenz: 1200, dauer: 0.08, typ: 'triangle', lautstaerke: 0.16 },
    { frequenz: 1800, dauer: 0.12, typ: 'triangle', lautstaerke: 0.13, ab: 0.06 },
  ],
  kauf: [
    { frequenz: 520, dauer: 0.1, typ: 'sine', lautstaerke: 0.18 },
    { frequenz: 780, dauer: 0.16, typ: 'sine', lautstaerke: 0.16, ab: 0.09 },
  ],
  bau: [
    { frequenz: 300, dauer: 0.09, typ: 'sawtooth', lautstaerke: 0.14 },
    { frequenz: 420, dauer: 0.14, typ: 'sawtooth', lautstaerke: 0.12, ab: 0.08 },
  ],
  karte: [{ frequenz: 700, dauer: 0.12, typ: 'triangle', lautstaerke: 0.14, nach: 480 }],
  erfolg: [
    { frequenz: 523, dauer: 0.12, typ: 'sine', lautstaerke: 0.18 },
    { frequenz: 659, dauer: 0.12, typ: 'sine', lautstaerke: 0.18, ab: 0.11 },
    { frequenz: 784, dauer: 0.26, typ: 'sine', lautstaerke: 0.2, ab: 0.22 },
  ],
  niederlage: [
    { frequenz: 400, dauer: 0.16, typ: 'sine', lautstaerke: 0.16 },
    { frequenz: 260, dauer: 0.32, typ: 'sine', lautstaerke: 0.16, ab: 0.14, nach: 180 },
  ],
  treffer: [{ frequenz: 900, dauer: 0.09, typ: 'square', lautstaerke: 0.14, nach: 1300 }],
  fehlschuss: [{ frequenz: 220, dauer: 0.14, typ: 'sawtooth', lautstaerke: 0.12, nach: 130 }],
  tick: [{ frequenz: 1000, dauer: 0.03, typ: 'square', lautstaerke: 0.08 }],
}

const SPEICHER_SCHLUESSEL = 'te-mini-games:ton'

let kontext: AudioContext | null = null
let an = leseEinstellung()

function leseEinstellung(): boolean {
  try {
    return window.localStorage.getItem(SPEICHER_SCHLUESSEL) !== 'aus'
  } catch {
    return true
  }
}

export function tonAn(): boolean {
  return an
}

export function setzeTon(wert: boolean): void {
  an = wert
  try {
    window.localStorage.setItem(SPEICHER_SCHLUESSEL, wert ? 'an' : 'aus')
  } catch {
    // Kein Speicher (privater Modus) -- die Einstellung gilt dann nur für diese Sitzung.
  }
}

function holeKontext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (kontext) return kontext
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    kontext = new Ctor()
    return kontext
  } catch {
    return null
  }
}

/** Einen Klang abspielen. Fehler bleiben stumm -- Ton ist Beiwerk. */
export function spiele(klang: Klang): void {
  if (!an) return
  const ctx = holeKontext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') void ctx.resume()
    const start = ctx.currentTime
    for (const ton of KLAENGE[klang]) {
      const beginn = start + (ton.ab ?? 0)
      const osz = ctx.createOscillator()
      const verstaerker = ctx.createGain()
      osz.type = ton.typ
      osz.frequency.setValueAtTime(ton.frequenz, beginn)
      if (ton.nach !== undefined) {
        osz.frequency.exponentialRampToValueAtTime(Math.max(20, ton.nach), beginn + ton.dauer)
      }
      // Weich ein- und ausblenden, sonst knackt es auf kleinen Lautsprechern.
      verstaerker.gain.setValueAtTime(0.0001, beginn)
      verstaerker.gain.exponentialRampToValueAtTime(ton.lautstaerke, beginn + 0.012)
      verstaerker.gain.exponentialRampToValueAtTime(0.0001, beginn + ton.dauer)
      osz.connect(verstaerker).connect(ctx.destination)
      osz.start(beginn)
      osz.stop(beginn + ton.dauer + 0.02)
    }
  } catch {
    // Manche Browser verweigern Ton ohne Berührung. Kein Grund für einen Fehler.
  }
}

/** Kurzes Rütteln, wo das Gerät es kann. */
export function vibriere(muster: number | number[]): void {
  if (!an) return
  try {
    navigator.vibrate?.(muster)
  } catch {
    // Nicht unterstützt -- ignorieren.
  }
}
