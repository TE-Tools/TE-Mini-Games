/**
 * Hält fest, dass technische Serverfehler nicht als solche am Tisch landen.
 *
 * Am 04.09.2026 stand die Datenbank auf dem Stand einer älteren Migration.
 * Wer online spielen wollte, bekam wörtlich zu lesen: „Could not find the
 * function public.fdi_create_match(p_category, p_mode, p_name) in the schema
 * cache". Das half niemandem weiter -- und es sagte vor allem nicht, dass man
 * am einen Gerät sofort weiterspielen kann.
 */
import { describe, it, expect } from 'vitest'
import { onlineFehlerText } from '@/services/onlineFehler'

describe('onlineFehlerText', () => {
  it('erklärt eine fehlende Serverfunktion in Worten', () => {
    const t = onlineFehlerText(
      'Could not find the function public.fdi_create_match(p_category, p_mode, p_name) in the schema cache',
    )
    expect(t).toContain('noch nicht eingerichtet')
    expect(t).toContain('Am einen Gerät')
    expect(t).not.toContain('schema cache')
  })

  it('erkennt auch eine fehlende Tabelle', () => {
    // Supabase reicht den Code getrennt von der Meldung -- beides zählt.
    expect(onlineFehlerText({ message: 'irgendwas', code: 'PGRST205' })).toContain(
      'noch nicht eingerichtet',
    )
    expect(onlineFehlerText("Could not find the table 'public.fdi_state' in the schema cache"))
      .toContain('noch nicht eingerichtet')
  })

  it('sagt beim Netzproblem, dass es am Netz liegt', () => {
    expect(onlineFehlerText(new Error('Failed to fetch'))).toContain('Verbindung')
  })

  it('sagt bei fehlender Anmeldung, dass man sich anmelden muss', () => {
    expect(onlineFehlerText(new Error('JWT expired'))).toContain('angemeldet')
  })

  it('erklärt eine verweigerte Berechtigung', () => {
    expect(onlineFehlerText(new Error('permission denied for function sr_create_match'))).toContain(
      'Berechtigung',
    )
  })

  it('lässt die Sätze der Spielregeln unverändert durch', () => {
    // Die kommen aus den Datenbankfunktionen und sind für Menschen geschrieben.
    for (const satz of [
      'Du bist nicht dabei',
      'Im Duell tippst du nur auf dein eigenes Team',
      'Duell braucht mindestens 6 Mitspielende',
      'Eine eigene Kategorie braucht mindestens 5 Wörter',
    ]) {
      expect(onlineFehlerText(new Error(satz))).toBe(satz)
    }
  })

  it('lässt niemanden ohne Antwort stehen', () => {
    expect(onlineFehlerText(null).length).toBeGreaterThan(0)
    expect(onlineFehlerText(new Error(''))).toBe('Das hat nicht geklappt.')
  })
})
