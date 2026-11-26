/**
 * Der Computer bei Dame: nimmt mit, was frei liegt, sieht einfache Fallen
 * und Schläge -- nur die leichte Stufe nicht, und das ist Absicht.
 */
import { describe, it, expect } from 'vitest'
import {
  STANDARD_REGELN,
  alsText,
  bewerte,
  grundstellung,
  schluessel,
  stellungAus,
  waehleZug,
  type DameRegeln,
  type DameStufe,
  type KiAuftrag,
  type Stellung,
} from '@/games/dame'

function frage(
  s: Stellung,
  stufe: DameStufe,
  extra: Partial<KiAuftrag> = {},
  regeln: DameRegeln = STANDARD_REGELN,
) {
  return waehleZug({
    stellung: alsText(s),
    regeln,
    verlauf: [schluessel(s)],
    stufe,
    seed: 7,
    ...extra,
  })
}

const OHNE_ZWANG = { ...STANDARD_REGELN, schlagzwang: false }
const GENAU = { rauschen: 0, zufall: 0 }

describe('Dame-Rechner', () => {
  it('bewertet die Grundstellung ausgeglichen', () => {
    expect(bewerte(grundstellung(), STANDARD_REGELN)).toBe(0)
  })

  it('nimmt einen Gewinn mit -- jede Stufe, auch mit Zufall', () => {
    // Ohne Schlagzwang müsste er nicht schlagen; der Schlag beendet aber die Partie.
    const s = stellungAus({ w: ['c3', 'g1'], b: ['d4'] })
    for (let seed = 1; seed <= 12; seed++) {
      expect(frage(s, 'leicht', { seed }, OHNE_ZWANG)).toBe('c3xe5')
    }
    expect(frage(s, 'mittel', {}, OHNE_ZWANG)).toBe('c3xe5')
  })

  it('nimmt einen freien Stein mit, wenn er nicht muss', () => {
    const s = stellungAus({ w: ['c3', 'g1'], b: ['d4', 'h8', 'b8'] })
    expect(frage(s, 'mittel', { werte: GENAU }, OHNE_ZWANG)).toBe('c3xe5')
  })

  it('mittel stellt keinen Stein ein; leicht sieht das Zurückschlagen nicht', () => {
    // c3-d4 sieht gut aus (Mitte, vorgerückt), aber e5 schlägt nach c3 zurück.
    const s = stellungAus({ w: ['c3', 'a1', 'g1'], b: ['e5', 'h8'] })
    for (let seed = 1; seed <= 8; seed++) {
      expect(frage(s, 'mittel', { seed })).not.toBe('c3-d4')
    }
    expect(frage(s, 'leicht', { werte: GENAU })).toBe('c3-d4')
  })

  it('sieht den Schlag: einen Stein geben, zwei bekommen', () => {
    // c3-d4! e5 muss schlagen (e5xc3, a1 versperrt das Weiterschlagen), dann b2xd4xb6.
    const s = stellungAus({ w: ['a1', 'b2', 'c3', 'e3'], b: ['e5', 'c5', 'h8'] })
    expect(frage(s, 'mittel', { werte: GENAU })).toBe('c3-d4')
    expect(frage(s, 'schwer', { werte: { zeitMs: 400 } })).toBe('c3-d4')
  })

  it('zieht mit demselben Startwert dasselbe', () => {
    const s = grundstellung()
    const a = frage(s, 'leicht', { seed: 42 })
    const b = frage(s, 'leicht', { seed: 42 })
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-h][1-8]-[a-h][1-8]$/)
  })

  it('liefert null, wenn es keinen Zug gibt', () => {
    const s = stellungAus({ w: ['a7', 'c7', 'd6'], b: ['b8'] }, 'b')
    expect(frage(s, 'schwer', { werte: { zeitMs: 50 } })).toBeNull()
    expect(frage(s, 'leicht')).toBeNull()
  })

  it('spielt mit der Hausregel „Dame zieht ein Feld“ nur kurze Damenzüge', () => {
    const s = stellungAus({ w: ['Dd4'], b: ['h8', 'b8'] })
    const kurzeDame = { ...STANDARD_REGELN, fliegendeDame: false }
    const zug = frage(s, 'mittel', { werte: GENAU }, kurzeDame)!
    const [von, nach] = zug.split('-')
    expect(Math.abs(von!.charCodeAt(0) - nach!.charCodeAt(0))).toBe(1)
  })
})
