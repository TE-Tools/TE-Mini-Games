/**
 * Der Ablauf einer Pokerpartie -- geprüft, indem sie gespielt wird.
 *
 * Ein Tisch hat viele Zustände, die sich von Hand nicht alle hinschreiben
 * lassen: all-in mit Resteinsatz, drei Erhöhungen hintereinander, zwei
 * Spieler gleichzeitig pleite. Deshalb spielt dieser Test komplette
 * Turniere durch und prüft nach jeder Hand die Dinge, die IMMER gelten
 * müssen:
 *
 *   * Chips entstehen nicht und verschwinden nicht.
 *   * Niemand setzt mehr, als er hat.
 *   * Jede Hand endet, jedes Turnier endet.
 *   * Am Ende hat genau einer alles, und die Plätze sind eindeutig.
 *
 * Eine Regel, die nur in einem von tausend Blättern bricht, fällt beim
 * Durchklicken nie auf -- hier schon.
 */
import { describe, it, expect } from 'vitest'
import {
  START_CHIPS,
  erstellePartie,
  handle,
  imRennen,
  moeglichkeiten,
  menschlicherPlatz,
  naechsteHand,
  schichten,
  type TexasZustand,
} from '@/games/texas-holdem/engine'
import { kiAktion } from '@/games/texas-holdem/ki'
import { kartenAus } from '@/games/texas-holdem/karten'

/**
 * Ein Tisch am River, von Hand gestellt: A ist mit 100 all-in und hat die
 * beste Hand, B ist mit 300 all-in, C darf noch schieben.
 */
function amRiver(): TexasZustand {
  const board = kartenAus('2c 7d 9h Js 4s')
  const mach = (
    id: string,
    karten: string,
    gesamt: number,
    chips: number,
    status: 'aktiv' | 'allin',
  ) => ({
    id,
    name: id.toUpperCase(),
    mensch: false,
    kiStufe: null,
    chips,
    einsatz: 0,
    gesamt,
    karten: kartenAus(karten),
    status,
    gehandelt: false,
    platz: null,
  })
  return {
    // A: Zwei Paare (Neunen und Siebenen). B: ein Paar Buben. C: nichts.
    spieler: [
      mach('a', '9s 7h', 100, 0, 'allin'),
      mach('b', 'Jh Td', 300, 0, 'allin'),
      mach('c', '3d 5c', 300, 200, 'aktiv'),
    ],
    dealer: 2,
    handNr: 1,
    blindStufe: 0,
    phase: 'river',
    board,
    pot: 700,
    hoechsterEinsatz: 0,
    letzteErhoehung: 20,
    amZug: 2,
    deck: [],
    seed: 1,
    protokoll: [],
    ergebnis: null,
    siegerId: null,
  }
}

function chipsGesamt(state: TexasZustand): number {
  return state.spieler.reduce((n, s) => n + s.chips + s.einsatz, 0) + state.pot
}

function tisch(anzahl: number, seed: number): TexasZustand {
  return erstellePartie({
    seed,
    spieler: Array.from({ length: anzahl }, (_, i) => ({
      name: `Rechner ${i + 1}`,
      mensch: false,
      kiStufe: (['leicht', 'normal', 'schwer'] as const)[i % 3],
    })),
  })
}

/** Spielt ein ganzes Turnier und prüft unterwegs mit. */
function spieleTurnier(anzahl: number, seed: number) {
  let state = tisch(anzahl, seed)
  const soll = anzahl * START_CHIPS
  let haende = 0
  let schritte = 0

  while (state.phase !== 'ende') {
    if (state.phase === 'showdown') {
      expect(chipsGesamt(state)).toBe(soll)
      haende++
      expect(haende).toBeLessThan(400)
      state = naechsteHand(state)
      continue
    }

    const vorher = state
    state = handle(state, kiAktion(state))
    schritte++
    expect(schritte).toBeLessThan(20_000)
    // Jede Aktion muss den Zustand bewegen -- sonst dreht sich der Tisch.
    expect(state).not.toBe(vorher)

    for (const s of state.spieler) {
      expect(s.chips).toBeGreaterThanOrEqual(0)
      expect(s.einsatz).toBeGreaterThanOrEqual(0)
    }
    expect(chipsGesamt(state)).toBe(soll)
  }

  return { state, haende }
}

