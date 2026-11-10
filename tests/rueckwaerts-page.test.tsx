/**
 * Rückwärts – die Seite, mit einer nachgestellten Tonanlage.
 *
 * jsdom hat weder Mikrofon noch Lautsprecher. Die Anlage hier liefert
 * vorbereitete Aufnahmen und merkt sich, was abgespielt wurde -- so lässt
 * sich prüfen, was ein Test im echten Browser nicht sehen kann: welche
 * Zahlenreihen wo liegen, und ob sie am Ende einer Runde leer sind.
 * (Dass Mikrofon und Lautsprecher selbst tun, was sie sollen, ist im
 * echten Chromium nachgemessen; siehe docs/design/rueckwaerts/.)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SprachProvider } from '@/i18n/SprachProvider'
import type { Klang } from '@/games/rueckwaerts'

const RATE = 8000

/** Steigender Ton zwischen zwei Stücken Stille -- wie eine Aufnahme vom Mikrofon. */
function aufnahme(): Klang {
  const samples = new Float32Array(RATE * 2)
  let phase = 0
  const von = RATE * 0.5
  const n = RATE * 0.8
  for (let i = 0; i < n; i++) {
    phase += (2 * Math.PI * (150 + 650 * (i / n))) / RATE
    samples[von + i] = 0.5 * Math.sin(phase)
  }
  return { samples, rate: RATE }
}

const still = (d: Float32Array) => d.every((v) => v === 0)

/** Steigt der Ton, liegen hinten mehr Nulldurchgänge als vorn. */
function steigt(d: Float32Array): boolean {
  const mitte = Math.floor(d.length / 2)
  const zaehle = (a: number, b: number) => {
    let n = 0
    for (let i = a + 1; i < b; i++) if (d[i - 1]! < 0 !== d[i]! < 0) n++
    return n
  }
  return zaehle(mitte, d.length) > zaehle(0, mitte)
}

const anlage = vi.hoisted(() => ({
  /** Was `stopp()` herausgegeben hat -- die Rohfassungen. */
  roh: [] as Float32Array[],
  /** Die Reihen, die zum Abspielen übergeben wurden (dieselben Objekte, keine Kopien). */
  uebergeben: [] as Float32Array[],
  /** Was dabei zu hören war -- Kopien vom Augenblick des Abspielens. */
  gehoert: [] as Float32Array[],
  abgebrochen: 0,
  geschlossen: 0,
  wiedergabeGestoppt: 0,
  beiVoll: null as null | (() => void),
  beiPegel: null as null | ((rms: number) => void),
  /** Was die nächste Aufnahme liefert; ein Fehler heißt: Mikrofon nicht zu haben. */
  naechste: null as null | (() => Klang),
  fehler: null as null | string,
}))

vi.mock('@/games/rueckwaerts/ton', () => {
  class TonFehler extends Error {
    readonly grund: string
    constructor(grund: string) {
      super(grund)
      this.grund = grund
    }
  }
  return {
    TonFehler,
    erstelleTonanlage: () => ({
      nimmAuf: async (o: { beiVoll: () => void; beiPegel?: (rms: number) => void }) => {
        if (anlage.fehler) throw new TonFehler(anlage.fehler)
        anlage.beiVoll = o.beiVoll
        anlage.beiPegel = o.beiPegel ?? null
        return {
          stopp: () => {
            const k = anlage.naechste!()
            anlage.roh.push(k.samples)
            return k
          },
          abbrechen: () => {
            anlage.abgebrochen++
          },
        }
      },
      spiele: (k: Klang) => {
        anlage.uebergeben.push(k.samples)
        anlage.gehoert.push(k.samples.slice())
        return {
          fertig: new Promise<void>(() => {}),
          stopp: () => {
            anlage.wiedergabeGestoppt++
          },
        }
      },
      schliessen: () => {
        anlage.geschlossen++
      },
    }),
  }
})

import { RueckwaertsPage } from '@/pages/play/RueckwaertsPage'

function zeige(sprache: 'de' | 'en' = 'de') {
  localStorage.setItem('te-sprache', sprache)
  return render(
    <SprachProvider>
      <MemoryRouter>
        <RueckwaertsPage />
      </MemoryRouter>
    </SprachProvider>,
  )
}

