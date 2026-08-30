import { test, expect, type Page } from '@playwright/test'

/** Seed the offline progress so the map can be checked anywhere on the path. */
async function seedProgress(page: Page, currentLevel: number, highestLevel = currentLevel) {
  await page.evaluate(
    async ({ cur, high }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('mini-challenge')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('gameProgress', 'readwrite')
          tx.objectStore('gameProgress').put({
            id: 'guest:perfect-second',
            userId: 'guest',
            gameId: 'perfect-second',
            currentLevel: cur,
            highestLevel: high,
            totalXp: 0,
            updatedAt: new Date().toISOString(),
          })
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      })
    },
    { cur: currentLevel, high: highestLevel },
  )
}

const ZONES = [
  { level: 1, name: 'Urwald', position: '1/100' },
  { level: 105, name: 'Vulkanland', position: '5/100' },
  { level: 210, name: 'Felswüste', position: '10/100' },
  { level: 305, name: 'Eiszeit', position: '5/100' },
  { level: 498, name: 'Gletschergipfel', position: '98/100' },
] as const

test.describe('Level map 1–500', () => {
  test('shows the zone of the current level', async ({ page }) => {
    await page.goto('/play/perfect-second')
    await expect(page.getByRole('heading', { name: 'Levelübersicht' })).toBeVisible()

    for (const zone of ZONES) {
      await seedProgress(page, zone.level)
      await page.reload()
      await expect(page.getByText(`Du bist hier: Level ${zone.level}`)).toBeVisible()
      await expect(page.getByText(zone.name, { exact: true })).toBeVisible()
      await expect(page.getByText(zone.position, { exact: true })).toBeVisible()
    }
  })

  test('shows one piece of 20 levels at a time', async ({ page }) => {
    await page.goto('/play/perfect-second')
    await expect(page.getByRole('heading', { name: 'Levelübersicht' })).toBeVisible()
    await seedProgress(page, 5)
    await page.reload()

    await expect(page.getByText('Abschnitt 1 · Level 1–20', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Level 20 gesperrt' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Level 21/ })).toHaveCount(0)
  })

  test('the gate stays shut until its last level is cleared', async ({ page }) => {
    await page.goto('/play/perfect-second')
    await expect(page.getByRole('heading', { name: 'Levelübersicht' })).toBeVisible()
    await seedProgress(page, 20)
    await page.reload()

    const gate = page.getByRole('button', { name: 'Tor zu Abschnitt 2 – erst nach Level 20' })
    await expect(gate).toBeVisible()
    await expect(gate).toBeDisabled()
  })

  test('opening the gate loads the next piece of the map', async ({ page }) => {
    await page.goto('/play/perfect-second')
    await expect(page.getByRole('heading', { name: 'Levelübersicht' })).toBeVisible()
    // Standing on level 15, but level 20 is already cleared → the gate can open.
    await seedProgress(page, 15, 25)
    await page.reload()

    await expect(page.getByText('Abschnitt 1 · Level 1–20', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Tor zu Abschnitt 2 öffnen' }).click()

    await expect(page.getByText('Abschnitt 2 · Level 21–40', { exact: false })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByRole('button', { name: 'Level 21 spielen' })).toBeVisible()
    // …and back down again.
    await page.getByRole('button', { name: 'Zurück zu Abschnitt 1' }).click()
    await expect(page.getByText('Abschnitt 1 · Level 1–20', { exact: false })).toBeVisible()
  })

  test('path ends at level 500 without a gate', async ({ page }) => {
    await page.goto('/play/perfect-second')
    await expect(page.getByRole('heading', { name: 'Levelübersicht' })).toBeVisible()
    await seedProgress(page, 498)
    await page.reload()

    await expect(page.getByText('Abschnitt 25 · Level 481–500', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: /Level 500/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Level 501/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Eispalast öffnen/ })).toHaveCount(0)
  })
})
