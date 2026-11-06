/**
 * Schützenopoly auf Englisch.
 *
 * Zwei Dinge werden hier geprüft: dass die Oberfläche wirklich Englisch
 * spricht, wenn Englisch gewählt ist -- und dass die Grundstücke dabei
 * deutsch bleiben, weil sie für echte Feste stehen. Dazu, dass die deutsche
 * Fassung des Protokolls im Wörterbuch Wort für Wort dieselbe ist wie die
 * Zeile, die die Engine schreibt. Sonst sähe ein deutscher Spieler auf
 * einmal andere Sätze als vorher.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import {
  BRETT,
  erstellePartie,
  grundstueck,
  kiSchritt,
  type LogEintrag,
  type SpielZustand,
} from '@/games/schuetzenopoly'
import { SprachProvider } from '@/i18n/SprachProvider'
import { de } from '@/i18n/texte/de'
import { FeldKarte } from '@/pages/play/schuetzenopoly/FeldKarte'
import { Handlungsleiste, Protokoll } from '@/pages/play/schuetzenopoly/Tisch'
import { protokollZeile } from '@/pages/play/schuetzenopoly/texte'

function aufEnglisch(ui: ReactElement) {
  localStorage.setItem('te-sprache', 'en')
  return render(<SprachProvider>{ui}</SprachProvider>)
}

function partie(): SpielZustand {
  return erstellePartie({
    seed: 7,
    spieler: [
      { name: 'Anna', typ: 'mensch' },
      { name: 'Ben', typ: 'ki', kiStufe: 'normal' },
    ],
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe('Schützenopoly auf Englisch', () => {
  it('zeigt die Besitzkarte englisch, das Fest aber unter seinem deutschen Namen', () => {
    const feld = BRETT.find((f) => f.typ === 'grundstueck')!
    const g = grundstueck(feld.grundstueckId!)!
    aufEnglisch(<FeldKarte feld={feld} zustand={partie()} onSchliessen={() => {}} />)

    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Plot')).toBeInTheDocument()
    expect(screen.getByText('Still free')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    // Die Stadt bleibt, wie sie heißt.
    expect(screen.getByRole('heading', { name: g.stadt })).toBeInTheDocument()
    expect(screen.queryByText('Standgeld')).toBeNull()
  })

  it('übersetzt auch die Felder, die kein Grundstück sind', () => {
    const strafbank = BRETT.find((f) => f.typ === 'strafbank')!
    aufEnglisch(<FeldKarte feld={strafbank} zustand={partie()} onSchliessen={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Penalty Bench' })).toHaveTextContent(/Just visiting/)
  })

  it('spricht in der Handlungsleiste und im Protokoll Englisch', () => {
    const zustand = partie()
    aufEnglisch(
      <>
        <Protokoll zustand={zustand} />
        <Handlungsleiste zustand={zustand} darfZiehen onAktion={() => {}} />
      </>,
    )
    expect(screen.getByText('The festival begins. Good luck!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Roll/ })).toBeInTheDocument()
    expect(screen.queryByText(/Würfeln/)).toBeNull()
  })

  it('sagt auf Deutsch im Protokoll Wort für Wort, was die Engine schreibt', () => {
    // Zwei Rechner spielen eine ganze Partie; jede Zeile wird verglichen.
    let s = erstellePartie({
      seed: 4711,
      spieler: [
        { name: 'Leicht', typ: 'ki', kiStufe: 'leicht' },
        { name: 'Normal', typ: 'ki', kiStufe: 'normal' },
        { name: 'Schwer', typ: 'ki', kiStufe: 'schwer' },
      ],
    })
    const gesehen = new Set<LogEintrag>(s.protokoll)
    for (let i = 0; i < 8000 && s.phase !== 'ende'; i++) {
      s = kiSchritt(s).state
      for (const eintrag of s.protokoll) gesehen.add(eintrag)
    }
    expect(s.phase).toBe('ende')

    // Die Seite setzt Tausenderpunkte, die Engine nicht -- das ist der einzige Unterschied.
    const ohnePunkte = (text: string) => text.replace(/(\d)\.(\d{3})/g, '$1$2')
    const arten = new Set<string>()
    for (const eintrag of gesehen) {
      expect(eintrag.meldung).toBeDefined()
      arten.add(eintrag.meldung!.art)
      expect(ohnePunkte(protokollZeile(de, 'de', eintrag))).toBe(ohnePunkte(eintrag.text))
    }
    // Genug verschiedene Zeilen, damit der Vergleich etwas sagt.
    expect(arten.size).toBeGreaterThan(10)
  })
})
