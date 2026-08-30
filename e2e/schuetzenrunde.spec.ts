import { test, expect, type Page } from '@playwright/test'

/**
 * Plays a whole Schützenrunde in the browser: lobby → Nacht → Diskussion →
 * Abstimmung → Ergebnis → … → Ende. It only clicks what a player would click,
 * so a broken phase button or a dead end fails the test.
 */

/** Click the button of whichever phase is on screen. False = nothing there yet. */
async function clickCurrentPhase(page: Page): Promise<boolean> {
  const night = page.getByRole('button', { name: /Nacht (beenden|abwarten)/ })
  const toVote = page.getByRole('button', { name: 'Zur Abstimmung' })
  const vote = page.getByRole('button', { name: /Stimme abgeben|Abstimmen ohne/ })
  const next = page.getByRole('button', { name: 'Nächste Nacht' })

  if (await night.isVisible()) {
    // Roles with a night action need a target first.
    if (await night.isDisabled()) {
      await page.locator('section[aria-label="Mitspieler"] button:not([disabled])').first().click()
    }
    await night.click()
    return true
  }
  if (await toVote.isVisible()) {
    await toVote.click()
    return true
  }
  if (await vote.isVisible()) {
    await vote.click()
    return true
  }
  if (await next.isVisible()) {
    await next.click()
    return true
  }
  return false
}

test.describe('Schützenrunde', () => {
  test('plays a full round to the end', async ({ page }) => {
    await page.goto('/play/schuetzenrunde')

    await expect(page.getByRole('heading', { name: 'Schützenrunde' })).toBeVisible()
    await page.getByRole('button', { name: '12', exact: true }).click()
    await page.getByLabel(/Schützenfest/).check()
    await page.getByRole('button', { name: 'Runde starten' }).click()

    // The role card is dealt right away.
    await expect(page.getByText(/Bruderschaft|Saboteure/).first()).toBeVisible()

    const restart = page.getByRole('button', { name: 'Neue Runde' })
    for (let step = 0; step < 150; step++) {
      if (await restart.isVisible()) break
      // A frame between two phases has no button yet – wait instead of giving up.
      if (!(await clickCurrentPhase(page))) await page.waitForTimeout(100)
    }

    // The match ended and the result was scored.
    await expect(restart).toBeVisible()
    await expect(page.getByText(/Gewonnen|Verloren/)).toBeVisible()
    await expect(page.getByText(/Punkte/).first()).toBeVisible()
    await expect(page.getByText(/Zugpunkte/)).toBeVisible()
  })

  test('offers the online mode and explains when it is unavailable', async ({ page }) => {
    await page.goto('/play/schuetzenrunde')
    const onlineButton = page.getByRole('button', { name: /Online mit Freunden/ })
    await expect(onlineButton).toBeVisible()
    await onlineButton.click()
    // Ohne Konto-Server (kein VITE_SUPABASE_* im Test) muss die Seite das sagen,
    // statt einen toten Knopf zu zeigen.
    await expect(page.getByText(/Konto-Server|Anmelden/)).toBeVisible()
    await page.getByRole('button', { name: /gegen Bots/ }).click()
    await expect(page.getByRole('button', { name: 'Runde starten' })).toBeVisible()
  })

  test('shows the lobby options', async ({ page }) => {
    await page.goto('/play/schuetzenrunde')
    await expect(page.getByText('Wie viele Mitglieder?')).toBeVisible()
    await expect(page.getByText('Dein Zug')).toBeVisible()
    await expect(page.getByLabel(/Zeitdruck/)).toBeVisible()
    await expect(page.getByText(/Zwei Saboteure/)).toBeVisible()
    await page.getByRole('button', { name: '16', exact: true }).click()
    await expect(page.getByText(/Drei Saboteure/)).toBeVisible()
  })
})
