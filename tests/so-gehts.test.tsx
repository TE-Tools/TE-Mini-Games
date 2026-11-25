import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SprachProvider } from '@/i18n/SprachProvider'
import { SoGehts } from '@/components/levelziel/SoGehts'
import { LevelZiel } from '@/components/levelziel/LevelZiel'
import { merkeSoGehtsGesehen, soGehtsGesehen } from '@/components/levelziel/soGehtsSpeicher'
import { renderAufDeutsch } from './aufDeutsch'

const SCHRITTE = [
  { bild: '👆', text: 'Schritt eins' },
  { bild: '🐝', text: 'Schritt zwei' },
  { bild: '⬡', text: 'Schritt drei' },
]

function zeige() {
  return renderAufDeutsch(
    <SoGehts spiel="test-spiel" schritte={SCHRITTE} mehr="Die ganze lange Erklärung." />,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('So geht’s', () => {
  it('steht beim ersten Mal offen, die lange Erklärung erst auf Wunsch', async () => {
    zeige()
    expect(screen.getByRole('button', { name: /So geht’s/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Schritt zwei')).toBeInTheDocument()
    expect(screen.queryByText('Die ganze lange Erklärung.')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Mehr erklären' }))
    expect(screen.getByText('Die ganze lange Erklärung.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Weniger erklären' }))
    expect(screen.queryByText('Die ganze lange Erklärung.')).toBeNull()
  })

  it('nach der ersten Runde zugeklappt -- und aufklappbar', async () => {
    merkeSoGehtsGesehen('test-spiel')
    zeige()
    const kopf = screen.getByRole('button', { name: /So geht’s/ })
    expect(kopf).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Schritt eins')).toBeNull()
    await userEvent.click(kopf)
    expect(screen.getByText('Schritt eins')).toBeInTheDocument()
  })

  it('merkt sich das je Spiel', () => {
    merkeSoGehtsGesehen('bienen-flow')
    expect(soGehtsGesehen('bienen-flow')).toBe(true)
    expect(soGehtsGesehen('squishy-dumplings')).toBe(false)
  })

  it('gesperrter Speicher hält nichts auf: dann eben offen', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt')
    })
    expect(() => merkeSoGehtsGesehen('test-spiel')).not.toThrow()
    expect(soGehtsGesehen('test-spiel')).toBe(false)
  })

  it('auf Englisch', () => {
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <SoGehts spiel="test-spiel" schritte={SCHRITTE} mehr="More." />
      </SprachProvider>,
    )
    expect(screen.getByRole('button', { name: /How to play/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Explain more' })).toBeInTheDocument()
  })
})

describe('Nächstes Ziel', () => {
  it('zeigt die Zeile auf Deutsch und Englisch', () => {
    renderAufDeutsch(<LevelZiel ziel={{ art: 'bisZumTor', level: 2 }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Noch 2 Level bis zum Tor')
    cleanup()
    localStorage.setItem('te-sprache', 'en')
    render(
      <SprachProvider>
        <LevelZiel ziel={{ art: 'neuerRekord', um: 40 }} />
      </SprachProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('New record – 40 points more')
  })

  it('ohne Ziel bleibt nur ein stiller Platzhalter', () => {
    renderAufDeutsch(<LevelZiel ziel={null} />)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
