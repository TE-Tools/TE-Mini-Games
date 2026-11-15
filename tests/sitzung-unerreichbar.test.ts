/**
 * „Keine Sitzung" ist nicht dasselbe wie „abgemeldet".
 *
 * Eine gespeicherte Anmeldung gilt eine Stunde. Danach holt Supabase beim
 * nächsten Start eine frische -- und meldet „keine Sitzung", wenn das
 * nicht geht, auch wenn der Grund nur ein Funkloch ist. Gemeldet aus der
 * Android-App (13.11.2026): „Ich muss mich jedes Mal neu einloggen."
 *
 * Geprüft wird hier die eine Stelle, die beides auseinanderhält.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'

const server = vi.hoisted(() => ({
  antwort: { data: { session: null as unknown }, error: null as unknown },
  melde: null as null | ((ereignis: string, sitzung: unknown) => void),
}))

vi.mock('@/database/supabase', () => {
  const supabase = {
    auth: {
      getSession: async () => server.antwort,
      onAuthStateChange: (cb: (ereignis: string, sitzung: unknown) => void) => {
        server.melde = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  }
  return { supabase, isSupabaseConfigured: true, requireSupabase: () => supabase }
})

const { getSession, sitzungNurUnerreichbar, onAuthStateChange } = await import('@/auth/authService')

const SITZUNG = { user: { id: 'u1' } }

describe('Sitzung: nicht erreichbar oder abgemeldet?', () => {
  beforeEach(() => {
    server.antwort = { data: { session: null }, error: null }
    server.melde = null
  })

  it('nicht erreichbar: keine Sitzung, aber auch keine Abmeldung', async () => {
    server.antwort = {
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    }
    expect(await getSession()).toBeNull()
    expect(sitzungNurUnerreichbar()).toBe(true)
  })

  it('vom Server abgelehnt: das ist eine Abmeldung', async () => {
    server.antwort = {
      data: { session: null },
      error: new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, undefined),
    }
    expect(await getSession()).toBeNull()
    expect(sitzungNurUnerreichbar()).toBe(false)
  })

  it('nie angemeldet: keine Sitzung, kein Fehler', async () => {
    expect(await getSession()).toBeNull()
    expect(sitzungNurUnerreichbar()).toBe(false)
  })

  it('wieder erreichbar: Der Vermerk von vorhin gilt nicht weiter', async () => {
    server.antwort = {
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    }
    await getSession()
    expect(sitzungNurUnerreichbar()).toBe(true)

    server.antwort = { data: { session: SITZUNG }, error: null }
    expect(await getSession()).toBe(SITZUNG)
    expect(sitzungNurUnerreichbar()).toBe(false)
  })

  it('sagt dem Empfänger, ob Supabase wirklich abgemeldet hat', async () => {
    const gemeldet: [unknown, boolean][] = []
    onAuthStateChange((user, abgemeldet) => gemeldet.push([user, abgemeldet]))

    server.melde!('INITIAL_SESSION', null)
    server.melde!('SIGNED_IN', SITZUNG)
    server.melde!('SIGNED_OUT', null)
    expect(gemeldet).toEqual([
      [null, false],
      [SITZUNG.user, false],
      [null, true],
    ])
  })

  it('eine echte Abmeldung löscht den Vermerk „nur nicht erreichbar"', async () => {
    onAuthStateChange(() => {})
    server.antwort = {
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    }
    await getSession()
    expect(sitzungNurUnerreichbar()).toBe(true)
    server.melde!('SIGNED_OUT', null)
    expect(sitzungNurUnerreichbar()).toBe(false)
  })
})