describe('Ein Turnier spielt sich zu Ende', () => {
  it('erhält die Chips und findet einen Sieger -- über viele Partien', () => {
    for (let i = 0; i < 40; i++) {
      const anzahl = 2 + (i % 5)
      const { state } = spieleTurnier(anzahl, 1000 + i)

      expect(state.siegerId).not.toBeNull()
      expect(chipsGesamt(state)).toBe(anzahl * START_CHIPS)

      const sieger = state.spieler.find((s) => s.id === state.siegerId)!
      expect(sieger.chips).toBe(anzahl * START_CHIPS)
      expect(sieger.platz).toBe(1)

      // Jeder hat genau einen Platz, und keiner doppelt.
      const plaetze = state.spieler.map((s) => s.platz).sort((a, b) => (a ?? 0) - (b ?? 0))
      expect(plaetze).toEqual(Array.from({ length: anzahl }, (_, k) => k + 1))
    }
  })

  it('braucht dafür eine vernünftige Zahl von Händen', () => {
    // Steigende Blinds sind der Motor: Ohne sie läuft ein Tisch ewig.
    const { haende } = spieleTurnier(4, 77)
    expect(haende).toBeGreaterThan(3)
    expect(haende).toBeLessThan(200)
  })
})

describe('Was in jeder Hand gilt', () => {
  it('lässt niemanden mehr setzen, als er hat', () => {
    let state = tisch(3, 42)
    for (let i = 0; i < 2000 && state.phase !== 'ende'; i++) {
      if (state.phase === 'showdown') {
        state = naechsteHand(state)
        continue
      }
      const dran = state.spieler[state.amZug]!
      const m = moeglichkeiten(state)
      if (m.erhoehen) {
        // Mehr als der Stapel hergibt, darf gar nicht angeboten werden.
        expect(m.erhoehen.max).toBeLessThanOrEqual(dran.einsatz + dran.chips)
        expect(m.erhoehen.min).toBeLessThanOrEqual(m.erhoehen.max)
      }
      if (m.mitgehen !== null) expect(m.mitgehen).toBeLessThanOrEqual(dran.chips)
      state = handle(state, kiAktion(state))
    }
  })

  it('verteilt am Ende jeder Hand den ganzen Topf', () => {
    let state = tisch(4, 4711)
    let geprueft = 0
    for (let i = 0; i < 6000 && state.phase !== 'ende'; i++) {
      if (state.phase === 'showdown') {
        // Nichts bleibt liegen.
        expect(state.pot).toBe(0)
        expect(state.ergebnis).not.toBeNull()
        expect(state.ergebnis!.anteile.length).toBeGreaterThan(0)
        geprueft++
        state = naechsteHand(state)
        continue
      }
      state = handle(state, kiAktion(state))
    }
    expect(geprueft).toBeGreaterThan(3)
  })

  it('beendet die Hand sofort, wenn alle bis auf einen wegwerfen', () => {
    let state = tisch(4, 9)
    // Alle folden der Reihe nach -- am Ende steht der grosse Blind allein.
    for (let i = 0; i < 10 && state.phase === 'preflop'; i++) {
      state = handle(state, { art: 'folden' })
    }
    expect(state.phase).toBe('showdown')
    expect(imRennen(state)).toHaveLength(1)
    // Ohne Showdown werden keine Karten gezeigt.
    expect(state.ergebnis?.gezeigt).toBe(false)
    expect(state.ergebnis?.anteile[0]?.betrag).toBeGreaterThan(0)
  })
})

