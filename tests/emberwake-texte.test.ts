/**
 * EMBERWAKE — die Oberfläche in beiden Sprachen.
 *
 * Die Inhalte (Gegenstände, Gebäude, Level) stehen zweimal da: in `data/`
 * als deutsche Kennung und im Wörterbuch. Der erste Block hält beide gleich.
 * Der Rest prüft, dass die Oberfläche der gewählten Sprache folgt und dass
 * die deutschen Texte aus der Simulation (Gründe, Todesursache, Hinweise)
 * beim Anzeigen erkannt werden.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { de } from '@/i18n/texte/de'
import { en } from '@/i18n/texte/en'
import { ITEMS } from '@/games/emberwake/data/items'
import { BUILDINGS } from '@/games/emberwake/data/buildings'
import { ENEMIES } from '@/games/emberwake/data/enemies'
import { RECIPES } from '@/games/emberwake/data/recipes'
import { LEVELS, WORLDS, getLevel, getWorldForLevel } from '@/games/emberwake/data/levels'
import type { BuildingId, EnemyId, ItemId } from '@/games/emberwake/data/schema/types'
import { generateWorld } from '@/games/emberwake/world/WorldGen'
import { canBuild } from '@/games/emberwake/systems/BaseSystem'
import { defaultProfile } from '@/games/emberwake/save/schema'
import { UiRoot, type UiCallbacks } from '@/games/emberwake/ui/UiRoot'
import {
  aktionText,
  emberwakeTexte,
  grundText,
  hinweisText,
  todesursache,
} from '@/games/emberwake/ui/texte'

const LEER = { buildings: {}, stock: {}, tools: [] as never[] }
const DE = de.emberwake
const EN = en.emberwake

function welt(levelId: number) {
  const level = getLevel(levelId)!
  return generateWorld(level, getWorldForLevel(level), LEER)
}

/** Alle Rückrufe tun nichts -- hier geht es nur um Text. */
const stumm = new Proxy({}, { get: () => () => undefined }) as UiCallbacks

function oberflaeche(sprache: 'de' | 'en'): UiRoot {
  localStorage.setItem('te-sprache', sprache)
  return new UiRoot(document.createElement('div'), stumm)
}

afterEach(() => {
  localStorage.removeItem('te-sprache')
})

describe('Emberwake – Wörterbuch und data/ stimmen überein', () => {
  it('nennt jeden Gegenstand wie data/items.ts', () => {
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      expect(DE.gegenstaende[id]).toBe(ITEMS[id].name)
    }
  })

  it('beschreibt jedes Gebäude und jede Stufe wie data/buildings.ts', () => {
    for (const id of Object.keys(BUILDINGS) as BuildingId[]) {
      expect(DE.gebaeude[id].name).toBe(BUILDINGS[id].name)
      expect(DE.gebaeude[id].stufen).toEqual(BUILDINGS[id].levels.map((l) => l.description))
      expect(EN.gebaeude[id].stufen).toHaveLength(BUILDINGS[id].levels.length)
    }
  })

  it('beschreibt jedes Rezept wie data/recipes.ts', () => {
    for (const r of RECIPES) {
      expect((DE.rezepte as Record<string, string>)[r.id]).toBe(r.description)
      expect(DE.gegenstaende[r.result]).toBe(r.name)
    }
  })

  it('kennt jede Todesursache durch einen Gegner', () => {
    for (const id of Object.keys(ENEMIES) as EnemyId[]) {
      expect(DE.getoetetVon[id]).toBe(ENEMIES[id].killVerb)
    }
  })

  it('kennt jedes Level und jede Welt mit allen Texten', () => {
    for (const w of WORLDS) {
      expect((DE.welten as Record<number, string>)[w.id]).toBe(w.name)
    }
    for (const l of LEVELS) {
      const t = (DE.level as Record<number, (typeof DE.level)[keyof typeof DE.level] | undefined>)[
        l.id
      ]
      expect(t, `Level ${l.id} fehlt im Wörterbuch`).toBeDefined()
      const hinweise = t!.hinweise as Record<string, string>
      expect(t!.name).toBe(l.name)
      expect(t!.untertitel).toBe(l.subtitle)
      expect(t!.hauptziel).toBe(l.objectives.primary.text)
      expect(t!.zusatzziel).toBe(l.objectives.secondary.text)
      expect(t!.geheimnis).toBe(l.secret.text)
      expect(t!.lore).toEqual(l.lore)
      expect(Object.keys(hinweise).sort()).toEqual(l.hints.map((h) => h.trigger).sort())
      for (const h of l.hints) expect(hinweise[h.trigger]).toBe(h.text)
    }
  })
})

