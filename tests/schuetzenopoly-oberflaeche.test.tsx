/**
 * Die Oberfläche beim Zug: Wer entscheidet, und wem gehört was?
 *
 * Thomas am 23.09.2026: "auch bei KI-Gegner Karte hochkommen lassen und
 * Animation, welcher Button gedrückt wird."
 *
 * Vorher entschied der Rechner unsichtbar: Zwischen zwei Bildern gehörte ihm
 * plötzlich ein Feld, und nur das Protokoll verriet hinterher, welches. Der
 * Test spielt einen echten Zug des Rechners durch die Seite und hält die
 * Reihenfolge fest -- Karte, sichtbarer Knopfdruck, dann erst der Zug.
 *
 * Gespielt wird über einen vorbereiteten Spielstand: Der Rechner ist am Zug
 * und läuft auf ein bestimmtes freies Grundstück. Damit hängt der Test nicht
 * am Würfel.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import {
  BRETT,
  erstellePartie,
  figur,
  speicherePartie,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import { Brett } from '@/pages/play/schuetzenopoly/Brett'
import { SchuetzenopolyPage } from '@/pages/play/SchuetzenopolyPage'

// Töne brauchen einen AudioContext, den jsdom nicht hat.
vi.mock('@/services/sound', () => ({
  spiele: vi.fn(),
  vibriere: vi.fn(),
  tonAn: () => false,
  setzeTon: vi.fn(),
}))
vi.mock('@/services/spielername', () => ({ spielerNameOderDu: async () => 'Du' }))

/** Ein freies Grundstück, auf das der Rechner zuläuft. */
const ziel = BRETT.find((f) => f.typ === 'grundstueck')!

function standAufDemWeg(wer: 'ki' | 'mensch'): SpielZustand {
  const frisch = erstellePartie({
    spieler:
      wer === 'ki'
        ? [
            { name: 'Rechner', typ: 'ki', kiStufe: 'normal' },
            { name: 'Du', typ: 'mensch' },
          ]
        : [
            { name: 'Du', typ: 'mensch' },
            { name: 'Rechner', typ: 'ki', kiStufe: 'normal' },
          ],
    rundenLimit: 20,
  })
  // Der Zugspieler steht ein Feld vor dem Ziel und ist mitten in der Bewegung:
  // So läuft die Seite denselben Weg wie im Spiel, nur ohne Würfelglück.
  return {
    ...frisch,
    phase: 'bewegen',
    amZug: 0,
    wuerfel: [1, 1],
    zielPosition: ziel.position,
    spieler: frisch.spieler.map((s, i) =>
      i === 0 ? { ...s, position: (ziel.position + 39) % 40 } : s,
    ),
  }
}

/** jsdom schreibt Farben als rgb() zurück, nicht als Hexwert. */
function alsRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

function zeige() {
  return render(
    <MemoryRouter>
      <SchuetzenopolyPage />
    </MemoryRouter>,
  )
}

async function starteMit(wer: 'ki' | 'mensch') {
  await speicherePartie(standAufDemWeg(wer))
  zeige()
  await userEvent.click(await screen.findByRole('button', { name: /Partie fortsetzen/ }))
}

describe('Der Zug des Rechners', () => {
  it('legt die Karte vor, drückt sichtbar einen Knopf und räumt sie wieder weg', async () => {
    await starteMit('ki')

    // 1. Die Karte kommt hoch -- dieselbe wie beim Menschen.
    const karte = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(karte).toHaveTextContent(ziel.name.split(' ')[0]!)
    // Und sie sagt, wer hier entscheidet.
    expect(screen.getByText(/Rechner entscheidet/)).toBeInTheDocument()

    // 2. Seine Knöpfe sind zu sehen, aber gesperrt: zusehen, nicht mitentscheiden.
    const kaufen = screen.getByRole('button', { name: /Kaufen/ })
    expect(kaufen).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Stehen lassen' })).toBeDisabled()

    // 3. Genau einer wird gedrückt -- und man sieht es.
    await waitFor(
      () => {
        expect(document.querySelectorAll('[data-gedrueckt="ja"]')).toHaveLength(1)
      },
      { timeout: 4000 },
    )

    // 4. Erst danach geht die Karte zurück und der Zug greift.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 4000 })
  })
})

describe('Der eigene Knopfdruck', () => {
  it('bleibt sichtbar, bis die Karte zurückgeschwungen ist', async () => {
    await starteMit('mensch')

    // Die Karte kommt beim Landen von selbst -- hier ohne fremden Akteur.
    await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(screen.queryByText(/entscheidet/)).toBeNull()

    const kaufen = screen.getByRole('button', { name: /Kaufen/ })
    expect(kaufen).toBeEnabled()
    await userEvent.click(kaufen)

    // Erst der sichtbare Druck …
    expect(kaufen).toHaveAttribute('data-gedrueckt', 'ja')
    // … dann geht die Karte zurück, und erst danach greift der Kauf.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 4000 })
    expect(await screen.findByText(new RegExp(`kauft ${ziel.name}`))).toBeInTheDocument()
  })
})

describe('Wem gehört das Feld', () => {
  it('trägt das Farbband des Besitzers auf dem Brett', () => {
    const zustand = standAufDemWeg('mensch')
    const id = ziel.grundstueckId!
    const besitzer = zustand.spieler[1]!
    const besitz = { ...zustand.besitz, [id]: { ...zustand.besitz[id]!, besitzerId: besitzer.id } }

    render(
      <Brett
        besitz={besitz}
        spieler={zustand.spieler}
        aktiverSpielerId={zustand.spieler[0]!.id}
        hervorgehoben={null}
        onFeldTippen={() => {}}
      />,
    )

    // Das Feld sagt, wem es gehört -- auch für alle, die das Brett nicht sehen.
    const feld = screen.getByRole('button', { name: new RegExp(`${ziel.name}, gehört Rechner`) })
    const band = feld.querySelector<HTMLElement>(`[title="${besitzer.name}"]`)
    expect(band).not.toBeNull()
    // In der Farbe der Figur -- derselben wie in der Mitspielerleiste.
    expect(band!.style.background).toBe(alsRgb(figur(besitzer.figurId).farbe))
    // Ein freies Feld trägt keins.
    const freie = screen.getAllByRole('button').filter((b) => b.querySelector('[title]') === null)
    expect(freie.length).toBeGreaterThan(30)
  })
})
