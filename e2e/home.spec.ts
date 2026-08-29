import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('shows title and main game buttons', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'MINI CHALLENGE' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Die perfekte Sekunde/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Was fehlt/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Familie/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Rangliste/i })).toBeVisible()
  })

  test('shows player stats placeholders', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Dein Level')).toBeVisible()
    await expect(page.getByText('XP')).toBeVisible()
    await expect(page.getByText('Streak')).toBeVisible()
  })
})