describe('Nebenpots', () => {
  it('schichtet die Einsätze so, dass niemand mehr gewinnt, als er bezahlt hat', () => {
    // A hat 100 bezahlt, B und C je 300. Dann gibt es einen Haupttopf von
    // 300 (alle drei) und einen Nebentopf von 400 (nur B und C).
    const lagen = schichten([
      { id: 'a', gesamt: 100, status: 'allin' },
      { id: 'b', gesamt: 300, status: 'allin' },
      { id: 'c', gesamt: 300, status: 'aktiv' },
    ])

    expect(lagen).toEqual([
      { betrag: 300, berechtigte: ['a', 'b', 'c'] },
      { betrag: 400, berechtigte: ['b', 'c'] },
    ])
  })

  it('nimmt das Geld eines Ausgestiegenen mit, lässt ihn aber nicht gewinnen', () => {
    const lagen = schichten([
      { id: 'a', gesamt: 50, status: 'gefoldet' },
      { id: 'b', gesamt: 200, status: 'aktiv' },
      { id: 'c', gesamt: 200, status: 'aktiv' },
    ])

    // Die 50 des Ausgestiegenen liegen im ersten Topf, berechtigt sind nur
    // die beiden anderen.
    expect(lagen[0]).toEqual({ betrag: 150, berechtigte: ['b', 'c'] })
    expect(lagen[1]).toEqual({ betrag: 300, berechtigte: ['b', 'c'] })
    expect(lagen.flatMap((l) => l.berechtigte)).not.toContain('a')
  })

  it('gibt einen nicht mitgegangenen Einsatz zurück', () => {
    // A setzt 500, B ist nur für 100 dabei. Die 400 Überschuss hat
    // niemand bezahlt -- sie gehören A zurück, egal wer gewinnt.
    const lagen = schichten([
      { id: 'a', gesamt: 500, status: 'aktiv' },
      { id: 'b', gesamt: 100, status: 'allin' },
    ])
    expect(lagen).toEqual([
      { betrag: 200, berechtigte: ['a', 'b'] },
      { betrag: 400, berechtigte: ['a'] },
    ])
  })

  it('zahlt den Haupttopf an den Kurzen und den Nebentopf an den Zweiten', () => {
    /*
     * Der Fall, auf den es ankommt: Der Spieler mit den wenigsten Chips
     * hat die beste Hand. Er bekommt den Haupttopf -- aber eben nur den.
     * Eine Wertung ohne Nebenpots würde ihm alles geben.
     */
    const state = amRiver()
    const fertig = handle(state, { art: 'schieben' })

    expect(fertig.phase).toBe('showdown')
    const anteil = (id: string) =>
      fertig.ergebnis!.anteile.find((a) => a.spielerId === id)?.betrag ?? 0

    expect(anteil('a')).toBe(300) // Haupttopf: 3 x 100
    expect(anteil('b')).toBe(400) // Nebentopf: 2 x 200
    expect(anteil('c')).toBe(0)
    expect(fertig.spieler.find((s) => s.id === 'a')!.chips).toBe(300)
  })
})

describe('Wenn der Mensch draussen ist', () => {
  it('endet das Turnier, statt den Rechner allein weiterspielen zu lassen', () => {
    /*
     * Vorher lief der Tisch ohne mich weiter: Die Seite zeigte Hand um
     * Hand „Die anderen spielen die Hand zu Ende", ohne je anzuhalten.
     * Aufgefallen ist das beim Durchspielen im Browser -- an einem Lauf,
     * der nicht endete.
     *
     * Gesucht wird ein Startwert, bei dem ich als Erster von dreien
     * rausfliege; welcher das ist, hängt an der KI und darf sich mit ihr
     * ändern. Der Test hängt deshalb an der Regel, nicht an der Zahl.
     */
    let gefunden = 0
    for (let seed = 1; seed <= 60 && gefunden < 3; seed++) {
      let state = erstellePartie({
        seed,
        startChips: 200,
        spieler: [
          { name: 'Du', mensch: true },
          { name: 'Ida', mensch: false, kiStufe: 'schwer' },
          { name: 'Bruno', mensch: false, kiStufe: 'schwer' },
        ],
      })
      for (let i = 0; i < 4000 && state.phase !== 'ende'; i++) {
        state = state.phase === 'showdown' ? naechsteHand(state) : handle(state, kiAktion(state))
      }
      expect(state.phase).toBe('ende')

      const ich = state.spieler.find((s) => s.mensch)!
      // Jeder hat einen Platz -- auch die, die noch Chips haben.
      const plaetze = state.spieler.map((s) => s.platz).sort((a, b) => (a ?? 0) - (b ?? 0))
      expect(plaetze).toEqual([1, 2, 3])
      expect(menschlicherPlatz(state)).toBe(ich.platz)

      if (ich.platz !== 3) continue
      gefunden++
      // Und genau daran hängt es: Es sitzen noch ZWEI mit Chips da.
      // Liefe der Tisch weiter, bliebe am Ende einer mit allem übrig.
      expect(state.spieler.filter((s) => s.chips > 0)).toHaveLength(2)
    }
    expect(gefunden).toBeGreaterThan(0)
  })
})

describe('Wie der Tisch spricht', () => {
  it('spricht den Menschen in der zweiten Person an', () => {
    /*
     * „Du schiebt" stand im Protokoll, weil jede Zeile `${name} schiebt`
     * lautete und der Mensch ohne Konto „Du" heisst. Im Browser der erste
     * Satz, den man liest.
     */
    let state = erstellePartie({
      seed: 3,
      spieler: [
        { name: 'Du', mensch: true },
        { name: 'Ida', mensch: false, kiStufe: 'normal' },
      ],
    })
    // Heads-up beginnt der Geber -- hier Ida. Erst sie, dann ich.
    while (!state.spieler[state.amZug]!.mensch) state = handle(state, kiAktion(state))
    state = handle(
      state,
      moeglichkeiten(state).schieben ? { art: 'schieben' } : { art: 'mitgehen' },
    )

    const meine = state.protokoll.filter((z) => z.startsWith('Du '))
    expect(meine.length).toBeGreaterThan(0)
    for (const zeile of meine) {
      expect(zeile).not.toMatch(/^Du (schiebt|geht|wirft|setzt|erhöht|ist)\b/)
    }
  })

  it('sagt die gewonnene Hand in der Form an, die nach „mit" steht', () => {
    const fertig = handle(amRiver(), { art: 'schieben' })
    // „mit zwei Paaren", nicht „mit Zwei Paare".
    expect(fertig.ergebnis!.text).toContain('mit zwei Paaren')
    expect(fertig.ergebnis!.text).not.toContain('mit Zwei Paare')
  })
})

