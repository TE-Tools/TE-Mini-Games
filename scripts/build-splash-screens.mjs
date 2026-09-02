/**
 * Baut die Startbilder (Splash Screens) für iOS.
 *
 * Warum überhaupt: Android baut sich seinen Startbildschirm aus dem Manifest
 * (Name, Symbol, background_color) selbst zusammen. iOS tut das nicht -- ohne
 * `apple-touch-startup-image` zeigt Safari beim Start der installierten App
 * eine weiße Fläche. Deshalb hier für die gängigen Gerätegrößen je ein Bild.
 *
 * Gerendert wird mit dem Chromium, der ohnehin für die Tests da ist -- keine
 * zusätzliche Bildbibliothek nötig.
 *
 * Aufruf: node scripts/build-splash-screens.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

/** Gerätegrößen in CSS-Pixeln plus Pixeldichte -- deckt iPhone 8 bis 16 ab. */
const GERAETE = [
  { name: 'iphone-se', w: 320, h: 568, dpr: 2 },
  { name: 'iphone-8', w: 375, h: 667, dpr: 2 },
  { name: 'iphone-8-plus', w: 414, h: 736, dpr: 3 },
  { name: 'iphone-x', w: 375, h: 812, dpr: 3 },
  { name: 'iphone-xr', w: 414, h: 896, dpr: 2 },
  { name: 'iphone-xs-max', w: 414, h: 896, dpr: 3 },
  { name: 'iphone-12', w: 390, h: 844, dpr: 3 },
  { name: 'iphone-14-pro', w: 393, h: 852, dpr: 3 },
  { name: 'iphone-14-pro-max', w: 430, h: 932, dpr: 3 },
  { name: 'ipad', w: 768, h: 1024, dpr: 2 },
  { name: 'ipad-pro-11', w: 834, h: 1194, dpr: 2 },
  { name: 'ipad-pro-12', w: 1024, h: 1366, dpr: 2 },
]

/**
 * Dasselbe Bild wie der Startbildschirm in index.html -- Creme, ein paar
 * weiche Farbverläufe, das Symbol und der Name. Wer die App öffnet, soll
 * keinen Bruch zwischen Startbild und App sehen.
 */
function seite(w, h) {
  const symbolGroesse = Math.round(Math.min(w, h) * 0.34)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    background-color: #fff8e8;
    background-image:
      radial-gradient(ellipse 100% 70% at 50% -20%, rgba(255,230,150,0.55), transparent 55%),
      radial-gradient(ellipse 50% 45% at 100% 10%, rgba(200,180,255,0.22), transparent 50%),
      radial-gradient(ellipse 45% 40% at 0% 85%, rgba(160,230,220,0.20), transparent 50%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: ${Math.round(symbolGroesse * 0.16)}px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .symbol {
    width: ${symbolGroesse}px; height: ${symbolGroesse}px;
    border-radius: ${Math.round(symbolGroesse * 0.22)}px;
    background: linear-gradient(180deg, #fff3c4 0%, #f0c84a 45%, #c4920f 100%);
    border: ${Math.max(3, Math.round(symbolGroesse * 0.02))}px solid #2a1f12;
    display: flex; align-items: center; justify-content: center;
    color: #2a1f12; font-weight: 800; font-size: ${Math.round(symbolGroesse * 0.42)}px;
    letter-spacing: 0.02em;
    box-shadow: 0 ${Math.round(symbolGroesse * 0.04)}px ${Math.round(symbolGroesse * 0.1)}px rgba(42,31,18,0.18);
  }
  .name { font-size: ${Math.round(symbolGroesse * 0.19)}px; font-weight: 800; color: #2a1f12; }
  .claim { font-size: ${Math.round(symbolGroesse * 0.1)}px; font-weight: 600; color: #7a6a50; }
  </style></head><body>
    <div class="symbol">TE</div>
    <div class="name">TE-Mini Games</div>
    <div class="claim">Nur noch eine Runde. ✨</div>
  </body></html>`
}

const ZIEL = 'public/splash'
mkdirSync(ZIEL, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PFAD || undefined,
})
const eintraege = []

for (const g of GERAETE) {
  const page = await browser.newPage({
    viewport: { width: g.w, height: g.h },
    deviceScaleFactor: g.dpr,
  })
  await page.setContent(seite(g.w, g.h))
  const png = await page.screenshot({ type: 'png' })
  const datei = `${g.name}-${g.w}x${g.h}@${g.dpr}x.png`
  writeFileSync(`${ZIEL}/${datei}`, png)
  await page.close()
  eintraege.push({ ...g, datei })
  console.log(`${datei}  ${(png.length / 1024).toFixed(0)} KB`)
}

await browser.close()

// Die <link>-Zeilen für index.html gleich mitliefern -- von Hand tippt die
// niemand fehlerfrei ab.
const links = eintraege
  .map(
    (g) =>
      `    <link rel="apple-touch-startup-image" href="/splash/${g.datei}"\n` +
      `      media="(device-width: ${g.w}px) and (device-height: ${g.h}px) and (-webkit-device-pixel-ratio: ${g.dpr})" />`,
  )
  .join('\n')
writeFileSync(`${ZIEL}/index-html-snippet.txt`, links + '\n')
console.log(`\n${eintraege.length} Startbilder in ${ZIEL}/`)
console.log(`Die <link>-Zeilen stehen in ${ZIEL}/index-html-snippet.txt`)
