import { useEffect, useState } from 'react'
import styles from './InstallButton.module.css'

/**
 * The event Chromium fires when the app fulfils the install criteria.
 * Not part of lib.dom yet, so it is typed here.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  return window.matchMedia?.('(display-mode: standalone)').matches === true || iosStandalone
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * "App installieren" – puts the game on the home screen or desktop.
 *
 * Chromium hands the install prompt over through `beforeinstallprompt`; we keep
 * the event and fire it on tap. iOS has no such event, so there the button
 * explains the two taps in Safari instead. Once the app runs installed, the
 * button disappears.
 */
export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Keep the browser's own mini-infobar away and use our button instead.
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null
  if (!promptEvent && !isIos()) return null

  const install = async () => {
    if (!promptEvent) {
      setShowIosHint(true)
      return
    }
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    setPromptEvent(null)
    if (outcome === 'accepted') setInstalled(true)
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={() => void install()}>
        <span aria-hidden="true">⬇️</span> App installieren
      </button>
      {showIosHint && (
        <p className={styles.hint}>
          In Safari unten auf <strong>Teilen</strong> tippen und dann{' '}
          <strong>„Zum Home-Bildschirm“</strong> wählen.
        </p>
      )}
    </div>
  )
}
