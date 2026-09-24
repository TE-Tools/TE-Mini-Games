/**
 * Das Zugbuch: Spielen zwei Geräte dieselbe Partie?
 *
 * Der ganze Online-Modus steht und fällt damit, dass aus demselben Startwert
 * und derselben Aktionsliste zwingend derselbe Spielstand folgt -- sonst
 * sähen zwei Mitspieler verschiedene Bretter und keiner wüsste, welches gilt.
 *
 * Dazu die zweite Zusage: Eine Aktion vom falschen Sitz bleibt wirkungslos.
 * Das ist der Grund, warum die Regeln hier bleiben dürfen und nicht ein
 * zweites Mal in SQL stehen müssen.
 */
import { describe, it, expect } from 'vitest'
import {
  aktiverSpieler,
  amZugSitz,
  eindeutigeNamen,
  feldAn,
  sitzSpielerId,
  wendeAn,
  zustandAus,
  type OnlineAktion,
  type ZugbuchEintrag,
} from '@/games/schuetzenopoly'

const NAMEN = ['Thomas', 'Lena', 'Kai']
const SEED = 20260924

function partie(zugbuch: ZugbuchEintrag[] = []) {
  return zustandAus({ seed: SEED, namen: NAMEN, rundenLimit: 20, zugbuch })
}

/** Ein Zugbuch bauen, wie es beim Spielen entsteht: immer vom Sitz am Zug. */
function spielMit(schritte: OnlineAktion[]): ZugbuchEintrag[] {
  const buch: ZugbuchEintrag[] = []
  let stand = partie()
  for (const aktion of schritte) {
    const eintrag = { nr: buch.length + 1, seat: amZugSitz(stand), aktion }
    buch.push(eintrag)
    stand = wendeAn(stand, eintrag)
  }
  return buch
}

describe('Das Zugbuch', () => {
  it('führt auf beiden Geräten zum selben Stand', () => {
    const buch = spielMit([
      { art: 'wuerfeln' },
      { art: 'ankommen' },
      { art: 'kaufen' },
      { art: 'zug_ende' },
      { art: 'wuerfeln' },
      { art: 'ankommen' },
      { art: 'ablehnen' },
      { art: 'zug_ende' },
    ])

    const hier = partie(buch)
    // Das andere Gerät bekommt dieselben Einträge -- nur in der Reihenfolge,
    // in der das Netz sie liefert, also nicht unbedingt sortiert.
    const dort = partie([...buch].reverse())

    expect(dort).toEqual(hier)
    expect(hier.protokoll.length).toBeGreaterThan(1)
  })

  it('lässt eine Aktion vom falschen Sitz wirkungslos', () => {
    const stand = partie()
    expect(amZugSitz(stand)).toBe(1)

    // Sitz 2 versucht zu würfeln, während Sitz 1 dran ist.
    const geschummelt = wendeAn(stand, { nr: 1, seat: 2, aktion: { art: 'wuerfeln' } })
    expect(geschummelt).toBe(stand)

    // Vom richtigen Sitz wirkt dieselbe Aktion.
    const echt = wendeAn(stand, { nr: 1, seat: 1, aktion: { art: 'wuerfeln' } })
    expect(echt).not.toBe(stand)
    expect(echt.wuerfel).not.toBeNull()
  })

  it('würfelt aus dem Startwert, nicht aus dem Zufall des Geräts', () => {
    const eins = partie([{ nr: 1, seat: 1, aktion: { art: 'wuerfeln' } }])
    const zwei = partie([{ nr: 1, seat: 1, aktion: { art: 'wuerfeln' } }])
    expect(zwei.wuerfel).toEqual(eins.wuerfel)

    // Ein anderer Startwert würfelt anders -- sonst wäre jede Partie gleich.
    const anders = zustandAus({
      seed: SEED + 1,
      namen: NAMEN,
      rundenLimit: 20,
      zugbuch: [{ nr: 1, seat: 1, aktion: { art: 'wuerfeln' } }],
    })
    expect(anders.spieler.map((s) => s.rolle)).not.toEqual(eins.spieler.map((s) => s.rolle))
  })

  it('setzt jeden Sitz auf seinen Spieler', () => {
    const stand = partie()
    expect(stand.spieler.map((s) => s.id)).toEqual(['p0', 'p1', 'p2'])
    expect(sitzSpielerId(1)).toBe('p0')
    expect(sitzSpielerId(3)).toBe('p2')
    expect(stand.spieler.map((s) => s.name)).toEqual(NAMEN)
    // Alle sind Menschen: Online spielt kein Rechner mit.
    expect(stand.spieler.every((s) => s.typ === 'mensch')).toBe(true)
  })

  it('lässt jeden jederzeit aufgeben, auch wenn ein anderer dran ist', () => {
    const stand = partie()
    const nachher = wendeAn(stand, { nr: 1, seat: 3, aktion: { art: 'aufgeben' } })
    expect(nachher.spieler[2]!.insolvent).toBe(true)
    // Wer am Zug war, ist es immer noch.
    expect(aktiverSpieler(nachher).id).toBe('p0')
  })

  it('macht gleiche Kontonamen unterscheidbar', () => {
    expect(eindeutigeNamen(['Thomas', 'Thomas', 'Lena', 'thomas'])).toEqual([
      'Thomas',
      'Thomas (2)',
      'Lena',
      'thomas (3)',
    ])
    // Und eine Runde mit zwei gleichen Namen läuft trotzdem an.
    const stand = zustandAus({ seed: SEED, namen: ['Max', 'Max'], rundenLimit: 20, zugbuch: [] })
    expect(stand.spieler.map((s) => s.name)).toEqual(['Max', 'Max (2)'])
  })

  it('spielt eine ganze Partie durch, ohne hängen zu bleiben', () => {
    // Stumpf immer das Naheliegende tun, bis die Partie endet: Das deckt
    // Karten, Gebühren, Strafbank und Minispiele mit ab.
    let stand = partie()
    const buch: ZugbuchEintrag[] = []
    const tu = (aktion: OnlineAktion) => {
      const eintrag = { nr: buch.length + 1, seat: amZugSitz(stand), aktion }
      buch.push(eintrag)
      stand = wendeAn(stand, eintrag)
    }

    for (let i = 0; i < 4000 && stand.phase !== 'ende'; i++) {
      if (stand.offenesMinispiel) tu({ art: 'minispiel', medaille: 'bronze' })
      else if (stand.offeneKarte) tu({ art: 'karte' })
      else if (stand.offeneWahl) tu({ art: 'wahl_weiter' })
      else if (stand.kaufAngebot) tu({ art: 'kaufen' })
      else if (stand.phase === 'wuerfeln') tu({ art: 'wuerfeln' })
      else if (stand.phase === 'bewegen') tu({ art: 'ankommen' })
      else tu({ art: 'zug_ende' })
    }

    expect(stand.phase).toBe('ende')
    expect(stand.siegerId).not.toBeNull()
    // Und das Nachspielen desselben Buchs kommt genau dort heraus.
    expect(partie(buch)).toEqual(stand)
    // Gekauft wurde auch wirklich etwas -- sonst prüfte der Test nichts.
    expect(Object.values(stand.besitz).some((b) => b.besitzerId)).toBe(true)
    expect(feldAn(aktiverSpieler(stand).position)).toBeDefined()
  })
})