describe('Welche fünf Karten gelten', () => {
  it('nennt dieselben Karten, die auf dem Tisch liegen -- nicht Kopien davon', () => {
    /*
     * Die Oberfläche legt nach dem Showdown einen Ring um die fünf
     * Karten, die die Hand ausmachen, und erkennt sie am Verweis. Würde
     * die Engine hier Kopien zurückgeben, verschwänden die Ringe --
     * ohne Fehlermeldung, nur still.
     */
    const fertig = handle(amRiver(), { art: 'schieben' })
    const hand = fertig.ergebnis!.anteile.find((a) => a.hand)!.hand!
    const sieger = fertig.spieler.find((s) => s.id === 'a')!

    const vomBrett = hand.karten.filter((k) => fertig.board.includes(k))
    const ausDerHand = hand.karten.filter((k) => sieger.karten.includes(k))

    expect(hand.karten).toHaveLength(5)
    expect(vomBrett.length + ausDerHand.length).toBe(5)
    // A hält 9♠ 7♥ auf 2♣ 7♦ 9♥ B♠ 4♠: zwei Paare, beide Karten zählen.
    expect(ausDerHand).toHaveLength(2)
  })
})

describe('Wie mutig die Stufen spielen', () => {
  /** Spielt Turniere und zählt, was die Stufen tun. */
  function stilProbe(stufen: ('leicht' | 'normal' | 'schwer')[], runden: number) {
    const zaehler = new Map<string, { erhoeht: number; gesamt: number; weg: number }>()
    for (const s of stufen) zaehler.set(s, { erhoeht: 0, gesamt: 0, weg: 0 })

    for (let r = 0; r < runden; r++) {
      let state = erstellePartie({
        seed: 5000 + r,
        spieler: stufen.map((s, i) => ({ name: `${s}${i}`, mensch: false, kiStufe: s })),
      })
      for (let i = 0; i < 20_000 && state.phase !== 'ende'; i++) {
        if (state.phase === 'showdown') {
          state = naechsteHand(state)
          continue
        }
        const stufe = state.spieler[state.amZug]!.kiStufe ?? 'normal'
        const aktion = kiAktion(state)
        const w = zaehler.get(stufe)!
        w.gesamt++
        if (aktion.art === 'erhoehen') w.erhoeht++
        if (aktion.art === 'folden') w.weg++
        state = handle(state, aktion)
      }
    }
    const anteil = (stufe: string) => {
      const w = zaehler.get(stufe)!
      return { erhoeht: w.erhoeht / w.gesamt, weg: w.weg / w.gesamt }
    }
    return anteil
  }

  it('erhöht von leicht nach schwer immer öfter', () => {
    /*
     * Thomas am 14.10.2026: "normal ist zu zahm bitte etwas mutiger
     * machen." Gemessen war das belegt -- „normal" erhöhte in 7,5
     * Prozent seiner Entscheidungen und warf 46 Prozent weg. Dieser
     * Test hält die Reihenfolge fest, damit niemand die Stufen beim
     * nächsten Nachstellen wieder ineinander schiebt.
     */
    const anteil = stilProbe(['leicht', 'normal', 'schwer'], 8)

    expect(anteil('leicht').erhoeht).toBeLessThan(anteil('normal').erhoeht)
    expect(anteil('normal').erhoeht).toBeLessThanOrEqual(anteil('schwer').erhoeht + 0.02)
    // Und „normal" muss wirklich mitspielen, nicht nur zusehen.
    expect(anteil('normal').erhoeht).toBeGreaterThan(0.12)
    expect(anteil('normal').weg).toBeLessThan(0.4)
  })

  it('lässt „leicht" zu oft mitgehen -- das ist der Anfängerfehler, der dort hingehört', () => {
    const anteil = stilProbe(['leicht', 'leicht', 'normal'], 6)
    expect(anteil('leicht').weg).toBeLessThan(anteil('normal').weg)
  })
})
