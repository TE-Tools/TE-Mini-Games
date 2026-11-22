/**
 * Wortbombe und Wer würde eher? mit englischem Inhalt.
 *
 * Die Silben und Fragen kommen in der Sprache der App: englische Runden
 * bekommen englische Listen (keine übersetzten deutschen), deutsche Runden
 * bleiben genau wie bisher.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { SprachProvider } from '@/i18n/SprachProvider'
import {
  SILBEN,
  SILBEN_EN,
  silbenFuer,
  ziehSilbe,
  createWortbombeMatch,
  explode,
  nextWortbombeRound,
} from '@/games/wortbombe'
import type { WortbombeState } from '@/games/wortbombe'
import { FRAGEN, FRAGEN_EN, fragenFuer, createWweeMatch } from '@/games/wer-wuerde-eher'
import { createRng } from '@/games/rng'
import { WortbombePage } from '@/pages/play/WortbombePage'
import { WerWuerdeEherPage } from '@/pages/play/WerWuerdeEherPage'
import { renderAufDeutsch } from './aufDeutsch'

const NAMEN = ['Anna', 'Ben', 'Cem']
const EN_SILBEN = new Set(SILBEN_EN.map((s) => s.text))
const DE_SILBEN = new Set(SILBEN.map((s) => s.text))
const EN_FRAGEN = new Set(FRAGEN_EN.map((f) => f.id))
const DE_FRAGEN = new Set(FRAGEN.map((f) => f.id))

function aufEnglisch(ui: ReactElement) {
  localStorage.setItem('te-sprache', 'en')
  return render(
    <SprachProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </SprachProvider>,
  )
}

/** Der Absatz, der genau die Silbe zeigt. */
function angezeigteSilbe(kandidaten: Set<string>): string {
  const treffer = screen.getAllByText(
    (_, el) => el?.tagName === 'P' && kandidaten.has(el.textContent ?? ''),
  )
  return treffer[0]!.textContent ?? ''
}

describe('Englische Silben', () => {
  it('hat keine doppelt', () => {
    expect(new Set(SILBEN_EN.map((s) => s.text)).size).toBe(SILBEN_EN.length)
  })

  it('hat alle drei Stufen, jede reichlich', () => {
    for (const stufe of ['leicht', 'mittel', 'schwer'] as const) {
      expect(silbenFuer([stufe], 'en').length).toBeGreaterThanOrEqual(20)
    }
  })

  it('besteht nur aus Buchstaben A-Z', () => {
    for (const s of SILBEN_EN) expect(s.text).toMatch(/^[A-Z]+$/)
  })

  it('enthält keine, zu der einem nichts einfällt', () => {
    for (const heikel of ['Q', 'QU', 'X', 'Y', 'Z', 'ZZ']) expect(EN_SILBEN.has(heikel)).toBe(false)
  })
})

describe('Wortbombe: Sprache der Silben', () => {
  it('zieht auf Englisch nur englische Silben', () => {
    const gezogen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const silbe = ziehSilbe(createRng(`en${i}`), ['leicht', 'mittel', 'schwer'], undefined, 'en')
      expect(EN_SILBEN.has(silbe), silbe).toBe(true)
      gezogen.add(silbe)
    }
    // Und wirklich aus der englischen Liste -- nicht nur aus der Schnittmenge.
    expect([...gezogen].some((s) => !DE_SILBEN.has(s))).toBe(true)
  })

  it('bleibt ohne Angabe deutsch, wie bisher', () => {
    const s = createWortbombeMatch({ names: NAMEN, seed: 3 })
    expect(s.sprache).toBe('de')
    for (let i = 0; i < 100; i++) {
      expect(DE_SILBEN.has(ziehSilbe(createRng(`de${i}`), ['schwer']))).toBe(true)
    }
  })

  it('zieht deutsch genau dieselben Silben wie vorher', () => {
    // Die deutsche Liste ist unverändert, also auch die Ziehung zum selben Seed.
    for (let i = 0; i < 30; i++) {
      const rng1 = createRng(`gleich${i}`)
      const rng2 = createRng(`gleich${i}`)
      expect(ziehSilbe(rng1, ['leicht', 'mittel'])).toBe(
        ziehSilbe(rng2, ['leicht', 'mittel'], undefined, 'de'),
      )
    }
  })

  it('bleibt über die Runden bei der gewählten Sprache', () => {
    let s = createWortbombeMatch({ names: NAMEN, seed: 7, lives: 9, sprache: 'en' })
    expect(s.sprache).toBe('en')
    for (let runde = 0; runde < 20; runde++) {
      expect(EN_SILBEN.has(s.silbe), s.silbe).toBe(true)
      s = nextWortbombeRound(explode(s))
    }
  })

  it('nimmt einen alten Stand ohne Sprache als deutsch', () => {
    const neu = createWortbombeMatch({ names: NAMEN, seed: 5, lives: 9, stufen: ['schwer'] })
    const alt: WortbombeState = { ...neu }
    delete alt.sprache
    let s = alt
    for (let runde = 0; runde < 20; runde++) {
      s = nextWortbombeRound(explode(s))
      expect(DE_SILBEN.has(s.silbe), s.silbe).toBe(true)
    }
  })
})

