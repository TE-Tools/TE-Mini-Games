/**
 * Das TWA-Manifest und die Verknüpfung zur Domain.
 *
 * Drei Dinge müssen zusammenpassen, und keines davon fällt beim Bauen
 * auf -- sie fallen erst auf, wenn die App aus dem Store startet und
 * statt Vollbild eine Adressleiste zeigt. Dann ist eine neue Fassung
 * nötig, durch die Prüfung bei Google.
 *
 * Der Schlüsselname `appVersion` steht hier, weil Bubblewrap genau den
 * liest. Vorher stand `appVersionName` im Manifest -- ein Schlüssel, den
 * niemand liest. Das gebaute Paket trug dann eine leere Version, und
 * eine leere Version nimmt Google nicht an. Aufgefallen ist das erst beim
 * ersten echten Bau.
 */
import { describe, it, expect } from 'vitest'
// Die Dateien selbst einlesen, nicht nachbauen: Ein Test gegen eine
// Kopie der Werte prüft nur die Kopie.
import manifest from '../twa-manifest.json'
import assetlinks from '../public/.well-known/assetlinks.json'

describe('TWA-Manifest', () => {
  it('nennt denselben Paketnamen wie assetlinks.json', () => {
    const imManifest = manifest.packageId
    const inAssetlinks = assetlinks.map((e) => e.target.package_name)
    expect(inAssetlinks.length).toBeGreaterThan(0)
    for (const name of inAssetlinks) {
      expect(name).toBe(imManifest)
    }
  })

  it('benutzt den Schlüssel appVersion -- appVersionName liest Bubblewrap nicht', () => {
    expect(manifest).toHaveProperty('appVersion')
    expect(manifest).not.toHaveProperty('appVersionName')
    expect(String(manifest.appVersion)).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('verlangt mindestens Android 7 -- die TWA-Bibliothek läuft nicht darunter', () => {
    // androidbrowserhelper 2.7.4 setzt minSdkVersion 24. Mit 23 bricht der
    // Manifest-Merger ab, bevor ein Paket entsteht.
    expect(Number(manifest.minSdkVersion)).toBeGreaterThanOrEqual(24)
  })

  it('hat einen Paketnamen, den Android annimmt', () => {
    // Kleinbuchstaben, mindestens zwei Teile, jeder beginnt mit einem
    // Buchstaben. Google prüft das beim Hochladen, nicht beim Bauen.
    expect(String(manifest.packageId)).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)
  })

  it('zeigt auf dieselbe Domain wie die ausgelieferte Seite', () => {
    expect(manifest.host).toBe('te-mini-games.pages.dev')
    expect(String(manifest.startUrl ?? '/')).toMatch(/^\//)
  })
})
