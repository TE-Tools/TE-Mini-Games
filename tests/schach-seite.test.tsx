/**
 * Die Seite gegen den Computer: Ziehen, Umwandeln, Zurücknehmen, Aufgeben,
 * gespeicherte Partie. Der Computer rechnet hier ohne Worker (jsdom hat
 * keinen) -- derselbe Weg wie auf einem Gerät, auf dem der Worker fehlt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SPEICHER_SCHLUESSEL } from '@/games/schach'
import { renderAufDeutsch as render } from './aufDeutsch'

const gebucht = vi.hoisted(() => vi.fn())
vi.mock('@/pages/play/schach/partieBuchen', () => ({
  buchePartie: gebucht,
}))
vi.mock('@/services/sound', () => ({ spiele: vi.fn(), vibriere: vi.fn() }))

const { SchachPage } = await import('@/pages/play/SchachPage')

function zeige() {
  return render(
    <StrictMode>
      <MemoryRouter>
        <SchachPage />
      </MemoryRouter>
    </StrictMode>,
  )
}

const feld = (name: string) => document.querySelector<HTMLButtonElement>(`[data-feld="${name}"]`)!
/** Die Zugliste als Text: „1.e4e5 2.Nf3" -- die Figuren lesen sich über ihre Beschriftung. */
const zugliste = () => {
  const liste = screen.queryByRole('list', { name: 'Züge' })
  if (!liste) return ''
  return [...liste.querySelectorAll('li')]
    .map(
      (li, i) =>
        `${i + 1}.` +
        [...li.querySelectorAll('[aria-label]')].map((z) => z.getAttribute('aria-label')).join(''),
    )
    .join('')
}

async function zieh(von: string, nach: string) {
  await userEvent.click(feld(von))
  await userEvent.click(feld(nach))
}

/** Bis der Computer geantwortet hat: Man ist wieder dran. */
const computerHatGezogen = () => screen.findByText(/Du bist am Zug/, {}, { timeout: 4000 })

beforeEach(() => {
  localStorage.clear()
  gebucht.mockReset()
  gebucht.mockResolvedValue({ punkte: 10, xp: 2, ausgang: 'niederlage', bestwert: false })
})