describe('Englische Fragen', () => {
  it('gibt jeder Frage eine eigene Kennung -- auch neben den deutschen', () => {
    expect(EN_FRAGEN.size).toBe(FRAGEN_EN.length)
    for (const id of EN_FRAGEN) expect(DE_FRAGEN.has(id), id).toBe(false)
  })

  it('hat von beiden Sorten reichlich', () => {
    expect(fragenFuer(['personen'], 'en').length).toBeGreaterThanOrEqual(100)
    expect(fragenFuer(['entweder'], 'en').length).toBeGreaterThanOrEqual(60)
  })

  it('gibt Entweder-oder-Fragen immer zwei Möglichkeiten', () => {
    for (const f of fragenFuer(['entweder'], 'en')) {
      expect(f.a, f.id).toBeTruthy()
      expect(f.b, f.id).toBeTruthy()
      expect(f.a).not.toBe(f.b)
    }
  })

  it('formuliert Personenfragen als englische Frage', () => {
    for (const f of fragenFuer(['personen'], 'en')) {
      expect(f.text.startsWith('Who is most likely to '), f.text).toBe(true)
      expect(f.text.endsWith('?'), f.text).toBe(true)
    }
  })

  it('enthält keine deutschen Zeichen', () => {
    for (const f of FRAGEN_EN) {
      for (const text of [f.text, f.a ?? '', f.b ?? '']) {
        expect(text, f.id).not.toMatch(/[äöüÄÖÜß]/)
      }
    }
  })
})

describe('Wer würde eher: Sprache der Fragen', () => {
  it('stellt auf Englisch nur englische Fragen', () => {
    for (let seed = 0; seed < 10; seed++) {
      const s = createWweeMatch({ names: NAMEN, seed, rounds: 25, sprache: 'en' })
      expect(s.sprache).toBe('en')
      for (const f of s.fragen) expect(EN_FRAGEN.has(f.id), f.id).toBe(true)
    }
  })

  it('bleibt ohne Angabe deutsch', () => {
    const s = createWweeMatch({ names: NAMEN, seed: 9, rounds: 25 })
    expect(s.sprache).toBe('de')
    for (const f of s.fragen) expect(DE_FRAGEN.has(f.id), f.id).toBe(true)
  })
})

describe('Die Seiten nehmen die Sprache der App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('Wortbombe auf Englisch zeigt eine englische Silbe', async () => {
    aufEnglisch(<WortbombePage />)
    await userEvent.click(screen.getByRole('button', { name: 'Light the fuse' }))
    expect(screen.getByText('Say a word containing')).toBeInTheDocument()
    expect(EN_SILBEN.has(angezeigteSilbe(EN_SILBEN))).toBe(true)
  })

  it('Wortbombe auf Deutsch zeigt eine deutsche Silbe', async () => {
    renderAufDeutsch(
      <MemoryRouter>
        <WortbombePage />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Zünden' }))
    expect(DE_SILBEN.has(angezeigteSilbe(DE_SILBEN))).toBe(true)
  })

  it('Wer würde eher auf Englisch stellt eine englische Frage', async () => {
    aufEnglisch(<WerWuerdeEherPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Start playing' }))
    await userEvent.click(screen.getByRole('button', { name: 'I am Thomas' }))
    const englisch = new Set(FRAGEN_EN.map((f) => f.text))
    const frage = screen.getByText(
      (_, el) => el?.tagName === 'P' && englisch.has(el.textContent ?? ''),
    )
    expect(frage.textContent).toMatch(/^(Who is most likely to .+\?|Would you rather…\?)$/)
    expect(screen.queryByText(/Wer würde am ehesten|Was wäre dir lieber/)).toBeNull()
  })

  it('Wer würde eher auf Deutsch stellt eine deutsche Frage', async () => {
    renderAufDeutsch(
      <MemoryRouter>
        <WerWuerdeEherPage />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Losspielen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ich bin Thomas' }))
    expect(
      screen.getByText(/^(Wer würde am ehesten .+\?|Was wäre dir lieber\?)$/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Who is most likely|Would you rather/)).toBeNull()
  })
})
