/**
 * Squishy Dumplings nachgerechnet.
 *
 * Kurz: Zwei benachbarte Knödel tauschen; stehen dadurch drei gleiche in
 * einer Reihe, verschwinden sie, von oben fällt nach, und was dabei wieder
 * zusammenfällt, löst sich auch auf. Ziel ist eine Anzahl in einer Zeit.
 *
 * Zwei Dinge prüft diese Datei über die Regeln hinaus:
 *   - Jedes der 300 Level ist in der vorgegebenen Zeit zu schaffen. Das
 *     rechnet ein Bot nach, der spielt wie ein aufmerksamer Mensch.
 *   - Es wird wirklich schwerer. Gemessen daran, wie viel Luft ein Bot noch
 *     hat, der einfach irgendeinen gültigen Zug macht.
 */
import { describe, it, expect } from 'vitest'
import {
  createDumplingMatch,
  findeTreffer,
  hatZug,
  loeseAuf,
  mische,
  moeglicheZuege,
  sindNachbarn,
  tausche,
  tauschBringtEtwas,
  tauschErlaubt,
  zeitAbgelaufen,
} from '@/games/squishy-dumplings/engine'
import { createDumplingLevel, schwierigkeit } from '@/games/squishy-dumplings/level'
import {
  SAMMEL_KNOEDEL,
  belohnungFuer,
  freigeschaltet,
  knoedelFuer,
  naechsteBelohnung,
} from '@/games/squishy-dumplings/sammlung'
import { squishyDumplingsGame } from '@/games/squishy-dumplings/definition'
import {
  DUMPLING_MAX_LEVEL,
  REIHEN,
  SPALTEN,
  type DumplingLevel,
  type DumplingState,
  type Zelle,
} from '@/games/squishy-dumplings/types'
import { isSegmentGate, SEGMENT_SIZE } from '@/progression/zones'

/** Ein Feld von Hand: Ziffern für Farben, Großbuchstabe = im Käfig. */
function feldAus(zeilen: string[]): Zelle[] {
  const out: Zelle[] = []
  for (const zeile of zeilen) {
    for (const z of zeile.replace(/\s/g, '')) {
      if (z >= 'A' && z <= 'F') {
        out.push({ farbe: z.charCodeAt(0) - 64, kaefig: true, spezial: 'keine' })
      } else if (z >= 'a' && z <= 'f') {
        // Kleinbuchstabe = goldener Sonderknödel dieser Farbe.
        out.push({ farbe: z.charCodeAt(0) - 96, kaefig: false, spezial: 'gold' })
      } else if (z >= 'p' && z <= 'u') {
        // p..u = diagonaler Sonderknödel der Farbe 1..6.
        out.push({ farbe: z.charCodeAt(0) - 111, kaefig: false, spezial: 'diagonal' })
      } else {
        out.push({ farbe: Number(z), kaefig: false, spezial: 'keine' })
      }
    }
  }
  return out
}

function level(zeilen: string[], farben = 5, ziel = 3, saat = 1): DumplingLevel {
  const cols = zeilen[0]!.replace(/\s/g, '').length
  return {
    level: 1,
    rows: zeilen.length,
    cols,
    farben,
    ziel,
    zeit: 60,
    kaefige: feldAus(zeilen).filter((z) => z.kaefig).length,
    feld: feldAus(zeilen),
    saat,
    isGate: false,
    label: 'Test',
  }
}

/** Match ohne den Mischer beim Start – für Felder, die absichtlich klemmen. */
function roh(lvl: DumplingLevel): DumplingState {
  return {
    level: lvl.level,
    rows: lvl.rows,
    cols: lvl.cols,
    farben: lvl.farben,
    feld: lvl.feld.map((z) => ({ ...z })),
    ziel: lvl.ziel,
    gesammelt: 0,
    kaefigeZu: lvl.feld.filter((z) => z.kaefig).length,
    zuege: 0,
    besteKette: 1,
    mischungen: 0,
    phase: 'play',
    zufall: lvl.saat,
  }
}