describe('Schach gegen den Computer', () => {
  it('zieht, der Computer antwortet, und Zurück nimmt beide Züge zurück', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Leicht' }))
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))

    await userEvent.click(feld('e2'))
    // Die Ziele des Bauern sind markiert, und nur die.
    expect(feld('e3').className).toMatch(/ziel/)
    expect(feld('e4').className).toMatch(/ziel/)
    expect(feld('e5').className).not.toMatch(/ziel/)
    await userEvent.click(feld('e4'))

    expect(screen.getByText('Der Computer überlegt …')).toBeInTheDocument()
    // Solange er überlegt, nimmt das Brett nichts an und Zurück geht nicht.
    expect(feld('d2')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zug zurück' })).toBeDisabled()

    await computerHatGezogen()
    expect(zugliste()).toMatch(/^1\.e4\S+$/)

    // Gespeichert sind die Züge -- beide.
    const gespeichert = JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!)
    expect(gespeichert.zuege).toHaveLength(2)
    expect(gespeichert.stufe).toBe('leicht')

    await userEvent.click(screen.getByRole('button', { name: 'Zug zurück' }))
    expect(screen.getByText('Noch kein Zug gespielt.')).toBeInTheDocument()
    expect(feld('e2').querySelector('svg')).not.toBeNull()
  })

  it('ein fremdes oder leeres Feld wählt nichts aus', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    await userEvent.click(feld('e7'))
    expect(feld('e7').getAttribute('aria-selected')).toBe('false')
    await userEvent.click(feld('e4'))
    expect(zugliste()).toBe('')
    // Zweimal dieselbe Figur: Auswahl wieder weg.
    await userEvent.click(feld('g1'))
    expect(feld('g1').getAttribute('aria-selected')).toBe('true')
    await userEvent.click(feld('g1'))
    expect(feld('g1').getAttribute('aria-selected')).toBe('false')
  })

  it('als Schwarz steht Schwarz unten, und der Computer fängt an', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Schwarz' }))
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    const felder = [...document.querySelectorAll('[data-feld]')].map((f) =>
      f.getAttribute('data-feld'),
    )
    expect(felder[0]).toBe('h1')
    expect(felder.at(-1)).toBe('a8')
    await computerHatGezogen()
    expect(zugliste()).toMatch(/^1\.\S+$/)
    // Nur ein Zug gespielt, und der war vom Computer: Zurück gibt es nicht.
    expect(screen.getByRole('button', { name: 'Zug zurück' })).toBeDisabled()
  })

  it('setzt eine gespeicherte Partie fort und fragt bei der Umwandlung nach der Figur', async () => {
    // 1.a4 b5 2.axb5 a6 3.bxa6 Bb7 4.axb7 Nc6 -- Weiß wandelt auf b8 oder a8 um.
    const zuege = ['a2a4', 'b7b5', 'a4b5', 'a7a6', 'b5a6', 'c8b7', 'a6b7', 'b8c6']
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({ stufe: 'mittel', farbe: 'w', zuege, seed: 7, partieId: 'p1' }),
    )
    zeige()
    await userEvent.click(
      screen.getByRole('button', { name: /Partie fortsetzen – Mittel, 8 Züge/ }),
    )
    await zieh('b7', 'b8')

    const dialog = screen.getByRole('dialog', { name: 'Der Bauer wird zu …' })
    expect(zugliste()).not.toMatch(/b8/)
    await userEvent.click(screen.getByRole('button', { name: 'Springer (Weiß)' }))
    expect(dialog).not.toBeInTheDocument()
    expect(zugliste()).toMatch(/5\.b8=N/)
    await computerHatGezogen()
    expect(JSON.parse(localStorage.getItem(SPEICHER_SCHLUESSEL)!).zuege[8]).toBe('b7b8n')
  })

  it('Rochade: König antippen, dann den Turm -- König und Turm tauschen die Seiten', async () => {
    // 1.e4 e5 2.Sf3 Sc6 3.Lc4 Lc5 -- Weiß darf kurz rochieren.
    const zuege = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({ stufe: 'leicht', farbe: 'w', zuege, seed: 3, partieId: 'p2' }),
    )
    zeige()
    await userEvent.click(screen.getByRole('button', { name: /Partie fortsetzen/ }))
    await userEvent.click(feld('e1'))
    // Der Turm ist als Ziel markiert, und ein Hinweis erklärt den Sonderzug.
    expect(feld('h1').className).toMatch(/rochadeZiel/)
    expect(screen.getByText(/Rochade: Tippe auf den grün umrandeten Turm/)).toBeInTheDocument()
    await userEvent.click(feld('h1'))
    expect(zugliste()).toMatch(/4\.O-O/)
    expect(feld('g1').getAttribute('aria-label')).toBe('g1: König (Weiß)')
    expect(feld('f1').getAttribute('aria-label')).toBe('f1: Turm (Weiß)')
    await computerHatGezogen()
  })

  it('ein Zug lässt sich auch mit dem Finger ziehen', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    // jsdom kennt keine Maße: Das Brett ist hier 400 Pixel groß, ein Feld 50.
    const brett = screen.getByRole('grid', { name: 'Schachbrett' })
    brett.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 }) as DOMRect
    const punkt = (linie: number, reihe: number) => ({
      clientX: linie * 50 + 25,
      clientY: (7 - reihe) * 50 + 25,
      button: 0,
      pointerId: 1,
    })
    fireEvent.pointerDown(feld('g1'), punkt(6, 0))
    fireEvent.pointerMove(brett, punkt(6, 1))
    fireEvent.pointerMove(brett, punkt(5, 2))
    fireEvent.pointerUp(brett, punkt(5, 2))
    expect(zugliste()).toMatch(/^1\.Nf3/)
    expect(feld('f3').getAttribute('aria-label')).toBe('f3: Springer (Weiß)')
    await computerHatGezogen()
  })

  it('verwirft einen Spielstand, der sich nicht nachspielen lässt', () => {
    localStorage.setItem(
      SPEICHER_SCHLUESSEL,
      JSON.stringify({ stufe: 'mittel', farbe: 'w', zuege: ['e2e5'], seed: 7, partieId: 'p1' }),
    )
    zeige()
    expect(screen.queryByRole('button', { name: /fortsetzen/ })).not.toBeInTheDocument()
  })

  it('Aufgeben beendet die Partie, bucht sie einmal und räumt den Spielstand weg', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    await userEvent.click(screen.getByRole('button', { name: 'Nein' }))
    expect(screen.queryByText('Verloren')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }))
    expect(screen.getByText('Verloren')).toBeInTheDocument()
    expect(await screen.findByText('+10 Punkte · +2 XP')).toBeInTheDocument()
    expect(gebucht).toHaveBeenCalledTimes(1)
    expect(gebucht.mock.calls[0]!.slice(1)).toEqual([
      { art: 'aufgabe', sieger: 'b' },
      'w',
      'mittel',
      0,
    ])
    expect(localStorage.getItem(SPEICHER_SCHLUESSEL)).toBeNull()
  })

  it('ein Zug, der nach dem Aufgeben noch ankommt, landet nicht auf dem Brett', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    await zieh('e2', 'e4')
    expect(screen.getByText('Der Computer überlegt …')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }))
    await act(() => new Promise((r) => setTimeout(r, 900)))
    expect(zugliste()).toBe('1.e4')
    // Nach dem Ende ist niemand mehr am Zug -- auch der Computer nicht.
    expect(document.querySelector('[class*="amZug"]')).toBeNull()
  })

  it('nach dem Ende fängt „Neue Partie" frisch an', async () => {
    zeige()
    await userEvent.click(screen.getByRole('button', { name: 'Partie starten' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aufgeben' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ja, aufgeben' }))
    await userEvent.click(screen.getByRole('button', { name: 'Neue Partie' }))
    await waitFor(() => expect(screen.queryByText('Verloren')).not.toBeInTheDocument())
    expect(screen.getByText('Du bist am Zug')).toBeInTheDocument()
  })
})
