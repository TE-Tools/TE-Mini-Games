/**
 * Trapbound: Belohnungsvideos.
 *
 *  - Level überspringen nach vielen Toden (`trapbound-ueberspringen`):
 *    nächstes Level frei, das übersprungene ohne Sterne, Bestzeit, Kristall.
 *  - Die Figur „Glut“ (`trapbound-farbe`): nur per Video, reine Optik,
 *    bleibt dauerhaft auf dem Gerät.
 *
 * Google wird nicht geladen: Die Warteschlange wird abgefangen und von Hand
 * beantwortet, wie in tests/werbung.test.tsx.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAufDeutsch as render } from './aufDeutsch'
import { setzeWerbungFuerTests } from '@/services/werbung'
import { SprachProvider } from '@/i18n/SprachProvider'
import { db } from '@/offline/db'
import { getOrCreateGameProgress, getPersonalRecord } from '@/offline'
import {
  LEVEL_ANZAHL,
  UEBERSPRINGEN_AB_TODEN,
  aktuelleFigur,
  darfUeberspringen,
  geschaffte,
  leseAussehen,
  leseStand,
  levelStand,
  loescheStand,
  merkeAbschluss,
  merkeUebersprungen,
  schalteFrei,
  ueberspringe,
  waehle,
  type Aussehen,
  type Stand,
} from '@/games/trapbound'
import { UeberspringenAngebot, FigurWahl } from '@/pages/play/TrapboundWerbung'

interface Wunsch {
  type?: string
  name?: string
  beforeReward?: (zeigen: () => void) => void
  adViewed?: () => void
  adDismissed?: () => void
  adBreakDone?: (info: { breakStatus: string }) => void
}

let wuensche: Wunsch[] = []
const belohnungen = () => wuensche.filter((w) => w.type === 'reward')

beforeEach(async () => {
  wuensche = []
  window.adsbygoogle = { push: (w: unknown) => wuensche.push(w as Wunsch) }
  setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
  localStorage.clear()
  localStorage.setItem('te-sprache', 'de')
  loescheStand()
  await db.delete()
  await db.open()
})

afterEach(() => {
  setzeWerbungFuerTests(null)
  vi.restoreAllMocks()
})

describe('Trapbound: Überspringen -- die Regel', () => {
  it('wird erst ab zehn Toden in einem Anlauf angeboten, einmal, nie im letzten Level', () => {
    const lage = { nr: 3, tode: UEBERSPRINGEN_AB_TODEN, hilfeGenutzt: false, geschafft: false }
    expect(UEBERSPRINGEN_AB_TODEN).toBe(10)
    expect(darfUeberspringen(lage)).toBe(true)
    expect(darfUeberspringen({ ...lage, tode: 9 })).toBe(false)
    expect(darfUeberspringen({ ...lage, hilfeGenutzt: true })).toBe(false)
    expect(darfUeberspringen({ ...lage, geschafft: true })).toBe(false)
    expect(darfUeberspringen({ ...lage, nr: LEVEL_ANZAHL })).toBe(false)
  })

  it('öffnet das nächste Level; das übersprungene zählt ohne Bestwerte und Kristall', () => {
    const vorher: Stand = {
      freigeschaltet: 3,
      level: {
        '3': { fertig: false, besteTode: Infinity, besteZeit: Infinity, kristall: false, tode: 12 },
      },
      einstellungen: leseStand().einstellungen,
    }
    const nachher = ueberspringe(vorher, 3)
    expect(nachher.freigeschaltet).toBe(4)
    const l = nachher.level['3']!
    expect(l).toMatchObject({ fertig: true, uebersprungen: true, kristall: false, tode: 12 })
    expect(l.besteZeit).toBe(Infinity)
    expect(l.besteTode).toBe(Infinity)
    // Rein: der alte Stand bleibt unberührt.
    expect(vorher.level['3']!.fertig).toBe(false)
  })

  it('lässt ein schon geschafftes Level mit seinen Bestwerten stehen', () => {
    merkeAbschluss({ nr: 2, tode: 1, zeit: 8, kristall: true })
    const nachher = ueberspringe(leseStand(), 2)
    expect(nachher.level['2']).toMatchObject({ besteZeit: 8, besteTode: 1, kristall: true })
    expect(nachher.level['2']!.uebersprungen).toBeUndefined()
  })

  it('wer es später wirklich schafft, bekommt alles wie sonst -- auch nach JSON', () => {
    merkeUebersprungen(1)
    expect(levelStand(1).uebersprungen).toBe(true)
    expect(geschaffte()).toBe(1)
    merkeAbschluss({ nr: 1, tode: 4, zeit: 12.5, kristall: true })
    const l = levelStand(1)
    expect(l.uebersprungen).toBeUndefined()
    // Infinity wird im Speicher zu null -- die Bestzeit darf trotzdem nicht 0 werden.
    expect(l.besteZeit).toBe(12.5)
    expect(l.besteTode).toBe(4)
    expect(l.kristall).toBe(true)
  })
})

describe('Trapbound: Überspringen -- das Angebot', () => {
  function zeige(props: Partial<Parameters<typeof UeberspringenAngebot>[0]> = {}) {
    const onUebersprungen = vi.fn()
    const onVorDemVideo = vi.fn()
    render(
      <UeberspringenAngebot
        nr={2}
        tode={10}
        hilfeGenutzt={false}
        geschafft={false}
        onVorDemVideo={onVorDemVideo}
        onUebersprungen={onUebersprungen}
        {...props}
      />,
    )
    return { onUebersprungen, onVorDemVideo }
  }

  it('zeigt ohne Video keinen Knopf', () => {
    zeige()
    expect(belohnungen()).toHaveLength(1)
    expect(belohnungen()[0]!.name).toBe('trapbound-ueberspringen')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fragt unter zehn Toden und nach genutzter Hilfe gar nicht erst', () => {
    zeige({ tode: 9 })
    zeige({ hilfeGenutzt: true })
    expect(belohnungen()).toHaveLength(0)
  })

  it('ist ohne Werbung oder offline nicht da', () => {
    setzeWerbungFuerTests({ client: null })
    zeige()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    setzeWerbungFuerTests({ client: 'ca-pub-1234567890123456' })
    zeige()
    expect(belohnungen()).toHaveLength(0)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('schaltet nach dem Video das nächste Level frei -- ohne Ergebnis und Rekord', async () => {
    const { onUebersprungen, onVorDemVideo } = zeige()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    const knopf = await screen.findByRole('button', { name: /Level überspringen/ })
    expect(knopf.textContent).toMatch(/Werbevideo – freiwillig/)
    await userEvent.click(knopf)
    expect(onVorDemVideo).toHaveBeenCalled()
    act(() => belohnungen()[0]!.adViewed!())

    await vi.waitFor(() => expect(onUebersprungen).toHaveBeenCalledTimes(1))
    const stand = onUebersprungen.mock.calls[0]![0] as Stand
    expect(stand.freigeschaltet).toBe(3)
    expect(levelStand(2)).toMatchObject({ fertig: true, uebersprungen: true, kristall: false })
    await vi.waitFor(async () =>
      expect((await getOrCreateGameProgress('trapbound')).currentLevel).toBe(3),
    )
    const fortschritt = await getOrCreateGameProgress('trapbound')
    expect(fortschritt.totalXp).toBe(0)
    expect(await getPersonalRecord('trapbound', 2)).toBeUndefined()
    expect(await db.gameResults.count()).toBe(0)
  })

  it('gibt nach einem abgebrochenen Video nichts', async () => {
    const { onUebersprungen } = zeige()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    await userEvent.click(await screen.findByRole('button', { name: /Level überspringen/ }))
    act(() => belohnungen()[0]!.adDismissed!())
    expect(await screen.findByText(/Video abgebrochen/)).toBeTruthy()
    expect(onUebersprungen).not.toHaveBeenCalled()
    expect(leseStand().freigeschaltet).toBe(1)
    expect(levelStand(2).fertig).toBe(false)
  })
})

describe('Trapbound: die Figur „Glut“', () => {
  function zeige() {
    let aussehen: Aussehen = leseAussehen()
    const onAendern = vi.fn((a: Aussehen) => {
      aussehen = a
    })
    const ergebnis = render(<FigurWahl aussehen={aussehen} onAendern={onAendern} />)
    return { onAendern, ergebnis, jetzt: () => aussehen }
  }

  it('ist gesperrt und nicht wählbar, solange kein Video lief', () => {
    const a = leseAussehen()
    expect(a.frei).toEqual([])
    expect(waehle(a, 'glut').gewaehlt).toBe('hell')
    expect(aktuelleFigur({ frei: [], gewaehlt: 'glut' }).id).toBe('hell')
  })

  it('zeigt ohne Video weder Knopf noch Wahl', () => {
    zeige()
    expect(belohnungen()[0]!.name).toBe('trapbound-farbe')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText('Figur')).toBeNull()
  })

  it('wird nach dem Video freigeschaltet, angezogen und bleibt -- auch nach „Fortschritt löschen“', async () => {
    const { onAendern, ergebnis, jetzt } = zeige()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    await userEvent.click(await screen.findByRole('button', { name: /Figur „Glut“/ }))
    act(() => belohnungen()[0]!.adViewed!())
    await vi.waitFor(() => expect(onAendern).toHaveBeenCalledTimes(1))
    expect(jetzt()).toEqual({ frei: ['glut'], gewaehlt: 'glut' })

    // Gespeichert, offline lesbar, und „Fortschritt löschen“ nimmt sie nicht weg.
    loescheStand()
    expect(leseAussehen()).toEqual({ frei: ['glut'], gewaehlt: 'glut' })
    expect(aktuelleFigur(leseAussehen()).spur).not.toBeNull()

    // Jetzt gibt es eine Wahl -- ohne neues Video.
    ergebnis.rerender(
      <SprachProvider>
        <FigurWahl aussehen={jetzt()} onAendern={onAendern} />
      </SprachProvider>,
    )
    expect(screen.getByText('Figur')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Hell/ }))
    expect(leseAussehen()).toEqual({ frei: ['glut'], gewaehlt: 'hell' })
  })

  it('bleibt nach einem abgebrochenen Video gesperrt', async () => {
    const { onAendern } = zeige()
    act(() => belohnungen()[0]!.beforeReward!(() => {}))
    await userEvent.click(await screen.findByRole('button', { name: /Figur „Glut“/ }))
    act(() => belohnungen()[0]!.adDismissed!())
    expect(await screen.findByText(/Video abgebrochen/)).toBeTruthy()
    expect(onAendern).not.toHaveBeenCalled()
    expect(leseAussehen().frei).toEqual([])
  })

  it('ist reine Optik: freischalten ändert nur den Anstrich', () => {
    const a = schalteFrei({ frei: [], gewaehlt: 'hell' }, 'glut')
    expect(Object.keys(aktuelleFigur(a)).sort()).toEqual(['farbe', 'id', 'nurPerVideo', 'spur'])
  })
})
