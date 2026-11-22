/**
 * Werbung -- nur als freiwilliges Video gegen eine Belohnung.
 *
 * Entscheidung (07.11.2026, Thomas): Die App startet mit Werbung. Wie:
 *
 *  - **Nur Belohnungsvideos.** Keine Banner, keine Werbung zwischen den
 *    Runden. Ein Spiel bietet an („Video ansehen: +1 Tipp“), der Spieler
 *    entscheidet. Wer nicht will, merkt von Werbung nichts.
 *  - **Werbung kauft Hilfe, nie Punkte.** Eine Belohnung hilft weiter
 *    (Tipp, Zeit, zweiter Versuch), erhöht aber weder Punkte noch XP, und
 *    eine so geschaffte Runde schreibt keinen Rekord. Sonst wäre die
 *    Rangliste käuflich -- mit Zeit statt Geld, aber käuflich.
 *  - **Offline-first bleibt.** Ohne Netz, ohne Konfiguration oder wenn
 *    gerade kein Video da ist, gibt es kein Angebot -- der Knopf fehlt
 *    einfach. Kein Spiel hängt davon ab.
 *  - **Google wird erst gefragt, wenn ein Spiel eine Belohnung anbietet.**
 *    Das Skript lädt nicht beim Start der App, sondern beim ersten Angebot.
 *    Die Einwilligung (EU) holt Googles eigenes Einwilligungsfenster ein,
 *    das in AdSense unter „Datenschutz und Mitteilungen“ eingerichtet wird.
 *
 * Technik: Googles „H5 Games Ads“ (Ad Placement API, `adBreak` mit
 * `type: 'reward'`). `beforeReward` kommt nur, wenn ein Video bereitsteht --
 * erst dann gibt es ein Angebot. `adViewed` heißt: zu Ende geschaut, die
 * Belohnung gilt. `adDismissed` heißt: abgebrochen, keine Belohnung.
 *
 * Eingeschaltet wird über die Umgebung beim Bauen (Cloudflare Pages →
 * Einstellungen → Variablen):
 *   VITE_ADSENSE_CLIENT=ca-pub-…   die Publisher-Kennung aus AdSense
 *   VITE_WERBUNG_TEST=on           Testvideos von Google (vor der Freigabe)
 * Ohne VITE_ADSENSE_CLIENT ist alles aus, wie bisher.
 *
 * **In der Android-App** gilt stattdessen AdMob (services/werbungAdmob.ts,
 * seit 07.11.2026). Diese Datei ist die eine Tür für die Spiele und wählt
 * den Weg: in der App AdMob, im Browser AdSense.
 */
import { pausiereTon } from './sound'
import { admobAktiv, admobAnfragen, admobEinwilligungAendern, inDerApp } from './werbungAdmob'

const SKRIPT_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

/** So lange wird auf ein Video gewartet, bevor es kein Angebot gibt. */
const WARTEZEIT_MS = 5000

interface Konfiguration {
  client: string | null
  test: boolean
}

function ausUmgebung(): Konfiguration {
  const client = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() ?? ''
  return {
    client: /^ca-pub-\d{10,20}$/.test(client) ? client : null,
    test: import.meta.env.VITE_WERBUNG_TEST === 'on',
  }
}

let konfiguration = ausUmgebung()

/** Nur für Tests: Konfiguration setzen und das Laden zurücksetzen. */
export function setzeWerbungFuerTests(neu: Partial<Konfiguration> | null): void {
  konfiguration = neu ? { client: null, test: false, ...neu } : ausUmgebung()
  geladen = false
}

/** Ist Werbung für diese App eingeschaltet? Steuert auch die Rechtstexte. */
export function werbungAktiv(): boolean {
  return werbeAnbieter() !== null
}

/** Wer gerade die Videos liefert -- steuert die Rechtstexte. */
export function werbeAnbieter(): 'admob' | 'adsense' | null {
  if (inDerApp()) return admobAktiv() ? 'admob' : null
  return konfiguration.client !== null ? 'adsense' : null
}

/* ------------------------------------------------------------- Google */

type PlacementInfo = { breakStatus?: string }

