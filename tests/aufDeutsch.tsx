/**
 * Rendern auf Deutsch.
 *
 * jsdom meldet en-US, die App wählt dort also Englisch. Tests, die deutschen
 * Text prüfen und einen übersetzten Baustein unmittelbar rendern, brauchen
 * deshalb beides: die Sprache ausdrücklich gesetzt und den Provider darüber.
 * Siehe docs/design/zweisprachig/README.md.
 */
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { SprachProvider } from '@/i18n/SprachProvider'

export function renderAufDeutsch(ui: ReactElement) {
  localStorage.setItem('te-sprache', 'de')
  return render(<SprachProvider>{ui}</SprachProvider>)
}