const knopf = (name: RegExp | string) => screen.getByRole('button', { name })

async function nimmAuf(start: RegExp) {
  const user = userEvent.setup()
  await user.click(knopf(start))
  await user.click(await screen.findByRole('button', { name: /Stopp|Stop/ }))
}

/** Spielt eine Runde bis zur Auflösung. */
async function bisZurAufloesung() {
  const user = userEvent.setup()
  await user.click(knopf('Losspielen'))
  await nimmAuf(/Aufnahme starten/)
  await nimmAuf(/Nachsprechen aufnehmen/)
  await user.click(knopf('Auflösen'))
}

beforeEach(() => {
  anlage.roh.length = 0
  anlage.uebergeben.length = 0
  anlage.gehoert.length = 0
  anlage.abgebrochen = 0
  anlage.geschlossen = 0
  anlage.wiedergabeGestoppt = 0
  anlage.beiVoll = null
  anlage.beiPegel = null
  anlage.naechste = aufnahme
  anlage.fehler = null
})

describe('Rückwärts: eine Runde', () => {
  it('erklärt das Spiel und sagt, was mit den Aufnahmen geschieht', () => {
    zeige()
    expect(screen.getByRole('heading', { name: /Rückwärts/ })).toBeInTheDocument()
    expect(screen.getByText(/spricht heimlich ein Wort ein/)).toBeInTheDocument()
    expect(
      screen.getByText(/werden nirgends gespeichert und nach jeder Runde gelöscht/),
    ).toBeInTheDocument()
  })

  it('führt vom Einsprechen über das Nachsprechen und Raten zur Auflösung und weiter', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    expect(screen.getByText('Thomas spricht ein Wort ein')).toBeInTheDocument()

    await nimmAuf(/Aufnahme starten/)
    expect(screen.getByText('Marina hört zu und spricht nach')).toBeInTheDocument()

    await nimmAuf(/Nachsprechen aufnehmen/)
    expect(screen.getByText('Jetzt raten: Phillip')).toBeInTheDocument()

    await user.click(knopf('Auflösen'))
    expect(screen.getByText('Thomas verrät das Wort')).toBeInTheDocument()

    await user.click(knopf(/Ja/))
    expect(screen.getByText('Runde 2')).toBeInTheDocument()
    expect(screen.getByText('Marina spricht ein Wort ein')).toBeInTheDocument()
  })

  it('wer nachspricht, bekommt genau einen Knopf -- und der spielt das Wort rückwärts', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)

    // Kein Weg zum Wort, wie es eingesprochen wurde.
    expect(screen.queryByRole('button', { name: /Das Wort/ })).toBeNull()
    await user.click(knopf(/Rückwärts anhören/))
    expect(anlage.gehoert).toHaveLength(1)
    // Eingesprochen wurde ein steigender Ton; rückwärts fällt er.
    expect(steigt(anlage.gehoert[0]!)).toBe(false)
    // Gestutzt: Von zwei Sekunden Aufnahme bleibt das Wort mit seinem Rand.
    expect(anlage.gehoert[0]!.length / RATE).toBeLessThan(1.2)
  })

  it('wer rät, bekommt die Nachahmung rückwärts -- und sonst nichts', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    await nimmAuf(/Nachsprechen aufnehmen/)

    expect(screen.queryByRole('button', { name: /Das Wort|Nachahmung/ })).toBeNull()
    await user.click(knopf(/Anhören/))
    expect(anlage.gehoert).toHaveLength(1)
    expect(steigt(anlage.gehoert[0]!)).toBe(false)
  })

  it('die Auflösung spielt alle vier Fassungen, jede richtig herum', async () => {
    const user = userEvent.setup()
    zeige()
    await bisZurAufloesung()
    await user.click(knopf('▶ Das Wort'))
    await user.click(knopf('▶ Das Wort rückwärts'))
    await user.click(knopf('▶ Die Nachahmung'))
    await user.click(knopf('▶ Die Nachahmung rückwärts'))
    expect(anlage.gehoert.map(steigt)).toEqual([true, false, true, false])
  })

  it('während einer Aufnahme lässt sich nichts abspielen', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    await user.click(knopf(/Nachsprechen aufnehmen/))
    await screen.findByText('Aufnahme läuft …')
    expect(knopf(/Rückwärts anhören/)).toBeDisabled()
    expect(knopf('Wort neu einsprechen')).toBeDisabled()
  })

  it('stoppt von selbst, wenn die Höchstlänge erreicht ist', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await user.click(knopf(/Aufnahme starten/))
    await screen.findByText('Aufnahme läuft …')
    anlage.beiVoll!()
    await waitFor(() =>
      expect(screen.getByText('Marina hört zu und spricht nach')).toBeInTheDocument(),
    )
  })

  it('zählt die Runden und zeigt am Ende den Stand', async () => {
    const user = userEvent.setup()
    zeige()
    await bisZurAufloesung()
    await user.click(knopf(/Ja/))
    await user.click(knopf('Beenden'))
    expect(screen.getByText('1 von 1 erraten')).toBeInTheDocument()
    expect(screen.getByText('Alle Aufnahmen sind gelöscht.')).toBeInTheDocument()
  })
})

