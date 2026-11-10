/**
 * Das Android-Manifest ist gültiges XML und nennt, was die App braucht.
 *
 * Ein Android-SDK gibt es beim Entwickeln hier nicht; das Paket baut nur
 * GitHub Actions. Ein Tippfehler im Manifest fällt deshalb erst dort auf --
 * so geschehen am 10.11.2026: Ein Kommentar enthielt zwei Bindestriche
 * hintereinander, was XML in Kommentaren verbietet, und der Bau endete mit
 * "Error parsing AndroidManifest.xml". Dieser Test liest die Datei mit
 * demselben strengen Maßstab, bevor sie das Projekt verlässt.
 */
import { describe, it, expect } from 'vitest'
import manifest from '../android/app/src/main/AndroidManifest.xml?raw'

const ANDROID = 'http://schemas.android.com/apk/res/android'

function lies(): Document {
  return new DOMParser().parseFromString(manifest, 'application/xml')
}

describe('AndroidManifest.xml', () => {
  it('ist gültiges XML', () => {
    const fehler = lies().querySelector('parsererror')
    expect(fehler?.textContent ?? null).toBeNull()
  })

  it('hat in keinem Kommentar zwei Bindestriche hintereinander', () => {
    // Derselbe Fehler, aber mit Zeilenangabe -- der Parser nennt nur die erste Stelle.
    const stellen: string[] = []
    for (const treffer of manifest.matchAll(/<!--([\s\S]*?)-->/g)) {
      if (treffer[1]!.includes('--')) stellen.push(treffer[1]!.trim().slice(0, 60))
    }
    expect(stellen).toEqual([])
  })

  it('verlangt die Berechtigungen, ohne die „Rückwärts" nicht aufnehmen kann', () => {
    // Capacitor fragt genau diese beiden ab, sobald die Seite das Mikrofon
    // öffnet (BridgeWebChromeClient.onPermissionRequest). Fehlt eine, lehnt
    // die App stumm ab.
    const rechte = Array.from(lies().querySelectorAll('uses-permission')).map((e) =>
      e.getAttributeNS(ANDROID, 'name'),
    )
    expect(rechte).toContain('android.permission.RECORD_AUDIO')
    expect(rechte).toContain('android.permission.MODIFY_AUDIO_SETTINGS')
    expect(rechte).toContain('android.permission.INTERNET')
  })

  it('macht das Mikrofon nicht zur Bedingung für die Installation', () => {
    const mikrofon = Array.from(lies().querySelectorAll('uses-feature')).find(
      (e) => e.getAttributeNS(ANDROID, 'name') === 'android.hardware.microphone',
    )
    expect(mikrofon?.getAttributeNS(ANDROID, 'required')).toBe('false')
  })
})
