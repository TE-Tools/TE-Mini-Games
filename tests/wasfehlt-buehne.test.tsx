/** Was fehlt?: Die Auflösung -- Ton, und bei falscher Wahl das Gewählte neben dem Gesuchten. */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import type * as Ton from '@/services/sound'

const ton = vi.hoisted(() => ({ spiele: vi.fn(), vibriere: vi.fn() }))
vi.mock('@/services/sound', async (original) => ({ ...(await original<typeof Ton>()), ...ton }))

const { WhatIsMissingPage } = await import('@/pages/play/WhatIsMissingPage')

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  localStorage.setItem('te-sprache', 'de')
  for (const f of Object.values(ton)) f.mockClear()
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  })
})
afterEach(() => vi.useRealTimers())

const inhalt = (liste: HTMLElement) =>
  within(liste)
    .getAllByRole('listitem')
    .map((li) => li.textContent ?? '')

/** Bis zur Wahl; liefert, was fehlt. */
async function bisZurWahl(user: ReturnType<typeof userEvent.setup>) {
  render(
    <SprachProvider>
      <MemoryRouter>
        <WhatIsMissingPage />
      </MemoryRouter>
    </SprachProvider>,
  )
  await user.click(await screen.findByRole('button', { name: /Level 1$/ }))
  await user.click(screen.getByRole('button', { name: 'Start' }))
  const gezeigt = inhalt(await screen.findByRole('list'))
  for (let i = 0; i < 80 && !screen.queryByText('Welches Objekt fehlt?'); i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
  }
  const noch = new Set(inhalt(screen.getByRole('list', { name: 'Noch sichtbare Objekte' })))
  return gezeigt.find((o) => !noch.has(o))!
}

const knoepfe = () => screen.getAllByRole('button').filter((b) => b.closest('li'))

describe('Was fehlt?: Auflösung', () => {
  it('richtig: Erfolgston, das Gesuchte allein auf der Bühne', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fehlt = await bisZurWahl(user)
    await user.click(knoepfe().find((b) => b.textContent === fehlt)!)
    await screen.findByText('Richtig!')
    expect(ton.spiele).toHaveBeenCalledWith('erfolg')
    expect(document.querySelectorAll('[class*="buehneEmoji"]')).toHaveLength(1)
  })

  it('falsch: Fehlerton, Rütteln, und das Gewählte steht neben dem Gesuchten', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const fehlt = await bisZurWahl(user)
    const falsch = knoepfe().find((b) => b.textContent !== fehlt)!
    const gewaehlt = falsch.textContent!
    await user.click(falsch)
    await screen.findByText('Leider falsch')
    expect(ton.spiele).toHaveBeenCalledWith('fehlschuss')
    expect(ton.vibriere).toHaveBeenCalled()
    const buehne = [...document.querySelectorAll('[class*="buehneEmoji"]')].map(
      (e) => e.textContent,
    )
    expect(buehne).toHaveLength(2)
    expect(gewaehlt.startsWith(buehne[0]!)).toBe(true)
    expect(fehlt.startsWith(buehne[1]!)).toBe(true)
  })
})
