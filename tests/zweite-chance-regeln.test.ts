/**
 * Belohnungsvideos -- die Regeln dahinter, ohne Oberfläche.
 *
 * Werbung kauft Hilfe, nie Punkte: Eine Runde mit Hilfe bringt keine Punkte
 * und keine XP, höchstens einen Stern und keinen Rekord. Das Level zählt.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { HOECHSTENS_STERNE_MIT_HILFE, mitHilfeGewertet } from '@/games/hilfe'
import {
  calculateWhatIsMissingScore,
  createWhatIsMissingLevel,
  wertungMitZweiterChance as wasFehltMitHilfe,
  zweiterBlickMoeglich,
  zweiterBlickSekunden,
} from '@/games/what-is-missing'
import {
  calculateReihenfolgeScore,
  eingabeNachFehler,
  wertungMitZweiterChance as reihenfolgeMitHilfe,
  zweiteChanceMoeglich as reihenfolgeChanceMoeglich,
} from '@/games/reihenfolge'
import {
  AUFGABEN_JE_RUNDE,
  MIN_NACHHOL_SEKUNDEN,
  calculateKopfrechnenScore,
  createKopfrechnenLevel,
  nachholRunde,
  wertungMitZweiterChance as kopfrechnenMitHilfe,
  zweiteChanceMoeglich as kopfrechnenChanceMoeglich,
} from '@/games/kopfrechnen'
import { VIDEO_AVATARS, getAvatar, istVideoAvatar } from '@/profile/avatars'
import {
  freigeschalteteGesichter,
  freigeschaltetMit,
  gesichtFreischalten,
  naechstesGesperrtes,
} from '@/profile/videoGesichter'

describe('Wertung mit Hilfe', () => {
  it('gibt keine Punkte, keine XP und höchstens einen Stern', () => {
    expect(mitHilfeGewertet({ score: 1000, xp: 60, stars: 5, extra: 'bleibt' })).toEqual({
      score: 0,
      xp: 0,
      stars: HOECHSTENS_STERNE_MIT_HILFE,
      extra: 'bleibt',
    })
    expect(mitHilfeGewertet({ score: 0, xp: 0, stars: 0 }).stars).toBe(0)
  })

  it('liegt in jedem Spiel nie über der Runde ohne Hilfe', () => {
    for (const level of [1, 50, 250, 500]) {
      for (const correct of [true, false]) {
        const ohne = calculateWhatIsMissingScore({ correct, level })
        const mit = wasFehltMitHilfe({ correct, level })
        expect(mit.score).toBeLessThanOrEqual(ohne.score)
        expect(mit.xp).toBe(0)
        expect(mit.stars).toBeLessThanOrEqual(1)
        expect(mit.correct).toBe(correct)
      }
      for (const correctSteps of [0, 2, 5]) {
        const ein = { correctSteps, sequenceLength: 5, level }
        const mit = reihenfolgeMitHilfe(ein)
        expect(mit.score).toBe(0)
        expect(mit.xp).toBe(0)
        expect(mit.stars).toBeLessThanOrEqual(1)
        expect(mit.complete).toBe(calculateReihenfolgeScore(ein).complete)
      }
      for (const correct of [3, 8, 10]) {
        const ein = { correct, secondsLeft: 40, level }
        const mit = kopfrechnenMitHilfe(ein)
        expect(mit.score).toBe(0)
        expect(mit.xp).toBe(0)
        expect(mit.timeBonus).toBe(0)
        expect(mit.stars).toBeLessThanOrEqual(1)
        // Das Level zählt trotzdem.
        expect(mit.passed).toBe(calculateKopfrechnenScore(ein).passed)
      }
    }
  })
})

describe('Was fehlt? -- zweiter Blick', () => {
  it('nur beim Wählen und nur einmal', () => {
    expect(zweiterBlickMoeglich({ waehlt: true, genutzt: false })).toBe(true)
    expect(zweiterBlickMoeglich({ waehlt: true, genutzt: true })).toBe(false)
    expect(zweiterBlickMoeglich({ waehlt: false, genutzt: false })).toBe(false)
  })

  it('zeigt so lange wie der erste Blick', () => {
    const level = createWhatIsMissingLevel(40, 'test')
    expect(zweiterBlickSekunden(level)).toBe(level.displayTimeSeconds)
  })
})

describe('Reihenfolge -- zweite Chance', () => {
  it('behält die richtigen Schritte bis vor den Fehlgriff', () => {
    expect(eingabeNachFehler([0, 2, 1], [0, 2, 3, 1])).toEqual([0, 2])
    expect(eingabeNachFehler([3], [0, 2])).toEqual([])
    expect(eingabeNachFehler([0, 2], [0, 2, 3])).toEqual([0, 2])
  })

  it('nur nach einem Fehler und nur einmal', () => {
    expect(reihenfolgeChanceMoeglich({ gescheitert: true, genutzt: false })).toBe(true)
    expect(reihenfolgeChanceMoeglich({ gescheitert: true, genutzt: true })).toBe(false)
    expect(reihenfolgeChanceMoeglich({ gescheitert: false, genutzt: false })).toBe(false)
  })
})

describe('Kopfrechnen -- Nachholen', () => {
  const cfg = createKopfrechnenLevel(120)

  it('lässt die richtigen stehen und ersetzt die anderen durch neue Aufgaben', () => {
    const treffer = [true, false, true, true, false, true, true]
    const runde = nachholRunde(cfg, treffer)
    expect(runde.tasks).toHaveLength(AUFGABEN_JE_RUNDE)
    expect(runde.treffer).toEqual([true, true, true, true, true])
    expect(runde.tasks.slice(0, 5)).toEqual(cfg.tasks.filter((_, i) => treffer[i]))
    const alt = new Set(cfg.tasks.map((a) => a.text))
    for (const neu of runde.tasks.slice(5)) expect(alt.has(neu.text)).toBe(false)
    expect(runde.seconds).toBe(Math.ceil((cfg.seconds * 5) / AUFGABEN_JE_RUNDE))
  })

  it('gibt nie weniger als die Mindestzeit und ist bei gleichem Versuch gleich', () => {
    const fast = nachholRunde(cfg, [true, true, true, true, true, true, true, true, true, false])
    expect(fast.seconds).toBe(MIN_NACHHOL_SEKUNDEN)
    expect(nachholRunde(cfg, [false])).toEqual(nachholRunde(cfg, [false]))
  })

  it('nur nach dem Scheitern und nur einmal', () => {
    expect(kopfrechnenChanceMoeglich({ gescheitert: true, genutzt: false })).toBe(true)
    expect(kopfrechnenChanceMoeglich({ gescheitert: true, genutzt: true })).toBe(false)
    expect(kopfrechnenChanceMoeglich({ gescheitert: false, genutzt: false })).toBe(false)
  })
})

describe('Gesichter per Video', () => {
  beforeEach(() => localStorage.clear())

  it('sind vier bis sechs eigene Gesichter, die getAvatar kennt', () => {
    expect(VIDEO_AVATARS.length).toBeGreaterThanOrEqual(4)
    expect(VIDEO_AVATARS.length).toBeLessThanOrEqual(6)
    for (const a of VIDEO_AVATARS) {
      expect(istVideoAvatar(a.id)).toBe(true)
      expect(getAvatar(a.id).emoji).toBe(a.emoji)
    }
    expect(istVideoAvatar('face-1')).toBe(false)
  })

  it('bleiben freigeschaltet und kommen der Reihe nach', () => {
    expect(freigeschalteteGesichter()).toEqual([])
    expect(naechstesGesperrtes([])).toBe('video-1')
    gesichtFreischalten('video-3')
    gesichtFreischalten('video-3')
    gesichtFreischalten('video-1')
    expect(freigeschalteteGesichter()).toEqual(['video-1', 'video-3'])
    expect(naechstesGesperrtes(freigeschalteteGesichter())).toBe('video-2')
    expect(naechstesGesperrtes(VIDEO_AVATARS.map((a) => a.id))).toBeNull()
  })

  it('übersteht kaputten Speicher und nimmt ein über das Konto gewähltes Gesicht mit', () => {
    localStorage.setItem('te-gesichter-per-video', '{kaputt')
    expect(freigeschalteteGesichter()).toEqual([])
    localStorage.setItem('te-gesichter-per-video', JSON.stringify(['video-2', 'face-1', 7]))
    expect(freigeschalteteGesichter()).toEqual(['video-2'])
    expect(freigeschaltetMit('video-5')).toEqual(['video-2', 'video-5'])
    expect(freigeschaltetMit('face-4')).toEqual(['video-2'])
  })
})
