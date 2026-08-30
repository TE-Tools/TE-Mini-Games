import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('shows title and main game buttons', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'TE-Mini Games' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Die perfekte Sekunde/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Was fehlt/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Familie/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Rangliste/i })).toBeVisible()
  })

  test('shows player stats placeholders', async ({ page }) => {
    await page.goto('/')
    // Exact matches: the XP hint below the stats also contains "XP" and
    // "Spieler-Level", which made this test fail depending on load timing.
    await expect(page.getByText('Level', { exact: true })).toBeVisible()
    await expect(page.getByText('XP', { exact: true })).toBeVisible()
    await expect(page.getByText('Streak', { exact: true })).toBeVisible()
  })
})
