/**
 * Baut die Bilder, die der Google Play Store beim Eintrag verlangt:
 * das Funktionsbild (1024x500) und Telefon-Bildschirmfotos (1080x1920).
 *
 * Warum als Skript und nicht von Hand abgefotografiert: Google will die
 * Bilder nach jeder sichtbaren Änderung aktuell haben. Von Hand heißt, dass
 * irgendwann Bilder im Eintrag stehen, die die App nicht mehr zeigt. Hier
 * kommen die Bildschirmfotos aus dem echten Build -- was drauf ist, ist
 * wirklich drin.
 *
 * Gerendert wird mit dem Chromium, der ohnehin für die Tests da ist.
 * Die Bilder landen in `docs/store/` und nicht in `public/`: Sie gehören
 * zum Store-Eintrag, nicht in die ausgelieferte App.
 *
 * Aufruf: npm run build && node scripts/build-store-assets.mjs
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { extname, join, normalize } from 'node:path'

const DIST = 'dist'
const ZIEL = 'docs/store'

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`Kein Build gefunden (${DIST}/index.html fehlt). Erst "npm run build".`)
  process.exit(1)
}

/**
 * Wie viele Spiele es gibt, steht im Funktionsbild -- und eine falsche Zahl
 * im Store-Eintrag fällt irgendwann jemandem auf. Deshalb nicht getippt,
 * sondern aus der Registrierung gezählt.
 */
const SPIELE_ANZAHL = (readFileSync('src/games/register.ts', 'utf8').match(/registerGame\(/g) || [])
  .length
if (SPIELE_ANZAHL < 2) {
  console.error('Spiele konnten nicht gezählt werden -- register.ts sieht anders aus als erwartet.')
  process.exit(1)
}

/* ---------------------------------------------------------------- Server
 * Ein winziger Dateiserver für den Build. Nötig, weil die App unter
 * file:// nicht läuft (Module, Service Worker, History-Routing) -- und
 * weil unbekannte Pfade auf index.html fallen müssen, sonst endet jede
 * Route außer "/" im 404.
 */
const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
}

const server = createServer((req, res) => {
  const pfad = decodeURIComponent((req.url || '/').split('?')[0])
  let datei = join(DIST, normalize(pfad).replace(/^(\.\.[/\\])+/, ''))
  if (!existsSync(datei) || statSync(datei).isDirectory()) datei = join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPEN[extname(datei)] || 'application/octet-stream' })
  createReadStream(datei).pipe(res)
})
await new Promise((fertig) => server.listen(0, '127.0.0.1', fertig))
const BASIS = `http://127.0.0.1:${server.address().port}`

mkdirSync(ZIEL, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined })

/* -------------------------------------------------- Funktionsbild 1024x500
 * Google zeigt es über dem Eintrag und schneidet links und rechts etwas ab,
 * sobald der Bildschirm schmal ist. Deshalb steht alles Wichtige in der
 * Mitte und außen nur Hintergrund.
 */
