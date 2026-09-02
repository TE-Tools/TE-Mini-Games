import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/styles/global.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Den Startbildschirm aus index.html wegblenden, sobald React gerendert hat.
 * `requestAnimationFrame` wartet auf genau das erste Bild -- vorher waere die
 * Seite fuer einen Wimpernschlag leer.
 */
requestAnimationFrame(() => {
  const splash = document.getElementById('splash')
  if (!splash) return
  splash.classList.add('weg')
  window.setTimeout(() => splash.remove(), 300)
})
