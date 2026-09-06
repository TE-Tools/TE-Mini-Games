/**
 * Unter welchem Namen jemand spielt.
 *
 * Anlass (06.09.2026, Thomas): "Wenn ich Kniffel einen Raum starte, steht
 * da immer noch Gast Du und nicht mein Accountname."
 *
 * Der erste Anlauf hatte nur den Geräteabgleich repariert. Das reichte
 * nicht: Der lokale Name wird beim ersten Start auf "Gast" gesetzt und
 * danach von niemandem mehr angefasst -- `setDisplayName` gab es zwar,
 * gerufen hat es keine einzige Stelle der Oberfläche. Ohne laufenden
 * Abgleich blieb es also für immer bei "Gast".
 *
 * Diese Tests halten die Reihenfolge fest, in der der Name jetzt gesucht
 * wird, und vor allem: dass er auch ohne Netz und ohne Datenbankabfrage
 * gefunden wird, wenn er in den Anmeldedaten steht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

const getCurrentUser = vi.fn()
vi.mock('@/auth/authService', () => ({ getCurrentUser: () => getCurrentUser() }))

const maybeSingle = vi.fn()
vi.mock('@/database/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
    }),
  },
}))

const { db } = await import('@/offline/db')
const { GAST_NAME } = await import('@/offline')
const { ermittleSpielerName, spielerNameOderDu, istEchterName } = await import(
  '@/services/spielername'
)

beforeEach(async () => {
  await db.profiles.clear()
  getCurrentUser.mockReset()
  maybeSingle.mockReset()
  maybeSingle.mockResolvedValue({ data: null })
})

describe('Ist das ein Name?', () => {
  it('erkennt den Vorgabewert als "noch keiner"', () => {
    expect(istEchterName(GAST_NAME)).toBe(false)
    expect(istEchterName('')).toBe(false)
    expect(istEchterName('   ')).toBe(false)
    expect(istEchterName(null)).toBe(false)
    expect(istEchterName(undefined)).toBe(false)
  })

  it('erkennt einen echten Namen', () => {
    expect(istEchterName('Thomas')).toBe(true)
    expect(istEchterName('  Thomas  ')).toBe(true)
  })
})

describe('Woher der Name kommt', () => {
  it('bleibt bei "Gast", wenn niemand angemeldet ist', async () => {
    getCurrentUser.mockResolvedValue(null)
    expect(await ermittleSpielerName()).toBe(GAST_NAME)
  })

  it('nimmt den Anzeigenamen aus den Anmeldedaten – ohne Datenbankabfrage', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { display_name: 'Thomas' } })
    expect(await ermittleSpielerName()).toBe('Thomas')
    expect(maybeSingle).not.toHaveBeenCalled()
  })

  it('nimmt den Benutzernamen, wenn kein Anzeigename gesetzt ist', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { username: 'tommy' } })
    expect(await ermittleSpielerName()).toBe('tommy')
  })

  it('kennt auch die Felder, die andere Anmeldewege setzen', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { full_name: 'Thomas E.' } })
    expect(await ermittleSpielerName()).toBe('Thomas E.')
  })

  it('fragt die Profilzeile, wenn in den Anmeldedaten nichts steht', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: {} })
    maybeSingle.mockResolvedValue({ data: { display_name: 'Thomas', username: 'tommy' } })
    expect(await ermittleSpielerName()).toBe('Thomas')
    expect(maybeSingle).toHaveBeenCalled()
  })

  it('nimmt aus der Profilzeile den Benutzernamen, wenn der Anzeigename leer ist', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: {} })
    maybeSingle.mockResolvedValue({ data: { display_name: null, username: 'tommy' } })
    expect(await ermittleSpielerName()).toBe('tommy')
  })

  it('bleibt bei "Gast", wenn das Konto gar keinen Namen hergibt', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: {} })
    maybeSingle.mockResolvedValue({ data: { display_name: null, username: null } })
    expect(await ermittleSpielerName()).toBe(GAST_NAME)
  })

  it('lässt einen lokal gesetzten Namen unangetastet', async () => {
    await db.profiles.put({
      id: 'guest',
      displayName: 'Tommy',
      avatar: null,
      totalXp: 0,
      playerLevel: 1,
      streakDays: 0,
      lastPlayedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { display_name: 'Thomas' } })
    expect(await ermittleSpielerName()).toBe('Tommy')
    expect(getCurrentUser).not.toHaveBeenCalled()
  })
})

describe('Der Name bleibt lokal stehen', () => {
  it('schreibt den Kontonamen fest, damit er auch ohne Netz gilt', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { display_name: 'Thomas' } })
    await ermittleSpielerName()

    // Zweiter Aufruf kommt ohne Konto aus -- der Name steht jetzt lokal.
    getCurrentUser.mockResolvedValue(null)
    expect(await ermittleSpielerName()).toBe('Thomas')
    expect((await db.profiles.get('guest'))?.displayName).toBe('Thomas')
  })
})

describe('Anzeige in einer Runde', () => {
  it('sagt "Du", solange kein Konto dahintersteht', async () => {
    getCurrentUser.mockResolvedValue(null)
    expect(await spielerNameOderDu()).toBe('Du')
  })

  it('sagt den Kontonamen, sobald es einen gibt', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { display_name: 'Thomas' } })
    expect(await spielerNameOderDu()).toBe('Thomas')
  })
})
