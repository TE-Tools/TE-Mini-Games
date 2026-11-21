/**
 * Der Zeitring (Kopfrechnen, Scharade, Stadt-Land-Fluss) und die Serie beim
 * Kopfrechnen: was sie anzeigen, und dass das Abzeichen nur einmal dasteht.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import { createKopfrechnenLevel } from '@/games/kopfrechnen'
import { Zeitring } from '@/components/zeitring/Zeitring'

const ton = vi.hoisted(() => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/services/sound', async (original) => ({
  ...(await original<typeof import('@/services/sound')>()),
  spiele: ton.spiele,
  vibriere: ton.vibriere,
}))

const { KopfrechnenPage } = await import('@/pages/play/KopfrechnenPage')

describe('Zeitring', () => {
  const balken = () => document.querySelectorAll('circle')[1]!
  const umfang = 2 * Math.PI * 44

  it('läuft mit der Zeit ab und zeigt die Sekunden', () => {
    const { rerender } = render(<Zeitring rest={60} gesamt={60} />)
    expect(screen.getByRole('timer').textContent).toBe('60')
    expect(Number(balken().getAttribute('stroke-dashoffset'))).toBeCloseTo(0)
    rerender(<Zeitring rest={15} gesamt={60} />)
    expect(Number(balken().getAttribute('stroke-dashoffset'))).toBeCloseTo(umfang * 0.75)
  })

  it('grün, ab der Hälfte gelb, in den letzten Sekunden rot', () => {
    const { rerender } = render(<Zeitring rest={50} gesamt={60} />)
    const klasse = () => screen.getByRole('timer').className
    expect(klasse()).toMatch(/voll/)
    rerender(<Zeitring rest={30} gesamt={60} />)
    expect(klasse()).toMatch(/halb/)
    rerender(<Zeitring rest={10} gesamt={60} />)
    expect(klasse()).toMatch(/knapp/)
    rerender(<Zeitring rest={5} gesamt={60} knapp={3} />)
    expect(klasse()).not.toMatch(/knapp/)
  })
})

describe('Kopfrechnen: Serie', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    localStorage.clear()
    ton.spiele.mockClear()
  })

  it('ab drei Richtigen in Folge ein Abzeichen -- immer nur eines, und ein Fehler beendet die Serie', async () => {
    const cfg = createKopfrechnenLevel(1)
    const user = userEvent.setup()
    localStorage.setItem('te-sprache', 'de')
    render(
      <SprachProvider>
        <MemoryRouter>
          <KopfrechnenPage />
        </MemoryRouter>
      </SprachProvider>,
    )
    await user.click(await screen.findByRole('button', { name: /Level 1$/ }))
    await user.click(screen.getByRole('button', { name: 'Start' }))
    const antworte = (zahl: number) => user.type(screen.getByRole('textbox'), `${zahl}{enter}`)
    const abzeichen = () => screen.queryAllByText(/richtig in Folge/)

    await antworte(cfg.tasks[0]!.answer)
    await antworte(cfg.tasks[1]!.answer)
    expect(abzeichen()).toHaveLength(0)
    await antworte(cfg.tasks[2]!.answer)
    expect(abzeichen().map((e) => e.textContent)).toEqual(['🔥 3 richtig in Folge'])
    await antworte(cfg.tasks[3]!.answer)
    // Beim vierten Treffer stand das Abzeichen einmal doppelt da (gleicher Schlüssel wie die Aufgabe).
    expect(abzeichen().map((e) => e.textContent)).toEqual(['🔥 4 richtig in Folge'])
    expect(ton.spiele).toHaveBeenCalledWith('treffer')

    await antworte(cfg.tasks[4]!.answer + 1)
    expect(abzeichen()).toHaveLength(0)
    expect(ton.spiele).toHaveBeenCalledWith('fehlschuss')
  })
})