function funktionsbild() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; width: 1024px; height: 500px; overflow: hidden; }
  body {
    background-color: #0d0a1e;
    background-image:
      radial-gradient(ellipse 70% 90% at 50% -20%, rgba(124,58,237,0.42), transparent 62%),
      radial-gradient(ellipse 50% 70% at 102% 10%, rgba(56,189,248,0.14), transparent 58%),
      radial-gradient(ellipse 60% 80% at -2% 105%, rgba(192,132,252,0.18), transparent 58%);
    display: flex; align-items: center; justify-content: center; gap: 44px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .symbol {
    width: 196px; height: 196px; border-radius: 44px; flex: none;
    background: linear-gradient(160deg, #2b2158, #1a1435);
    border: 3px solid #a78bfa;
    display: flex; align-items: center; justify-content: center;
    color: #f0c84a; font-weight: 800; font-size: 82px; letter-spacing: 0.02em;
    box-shadow: 0 10px 30px rgba(0,0,0,0.55), 0 0 26px rgba(139,92,246,0.45);
  }
  .text { display: flex; flex-direction: column; gap: 14px; }
  .name { font-size: 62px; font-weight: 800; color: #f4f1ff; line-height: 1; }
  .claim { font-size: 27px; font-weight: 600; color: #f0c84a; }
  .zeile { font-size: 20px; font-weight: 500; color: #cfc8e8; }
  </style></head><body>
    <div class="symbol">TE</div>
    <div class="text">
      <div class="name">TE-Mini Games</div>
      <div class="claim">Nur noch eine Runde. ✨</div>
      <div class="zeile">${SPIELE_ANZAHL} Spiele · allein, zu zweit oder in der Gruppe · auch offline</div>
    </div>
  </body></html>`
}

{
  const page = await browser.newPage({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  })
  await page.setContent(funktionsbild())
  const png = await page.screenshot({ type: 'png' })
  writeFileSync(`${ZIEL}/funktionsbild-1024x500.png`, png)
  await page.close()
  console.log(`funktionsbild-1024x500.png  ${(png.length / 1024).toFixed(0)} KB`)
}

/* ------------------------------------------------ Bildschirmfotos 1080x1920
 * Google will mindestens zwei pro Geräteklasse, 16:9 im Hochformat.
 * 540x960 CSS-Pixel bei doppelter Dichte ergibt genau 1080x1920 -- und
 * bleibt unter dem ersten Umbruchpunkt, die App zeigt also ihr
 * Telefon-Layout und nicht das breite.
 */
/**
 * Jedes Bild mit dem Weg dorthin. Ein Bildschirmfoto vom Startmenü eines
 * Spiels zeigt nichts vom Spiel -- deshalb klickt sich das Skript bis in
 * die Partie hinein, so wie es ein Spieler täte.
 */
const BILDER = [
  { name: '1-start', pfad: '/' },
  {
    name: '2-kniffel',
    pfad: '/play/kniffel',
    async weg(page) {
      await klick(page, /Gegen den Rechner/)
      await klick(page, /Los geht/)
      await klick(page, /Würfeln/)
      // Die Würfel rollen in 3D aus -- vorher steht auf dem Bild Bewegungsunschärfe.
      await page.waitForTimeout(3500)
    },
  },
  { name: '3-sudoku', pfad: '/play/sudoku', weg: (page) => klick(page, /Spielen · Stufe 1/) },
  { name: '4-levelkarte', pfad: '/play/perfect-second' },
  {
    name: '5-texas',
    pfad: '/play/texas-holdem',
    async weg(page) {
      await klick(page, /Turnier gegen den Rechner/)
      await klick(page, /Los geht/)
      // Erst setzen die Rechner-Gegner, dann ist der Spieler dran. Vorher
      // wäre der Tisch ohne eigene Karten und ohne Knöpfe zu sehen.
      await page
        .getByRole('button', { name: /Passen|Mitgehen|Erhöhen|Schieben|All[- ]?In/i })
        .first()
        .waitFor({ timeout: 20000 })
        .catch(() => {})
    },
  },
  {
    name: '6-schuetzenopoly',
    pfad: '/play/schuetzenopoly',
    async weg(page) {
      await klick(page, /Neue Partie/)
      await klick(page, /Partie starten/)
    },
  },
  {
    name: '7-maumau',
    pfad: '/play/maumau',
    async weg(page) {
      await klick(page, /Gegen den Rechner/)
      await klick(page, /Los geht/)
    },
  },
  { name: '8-emberwake', pfad: '/play/emberwake', weg: (page) => klick(page, /^Spielen$/) },
]

/** Klickt einen Knopf, wenn es ihn gibt -- und sagt es, wenn nicht. */
async function klick(page, name) {
  const el = page.getByRole('button', { name }).first()
  if (!(await el.count())) {
    console.error(`  Knopf fehlt: ${name} -- das Bild zeigt nicht, was es soll.`)
    fehler = true
    return
  }
  await el.click()
  await page.waitForTimeout(1400)
}
let fehler = false

const kontext = await browser.newContext({
  viewport: { width: 540, height: 960 },
  deviceScaleFactor: 2,
  locale: 'de-DE',
  // Der Service Worker würde die Seiten aus seinem Zwischenspeicher
  // ausliefern -- dann fotografiert man einen alten Build.
  serviceWorkers: 'block',
  colorScheme: 'light',
})

const page = await kontext.newPage()

// Einmal an der Anmeldung vorbei: ohne das steht vor jedem Spiel die Hürde.
await page.goto(`${BASIS}/`, { waitUntil: 'domcontentloaded' })
const gast = page.getByRole('button', { name: /gast/i })
if (await gast.count()) {
  await gast.first().click()
  await page.waitForTimeout(600)
}

for (const b of BILDER) {
  await page.goto(`${BASIS}${b.pfad}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(900)
  if (b.weg) await b.weg(page)
  // Kurz warten: Schriften, Bilder und die Einblend-Animationen sollen
  // durch sein, sonst steht auf dem Bild eine halb sichtbare Kachel.
  await page.waitForTimeout(800)
  const png = await page.screenshot({ type: 'png' })
  const datei = `telefon-${b.name}-1080x1920.png`
  writeFileSync(`${ZIEL}/${datei}`, png)
  console.log(`${datei}  ${(png.length / 1024).toFixed(0)} KB`)
}

await browser.close()
server.close()
console.log(`\nFertig in ${ZIEL}/`)
if (fehler) {
  console.error('\nMindestens ein Knopf wurde nicht gefunden -- die Oberfläche hat sich geändert.')
  process.exit(1)
}
