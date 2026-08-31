/**
 * Angemeldet-sein und einen Benutzernamen zu haben sind zwei verschiedene Dinge.
 *
 * Hintergrund (31.08.2026): Die Rangliste leitete "ist angemeldet" aus
 * getMyUsername() ab. Wer sich über Google anmeldet, bekommt aber keinen
 * Benutzernamen – handle_new_user() übernimmt nur, was in den Anmeldedaten
 * steht, und Google liefert keinen. Folge: Die App behauptete "nicht
 * angemeldet", obwohl die Anmeldung stand.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/database/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const { getAuthStatus } = await import('@/auth/authService')

function profileReturning(username: string | null) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: username === null ? { username: null } : { username } }),
      }),
    }),
  }
}

describe('getAuthStatus', () => {
  beforeEach(() => {
    mockGetUser.mockReset()
    mockFrom.mockReset()
  })

  it('meldet angemeldet auch ohne Benutzernamen (Google-Anmeldung)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.de' } } })
    mockFrom.mockReturnValue(profileReturning(null))

    const status = await getAuthStatus()
    expect(status.signedIn).toBe(true)
    expect(status.username).toBeNull()
    expect(status.email).toBe('a@b.de')
  })

  it('liefert den Benutzernamen, wenn einer gesetzt ist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.de' } } })
    mockFrom.mockReturnValue(profileReturning('thomas'))

    const status = await getAuthStatus()
    expect(status.signedIn).toBe(true)
    expect(status.username).toBe('thomas')
  })

  it('meldet nicht angemeldet, wenn keine Sitzung besteht', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const status = await getAuthStatus()
    expect(status.signedIn).toBe(false)
    expect(status.username).toBeNull()
  })
})
