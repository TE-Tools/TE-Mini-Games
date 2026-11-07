/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * Die Publisher-ID von TE-Digital bei Google (AdMob und AdSense, ein Konto).
 * Öffentlich -- sie steht ohnehin in jeder ads.txt. Von Thomas am 07.11.2026
 * aus AdMob übernommen.
 */
const GOOGLE_PUBLISHER_ID = 'pub-9622372327277679'

/**
 * app-ads.txt (AdMob) und ads.txt (AdSense) mit derselben Zeile: Google
 * liefert Werbung nur ungeschmälert aus, wenn auf der Entwickler-Website
 * steht, wer verkaufen darf. AdMob sucht app-ads.txt auf der Website aus
 * dem Play-Eintrag, AdSense ads.txt auf der Seite selbst. Siehe
 * docs/werbung.md.
 */
function adsTxt(): Plugin {
  const zeile = `google.com, ${GOOGLE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0\n`
  return {
    name: 'te-ads-txt',
    generateBundle() {
      for (const fileName of ['app-ads.txt', 'ads.txt']) {
        this.emitFile({ type: 'asset', fileName, source: zeile })
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    adsTxt(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'TE-Mini Games',
        short_name: 'TE-Mini Games',
        description:
          'Kurze Geschicklichkeits-, Gedächtnis-, Reaktions- und Logikspiele. Nur noch eine Runde.',
        // Muss zur echten Hintergrundfarbe der App passen (--color-bg in
        // src/styles/tokens.css): Android baut daraus seinen Startbildschirm,
        // und ein dunkler Start vor einer cremefarbenen App blitzt haesslich.
        theme_color: '#f3f2f9',
        background_color: '#f3f2f9',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'de',
        categories: ['games', 'entertainment'],
        // PNG first: Chrome only offers "install" when the manifest carries a
        // raster icon of 192 and 512 px.
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Die iOS-Startbilder sind zusammen rund 3 MB und werden nur beim
        // Start aus dem HTTP-Cache geladen -- in den Offline-Vorrat gehoeren
        // sie nicht, sonst laedt jede Installation sie unnoetig mit.
        globIgnores: ['splash/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    // Vitest laesst Stylesheets sonst leer. tests/helles-design.test.ts liest
    // sie aber wirklich -- es sucht nach Resten des alten Nachtdesigns.
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/setup.ts', 'e2e/', '**/*.d.ts'],
    },
  },
})