interface AdBreakOptionen {
  type: 'reward'
  name: string
  beforeAd?: () => void
  afterAd?: () => void
  beforeReward: (showAdFn: () => void) => void
  adDismissed: () => void
  adViewed: () => void
  adBreakDone?: (info: PlacementInfo) => void
}

type AdsQueue = { push: (eintrag: unknown) => void }

declare global {
  interface Window {
    adsbygoogle?: AdsQueue | unknown[]
  }
}

let geladen = false

function warteschlange(): AdsQueue {
  window.adsbygoogle = window.adsbygoogle ?? []
  return window.adsbygoogle as AdsQueue
}

function ladeSkript(client: string, test: boolean): void {
  if (geladen) return
  geladen = true
  const skript = document.createElement('script')
  skript.async = true
  skript.src = `${SKRIPT_URL}?client=${encodeURIComponent(client)}`
  skript.crossOrigin = 'anonymous'
  // Mindestens 30 s zwischen zwei Videos -- schützt vor Dauerwerbung.
  skript.dataset.adFrequencyHint = '30s'
  if (test) skript.dataset.adbreakTest = 'on'
  document.head.appendChild(skript)
  warteschlange().push({ preloadAdBreaks: 'on', sound: 'on' })
}

/**
 * Die Einwilligung nachträglich ändern. Google verlangt, dass das jederzeit
 * geht; der Knopf dafür steht in der Datenschutzerklärung. Öffnet Googles
 * Einwilligungsfenster (Funding Choices), lädt das Skript dafür nötigenfalls.
 */
export function einwilligungAendern(): void {
  if (inDerApp()) {
    void admobEinwilligungAendern()
    return
  }
  const { client, test } = konfiguration
  if (!client || typeof window === 'undefined') return
  ladeSkript(client, test)
  const w = window as unknown as {
    googlefc?: { callbackQueue?: unknown[]; showRevocationMessage?: () => void }
  }
  w.googlefc = w.googlefc ?? {}
  w.googlefc.callbackQueue = w.googlefc.callbackQueue ?? []
  w.googlefc.callbackQueue.push(() => w.googlefc?.showRevocationMessage?.())
}

/* ------------------------------------------------------------ Angebot */

/** Ein Video steht bereit. `zeigen()` liefert, ob es zu Ende geschaut wurde. */
export interface Angebot {
  zeigen: () => Promise<boolean>
}

/**
 * Fragt nach einem Belohnungsvideo. Liefert ein Angebot, wenn eines
 * bereitsteht, sonst null -- offline, ohne Konfiguration, ohne Video, nach
 * der Wartezeit. Wirft nie.
 *
 * `name` benennt die Stelle in AdSense-Berichten, z.B. 'sudoku-tipp'.
 */
export function belohnungAnfragen(name: string): Promise<Angebot | null> {
  if (inDerApp()) return admobAnfragen(pausiereTon)
  const { client, test } = konfiguration
  if (!client) return Promise.resolve(null)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null)
  if (typeof document === 'undefined') return Promise.resolve(null)

  return new Promise((resolve) => {
    let entschieden = false
    const entscheide = (wert: Angebot | null) => {
      if (entschieden) return
      entschieden = true
      resolve(wert)
    }
    let ergebnis: (geschaut: boolean) => void = () => {}

    try {
      ladeSkript(client, test)
      const optionen: AdBreakOptionen = {
        type: 'reward',
        name,
        beforeAd: () => pausiereTon(true),
        afterAd: () => pausiereTon(false),
        beforeReward: (showAdFn) =>
          entscheide({
            zeigen: () =>
              new Promise<boolean>((fertig) => {
                ergebnis = fertig
                showAdFn()
              }),
          }),
        adDismissed: () => ergebnis(false),
        adViewed: () => ergebnis(true),
        adBreakDone: () => {
          pausiereTon(false)
          entscheide(null)
          // Kam weder „geschaut“ noch „abgebrochen“, gilt es als abgebrochen.
          ergebnis(false)
        },
      }
      warteschlange().push(optionen)
    } catch {
      entscheide(null)
    }
    window.setTimeout(() => entscheide(null), WARTEZEIT_MS)
  })
}
