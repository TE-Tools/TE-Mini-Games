/**
 * Welcher Name im Spiel steht.
 *
 * Anlass (06.09.2026, Thomas): "Gast steht bei Kniffel statt mein
 * Eingeloggter Name."
 *
 * Ursache war eine Zeile im Geräte-Abgleich: `local?.displayName ??
 * profile.display_name`. Der lokale Name gewinnt darin immer -- es gibt
 * ihn ja immer, weil beim ersten Start "Gast" angelegt wird. Der Name vom
 * Konto kam deshalb nie an.
 *
 * Die Regel, die jetzt gilt, steht hier als Test: "Gast" ist der
 * unangetastete Vorgabewert und zählt als "noch nichts gesetzt"; ein
 * selbst gewählter Name bleibt dagegen unangetastet.
 */
import { describe, it, expect } from 'vitest'
import { GAST_NAME } from '@/offline'

/**
 * Dieselbe Entscheidung wie in pullRemoteState -- hier nachgebaut, weil
 * die echte Funktion eine Supabase-Verbindung braucht. Ändert sich die
 * Regel dort, muss sie hier mitgeändert werden, und dann fällt jemandem
 * auf, dass es eine Regel ist.
 */
function nameNachAbgleich(lokal: string | null, konto: string | null): string {
  const lokalerName = lokal?.trim()
  const kontoName = konto?.trim()
  const selbstGesetzt = Boolean(lokalerName) && lokalerName !== GAST_NAME
  return selbstGesetzt ? (lokalerName as string) : kontoName || lokalerName || GAST_NAME
}

describe('Name nach dem Geräte-Abgleich', () => {
  it('nimmt den Namen vom Konto, wenn lokal nur "Gast" steht', () => {
    expect(nameNachAbgleich(GAST_NAME, 'Thomas')).toBe('Thomas')
  })

  it('lässt einen selbst gewählten Namen in Ruhe', () => {
    expect(nameNachAbgleich('Tommy', 'Thomas')).toBe('Tommy')
  })

  it('bleibt bei "Gast", wenn das Konto auch keinen Namen hat', () => {
    expect(nameNachAbgleich(GAST_NAME, null)).toBe(GAST_NAME)
    expect(nameNachAbgleich(GAST_NAME, '   ')).toBe(GAST_NAME)
  })

  it('nimmt den Kontonamen auch, wenn lokal noch gar nichts steht', () => {
    expect(nameNachAbgleich(null, 'Thomas')).toBe('Thomas')
  })

  it('behandelt Leerzeichen um den Namen wie nicht vorhanden', () => {
    expect(nameNachAbgleich('  ', 'Thomas')).toBe('Thomas')
    expect(nameNachAbgleich('  Tommy  ', 'Thomas')).toBe('Tommy')
  })

  it('fällt auf "Gast" zurück, wenn beides fehlt', () => {
    expect(nameNachAbgleich(null, null)).toBe(GAST_NAME)
  })
})
