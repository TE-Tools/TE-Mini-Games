/**
 * Die Bausteine der Online-Vorräume (src/components/onlineLobby): Code
 * kopieren und teilen, wer im Raum ist und auf wie viele gewartet wird,
 * das Codefeld.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { CodeFeld, RaumCode, WarteSpieler } from '@/components/onlineLobby/OnlineLobby'
import { renderAufDeutsch as render } from './aufDeutsch'

const schreiben = vi.fn<(text: string) => Promise<void>>()

function setzeNavigator(werte: { clipboard?: unknown; share?: unknown }) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: werte.clipboard,
  })
  Object.defineProperty(navigator, 'share', { configurable: true, value: werte.share })
}

beforeEach(() => {
  schreiben.mockReset()
  schreiben.mockResolvedValue(undefined)
  setzeNavigator({ clipboard: { writeText: schreiben }, share: undefined })
})

afterEach(() => {
  setzeNavigator({ clipboard: undefined, share: undefined })
})

/** Wartet, bis die Versprechen der Knöpfe durch sind. */
const klick = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.click(el)
  })
}

describe('RaumCode', () => {
  it('zeigt den Code groß und kopiert ihn beim Antippen', async () => {
    render(<RaumCode code="K7QXP" spiel="Kniffel" />)
    expect(screen.getByText('K7QXP')).toBeInTheDocument()
    await klick(screen.getByRole('button', { name: 'Code K7QXP kopieren' }))
    expect(schreiben).toHaveBeenCalledWith('K7QXP')
    expect(screen.getByText('Code kopiert')).toBeInTheDocument()
  })

  it('sagt Bescheid, wenn Kopieren nicht geht', async () => {
    schreiben.mockRejectedValue(new Error('verboten'))
    render(<RaumCode code="K7QXP" spiel="Kniffel" />)
    await klick(screen.getByRole('button', { name: 'Code K7QXP kopieren' }))
    expect(screen.getByText(/Kopieren ging nicht/)).toBeInTheDocument()
  })

  it('teilt über das Gerät, wo es das gibt -- nur Text mit Code, kein Link', async () => {
    const teilen = vi.fn(async () => {})
    setzeNavigator({ clipboard: { writeText: schreiben }, share: teilen })
    render(<RaumCode code="K7QXP" spiel="Kniffel" />)
    await klick(screen.getByRole('button', { name: 'Einladen' }))
    expect(teilen).toHaveBeenCalledTimes(1)
    const daten = (teilen.mock.calls[0] as unknown as [ShareData])[0]
    expect(daten.text).toContain('K7QXP')
    expect(daten.text).toContain('Kniffel')
    expect(daten.url).toBeUndefined()
    expect(schreiben).not.toHaveBeenCalled()
  })

  it('legt die Einladung in die Ablage, wenn das Gerät nicht teilen kann', async () => {
    render(<RaumCode code="K7QXP" spiel="Kniffel" />)
    await klick(screen.getByRole('button', { name: 'Einladen' }))
    expect(schreiben).toHaveBeenCalledWith(expect.stringContaining('K7QXP'))
    expect(screen.getByText(/Einladung kopiert/)).toBeInTheDocument()
  })

  it('bleibt still, wenn man das Teilen abbricht', async () => {
    const teilen = vi.fn(async () => {
      throw new DOMException('abgebrochen', 'AbortError')
    })
    setzeNavigator({ clipboard: { writeText: schreiben }, share: teilen })
    render(<RaumCode code="K7QXP" spiel="Kniffel" />)
    await klick(screen.getByRole('button', { name: 'Einladen' }))
    expect(schreiben).not.toHaveBeenCalled()
    expect(screen.queryByText(/kopiert/)).toBeNull()
  })
})

describe('WarteSpieler', () => {
  const zwei = [
    { seat: 1, name: 'Thomas', is_you: true },
    { seat: 2, name: 'Lena', is_you: false },
  ]

  it('zählt, auf wie viele noch gewartet wird', () => {
    render(<WarteSpieler spieler={zwei} gastgeberPlatz={1} min={4} ichBinGastgeber />)
    expect(screen.getByText('Thomas')).toBeInTheDocument()
    expect(screen.getByText('Lena')).toBeInTheDocument()
    expect(screen.getByText('2 Personen')).toBeInTheDocument()
    expect(screen.getByText('Wartet auf 2 weitere Personen')).toBeInTheDocument()
  })

  it('sagt „eine weitere" im Singular und „alle da", wenn es reicht', () => {
    const { rerender } = render(
      <WarteSpieler spieler={zwei} gastgeberPlatz={1} min={3} ichBinGastgeber />,
    )
    expect(screen.getByText('Wartet auf eine weitere Person')).toBeInTheDocument()
    rerender(<WarteSpieler spieler={zwei} gastgeberPlatz={1} min={2} ichBinGastgeber />)
    expect(screen.getByText('Alle da – du kannst starten.')).toBeInTheDocument()
    rerender(<WarteSpieler spieler={zwei} gastgeberPlatz={1} min={2} ichBinGastgeber={false} />)
    expect(screen.getByText('Alle da – gleich startet der Gastgeber.')).toBeInTheDocument()
  })

  it('markiert Gastgeber und dich', () => {
    // Ich bin Gast: Gastgeber ist der feste Platz 1, das bin nicht ich.
    render(
      <WarteSpieler
        spieler={[
          { seat: 1, name: 'Lena', is_you: false },
          { seat: 2, name: 'Thomas', is_you: true },
        ]}
        gastgeberPlatz={1}
        min={2}
        ichBinGastgeber={false}
      />,
    )
    const lena = screen.getByText('Lena').closest('li')!
    const thomas = screen.getByText('Thomas').closest('li')!
    expect(lena).toHaveTextContent('Gastgeber')
    expect(lena).not.toHaveTextContent('Du')
    expect(thomas).toHaveTextContent('Du')
    expect(thomas).not.toHaveTextContent('Gastgeber')
  })

  it('nimmt einen eigenen Hinweis statt der Zählung', () => {
    render(
      <WarteSpieler
        spieler={zwei}
        gastgeberPlatz={1}
        min={5}
        ichBinGastgeber
        hinweis="2/8 Plätze"
      />,
    )
    expect(screen.getByText('2/8 Plätze')).toBeInTheDocument()
    expect(screen.queryByText(/Wartet auf/)).toBeNull()
  })
})

describe('CodeFeld', () => {
  function Feld({ onFertig }: { onFertig: () => void }) {
    const [wert, setWert] = useState('')
    return <CodeFeld wert={wert} onWert={setWert} beschriftung="Mit Code" onFertig={onFertig} />
  }

  it('macht Großbuchstaben, wirft Fremdes raus und kappt bei fünf', () => {
    render(<Feld onFertig={() => {}} />)
    const feld = screen.getByLabelText('Mit Code')
    fireEvent.change(feld, { target: { value: 'k7-q xp9' } })
    expect(feld).toHaveValue('K7QXP')
  })

  it('tritt mit Enter erst bei vollständigem Code bei', () => {
    const fertig = vi.fn()
    render(<Feld onFertig={fertig} />)
    const feld = screen.getByLabelText('Mit Code')
    fireEvent.change(feld, { target: { value: 'K7Q' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(fertig).not.toHaveBeenCalled()
    fireEvent.change(feld, { target: { value: 'K7QXP' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(fertig).toHaveBeenCalledTimes(1)
  })
})
