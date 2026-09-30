/**
 * Was nach einer Partie gegen den Rechner gespeichert wird.
 *
 * Thomas am 30.09.2026: "wenn man gewinnt und verliert speichern".
 *
 * Gespeichert wurde beides schon -- aber eine Zeile stimmte nicht: Die
 * Seite meldete JEDE gewonnene Partie als Bestwert und keine verlorene.
 * Damit war eine vierzig Punkte schwache Partie ein Rekord und eine knapp
 * verlorene mit dreihundert keiner. Das hier hält fest, was gilt: Der
 * Bestwert ist die höchste Punktzahl, der Sieg bringt XP.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { leererBlock, type Block, type KniffelZustand } from '@/games/kniffel'

vi.mock('@/database/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: vi.fn(async () => ({ data: true, error: null })) },
}))
vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => null),
  getMyUsername: vi.fn(async () => null),
}))

function mitPunkten(punkte: number): Block {
  // Die Chance zählt die Augen unverändert -- der kürzeste Weg zu einer
  // bestimmten Punktzahl, ohne die Wertung nachzubauen.
  return { ...leererBlock(), chance: punkte }
}

/** Eine beendete Partie: ich mit `meine`, ein Rechner mit `seine`. */
function partie(meine: number, seine: number): KniffelZustand {
  const ichGewinne = meine >= seine
  return {
    phase: 'ende',
    spieler: [
      { id: 'p0', name: 'Du', typ: 'mensch', kiStufe: null, block: mitPunkten(meine) },
      { id: 'p1', name: 'Rechner 1', typ: 'ki', kiStufe: 'schwer', block: mitPunkten(seine) },
    ],
    amZug: 0,
    wuerfel: [0, 0, 0, 0, 0],
    gehalten: [false, false, false, false, false],
    wurfNummer: 0,
    runde: 13,
    protokoll: [],
    seed: 1,
    rngZaehler: 0,
    siegerId: ichGewinne ? 'p0' : 'p1',
    version: 1,
  }
}

async function teile() {
  const { buchePartie } = await import('@/pages/play/kniffel/partieBuchen')
  const { db } = await import('@/offline/db')
  return { buchePartie, db }
}

describe('Eine Partie buchen', () => {
  beforeEach(async () => {
    const { db } = await teile()
    await db.gameResults.clear()
    await db.personalRecords.clear()
    await db.syncOutbox.clear()
  })

  it('speichert auch die verlorene Partie', async () => {
    const { buchePartie, db } = await teile()
    const gebucht = await buchePartie(partie(198, 245), 'aaaa-1')

    expect(gebucht?.gewonnen).toBe(false)
    expect(gebucht?.punkte).toBe(198)

    const ergebnisse = await db.gameResults.toArray()
    expect(ergebnisse).toHaveLength(1)
    expect(ergebnisse[0]?.score).toBe(198)

    // Und sie geht auch an die Bestenliste: Eine Rangliste, in der nur
    // Siege auftauchen, kann keine Partien zählen.
    const meldung = (await db.syncOutbox.toArray()).find((e) => e.type === 'kniffel_partie')
    expect(meldung?.payload).toMatchObject({
      partieId: 'aaaa-1',
      punkte: 198,
      besterGegner: 245,
      mitspieler: 2,
      stufe: 'schwer',
    })
  })

  it('speichert die gewonnene Partie und legt XP drauf', async () => {
    const { buchePartie } = await teile()
    const verloren = await buchePartie(partie(200, 260), 'aaaa-2')
    const gewonnen = await buchePartie(partie(200, 100), 'aaaa-3')

    // Gleiche Punktzahl, einmal gewonnen: derselbe Punktestand, mehr XP.
    expect(verloren?.xp).toBe(50)
    expect(gewonnen?.xp).toBe(90)
    expect(gewonnen?.gewonnen).toBe(true)
  })

  it('macht den Bestwert an der Punktzahl fest, nicht am Sieg', async () => {
    const { buchePartie, db } = await teile()

    const erste = await buchePartie(partie(150, 100), 'bbbb-1')
    expect(erste?.bestwert).toBe(true)

    // Knapp verloren, aber die beste Partie, die ich je gespielt habe.
    const beste = await buchePartie(partie(300, 310), 'bbbb-2')
    expect(beste?.bestwert).toBe(true)
    expect(beste?.gewonnen).toBe(false)

    // Ein schwacher Sieg ist kein Bestwert -- genau das war der Fehler.
    const schwach = await buchePartie(partie(40, 20), 'bbbb-3')
    expect(schwach?.gewonnen).toBe(true)
    expect(schwach?.bestwert).toBe(false)

    const rekord = await db.personalRecords.toArray()
    expect(rekord[0]?.bestScore).toBe(300)
  })

  it('bucht nichts, wenn niemand am Tisch saß', async () => {
    const { buchePartie, db } = await teile()
    const nur = partie(100, 100)
    nur.spieler = nur.spieler.filter((s) => s.typ === 'ki')

    expect(await buchePartie(nur, 'cccc-1')).toBeNull()
    expect(await db.gameResults.count()).toBe(0)
  })
})