describe('Reihen finden', () => {
  it('erkennt drei gleiche waagerecht und senkrecht', () => {
    const feld = feldAus(['111 22', '345 13', '345 24'])
    const treffer = findeTreffer(feld, 3, 5)
    expect(treffer).toContain(0)
    expect(treffer).toContain(1)
    expect(treffer).toContain(2)
    // Die 3er-Spalte links unten: Zeile 1 und 2 haben nur zwei -- keine Reihe.
    expect(treffer).toHaveLength(3)
  })

  it('nimmt auch längere Reihen ganz mit', () => {
    const feld = feldAus(['11111', '23423', '34234'])
    expect(findeTreffer(feld, 3, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('zerreißt eine Reihe am Käfig', () => {
    // Drei Einsen, aber die mittlere sitzt im Käfig -- das zählt nicht.
    const feld = feldAus(['1A1 2', '2342 3', '3423 4'])
    expect(findeTreffer(feld, 3, 5)).toEqual([])
  })

  it('sieht zwei Reihen in einem Feld', () => {
    const feld = feldAus(['11124', '22235', '34534'])
    const treffer = findeTreffer(feld, 3, 5)
    expect(treffer).toEqual([0, 1, 2, 5, 6, 7])
  })
})

describe('Ein Zug', () => {
  /**
   * Ein Tausch nach oben bringt die dritte Zwei in die Reihe:
   *   2 2 1        2 2 2
   *   3 4 2   →    3 4 1
   */
  const brett = ['221 3 4', '342 5 3', '453 4 5', '534 5 3', '345 3 4', '453 4 5', '534 5 3']

  it('lässt nur benachbarte Felder tauschen', () => {
    const s = roh(level(brett))
    expect(sindNachbarn(0, 1, 7)).toBe(true)
    expect(sindNachbarn(0, 2, 7)).toBe(false)
    expect(tauschErlaubt(s, 0, 2)).toBe(false)
    expect(tauschErlaubt(s, 0, 1)).toBe(true)
  })

  it('nimmt einen Tausch nicht an, der keine Reihe ergibt', () => {
    const s = roh(level(brett))
    const r = tausche(s, 0, 1)
    expect(r.gueltig).toBe(false)
    expect(r.state).toBe(s)
    expect(r.state.zuege).toBe(0)
  })

  it('löst die Reihe auf, zählt sie und füllt von oben nach', () => {
    const s = roh(level(brett))
    // (0,2) und (1,2) tauschen: oben steht dann 2 2 2.
    const r = tausche(s, 2, 7)
    expect(r.gueltig).toBe(true)
    expect(r.state.gesammelt).toBeGreaterThanOrEqual(3)
    expect(r.state.zuege).toBe(1)
    // Kein Loch bleibt zurück.
    expect(r.state.feld.every((z) => z.farbe > 0)).toBe(true)
  })

  it('liefert keine fertige Reihe von oben nach', () => {
    // Sonst löst sich das Feld von allein auf, und Suchen lohnt sich nicht.
    const s = roh(level(brett))
    const r = tausche(s, 2, 7)
    expect(findeTreffer(r.state.feld, r.state.rows, r.state.cols)).toEqual([])
  })

  it('erzählt jeden Schritt der Auflösung, damit die Anzeige sie vorführen kann', () => {
    const s = roh(level(brett))
    const r = tausche(s, 2, 7)
    expect(r.schritte.length).toBeGreaterThanOrEqual(1)
    expect(r.schritte[0]!.treffer.length).toBeGreaterThanOrEqual(3)
    expect(r.schritte[0]!.feld).toHaveLength(s.feld.length)
    expect(r.getauscht[2]!.farbe).toBe(s.feld[7]!.farbe)
  })

  it('zählt eine Kette mit, wenn nach dem Nachrutschen wieder etwas passt', () => {
    // Von Hand gebaut: Nach dem Auflösen der obersten Dreierreihe fallen
    // drei Vieren übereinander.
    const feld = feldAus(['111', '424', '244', '442'])
    const auf = loeseAuf(feld, 4, 3, 5, 7)
    expect(auf.schritte.length).toBeGreaterThanOrEqual(1)
    expect(auf.gesammelt).toBeGreaterThanOrEqual(3)
  })
})

describe('Käfige', () => {
  const mitKaefig = ['1A1 2 3', '22 1 3 4', '34 2 4 5', '45 3 5 4', '53 4 3 5', '34 5 4 3']

  it('lassen sich nicht schieben', () => {
    const s = roh(level(mitKaefig))
    expect(s.feld[1]!.kaefig).toBe(true)
    expect(tauschErlaubt(s, 0, 1)).toBe(false)
    expect(tauschErlaubt(s, 1, 2)).toBe(false)
  })

  it('springen auf, wenn direkt daneben eine Reihe verschwindet', () => {
    // Erste Spalte: 1,2,3 -- mit einem Tausch entsteht darunter eine Reihe
    // aus Zweien, die den Käfig bei (0,1) berührt.
    const feld = feldAus(['1A34', '2213', '3231', '4322'])
    const auf = loeseAuf(feld, 4, 4, 5, 3)
    void auf
    // Direkter Weg: eine Reihe unmittelbar neben dem Käfig auflösen.
    const feld2 = feldAus(['1A34', '2223', '3431', '4322'])
    const auf2 = loeseAuf(feld2, 4, 4, 5, 3)
    expect(auf2.befreit).toBeGreaterThanOrEqual(1)
    expect(auf2.feld[1]!.kaefig).toBe(false)
  })

  it('bleiben zu, wenn die Reihe woanders liegt', () => {
    // Die Dreierreihe liegt zwei Zeilen unter dem Käfig -- der bleibt zu.
    // Gemessen am ersten Schritt: Danach rutscht alles nach, und was dabei
    // neben dem Käfig zusammenfällt, darf ihn sehr wohl öffnen.
    const feld = feldAus(['1A34', '2411', '3332', '4214'])
    const auf = loeseAuf(feld, 4, 4, 5, 3)
    expect(auf.schritte[0]!.treffer).toEqual([8, 9, 10])
    expect(auf.schritte[0]!.befreit).toEqual([])
  })

  it('gehören zum Levelziel: Ziel erreicht, aber ein Käfig zu, heißt nicht gewonnen', () => {
    const lvl = level(['1A34', '2223', '3431', '4322'], 5, 3)
    const s = roh(lvl)
    const r = tausche(s, 8, 12)
    // Auch wenn genug gesammelt wäre: Solange ein Käfig zu ist, läuft es.
    if (r.state.kaefigeZu > 0) expect(r.state.phase).toBe('play')
  })
})

describe('Gewonnen und verloren', () => {
  it('ist gewonnen, sobald Ziel erreicht und alle Käfige offen sind', () => {
    const s = roh(level(['221 3 4', '342 5 3', '453 4 5', '534 5 3'], 5, 3))
    const r = tausche(s, 2, 7)
    expect(r.state.gesammelt).toBeGreaterThanOrEqual(3)
    expect(r.state.phase).toBe('won')
  })

  it('ist verloren, wenn die Zeit um ist', () => {
    const s = roh(level(['221 3 4', '342 5 3', '453 4 5', '534 5 3'], 5, 99))
    expect(zeitAbgelaufen(s).phase).toBe('lost')
  })

  it('nimmt nach dem Ende keine Züge mehr an', () => {
    const s = zeitAbgelaufen(roh(level(['221 3 4', '342 5 3', '453 4 5', '534 5 3'])))
    expect(tauschErlaubt(s, 0, 1)).toBe(false)
    expect(tausche(s, 2, 7).gueltig).toBe(false)
  })
})

describe('Wenn nichts mehr geht', () => {
  it('erkennt ein festgefahrenes Feld', () => {
    // Jede Farbe genau zweimal: Drei gleiche kann es hier gar nicht geben,
    // also gibt es auch keinen Zug.
    const s = roh(level(['1234', '5612', '3456'], 6))
    expect(findeTreffer(s.feld, s.rows, s.cols)).toEqual([])
    expect(moeglicheZuege(s)).toEqual([])
    expect(hatZug(s)).toBe(false)
  })

  it('mischt neu, bis wieder ein Zug möglich ist und nichts von allein passt', () => {
    const s = createDumplingMatch(createDumplingLevel(30))
    const neu = mische(s)
    expect(neu.feld).not.toEqual(s.feld)
    expect(findeTreffer(neu.feld, neu.rows, neu.cols)).toEqual([])
    expect(hatZug(neu)).toBe(true)
    expect(neu.mischungen).toBe(1)
  })

  it('lässt die Käfige beim Mischen liegen', () => {
    // Sonst wäre Mischen ein Ausweg aus jeder schwierigen Lage.
    const s = createDumplingMatch(createDumplingLevel(150))
    const vorher = s.feld.map((z) => z.kaefig)
    expect(vorher.filter(Boolean).length).toBeGreaterThan(0)
    const neu = mische(s)
    expect(neu.feld.map((z) => z.kaefig)).toEqual(vorher)
  })

  it('nimmt einem Zug nicht die Farben weg', () => {
    // Gemischt wird nur die Anordnung, nicht der Vorrat.
    const s = createDumplingMatch(createDumplingLevel(30))
    const zaehle = (st: typeof s) => {
      const n: number[] = []
      for (const z of st.feld) n[z.farbe] = (n[z.farbe] ?? 0) + 1
      return n
    }
    expect(zaehle(mische(s))).toEqual(zaehle(s))
  })
})

describe('Die Level', () => {
  const alle = Array.from({ length: DUMPLING_MAX_LEVEL }, (_, i) => createDumplingLevel(i + 1))

  it('legt 300 Level an, jedes zwanzigste als Tor', () => {
    expect(alle).toHaveLength(300)
    for (const l of alle) expect(l.isGate).toBe(isSegmentGate(l.level))
    expect(alle.filter((l) => l.isGate)).toHaveLength(300 / SEGMENT_SIZE)
  })

  it('gibt jedem Level ein Feld ohne fertige Reihen und mit mehreren Zügen', () => {
    for (const l of alle) {
      expect(l.feld).toHaveLength(REIHEN * SPALTEN)
      expect(findeTreffer(l.feld, l.rows, l.cols)).toEqual([])
      const s = createDumplingMatch(l)
      expect(`Level ${l.level}: ${moeglicheZuege(s).length} Züge`).not.toBe(
        `Level ${l.level}: 0 Züge`,
      )
    }
  })

  it('wird schwerer: mehr Farben, höheres Ziel, mehr Käfige', () => {
    expect(alle[0]!.farben).toBe(4)
    expect(alle[299]!.farben).toBe(6)
    expect(alle[299]!.ziel).toBeGreaterThan(alle[0]!.ziel * 3)
    expect(alle[0]!.kaefige).toBe(0)
    expect(alle[299]!.kaefige).toBeGreaterThanOrEqual(6)
    for (const l of alle) {
      expect(l.farben).toBeGreaterThanOrEqual(4)
      expect(l.farben).toBeLessThanOrEqual(6)
    }
  })

  it('hält die ersten elf Level käfigfrei – erst die Regel, dann die Hürde', () => {
    for (const l of alle.slice(0, 11)) expect(l.kaefige).toBe(0)
    expect(alle[11]!.kaefige).toBeGreaterThanOrEqual(1)
  })

  it('steigt ab Level 21 ohne Rückschritt an', () => {
    const werte: number[] = []
    for (let L = 21; L <= DUMPLING_MAX_LEVEL; L++) {
      if (isSegmentGate(L)) continue
      werte.push(schwierigkeit(L))
    }
    for (let i = 1; i < werte.length; i++) expect(werte[i]!).toBeGreaterThan(werte[i - 1]!)
    // Die Lernphase bleibt flach.
    for (let L = 1; L <= 20; L++) {
      if (!isSegmentGate(L)) expect(schwierigkeit(L)).toBeLessThanOrEqual(0.2)
    }
  })

  it('macht das Tor schwerer als das Level davor', () => {
    for (let L = SEGMENT_SIZE; L <= DUMPLING_MAX_LEVEL; L += SEGMENT_SIZE) {
      expect(schwierigkeit(L)).toBeGreaterThan(schwierigkeit(L - 1))
      expect(createDumplingLevel(L).ziel).toBeGreaterThan(createDumplingLevel(L - 1).ziel)
    }
  })

  it('ist immer gleich aufgebaut – gleiches Level, gleiches Feld', () => {
    for (const n of [1, 17, 140]) {
      const a = createDumplingLevel(n)
      const b = createDumplingLevel(n)
      expect(b.feld).toEqual(a.feld)
      expect({ ziel: b.ziel, zeit: b.zeit, farben: b.farben }).toEqual({
        ziel: a.ziel,
        zeit: a.zeit,
        farben: a.farben,
      })
    }
  })

  it('spielt sich gleich, wenn man dieselben Züge macht', () => {
    const zuege: [number, number][] = []
    let a = createDumplingMatch(createDumplingLevel(30))
    for (let n = 0; n < 8 && a.phase === 'play'; n++) {
      const m = moeglicheZuege(a)
      if (m.length === 0) break
      zuege.push(m[0]!)
      a = tausche(a, m[0]![0], m[0]![1]).state
    }
    let b = createDumplingMatch(createDumplingLevel(30))
    for (const [x, y] of zuege) b = tausche(b, x, y).state
    expect(b.feld).toEqual(a.feld)
    expect(b.gesammelt).toBe(a.gesammelt)
  })

  it('bleibt außerhalb seiner Grenzen stehen', () => {
    expect(createDumplingLevel(0).level).toBe(1)
    expect(createDumplingLevel(999).level).toBe(DUMPLING_MAX_LEVEL)
  })
})

/**
 * Zwei Bots als Maßstab.
 *
 * `klug` sucht den Zug, der am meisten bringt, und zieht flott -- das ist,
 * wer das Spiel verstanden hat. `naiv` nimmt irgendeinen gültigen Zug und
 * lässt sich Zeit -- das ist, wer einfach drauflostippt. Die Sekunden je
 * Zug sind die Annahme, an der die Zeitvorgaben der Level hängen.
 */
const SEK_KLUG = 1.3
const SEK_NAIV = 2.2

function bestenZug(s: DumplingState): [number, number] | null {
  const zuege = moeglicheZuege(s)
  if (zuege.length === 0) return null
  let beste = zuege[0]!
  let wert = -1
  for (const [a, b] of zuege) {
    const r = tausche(s, a, b)
    const gewinn = r.state.gesammelt - s.gesammelt + (s.kaefigeZu - r.state.kaefigeZu) * 4
    if (gewinn > wert) {
      wert = gewinn
      beste = [a, b]
    }
  }
  return beste
}

function spiele(level: number, klug: boolean, saat = 1) {
  const cfg = createDumplingLevel(level)
  let s = createDumplingMatch(cfg)
  let zuege = 0
  let w = (level * 31 + saat * 7919) >>> 0
  for (let n = 0; n < 500 && s.phase === 'play'; n++) {
    const moeglich = moeglicheZuege(s)
    if (moeglich.length === 0) break
    w = (w * 1664525 + 1013904223) >>> 0
    const zug = klug ? bestenZug(s)! : moeglich[w % moeglich.length]!
    s = tausche(s, zug[0], zug[1]).state
    zuege++
  }
  const gebraucht = zuege * (klug ? SEK_KLUG : SEK_NAIV)
  return {
    zuege,
    gebraucht,
    /** Anteil der Zeit, der übrig bleibt. Negativ heißt: zu langsam. */
    luft: (cfg.zeit - gebraucht) / cfg.zeit,
    gewonnen: s.phase === 'won',
  }
}

describe('Zu schaffen', () => {
  it('lässt jedes der 300 Level in der vorgegebenen Zeit gewinnen', () => {
    const zuKnapp: string[] = []
    for (let L = 1; L <= DUMPLING_MAX_LEVEL; L++) {
      const r = spiele(L, true)
      if (!r.gewonnen) zuKnapp.push(`Level ${L}: kein Sieg`)
      // Ein Viertel Luft muss bleiben -- ein Mensch ist kein Bot.
      else if (r.luft < 0.25) zuKnapp.push(`Level ${L}: nur ${Math.round(r.luft * 100)}% Luft`)
    }
    expect(zuKnapp).toEqual([])
  }, 180_000)

  it('lässt die Lernphase auch ohne Nachdenken durchgehen', () => {
    const raus: number[] = []
    for (let L = 1; L < 20; L++) {
      const treffer = [1, 2, 3].filter((k) => {
        const r = spiele(L, false, k)
        return r.gewonnen && r.luft >= 0
      }).length
      if (treffer < 2) raus.push(L)
    }
    expect(raus).toEqual([])
  }, 120_000)
})

describe('Es wird schwerer', () => {
  const mittel = (von: number, bis: number) => {
    const werte: number[] = []
    for (let L = von; L <= bis; L += 3) {
      if (isSegmentGate(L)) continue
      werte.push(spiele(L, false).luft)
    }
    return werte.reduce((a, b) => a + b, 0) / werte.length
  }

  it('lässt dem, der einfach drauflostippt, immer weniger Luft', () => {
    // Das ist die Messung zu "das Spiel wird immer schwerer": Wie viel von
    // der Zeit bleibt übrig, wenn man ohne Plan spielt?
    const frueh = mittel(1, 20)
    const mitte = mittel(21, 100)
    const spaet = mittel(101, 200)
    const ende = mittel(201, 300)
    expect(frueh).toBeGreaterThan(0.35)
    expect(mitte).toBeLessThan(frueh)
    expect(spaet).toBeLessThan(mitte)
    expect(ende).toBeLessThan(spaet)
    expect(ende).toBeLessThan(0.12)
  }, 180_000)
})

describe('Die Sammlung', () => {
  it('hat fünfzehn Knödel mit steigenden Freischaltstufen', () => {
    expect(SAMMEL_KNOEDEL).toHaveLength(15)
    for (let i = 1; i < SAMMEL_KNOEDEL.length; i++) {
      expect(SAMMEL_KNOEDEL[i]!.abLevel).toBeGreaterThan(SAMMEL_KNOEDEL[i - 1]!.abLevel)
    }
    expect(SAMMEL_KNOEDEL[0]!.abLevel).toBe(1)
    expect(SAMMEL_KNOEDEL.at(-1)!.abLevel).toBe(DUMPLING_MAX_LEVEL)
    expect(new Set(SAMMEL_KNOEDEL.map((k) => k.id)).size).toBe(15)
  })

  it('gibt einen Knödel dazu, je weiter man kommt', () => {
    expect(freigeschaltet(0)).toHaveLength(1)
    expect(freigeschaltet(1)).toHaveLength(1)
    expect(freigeschaltet(5).map((k) => k.id)).toContain('bao-rot')
    expect(freigeschaltet(DUMPLING_MAX_LEVEL)).toHaveLength(15)
    for (let L = 1; L < DUMPLING_MAX_LEVEL; L++) {
      expect(freigeschaltet(L + 1).length).toBeGreaterThanOrEqual(freigeschaltet(L).length)
    }
  })

  it('sagt, welches Level welchen Knödel bringt und was als Nächstes kommt', () => {
    expect(belohnungFuer(5)!.id).toBe('bao-rot')
    expect(belohnungFuer(6)).toBeNull()
    expect(naechsteBelohnung(1)!.abLevel).toBe(5)
    expect(naechsteBelohnung(DUMPLING_MAX_LEVEL)).toBeNull()
  })

  it('fällt auf den ersten zurück, wenn eine Kennung nicht passt', () => {
    expect(knoedelFuer('gibt-es-nicht').id).toBe('bao-klassik')
    expect(knoedelFuer(null).id).toBe('bao-klassik')
    expect(knoedelFuer('bao-gold').name).toBe('Goldener Bao')
  })
})

describe('Wertung', () => {
  const roheDaten = (restzeit: number, kette = 1) => ({
    won: true,
    gesammelt: 60,
    restzeit,
    besteKette: kette,
  })

  it('gibt nichts für ein verlorenes Level', () => {
    expect(squishyDumplingsGame.calculateScore(5, { won: false, gesammelt: 40 })).toBe(0)
    expect(squishyDumplingsGame.calculateXP(5, 0)).toBe(0)
    expect(squishyDumplingsGame.calculateStars!(5, 0)).toBe(0)
  })

  it('belohnt Restzeit und lange Ketten', () => {
    expect(squishyDumplingsGame.calculateScore(5, roheDaten(30))).toBeGreaterThan(
      squishyDumplingsGame.calculateScore(5, roheDaten(5)),
    )
    expect(squishyDumplingsGame.calculateScore(5, roheDaten(10, 4))).toBeGreaterThan(
      squishyDumplingsGame.calculateScore(5, roheDaten(10, 1)),
    )
  })

  it('vergibt Sterne von eins bis fünf, und mehr Punkte sind nie weniger Sterne', () => {
    const sterne = [0, 10, 20, 30, 45].map((t) =>
      squishyDumplingsGame.calculateStars!(5, squishyDumplingsGame.calculateScore(5, roheDaten(t))),
    )
    expect(Math.min(...sterne)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...sterne)).toBe(5)
    for (let i = 1; i < sterne.length; i++)
      expect(sterne[i]!).toBeGreaterThanOrEqual(sterne[i - 1]!)
  })

  it('ist im Spielverzeichnis eingetragen', () => {
    expect(squishyDumplingsGame.id).toBe('squishy-dumplings')
    expect(squishyDumplingsGame.maxLevel).toBe(DUMPLING_MAX_LEVEL)
    const cfg = squishyDumplingsGame.createLevel(42)
    expect(cfg.level).toBe(42)
    expect(cfg.ziel).toBe(createDumplingLevel(42).ziel)
  })
})

describe('Tauschprüfung', () => {
  it('sagt vorher, ob ein Tausch etwas bringt', () => {
    const s = roh(level(['221 3 4', '342 5 3', '453 4 5', '534 5 3']))
    expect(tauschBringtEtwas(s, 2, 7)).toBe(true)
    expect(tauschBringtEtwas(s, 0, 1)).toBe(false)
  })

  it('listet alle Züge, die etwas bringen', () => {
    const s = roh(level(['221 3 4', '342 5 3', '453 4 5', '534 5 3']))
    const zuege = moeglicheZuege(s)
    expect(zuege.length).toBeGreaterThan(0)
    for (const [a, b] of zuege) expect(tauschBringtEtwas(s, a, b)).toBe(true)
  })
})

/**
 * Die Sonderknödel, so wie Thomas sie am 10.09.2026 beschrieben hat:
 *
 *   "Sollte man fünf in einer Reihe bekommen, soll ein golden glänzender
 *    rauskommen von der Farbe. Und wenn man den mit einem anderen
 *    kombiniert, also rechts oder links daneben eine Dreierreihe mit ihm
 *    hinbekommt, explodieren alle in derselben Farbe einmal. [...] Bei
 *    einer Viererreihe, dass diagonal alle weggesprengt werden, wenn mit
 *    dem neuen besonderen Viererding noch mal mindestens ein Dreier
 *    gemacht worden ist."
 *
 * Beide entstehen also aus der langen Reihe und wirken erst beim nächsten
 * Mal. Das ist der Kern: Man kann sie sich aufheben.
 */
describe('Sonderknödel', () => {
  it('macht aus einer Viererreihe einen diagonalen Knödel', () => {
    const st = roh(level(['11213', '54124', '32452', '25345']))
    const e = tausche(st, 2, 7)
    expect(e.gueltig).toBe(true)
    // Er liegt dort, wo der Finger war -- nicht am anderen Ende der Reihe.
    expect(e.schritte[0]!.neue).toEqual([{ platz: 2, art: 'diagonal' }])
    expect(e.state.feld[2]!.spezial).toBe('diagonal')
    expect(e.state.feld[2]!.farbe).toBe(1)
  })

  it('macht aus einer Fünferreihe einen goldenen Knödel', () => {
    const st = roh(level(['11211', '54124', '32452', '25345']))
    const e = tausche(st, 2, 7)
    expect(e.schritte[0]!.neue).toEqual([{ platz: 2, art: 'gold' }])
    expect(e.state.feld[2]!.spezial).toBe('gold')
    expect(e.state.feld[2]!.farbe).toBe(1)
  })

  it('zählt den Sonderknödel nicht als eingesammelt – er bleibt ja liegen', () => {
    const st = roh(level(['11213', '54124', '32452', '25345']))
    const e = tausche(st, 2, 7)
    // Vier verschwinden, einer bleibt als Sonderknödel: drei gesammelt.
    expect(e.schritte[0]!.treffer).toHaveLength(4)
    expect(e.state.gesammelt).toBe(3)
  })

  it('lässt beim Goldenen alle seiner Farbe platzen – auch weit weg', () => {
    // a = goldener Knödel der Farbe 1. Der Tausch macht mit ihm einen Dreier.
    const st = roh(level(['21345', 'a3152', '45234', '32415']))
    const e = tausche(st, 6, 1)
    expect(e.gueltig).toBe(true)
    const schritt = e.schritte[0]!
    expect(schritt.gezuendet).toContain(5)
    // Die 1 unten rechts (Feld 18) liegt in keiner Reihe und geht trotzdem mit.
    expect(schritt.treffer).toContain(18)
    // Nach dem Zug ist keine einzige 1 mehr übrig, die vorher dalag.
    expect(schritt.treffer.length).toBeGreaterThanOrEqual(4)
  })

  it('fegt beim Diagonalen beide Schrägen leer', () => {
    // p = diagonaler Knödel der Farbe 1, in der Mitte eines 5x5-Feldes.
    const st = roh(level(['34523', '45234', '51p25', '23412', '42351']))
    const e = tausche(st, 13, 18)
    expect(e.gueltig).toBe(true)
    const schritt = e.schritte[0]!
    expect(schritt.gezuendet).toContain(12)
    // Beide Diagonalen durch Feld 12 (Zeile 2, Spalte 2).
    for (const i of [0, 6, 12, 18, 24, 4, 8, 16, 20]) {
      expect(`Feld ${i}`).toBe(schritt.treffer.includes(i) ? `Feld ${i}` : `Feld ${i} fehlt`)
    }
  })

  it('zündet einen Sonderknödel, den eine Sprengung mitreißt, gleich mit', () => {
    // Der Diagonale (p, Feld 12) reißt Feld 0 mit -- dort liegt ein goldener
    // Zweier, und der nimmt dann alle Zweien mit.
    const st = roh(level(['b4523', '45234', '51p25', '23412', '42351']))
    const e = tausche(st, 13, 18)
    const schritt = e.schritte[0]!
    expect(schritt.gezuendet).toContain(12)
    expect(schritt.gezuendet).toContain(0)
    // Die 2 in Feld 3 liegt auf keiner Diagonale und in keiner Reihe.
    expect(schritt.treffer).toContain(3)
  })

  it('lässt Sonderknödel ganz normal nachrutschen', () => {
    const st = roh(level(['54213', 'a2541', '33452', '25314'], 6))
    // Unter dem Goldenen wird geräumt, also fällt er nach unten.
    const vorher = st.feld.findIndex((z) => z.spezial === 'gold')
    const e = tausche(st, 12, 17)
    expect(e.gueltig).toBe(true)
    const nachher = e.state.feld.findIndex((z) => z.spezial === 'gold')
    expect(nachher === -1 || nachher >= vorher).toBe(true)
  })

  it('behält beim Mischen Farbe und Sonderart zusammen', () => {
    const st = roh(level(['12345', 'a2345', '12345', '12345']))
    const gemischt = mische(st)
    const gold = gemischt.feld.filter((z) => z.spezial === 'gold')
    expect(gold).toHaveLength(1)
    expect(gold[0]!.farbe).toBe(1)
  })
})
