/**
 * Belohnungsvideos in der Android-App: Google AdMob.
 *
 * Entscheidung (07.11.2026, Thomas): Die Play-Store-App ist eine
 * Capacitor-App statt einer Trusted Web Activity, damit AdMob geht -- ohne
 * eigene Domain. Im Browser bleibt es bei AdSense (services/werbung.ts).
 * Die Spiele merken davon nichts: Sie fragen `belohnungAnfragen` und
 * bekommen ein Angebot oder keins.
 *
 * Eingeschaltet über die Umgebung beim Bauen der Seite (Cloudflare) --
 * die App lädt die Seite, also gilt dort dieselbe Variable:
 *   VITE_ADMOB_BELOHNUNG=ca-app-pub-…/…   die Anzeigenblock-ID (Belohnung)
 *   VITE_WERBUNG_TEST=on                  Googles Testvideos, auch ohne ID
 *
 * Die Einwilligung (EU) holt Googles UMP-Fenster ein, bevor das erste Video
 * geladen wird. Ohne Einwilligung, wo sie nötig ist, gibt es kein Angebot.
 */
import { Capacitor } from '@capacitor/core'
import type { Angebot } from './werbung'

/** Googles öffentlicher Test-Anzeigenblock für Belohnungsvideos. */
const TEST_BELOHNUNG = 'ca-app-pub-3940256099942544/5224354917'

const WARTEZEIT_MS = 8000

interface AdmobKonfiguration {
  block: string | null
  test: boolean
}

function ausUmgebung(): AdmobKonfiguration {
  const block = (import.meta.env.VITE_ADMOB_BELOHNUNG as string | undefined)?.trim() ?? ''
  return {
    block: /^ca-app-pub-\d{10,20}\/\d{5,15}$/.test(block) ? block : null,
    test: import.meta.env.VITE_WERBUNG_TEST === 'on',
  }
}

let konfiguration = ausUmgebung()
let bereit: Promise<boolean> | null = null

/** Nur für Tests. */
export function setzeAdmobFuerTests(neu: Partial<AdmobKonfiguration> | null): void {
  konfiguration = neu ? { block: null, test: false, ...neu } : ausUmgebung()
  bereit = null
}

/** Läuft die Seite gerade in der Android-App? */
export function inDerApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** Ist AdMob in der App eingeschaltet? */
export function admobAktiv(): boolean {
  return inDerApp() && (konfiguration.block !== null || konfiguration.test)
}

function anzeigenblock(): string {
  return konfiguration.test ? TEST_BELOHNUNG : (konfiguration.block ?? TEST_BELOHNUNG)
}

async function plugin() {
  return (await import('@capacitor-community/admob')).AdMob
}

/** Einmal je Start: AdMob hochfahren und die Einwilligung klären. */
function vorbereiten(): Promise<boolean> {
  bereit ??= (async () => {
    try {
      const admob = await plugin()
      await admob.initialize({ initializeForTesting: konfiguration.test })
      let info = await admob.requestConsentInfo()
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
        info = await admob.showConsentForm()
      }
      return info.canRequestAds
    } catch {
      // Beim nächsten Angebot neu versuchen -- etwa wenn das Netz zurück ist.
      bereit = null
      return false
    }
  })()
  return bereit
}

function mitFrist<T>(versprechen: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    versprechen,
    new Promise<null>((fertig) => window.setTimeout(() => fertig(null), ms)),
  ])
}

/**
 * Lädt ein Belohnungsvideo vor. Liefert ein Angebot, wenn eines bereitsteht,
 * sonst null. Wirft nie.
 */
export async function admobAnfragen(pausiere: (stumm: boolean) => void): Promise<Angebot | null> {
  if (!admobAktiv()) return null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  try {
    if (!(await mitFrist(vorbereiten(), WARTEZEIT_MS))) return null
    const admob = await plugin()
    const geladen = await mitFrist(
      admob.prepareRewardVideoAd({ adId: anzeigenblock(), isTesting: konfiguration.test }),
      WARTEZEIT_MS,
    )
    if (!geladen) return null
    return {
      zeigen: () => zeigen(pausiere),
    }
  } catch {
    return null
  }
}

async function zeigen(pausiere: (stumm: boolean) => void): Promise<boolean> {
  const { RewardAdPluginEvents } = await import('@capacitor-community/admob')
  const admob = await plugin()
  let belohnt = false
  pausiere(true)
  return new Promise<boolean>((fertig) => {
    const griffe: Promise<{ remove: () => Promise<void> }>[] = []
    const ende = (wert: boolean) => {
      pausiere(false)
      for (const g of griffe) void g.then((h) => h.remove())
      fertig(wert)
    }
    griffe.push(
      admob.addListener(RewardAdPluginEvents.Rewarded, () => {
        belohnt = true
      }),
      admob.addListener(RewardAdPluginEvents.Dismissed, () => ende(belohnt)),
      admob.addListener(RewardAdPluginEvents.FailedToShow, () => ende(false)),
    )
    admob.showRewardVideoAd().catch(() => ende(false))
  })
}

/** Googles Fenster, um die Einwilligung zu ändern. */
export async function admobEinwilligungAendern(): Promise<void> {
  if (!inDerApp()) return
  try {
    const admob = await plugin()
    await admob.showPrivacyOptionsForm()
  } catch {
    /* Ohne Netz oder ohne nötige Einwilligung gibt es kein Fenster. */
  }
}