describe('Rückwärts: wenn die Aufnahme nicht klappt', () => {
  it('sagt, wenn vom Mikrofon gar nichts kommt, und bleibt beim Einsprechen', async () => {
    const user = userEvent.setup()
    anlage.naechste = () => ({ samples: new Float32Array(RATE), rate: RATE })
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    expect(screen.getByRole('alert')).toHaveTextContent('Vom Mikrofon kommt kein Ton')
    expect(screen.getByText('Thomas spricht ein Wort ein')).toBeInTheDocument()
    expect(knopf(/Aufnahme starten/)).toBeEnabled()
  })

  it('sagt, wenn nur Rauschen zu hören war', async () => {
    const user = userEvent.setup()
    anlage.naechste = () => {
      const samples = new Float32Array(RATE)
      let saat = 99
      for (let i = 0; i < samples.length; i++) {
        saat = (saat * 1103515245 + 12345) & 0x7fffffff
        samples[i] = 0.004 * ((saat / 0x7fffffff) * 2 - 1)
      }
      return { samples, rate: RATE }
    }
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    expect(screen.getByRole('alert')).toHaveTextContent('Da war nur Rauschen zu hören')
    // Darunter steht, was gemessen wurde -- für die Fehlersuche aus der Ferne.
    expect(
      screen.getByText(
        /^Messwerte: 1[.,]0 s aufgenommen · Stimme 0[.,]002\d · Rauschen 0[.,]002\d$/,
      ),
    ).toBeInTheDocument()

    // Mit dem nächsten Versuch ist die Zeile wieder weg.
    anlage.naechste = aufnahme
    await nimmAuf(/Aufnahme starten/)
    expect(screen.queryByText(/Messwerte/)).toBeNull()
  })

  it('nimmt eine leise Stimme an und macht sie hörbar', async () => {
    const user = userEvent.setup()
    // Ein Handy, das nicht hochregelt: ein Hundertstel des vollen Ausschlags.
    anlage.naechste = () => {
      const k = aufnahme()
      for (let i = 0; i < k.samples.length; i++) k.samples[i] = k.samples[i]! * 0.02
      return k
    }
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Marina hört zu und spricht nach')).toBeInTheDocument()
    await user.click(knopf(/Rückwärts anhören/))
    const lautestes = anlage.gehoert[0]!.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    expect(lautestes).toBeGreaterThan(0.5)
  })

  it('zeigt während der Aufnahme, ob das Mikrofon etwas hört', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await user.click(knopf(/Aufnahme starten/))
    const anzeige = await screen.findByRole('meter', { name: 'Mikrofonpegel' })
    expect(anzeige).toHaveAttribute('aria-valuenow', '0')
    act(() => anlage.beiPegel!(0.01))
    expect(Number(anzeige.getAttribute('aria-valuenow'))).toBeGreaterThan(30)
    act(() => anlage.beiPegel!(0))
    expect(anzeige).toHaveAttribute('aria-valuenow', '0')
  })

  it('sagt, was zu tun ist, wenn das Mikrofon verweigert wird', async () => {
    const user = userEvent.setup()
    anlage.fehler = 'verweigert'
    zeige()
    await user.click(knopf('Losspielen'))
    await user.click(knopf(/Aufnahme starten/))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ohne Mikrofon geht dieses Spiel nicht',
    )
    expect(knopf(/Aufnahme starten/)).toBeEnabled()
  })

  it('lässt ein verunglücktes Wort neu einsprechen', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    await user.click(knopf('Wort neu einsprechen'))
    expect(screen.getByText('Thomas spricht ein Wort ein')).toBeInTheDocument()
  })
})

