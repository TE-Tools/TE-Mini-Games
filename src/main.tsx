import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { StartFehler } from '@/app/StartFehler'
import '@/styles/global.css'

/**
 * Den Startbildschirm aus index.html wegblenden.
 *
 * Er verschwindet jetzt in jedem Fall -- auch wenn beim Start etwas
 * schiefgeht. Vorher stand die Zeile hinter dem Rendern: Warf React dabei
 * einen Fehler, wurde sie nie erreicht, und der Startbildschirm blieb für
 * immer stehen. Von außen sah das aus, als ließe sich die App nicht mehr
 * öffnen -- ohne Meldung und ohne Ausweg.
 */
function splashWeg(): void {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('weg')
  window.setTimeout(() => splash.remove(), 300)
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  splashWeg()
  throw new Error('Root element #root not found')
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <StartFehler>
        <App />
      </StartFehler>
    </StrictMode>,
  )
} finally {
  // `requestAnimationFrame` wartet auf das erste gezeichnete Bild -- vorher
  // wäre die Seite für einen Wimpernschlag leer.
  requestAnimationFrame(splashWeg)
}

// Und als letzte Sicherung: Sollte gar nichts davon greifen (ein Fehler
// außerhalb von React, ein hängendes Modul), verschwindet der
// Startbildschirm trotzdem, statt die App für immer als "lädt" zu zeigen.
window.setTimeout(splashWeg, 10_000)
