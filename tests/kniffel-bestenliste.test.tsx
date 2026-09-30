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
import { sichtbar, sortiere, werte } from '@/pages/play/kniffel/bestenlisteSortierung'
import type { KniffelBestenEintrag } from '@/services/kniffelOnline'

const daten = vi.hoisted(() => ({
  liste: [] as KniffelBestenEintrag[],
  meinName: null as string | null,
}))
vi.mock('@/services/kniffelOnline', () => ({
  isKniffelOnlineAvailable: true,
  fetchKniffelBestenliste: vi.fn(async () => daten.liste),
  fetchMeinBestenlistenName: vi.fn(async () => daten.meinName),
}))

const { Bestenliste } = await import('@/pages/play/kniffel/Bestenliste')

function eintrag(over: Partial<KniffelBestenEintrag>): KniffelBestenEintrag {
  const siege = over.siege ?? 0
  const partien = over.partien ?? 0
  const bester = over.bester_sieg ?? 0
  return {
    username: 'wer',
    siege,
    partien,
    bester_sieg: bester,
    bestes_spiel: bester,
    schnitt: 0,
    zuletzt: null,
    // Ohne eigene Angabe kommt alles aus Online-Partien -- so sah jede
    // Zeile vor Migration 022 aus.
    siege_online: siege,
    partien_online: partien,
    bester_sieg_online: bester,
    ...over,
  }
}

/*
 * Vier Spieler, absichtlich gegenläufig:
 *
 *   vielspieler  viele Siege, aber keiner davon hoch
 *   glückspilz   ein einziger Sieg, dafür der höchste -- und der fiel
 *                gegen den Rechner, also nur in der Gesamtliste
 *   ausdauernd   gleich viele Siege wie vielspieler, aus weniger Partien
 *   neuling      hat gespielt, aber noch nie gewonnen
 */
const VIELSPIELER = eintrag({ username: 'vielspieler', siege: 9, partien: 30, bester_sieg: 210 })
const GLUECKSPILZ = eintrag({
  username: 'glueckspilz',
  siege: 1,
  partien: 2,
  bester_sieg: 412,
  // Nur gegen den Rechner: online hat er nichts vorzuweisen.
  siege_online: 0,
  partien_online: 0,
  bester_sieg_online: 0,
})
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
    daten.meinName = null
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
    expect(await screen.findByText(/Noch keine beendete Partie/)).toBeInTheDocument()
  })

  it('nennt, was gezählt wird', async () => {
    render(<Bestenliste />)
    // Ohne diesen Satz fragt man sich, was da eigentlich gezählt wurde.
    expect(await screen.findByText(/online und gegen den Rechner/)).toBeInTheDocument()
  })

  it('findet die eigene Zeile auch ohne Zutun der Seite', async () => {
    // Der Name kommt aus dem Konto. Vorher gab die Seite den Anzeigenamen
    // hinein, die Liste steht aber auf dem Benutzernamen -- dann leuchtete
    // die eigene Zeile nie.
    daten.meinName = 'ausdauernd'
    render(<Bestenliste />)
    const meine = (await screen.findByText('ausdauernd')).closest('li')
    expect(meine?.className).toMatch(/ich/)
  })
})

describe('Online oder auch gegen den Rechner', () => {
  beforeEach(() => {
    daten.liste = [VIELSPIELER, GLUECKSPILZ, AUSDAUERND]
    daten.meinName = null
  })

  it('zählt den Rechner von Anfang an mit', async () => {
    // Thomas am 30.09.2026: "Bitte auch gegen Computer mit auswerten."
    // Die Vorgabe ist also alles, nicht nur online.
    render(<Bestenliste start="punkte" />)
    const liste = await screen.findByRole('list')
    expect(within(liste).getAllByRole('listitem')[0]).toHaveTextContent('glueckspilz')
  })

  it('lässt sich auf die nachprüfbaren Partien umschalten', async () => {
    render(<Bestenliste start="punkte" />)
    await screen.findByRole('list')

    await userEvent.click(screen.getByRole('button', { name: 'Nur Online' }))

    const liste = screen.getByRole('list')
    // Der hohe Wert war gegen den Rechner -- online führt jetzt ein anderer.
    expect(within(liste).getAllByRole('listitem')[0]).toHaveTextContent('ausdauernd')
    expect(liste).toHaveTextContent('260')
    // Und wer nur gegen den Rechner gespielt hat, steht gar nicht mehr da:
    // eine Zeile aus lauter Nullen wäre keine Auskunft.
    expect(liste).not.toHaveTextContent('glueckspilz')
    expect(screen.getByText(/nur beendete Online-Partien/)).toBeInTheDocument()
  })

  it('geht wieder zurück', async () => {
    render(<Bestenliste start="punkte" />)
    await screen.findByRole('list')
    await userEvent.click(screen.getByRole('button', { name: 'Nur Online' }))
    await userEvent.click(screen.getByRole('button', { name: 'Rechner mitzählen' }))
    expect(within(screen.getByRole('list')).getAllByRole('listitem')[0]).toHaveTextContent(
      'glueckspilz',
    )
  })

  it('zählt in der Siegerliste die Partien gegen den Rechner nicht zu den Online-Partien', () => {
    // Die Falle: Wenn "Siege" alles zählt und "Partien" nur online, steht
    // da irgendwann "9 Siege aus 3 Partien".
    expect(werte(GLUECKSPILZ, 'alle')).toEqual({ siege: 1, partien: 2, bester_sieg: 412 })
    expect(werte(GLUECKSPILZ, 'online')).toEqual({ siege: 0, partien: 0, bester_sieg: 0 })
  })

  it('sortiert online nach den Online-Zahlen', () => {
    const reihe = sortiere([GLUECKSPILZ, VIELSPIELER, AUSDAUERND], 'punkte', 'online')
    expect(reihe.map((e) => e.username)).toEqual(['ausdauernd', 'vielspieler', 'glueckspilz'])
    expect(sichtbar(reihe, 'punkte', 'online').map((e) => e.username)).toEqual([
      'ausdauernd',
      'vielspieler',
    ])
  })
})
