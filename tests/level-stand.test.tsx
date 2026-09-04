/**
 * Wo die anderen stehen -- auf der Levelkarte.
 *
 * Thomas am 04.09.2026: "die perfekte Sekunde kann man bei den Leveln Karte
 * sehen wo andere Spieler stehen das waere schoen."
 *
 * Zwei Dinge muessen dabei stimmen und sind schnell verloren: Die Stufe bleibt
 * antippbar (die Namen sitzen daneben, nicht darauf), und eine grosse Familie
 * an einer Stufe deckt die Strasse nicht zu.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LevelMap } from '@/components/level-map/LevelMap'

function karte(
  mitspieler: { username: string; level: number }[],
  currentLevel = 3,
  highestLevel = currentLevel,
) {
  return render(
    <LevelMap
      currentLevel={currentLevel}
      highestLevel={highestLevel}
      avatarId={null}
      onSelectLevel={() => undefined}
      gameLabel="Die perfekte Sekunde"
      mitspieler={mitspieler}
    />,
  )
}

describe('LevelMap: Stand der anderen', () => {
  it('zeigt die anderen an ihrer Stufe', () => {
    karte([
      { username: 'anna', level: 5 },
      { username: 'bert', level: 2 },
    ])
    expect(screen.getByText('anna')).toBeTruthy()
    expect(screen.getByText('bert')).toBeTruthy()
  })

  it('sieht ohne Mitspieler aus wie bisher', () => {
    const { container } = karte([])
    expect(container.querySelectorAll('[title]')).toHaveLength(0)
  })

  it('fasst mehr als drei an einer Stufe zusammen', () => {
    karte([
      { username: 'anna', level: 4 },
      { username: 'bert', level: 4 },
      { username: 'cleo', level: 4 },
      { username: 'dora', level: 4 },
      { username: 'emil', level: 4 },
    ])
    // Drei Namen plus "+2" -- sonst waere die Strasse zugedeckt.
    expect(screen.getByText('+2')).toBeTruthy()
    expect(screen.queryByText('emil')).toBeNull()
  })

  it('nennt beim Daraufzeigen trotzdem alle', () => {
    const { container } = karte([
      { username: 'anna', level: 4 },
      { username: 'bert', level: 4 },
      { username: 'cleo', level: 4 },
      { username: 'dora', level: 4 },
    ])
    const gruppe = container.querySelector('[title]')
    expect(gruppe?.getAttribute('title')).toBe('anna, bert, cleo, dora')
  })

  it('lässt die Stufe antippbar', () => {
    const gedrueckt = vi.fn()
    render(
      <LevelMap
        currentLevel={3}
        highestLevel={5}
        avatarId={null}
        onSelectLevel={gedrueckt}
        gameLabel="Die perfekte Sekunde"
        mitspieler={[{ username: 'anna', level: 4 }]}
      />,
    )
    screen.getByRole('button', { name: /^Level 4 spielen$/ }).click()
    expect(gedrueckt).toHaveBeenCalledWith(4)
  })

  it('setzt die Namen neben die Stufe, nicht hinein', () => {
    // Beim ersten Versuch standen sie IM Knopf. Der ist rund und beschneidet,
    // was ueber den Rand hinausragt -- die Namen waren schlicht unsichtbar,
    // und die Tests hier merkten nichts davon, weil jsdom kein Layout kennt.
    // Aufgefallen ist es erst auf einem Bildschirmfoto. Diese Pruefung ist die
    // Lehre daraus: Sie fragt nicht, ob gezeichnet wurde, sondern wo.
    const { container } = karte([{ username: 'anna', level: 4 }])
    const gruppe = container.querySelector('[title="anna"]')
    expect(gruppe).toBeTruthy()
    expect(gruppe!.closest('button')).toBeNull()
  })

  it('nimmt die Namen nicht in die Beschriftung des Knopfes auf', () => {
    // Sonst hiesse der Knopf fuer die Sprachausgabe "Level 4 spielen anna".
    // Level 4 muss dafuer frei sein -- gesperrt heisst er anders.
    karte([{ username: 'anna', level: 4 }], 3, 5)
    expect(screen.getByRole('button', { name: /^Level 4 spielen$/ })).toBeTruthy()
  })

  it('sortiert die Namen, damit die Reihenfolge nicht springt', () => {
    const { container } = karte([
      { username: 'zoe', level: 4 },
      { username: 'anna', level: 4 },
      { username: 'mila', level: 4 },
    ])
    expect(container.querySelector('[title]')?.getAttribute('title')).toBe('anna, mila, zoe')
  })
})