describe('Rückwärts: keine Aufnahme überlebt ihre Runde', () => {
  it('die Rohfassung vom Mikrofon ist gleich nach dem Stopp überschrieben', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    expect(anlage.roh).toHaveLength(1)
    expect(still(anlage.roh[0]!)).toBe(true)
  })

  it('auch dann, wenn die Aufnahme nicht gezählt hat', async () => {
    const user = userEvent.setup()
    // Ein Knacks: zu kurz für ein Wort, aber nicht still.
    anlage.naechste = () => {
      const samples = new Float32Array(RATE)
      samples.fill(0.5, 4000, 4300)
      return { samples, rate: RATE }
    }
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(still(anlage.roh[0]!)).toBe(true)
  })

  it('mit der nächsten Runde sind alle vier Fassungen überschrieben', async () => {
    const user = userEvent.setup()
    zeige()
    await bisZurAufloesung()
    for (const name of [
      '▶ Das Wort',
      '▶ Das Wort rückwärts',
      '▶ Die Nachahmung',
      '▶ Die Nachahmung rückwärts',
    ]) {
      await user.click(knopf(name))
    }
    expect(anlage.uebergeben).toHaveLength(4)
    expect(anlage.uebergeben.every((d) => !still(d))).toBe(true)

    await user.click(knopf(/Nein/))
    expect(anlage.uebergeben.every(still)).toBe(true)
    // Und die laufende Wiedergabe wurde vorher angehalten.
    expect(anlage.wiedergabeGestoppt).toBeGreaterThan(0)
  })

  it('beim Beenden mitten in der Runde ebenso', async () => {
    const user = userEvent.setup()
    zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    await user.click(knopf(/Rückwärts anhören/))
    await user.click(knopf('Beenden'))
    expect(anlage.uebergeben.every(still)).toBe(true)
    expect(screen.getByText('Keine Runde zu Ende gespielt.')).toBeInTheDocument()
  })

  it('wer die Seite mitten in der Runde verlässt, lässt nichts zurück', async () => {
    const user = userEvent.setup()
    const { unmount } = zeige()
    await user.click(knopf('Losspielen'))
    await nimmAuf(/Aufnahme starten/)
    await user.click(knopf(/Rückwärts anhören/))
    expect(still(anlage.uebergeben[0]!)).toBe(false)

    unmount()
    expect(still(anlage.uebergeben[0]!)).toBe(true)
    expect(anlage.geschlossen).toBe(1)
  })

  it('wer die Seite während einer Aufnahme verlässt, gibt das Mikrofon frei', async () => {
    const user = userEvent.setup()
    const { unmount } = zeige()
    await user.click(knopf('Losspielen'))
    await user.click(knopf(/Aufnahme starten/))
    await screen.findByText('Aufnahme läuft …')
    unmount()
    expect(anlage.abgebrochen).toBe(1)
  })
})

describe('Rückwärts auf Englisch', () => {
  it('zeigt die ganze Runde englisch', async () => {
    const user = userEvent.setup()
    zeige('en')
    expect(screen.getByRole('heading', { name: /Backwards/ })).toBeInTheDocument()
    expect(screen.getByText(/deleted after every round/)).toBeInTheDocument()
    await user.click(knopf('Start playing'))
    expect(screen.getByText('Thomas records a word')).toBeInTheDocument()
    await nimmAuf(/Start recording/)
    expect(screen.getByText('Marina listens and copies')).toBeInTheDocument()
    await nimmAuf(/Record your copy/)
    expect(screen.getByText('Time to guess: Phillip')).toBeInTheDocument()
    await user.click(knopf('Reveal'))
    expect(knopf('▶ The copy backwards')).toBeInTheDocument()
  })
})
