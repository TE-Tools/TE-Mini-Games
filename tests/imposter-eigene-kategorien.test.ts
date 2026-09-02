/**
 * Eigene Wortlisten: anlegen, ändern, löschen und -- der eigentliche Zweck --
 * exportieren und auf einem anderen Gerät wieder einlesen.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadCustomCategories,
  saveCustomCategory,
  deleteCustomCategory,
  customCategoryById,
  exportCustomCategories,
  importCustomCategories,
  parseWords,
  idFor,
  isCustomCategory,
  MIN_WORDS,
} from '@/games/finde-den-imposter/customCategories'

const WOERTER = ['Königsschuss', 'Vogelstange', 'Fahnenträger', 'Schützenkönig', 'Festzelt']

beforeEach(() => {
  localStorage.clear()
})

describe('Anlegen und Ändern', () => {
  it('legt eine Liste an und findet sie wieder', () => {
    const c = saveCustomCategory({ label: 'Schützenverein', words: WOERTER })
    expect(isCustomCategory(c.id)).toBe(true)
    expect(loadCustomCategories()).toHaveLength(1)
    expect(customCategoryById(c.id)?.words).toEqual(WOERTER)
  })

  it('besteht auf einem Namen und auf genug Wörtern', () => {
    expect(() => saveCustomCategory({ label: '  ', words: WOERTER })).toThrow(/Namen/)
    expect(() => saveCustomCategory({ label: 'Zu kurz', words: ['A', 'B'] })).toThrow(
      new RegExp(`Mindestens ${MIN_WORDS}`),
    )
  })

  it('zählt doppelte Wörter nicht mit', () => {
    expect(() =>
      saveCustomCategory({ label: 'Doppelt', words: ['Hund', 'hund', 'HUND', 'Katze', 'Maus'] }),
    ).toThrow(/Mindestens/)
  })

  it('lässt denselben Namen kein zweites Mal zu', () => {
    saveCustomCategory({ label: 'Verein', words: WOERTER })
    expect(() => saveCustomCategory({ label: 'verein', words: WOERTER })).toThrow(/gibt es schon/)
  })

  it('ändert eine bestehende Liste, statt eine zweite anzulegen', () => {
    const c = saveCustomCategory({ label: 'Verein', words: WOERTER })
    saveCustomCategory({ id: c.id, label: 'Verein', words: [...WOERTER, 'Blaskapelle'] })
    expect(loadCustomCategories()).toHaveLength(1)
    expect(customCategoryById(c.id)?.words).toHaveLength(6)
  })

  it('löscht auf Wunsch wieder', () => {
    const c = saveCustomCategory({ label: 'Weg damit', words: WOERTER })
    deleteCustomCategory(c.id)
    expect(loadCustomCategories()).toHaveLength(0)
  })

  it('gibt eigenen Listen ein Präfix, damit sie keine eingebaute überschreiben', () => {
    expect(idFor('Tiere')).not.toBe('tiere')
    expect(isCustomCategory(idFor('Tiere'))).toBe(true)
  })
})

describe('Wörter aus dem Textfeld', () => {
  it('nimmt Zeilen, Kommas und Semikolons', () => {
    expect(parseWords('Hund\nKatze, Maus; Pferd')).toEqual(['Hund', 'Katze', 'Maus', 'Pferd'])
  })

  it('wirft Leerzeilen und Dopplungen raus und behält die Reihenfolge', () => {
    expect(parseWords('  Hund \n\n hund \n Katze ')).toEqual(['Hund', 'Katze'])
  })
})

describe('Export und Import', () => {
  it('bringt eine exportierte Liste auf einem leeren Gerät wieder zurück', () => {
    saveCustomCategory({ label: 'Verein', words: WOERTER })
    const datei = exportCustomCategories()

    localStorage.clear()
    expect(loadCustomCategories()).toHaveLength(0)

    const r = importCustomCategories(datei)
    expect(r).toMatchObject({ added: 1, updated: 0 })
    expect(loadCustomCategories()[0]?.words).toEqual(WOERTER)
  })

  it('aktualisiert eine gleichnamige Liste, statt sie doppelt anzulegen', () => {
    saveCustomCategory({ label: 'Verein', words: WOERTER })
    const datei = exportCustomCategories()
    saveCustomCategory({
      id: loadCustomCategories()[0]!.id,
      label: 'Verein',
      words: ['Ganz', 'andere', 'Woerter', 'stehen', 'hier'],
    })

    const r = importCustomCategories(datei)
    expect(r).toMatchObject({ added: 0, updated: 1 })
    expect(loadCustomCategories()).toHaveLength(1)
    expect(loadCustomCategories()[0]?.words).toEqual(WOERTER)
  })

  it('nimmt auch eine nackte Liste ohne Drumherum an', () => {
    const r = importCustomCategories(JSON.stringify([{ label: 'Roh', words: WOERTER }]))
    expect(r.added).toBe(1)
  })

  it('sagt, was nicht durchging, statt alles abzulehnen', () => {
    const r = importCustomCategories(
      JSON.stringify([
        { label: 'Gut', words: WOERTER },
        { label: 'Zu kurz', words: ['A'] },
      ]),
    )
    expect(r.added).toBe(1)
    expect(r.skipped).toHaveLength(1)
    expect(r.skipped[0]).toContain('Zu kurz')
  })

  it('weist kaputten Text mit einer verständlichen Meldung ab', () => {
    expect(() => importCustomCategories('{kein json')).toThrow(/JSON/)
    expect(() => importCustomCategories('{"format":"x"}')).toThrow(/keine Kategorien/)
  })
})
