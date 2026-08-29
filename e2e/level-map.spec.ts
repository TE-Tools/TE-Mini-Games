import { test, expect, type Page } from '@playwright/test'

/** Seed the offline progress so the map can be checked in every zone. */
async function seedProgress(page: Page, level: number) {
  await page.evaluate(async (lvl) => {
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
          currentLevel: lvl,
          highestLevel: lvl,
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
  }, level)
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

  test('path ends at level 500', async ({ page }) => {
    await page.goto('/play/perfect-second')
    await expect(page.getByRole('heading', { name: 'Levelübersicht' })).toBeVisible()
    await seedProgress(page, 498)
    await page.reload()

    await expect(page.getByRole('button', { name: /^Level 500, Eispalast$|^Level 500 gesperrt$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Level 501/ })).toHaveCount(0)
  })
})
