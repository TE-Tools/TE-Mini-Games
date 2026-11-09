/**
 * Werbung in der Android-App: AdMob statt AdSense, dieselbe Tür für die
 * Spiele. Das Plugin wird nachgestellt -- geprüft wird, was die App daraus
 * macht: Angebot nur mit Einwilligung und geladenem Video, Belohnung nur
 * für ein zu Ende geschautes.
 *
 * Dazu der Rücksprung nach der Google-Anmeldung im externen Browser.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const zustand = vi.hoisted(() => ({
  nativ: true,
  kannWerben: true,
  laden: true,
  hoerer: new Map<string, () => void>(),
  aufrufe: [] as string[],
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => zustand.nativ },
}))

vi.mock('@capacitor-community/admob', () => ({
  RewardAdPluginEvents: {
    Rewarded: 'onRewardedVideoAdReward',
    Dismissed: 'onRewardedVideoAdDismissed',
    FailedToShow: 'onRewardedVideoAdFailedToShow',
  },
  AdMob: {
    initialize: vi.fn(async () => {
      zustand.aufrufe.push('initialize')
    }),
    requestConsentInfo: vi.fn(async () => ({
      status: zustand.kannWerben ? 'OBTAINED' : 'REQUIRED',
      isConsentFormAvailable: true,
      canRequestAds: zustand.kannWerben,
    })),
    showConsentForm: vi.fn(async () => {
      zustand.aufrufe.push('einwilligung')
      return { status: 'REQUIRED', canRequestAds: zustand.kannWerben }
    }),
    prepareRewardVideoAd: vi.fn(async (o: { adId: string }) => {
      zustand.aufrufe.push(`laden:${o.adId}`)
      if (!zustand.laden) throw new Error('kein Video')
      return { adUnitId: o.adId }
    }),
    showRewardVideoAd: vi.fn(async () => {
      zustand.aufrufe.push('zeigen')
      return { type: '', amount: 0 }
    }),
    addListener: vi.fn(async (name: string, f: () => void) => {
      zustand.hoerer.set(name, f)
      return { remove: async () => zustand.hoerer.delete(name) }
    }),
    showPrivacyOptionsForm: vi.fn(async () => {
      zustand.aufrufe.push('widerruf')
    }),
  },
}))

const werbung = await import('@/services/werbung')
const admob = await import('@/services/werbungAdmob')
const { sitzungAusRuecksprung, APP_RUECKSPRUNG } = await import('@/auth/appAnmeldung')

beforeEach(() => {
  zustand.nativ = true
  zustand.kannWerben = true
  zustand.laden = true
  zustand.hoerer.clear()
  zustand.aufrufe = []
  admob.setzeAdmobFuerTests({ block: 'ca-app-pub-9622372327277679/1234567890' })
  werbung.setzeWerbungFuerTests({ client: null })
})

describe('Werbung in der App', () => {
  it('nimmt in der App AdMob, im Browser nicht', () => {
    expect(werbung.werbeAnbieter()).toBe('admob')
    zustand.nativ = false
    expect(werbung.werbeAnbieter()).toBeNull()
  })

  it('ist ohne Anzeigenblock aus -- außer im Testmodus', () => {
    admob.setzeAdmobFuerTests({ block: null })
    expect(werbung.werbungAktiv()).toBe(false)
    admob.setzeAdmobFuerTests({ block: null, test: true })
    expect(werbung.werbungAktiv()).toBe(true)
  })

  it('belohnt ein zu Ende geschautes Video', async () => {
    const angebot = await werbung.belohnungAnfragen('test')
    expect(angebot).not.toBeNull()
    expect(zustand.aufrufe).toContain('laden:ca-app-pub-9622372327277679/1234567890')

    const geschaut = angebot!.zeigen()
    await vi.waitFor(() => expect(zustand.aufrufe).toContain('zeigen'))
    zustand.hoerer.get('onRewardedVideoAdReward')!()
    zustand.hoerer.get('onRewardedVideoAdDismissed')!()
    expect(await geschaut).toBe(true)
  })

  it('belohnt ein abgebrochenes Video nicht', async () => {
    const angebot = await werbung.belohnungAnfragen('test')
    const geschaut = angebot!.zeigen()
    await vi.waitFor(() => expect(zustand.aufrufe).toContain('zeigen'))
    zustand.hoerer.get('onRewardedVideoAdDismissed')!()
    expect(await geschaut).toBe(false)
  })

  it('bietet ohne Einwilligung nichts an und fragt sie vorher', async () => {
    zustand.kannWerben = false
    expect(await werbung.belohnungAnfragen('test')).toBeNull()
    expect(zustand.aufrufe).toContain('einwilligung')
    expect(zustand.aufrufe.some((a) => a.startsWith('laden:'))).toBe(false)
  })

  it('bietet nichts an, wenn kein Video lädt', async () => {
    zustand.laden = false
    expect(await werbung.belohnungAnfragen('test')).toBeNull()
  })

  it('nimmt im Testmodus Googles Test-Anzeigenblock', async () => {
    admob.setzeAdmobFuerTests({ block: 'ca-app-pub-9622372327277679/1234567890', test: true })
    await werbung.belohnungAnfragen('test')
    expect(zustand.aufrufe).toContain('laden:ca-app-pub-3940256099942544/5224354917')
  })

  it('öffnet für den Widerruf Googles Fenster', async () => {
    werbung.einwilligungAendern()
    await vi.waitFor(() => expect(zustand.aufrufe).toContain('widerruf'))
  })
})

describe('Rücksprung nach der Google-Anmeldung', () => {
  function nachgestellt() {
    return {
      auth: {
        exchangeCodeForSession: vi.fn(async () => ({ error: null })),
        setSession: vi.fn(async () => ({ error: null })),
      },
    }
  }

  it('tauscht einen Code gegen die Sitzung (PKCE)', async () => {
    const s = nachgestellt()
    // @ts-expect-error -- nur der Teil des Clients, den die Funktion braucht
    expect(await sitzungAusRuecksprung(s, `${APP_RUECKSPRUNG}?code=abc123`)).toBe(true)
    expect(s.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123')
  })

  it('setzt die Sitzung aus den Schlüsseln hinter dem #', async () => {
    const s = nachgestellt()
    // @ts-expect-error -- nur der Teil des Clients, den die Funktion braucht
    const ok = await sitzungAusRuecksprung(s, `${APP_RUECKSPRUNG}#access_token=a&refresh_token=r`)
    expect(ok).toBe(true)
    expect(s.auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' })
  })

  it('ignoriert fremde Adressen', async () => {
    const s = nachgestellt()
    // @ts-expect-error -- nur der Teil des Clients, den die Funktion braucht
    expect(await sitzungAusRuecksprung(s, 'https://example.org/?code=x')).toBe(false)
    expect(s.auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
