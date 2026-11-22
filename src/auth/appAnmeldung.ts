/**
 * Anmeldung mit Google in der Android-App.
 *
 * Seit die App eine Capacitor-Hülle ist (07.11.2026, capacitor.config.ts),
 * läuft die Seite in einer eingebetteten Webansicht -- und dort lässt
 * Google seine Anmeldung nicht zu („disallowed_useragent“). Darum öffnet
 * die App die Anmeldung im externen Browser. Danach schickt Supabase den
 * Browser an `de.tetools.minigames://auth` zurück; Android gibt das an die
 * App (AndroidManifest.xml), und hier wird daraus die Sitzung.
 *
 * Diese Adresse muss in Supabase unter Authentication → URL Configuration →
 * Redirect URLs stehen, sonst lehnt Supabase den Rücksprung ab.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const APP_RUECKSPRUNG = 'de.tetools.minigames://auth'

/** Öffnet die Google-Anmeldung im externen Browser. */
export async function googleInDerApp(supabase: SupabaseClient): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: APP_RUECKSPRUNG, skipBrowserRedirect: true },
  })
  if (error || !data.url) return { error: error?.message ?? 'Anmeldung ließ sich nicht öffnen' }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url: data.url })
  return { error: null }
}

/**
 * Liest aus der Rücksprung-Adresse die Sitzung: mit PKCE steht dort ein
 * `code`, im älteren Ablauf stehen die Schlüssel hinter dem `#`.
 * Liefert, ob eine Sitzung gesetzt wurde.
 */
export async function sitzungAusRuecksprung(
  supabase: SupabaseClient,
  adresse: string,
): Promise<boolean> {
  if (!adresse.startsWith(APP_RUECKSPRUNG)) return false
  const rest = adresse.slice(APP_RUECKSPRUNG.length)
  const [vorne = '', hinten = ''] = rest.split('#')
  const abfrage = new URLSearchParams(vorne.replace(/^[/?]+/, ''))
  const code = abfrage.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return !error
  }
  const schluessel = new URLSearchParams(hinten)
  const access_token = schluessel.get('access_token')
  const refresh_token = schluessel.get('refresh_token')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    return !error
  }
  return false
}

/** Einmal beim Start der App: auf den Rücksprung horchen. */
export async function horcheAufRuecksprung(supabase: SupabaseClient): Promise<void> {
  const { App } = await import('@capacitor/app')
  const { Browser } = await import('@capacitor/browser')
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(APP_RUECKSPRUNG)) return
    const angemeldet = await sitzungAusRuecksprung(supabase, url)
    await Browser.close().catch(() => undefined)
    // Zur Kontoseite: Sie zeigt den neuen Stand und fragt, wo nötig, nach
    // dem Benutzernamen -- wie nach einer Anmeldung im Browser.
    if (angemeldet) window.location.assign('/auth')
  })
}
