/**
 * Der Start darf nie in einem ewigen Ladebildschirm enden.
 *
 * Am 10.09.2026 meldete Thomas, einige könnten die App nicht mehr öffnen.
 * Die Ursache war nicht ein bestimmter Fehler, sondern dass *jeder* Fehler
 * beim ersten Rendern denselben Ausgang hatte: `main.tsx` blendete den
 * Startbildschirm aus index.html erst nach dem Rendern weg, also nie -- und
 * die App stand für immer auf "lädt", ohne Meldung und ohne Ausweg.
 *
 * Der Test hält beides fest: dass ein Renderfehler etwas Lesbares zeigt und
 * dass er dabei auch etwas zum Weiterkommen anbietet.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StartFehler } from '@/app/StartFehler'

function Kaputt(): never {
  throw new Error('Absicht: kaputt beim Rendern')
}

afterEach(() => cleanup())

describe('Auffang beim Start', () => {
  it('zeigt bei einem Renderfehler eine lesbare Seite statt gar nichts', () => {
    const stumm = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <StartFehler>
        <Kaputt />
      </StartFehler>,
    )
    expect(screen.getByText('Da ist etwas schiefgegangen')).toBeTruthy()
    // Die Meldung selbst steht dabei, damit man sie melden kann.
    expect(screen.getByText(/Absicht: kaputt beim Rendern/)).toBeTruthy()
    stumm.mockRestore()
  })

  it('bietet einen Weg zurück an', () => {
    const stumm = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <StartFehler>
        <Kaputt />
      </StartFehler>,
    )
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zwischenspeicher leeren' })).toBeTruthy()
    stumm.mockRestore()
  })

  it('lässt heile Inhalte unangetastet durch', () => {
    render(
      <StartFehler>
        <p>alles gut</p>
      </StartFehler>,
    )
    expect(screen.getByText('alles gut')).toBeTruthy()
  })
})
