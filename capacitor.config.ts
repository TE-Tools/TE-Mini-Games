/**
 * Die Android-App: eine Capacitor-Hülle um die Seite.
 *
 * Seit 07.11.2026 statt der Trusted Web Activity (twa-manifest.json), damit
 * AdMob geht -- AdMob braucht Android-Code in der App, und in eine TWA
 * kommt man von der Seite aus nicht hinein (docs/werbung.md).
 *
 * Die App lädt die ausgelieferte Seite (`server.url`) statt eines
 * eingepackten Builds. So bleibt, was die TWA ausmachte: Jede Änderung an
 * der Seite ist sofort in der App, ohne Store-Update. Ein Store-Update
 * braucht es nur, wenn sich die Hülle selbst ändert (Plugins, Android-
 * Einstellungen). Offline trägt wie bisher der Service Worker der Seite.
 *
 * Paketname und Signierschlüssel bleiben die der TWA -- für Google Play ist
 * es dieselbe App.
 */
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'de.tetools.minigames',
  appName: 'TE-Mini Games',
  webDir: 'dist',
  server: {
    url: 'https://te-mini-games.pages.dev',
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    // Die Seite ist hell; die Statusleiste soll nicht schwarz darüberliegen.
    backgroundColor: '#f3f2f9',
  },
}

export default config
