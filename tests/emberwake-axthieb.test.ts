/**
 * Emberwake: der Axthieb des Trägers (render/axtHieb.ts). Ein Hieb holt vorn
 * über den Kopf aus und schlägt über den Kopf nach vorn unten -- nie unten
 * herum an der Hüfte vorbei, wie es bis zum 27.11.2026 aussah.
 */
import { describe, it, expect } from 'vitest'
import { axtStellung, kampfStellung, AXT_BEREIT } from '@/games/emberwake/render/axtHieb'

/** Zwei Stellungen gleich bis auf Rundung. */
function gleich(a: object, b: object): void {
  for (const [k, v] of Object.entries(a))
    expect(v).toBeCloseTo((b as Record<string, number>)[k]!, 9)
}

const phasen = (von: number, bis: number, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => von + ((bis - von) * i) / n)

describe('Emberwake: Axthieb', () => {
  it('ist ein geschlossener Kreis: das Ende eines Hiebs ist der Anfang des nächsten', () => {
    gleich(axtStellung(0), axtStellung(1))
  })

  it('trifft vorn unten, mit gestrecktem Arm und vorgebeugtem Oberkörper', () => {
    const t = axtStellung(1)
    expect(t.schulter).toBeGreaterThan(0.3)
    expect(t.schulter).toBeLessThan(Math.PI / 2)
    expect(t.ellbogen).toBeLessThan(0.2)
    expect(t.rumpf).toBeLessThan(0)
  })

  it('steht oben hinter dem Kopf und lehnt dabei zurück', () => {
    const o = axtStellung(0.7)
    expect(o.schulter).toBeGreaterThan(Math.PI)
    expect(o.rumpf).toBeGreaterThan(0)
  })

  it('holt vorn hoch aus und schlägt über den Kopf -- der Arm kommt nie nach unten hinten', () => {
    // Unten hinten hieße Winkel unter 0: Dort hing der Arm hinter der Hüfte.
    for (const p of phasen(0, 1)) expect(axtStellung(p).schulter).toBeGreaterThanOrEqual(0.4)
    // Der Schlag läuft in einer Richtung: über den Kopf nach vorn.
    const schlag = phasen(0.74, 1).map((p) => axtStellung(p).schulter)
    for (let i = 1; i < schlag.length; i++) expect(schlag[i]!).toBeLessThanOrEqual(schlag[i - 1]!)
  })

  it('schlägt schnell zu: das letzte Viertel bringt den größten Teil des Wegs', () => {
    const oben = axtStellung(0.74).schulter
    const spaet = axtStellung(0.9).schulter
    const treffer = axtStellung(1).schulter
    expect(oben - spaet).toBeLessThan(spaet - treffer)
  })

  it('im Kampf: fast oben anfangen, durchschlagen, in die Bereitschaft zurück', () => {
    expect(kampfStellung(1).schulter).toBeGreaterThan(Math.PI)
    expect(kampfStellung(0.65).schulter).toBeCloseTo(axtStellung(1).schulter, 5)
    gleich(kampfStellung(0), AXT_BEREIT)
  })
})
