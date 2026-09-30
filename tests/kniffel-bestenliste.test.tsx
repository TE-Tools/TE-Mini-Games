/**
 * Die Kniffel-Bestenliste: Steht oben, wer oben stehen soll?
 *
 * Thomas am 30.09.2026: "Kniffel erweitern mit Rangliste, wer viele Spiele
 * gewonnen hat, und eine Rangliste, wer mit den meisten Punkten gewonnen
 * hat."
 *
 * Zwei Listen auf denselben Zahlen -- und genau da entsteht der Fehler, den
 * niemand bemerkt: Wenn die eine anders zählt als die andere. Deshalb wird
 * hier beides festgehalten, die Reihenfolge und das, was in der Zeile steht.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { sichtbar, sortiere } from '@/pages/play/kniffel/bestenlisteSortierung'
import type { KniffelBestenEintrag } from '@/services/kniffelOnline'

const daten = vi.hoisted(() => ({ liste: [] as KniffelBestenEintrag[] }))
vi.mock('@/services/kniffelOnline', () => ({
  fetchKniffelBestenliste: vi.fn(async () => daten.liste),
}))

const { Bestenliste } = await import('@/pages/play/kniffel/Bestenliste')

function eintrag(over: Partial<KniffelBestenEintrag>): KniffelBestenEintrag {
  return {
    username: 'wer',
    siege: 0,
    partien: 0,
    bester_sieg: 0,
    bestes_spiel: 0,
    schnitt: 0,
    zuletzt: null,
    ...over,
  }
}

/*
 * Drei Spieler, absichtlich gegenläufig:
 *
 *   vielspieler  viele Siege, aber keiner davon hoch
 *   glückspilz   ein einziger Sieg, dafür der höchste
 *   ausdauernd   gleich viele Siege wie vielspieler, aus weniger Partien
 */
const VIELSPIELER = eintrag({ username: 'vielspieler', siege: 9, partien: 30, bester_sieg: 210 })
const GLUECKSPILZ = eintrag({ username: 'glueckspilz', siege: 1, partien: 2, bester_sieg: 412 })
const AUSDAUERND = eintrag({ username: 'ausdauernd', siege: 9, partien: 12, bester_sieg: 260 })
const NEULING = eintrag({ username: 'neuling', siege: 0, partien: 4, bester_sieg: 0 })

describe('Die Reihenfolge', () => {
  it('stellt nach Siegen den nach vorn, der oft gewinnt', () => {
    const reihe = sortiere([GLUECKSPILZ, VIELSPIELER, AUSDAUERND], 'siege')
    // Neun Siege schlagen einen -- und bei Gleichstand gewinnt, wer dafür
    // weniger Partien gebraucht hat.
    expect(reihe.map((e) => e.username)).toEqual(['ausdauernd', 'vielspieler', 'glueckspilz'])
  })

  it('stellt nach Punkten den nach vorn, der hoch gewinnt', () => {
    const reihe = sortiere([VIELSPIELER, AUSDAUERND, GLUECKSPILZ], 'punkte')
    expect(reihe.map((e) => e.username)).toEqual(['glueckspilz', 'ausdauernd', 'vielspieler'])
  })

  it('lässt in der Punkteliste weg, wer noch nie gewonnen hat', () => {
    // Eine Null zwischen lauter Siegpunktzahlen liest sich wie ein Fehler.
    expect(sichtbar([VIELSPIELER, NEULING], 'punkte').map((e) => e.username)).toEqual([
      'vielspieler',
    ])
    // In der Siegerliste steht er weiter -- dort ist die Null die Auskunft.
    expect(sichtbar([VIELSPIELER, NEULING], 'siege')).toHaveLength(2)
  })

  it('fasst die übergebene Liste nicht an', () => {
    const original = [GLUECKSPILZ, VIELSPIELER]
    sortiere(original, 'siege')
    expect(original.map((e) => e.username)).toEqual(['glueckspilz', 'vielspieler'])
  })
})

describe('Die Anzeige', () => {
  beforeEach(() => {
    daten.liste = [VIELSPIELER, GLUECKSPILZ, AUSDAUERND]
  })

  it('zeigt beide Listen und schaltet zwischen ihnen um', async () => {
    render(<Bestenliste />)

    const liste = await screen.findByRole('list')
    expect(within(liste).getAllByRole('listitem')[0]).toHaveTextContent('ausdauernd')
    // In der Siegerliste steht, wie viele Siege aus wie vielen Partien.
    expect(liste).toHaveTextContent('9')
    expect(liste).toHaveTextContent('Siege aus 12')

    await userEvent.click(screen.getByRole('tab', { name: 'Höchster Sieg' }))
    const nachher = screen.getByRole('list')
    expect(within(nachher).getAllByRole('listitem')[0]).toHaveTextContent('glueckspilz')
    expect(nachher).toHaveTextContent('412')
    expect(nachher).toHaveTextContent('Punkte im Sieg')
  })

  it('hebt die eigene Zeile hervor – und nur die', async () => {
    render(<Bestenliste eigenerName="glueckspilz" />)
    const meine = (await screen.findByText('glueckspilz')).closest('li')
    const fremde = screen.getByText('ausdauernd').closest('li')
    // Die Klassennamen kommen gehasht aus dem CSS-Modul; erkennbar bleibt
    // der Teil, den wir vergeben haben.
    expect(meine?.className).toMatch(/ich/)
    expect(fremde?.className).not.toMatch(/ich/)
  })

  it('sagt es, wenn noch niemand gespielt hat', async () => {
    daten.liste = []
    render(<Bestenliste />)
    expect(await screen.findByText(/Noch keine beendete Online-Partie/)).toBeInTheDocument()
  })

  it('nennt, was gezählt wird', async () => {
    render(<Bestenliste />)
    // Ohne diesen Satz fragt man sich, warum die Partien gegen den Rechner fehlen.
    expect(await screen.findByText(/beendete Online-Partien/)).toBeInTheDocument()
  })
})