describe('Emberwake – Texte aus der Simulation', () => {
  it('übersetzt den Grund, warum etwas nicht gebaut werden kann', () => {
    const w = welt(1)
    const grund = canBuild(w, 'workbench').reason
    expect(grund).toBe('Noch nicht freigeschaltet')
    expect(grundText(EN, grund!)).toBe('Not unlocked yet')
    expect(grundText(DE, grund!)).toBe(grund)
    expect(grundText(EN, 'Werkbank nötig')).toBe('Workbench required')
    for (const schluessel of Object.keys(DE.gruende) as Array<keyof typeof DE.gruende>) {
      const wert = DE.gruende[schluessel]
      if (typeof wert === 'string') expect(grundText(EN, wert)).toBe(EN.gruende[schluessel])
    }
  })

  it('übersetzt die Todesursache', () => {
    expect(todesursache(EN, ENEMIES.hetzer.killVerb)).toBe('A Harrier ran you down')
    expect(todesursache(EN, 'Der Kern erlosch nach 1:05')).toBe('The core went out after 1:05')
    expect(todesursache(DE, 'Der Kern erlosch nach 1:05')).toBe('Der Kern erlosch nach 1:05')
    // Unbekanntes bleibt stehen statt zu verschwinden.
    expect(todesursache(EN, 'Etwas anderes')).toBe('Etwas anderes')
  })

  it('übersetzt Hinweise über ihren Auslöser', () => {
    const level = getLevel(1)!
    expect(hinweisText(EN, level, 'Fälle einen Baum für den Kern')).toBe('Fell a tree for the core')
    expect(hinweisText(DE, level, 'Fälle einen Baum für den Kern')).toBe(
      'Fälle einen Baum für den Kern',
    )
  })

  it('beschriftet den Aktionsknopf in der gewählten Sprache', () => {
    const w = welt(1)
    w.interactable = { kind: 'core', id: 0, label: 'Lager' }
    expect(aktionText(EN, w)).toBe('Camp')
    expect(aktionText(DE, w)).toBe('Lager')
    const baum = w.nodes.find((n) => n.form === 'baum')!
    w.interactable = { kind: 'node', id: baum.id, label: 'Baum fällen' }
    expect(aktionText(EN, w)).toBe('Fell tree')
    w.interactable = { kind: 'secret', id: 0, label: 'Untersuchen' }
    expect(aktionText(EN, w)).toBe('Examine')
  })
})

describe('Emberwake – Oberfläche folgt der Sprache der App', () => {
  it('liest die Sprache wie die App', () => {
    localStorage.setItem('te-sprache', 'en')
    expect(emberwakeTexte()).toBe(EN)
    localStorage.setItem('te-sprache', 'de')
    expect(emberwakeTexte()).toBe(DE)
  })

  it('zeigt Titel und Levelauswahl auf Englisch', () => {
    const ui = oberflaeche('en')
    ui.showTitle(defaultProfile(), false, true, true)
    const titel = ui.root.textContent ?? ''
    expect(titel).toContain('Play')
    expect(titel).toContain('Choose level')
    expect(titel).toContain('Every step away from camp makes your camp darker.')
    expect(titel).toContain('← Back to overview')
    expect(titel).not.toContain('Spielen')
    expect(titel).not.toContain('Leben')

    ui.showLevels(defaultProfile())
    const liste = ui.root.textContent ?? ''
    expect(liste).toContain('World 1 · The Ashwood')
    expect(liste).toContain('First Ember')
    expect(liste).toContain('Locked')
    expect(liste).not.toContain('Erste Glut')
  })

  it('zeigt Titel und Levelauswahl auf Deutsch', () => {
    const ui = oberflaeche('de')
    ui.showTitle(defaultProfile(), false, true, true)
    const titel = ui.root.textContent ?? ''
    expect(titel).toContain('Spielen')
    expect(titel).toContain('Level wählen')
    expect(titel).toContain('Jeder Schritt vom Lager weg macht dein Lager dunkler.')
    expect(titel).not.toContain('Play')

    ui.showLevels(defaultProfile())
    const liste = ui.root.textContent ?? ''
    expect(liste).toContain('Welt 1 · Der Aschenwald')
    expect(liste).toContain('Erste Glut')
    expect(liste).toContain('Gesperrt')
  })

  it('zeigt Kopfleiste und Lager in der gewählten Sprache', () => {
    const w = welt(1)
    w.camp.stock = { wood: 3 }

    const englisch = oberflaeche('en')
    englisch.updateHud(w, 0, null, 3)
    const hud = englisch.root.textContent ?? ''
    expect(hud).toContain('Bring the core to 80 %')
    expect(hud).toContain('★★ In under five minutes')
    expect(hud).toContain('Load')
    englisch.showCamp(w, 'core')
    const lager = englisch.root.textContent ?? ''
    expect(lager).toContain('Feed the core')
    expect(lager).toContain('+4 % per tinderwood · 3 wood in camp')
    englisch.showCamp(w, 'stock')
    expect(englisch.root.textContent).toContain('3Tinderwood')
    expect(englisch.root.textContent).toContain('Tools: none')

    const deutsch = oberflaeche('de')
    deutsch.updateHud(w, 0, null, 3)
    expect(deutsch.root.textContent).toContain('Bring den Kern auf 80 %')
    deutsch.showCamp(w, 'core')
    expect(deutsch.root.textContent).toContain('+4 % je Zunderholz · 3 Holz im Lager')
  })
})
