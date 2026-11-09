/**
 * Baut App-Symbol und Startbild der Android-App aus public/icons/.
 *
 * Capacitor legt beim Anlegen des Projekts sein eigenes Logo ab; das hier
 * ersetzt es durch das von TE-Mini Games. Nach jeder Änderung am Symbol
 * neu laufen lassen:
 *
 *   node scripts/build-android-icons.mjs
 *
 * Gerendert wird mit dem Chromium, der für die Tests ohnehin da ist --
 * keine zusätzliche Bildbibliothek.
 */
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, rmSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const RES = 'android/app/src/main/res'
const HINTERGRUND = '#f3f2f9'

/** Symbol (48 dp) und Vordergrund des adaptiven Symbols (108 dp) je Dichte. */
const DICHTEN = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

const alsDatenUrl = (datei) =>
  `data:image/png;base64,${readFileSync(join('public/icons', datei)).toString('base64')}`
const symbol = alsDatenUrl('icon-512.png')
const maskierbar = alsDatenUrl('icon-maskable-512.png')

const browser = await chromium.launch()
const seite = await browser.newPage()

/** Zeichnet ein Bild auf eine Leinwand und gibt PNG-Bytes zurück. */
async function zeichne(quelle, groesse, { rund = false, anteil = 1, hintergrund = null } = {}) {
  const daten = await seite.evaluate(
    async ({ quelle, groesse, rund, anteil, hintergrund }) => {
      const bild = new Image()
      bild.src = quelle
      await bild.decode()
      const c = document.createElement('canvas')
      c.width = groesse
      c.height = groesse
      const g = c.getContext('2d')
      if (hintergrund) {
        g.fillStyle = hintergrund
        g.fillRect(0, 0, groesse, groesse)
      }
      if (rund) {
        g.beginPath()
        g.arc(groesse / 2, groesse / 2, groesse / 2, 0, Math.PI * 2)
        g.clip()
      }
      const seiteLang = groesse * anteil
      const versatz = (groesse - seiteLang) / 2
      g.imageSmoothingQuality = 'high'
      g.drawImage(bild, versatz, versatz, seiteLang, seiteLang)
      return c.toDataURL('image/png')
    },
    { quelle, groesse, rund, anteil, hintergrund },
  )
  return Buffer.from(daten.split(',')[1], 'base64')
}

for (const [dichte, faktor] of Object.entries(DICHTEN)) {
  const ordner = join(RES, `mipmap-${dichte}`)
  const s = Math.round(48 * faktor)
  writeFileSync(join(ordner, 'ic_launcher.png'), await zeichne(maskierbar, s))
  writeFileSync(join(ordner, 'ic_launcher_round.png'), await zeichne(maskierbar, s, { rund: true }))
  // Adaptives Symbol: Das maskierbare Bild füllt die 108 dp ganz aus; die
  // Maske des Geräts schneidet den Rand weg, der Inhalt liegt in der Mitte.
  writeFileSync(
    join(ordner, 'ic_launcher_foreground.png'),
    await zeichne(maskierbar, Math.round(108 * faktor)),
  )
  console.log(`mipmap-${dichte}: ${s}px`)
}

// Hintergrund des adaptiven Symbols: dieselbe Farbe wie die App.
writeFileSync(
  join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${HINTERGRUND}</color>\n</resources>\n`,
)

// Startbild: das Capacitor-Logo raus, unser Symbol mittig auf der App-Farbe.
for (const ordner of readdirSync(RES)) {
  const datei = join(RES, ordner, 'splash.png')
  if (ordner.startsWith('drawable') && existsSync(datei)) rmSync(datei)
}
mkdirSync(join(RES, 'drawable-nodpi'), { recursive: true })
writeFileSync(join(RES, 'drawable-nodpi/splash_symbol.png'), await zeichne(symbol, 288))
writeFileSync(
  join(RES, 'drawable/splash.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<!-- Startbild: App-Farbe, Symbol in der Mitte. Erzeugt von scripts/build-android-icons.mjs. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item android:gravity="center" android:width="144dp" android:height="144dp">
        <bitmap android:src="@drawable/splash_symbol" android:gravity="center" />
    </item>
</layer-list>
`,
)
console.log('Startbild: drawable/splash.xml')

await browser.close()
