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
const update = vi.fn()
vi.mock('@/database/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }),
      update: (werte: unknown) => {
        update(werte)
        return { eq: () => Promise.resolve({ error: null }) }
      },
    }),
  },
}))

const { db } = await import('@/offline/db')
const { GAST_NAME } = await import('@/offline')
const {
  ermittleSpielerName,
  spielerNameOderDu,
  istEchterName,
  pruefeName,
  setzeSpielerName,
  nameVomKontoUebernehmen,
  NAME_MIN,
  NAME_MAX,
} = await import('@/services/spielername')

beforeEach(async () => {
  await db.profiles.clear()
  getCurrentUser.mockReset()
  maybeSingle.mockReset()
  update.mockReset()
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

describe('Namen von Hand setzen', () => {
  it('weist zu kurze und zu lange Namen zurück', () => {
    expect(pruefeName('a')).toMatch(new RegExp(`${NAME_MIN}`))
    expect(pruefeName('x'.repeat(NAME_MAX + 1))).toMatch(new RegExp(`${NAME_MAX}`))
  })

  it('lässt den Platzhalter nicht als Namen zu', () => {
    expect(pruefeName(GAST_NAME)).toMatch(/Platzhalter/)
  })

  it('nimmt einen normalen Namen an', () => {
    expect(pruefeName('Thomas')).toBeNull()
    expect(pruefeName('  Thomas  ')).toBeNull()
  })

  it('speichert den Namen lokal und gibt ihn beschnitten zurück', async () => {
    getCurrentUser.mockResolvedValue(null)
    expect(await setzeSpielerName('  Tommy  ')).toBe('Tommy')
    expect((await db.profiles.get('guest'))?.displayName).toBe('Tommy')
  })

  it('schreibt ihn angemeldet auch ins Konto – für die anderen Geräte', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: {} })
    await setzeSpielerName('Tommy')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Tommy' }))
  })

  it('fasst das Konto nicht an, wenn niemand angemeldet ist', async () => {
    getCurrentUser.mockResolvedValue(null)
    await setzeSpielerName('Tommy')
    expect(update).not.toHaveBeenCalled()
  })

  it('lehnt einen ungültigen Namen ab, ohne etwas zu speichern', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(setzeSpielerName('a')).rejects.toThrow()
    expect(await db.profiles.get('guest')).toBeUndefined()
  })

  it('schlägt den selbst gesetzten Namen danach über den Kontonamen', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { display_name: 'Thomas' } })
    await setzeSpielerName('Tommy')
    expect(await ermittleSpielerName()).toBe('Tommy')
  })
})

describe('Wieder den Namen aus dem Konto nehmen', () => {
  it('verwirft den eigenen und holt den vom Konto', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', user_metadata: { display_name: 'Thomas' } })
    await setzeSpielerName('Tommy')
    expect(await nameVomKontoUebernehmen()).toBe('Thomas')
    expect(await ermittleSpielerName()).toBe('Thomas')
  })

  it('landet bei "Gast", wenn im Konto keiner steht', async () => {
    getCurrentUser.mockResolvedValue(null)
    await setzeSpielerName('Tommy')
    expect(await nameVomKontoUebernehmen()).toBe(GAST_NAME)
  })
})
