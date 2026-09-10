/**
 * Der Auffang für Fehler beim Start.
 *
 * Am 10.09.2026 meldete Thomas, einige könnten die App nicht mehr öffnen.
 * Nachgesehen: Wirft der erste Render einen Fehler, bricht `main.tsx` ab --
 * und weil der Startbildschirm aus index.html erst *nach* dem Rendern
 * weggeblendet wird, bleibt er für immer stehen. Von außen sieht das aus,
 * als hänge die App beim Laden. Kein Fehler, keine Meldung, kein Ausweg.
 *
 * Deshalb hier zwei Dinge:
 *
 *   1. Ein Rahmen, der Renderfehler auffängt und stattdessen etwas
 *      Lesbares zeigt -- mit der Fehlermeldung, damit man sie melden kann.
 *   2. Zwei Knöpfe, die in den allermeisten Fällen helfen: neu laden und,
 *      wenn das nicht reicht, den Zwischenspeicher der App leeren. Der
 *      Spielstand liegt in IndexedDB und bleibt dabei erhalten.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  fehler: Error | null
}

/** Zwischenspeicher und Service Worker wegräumen, dann neu laden. */
async function appZuruecksetzen(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    // Weiter -- die Caches sind wichtiger.
  }
  try {
    if ('caches' in window) {
      const namen = await caches.keys()
      await Promise.all(namen.map((n) => caches.delete(n)))
    }
  } catch {
    // Auch das darf den Neustart nicht aufhalten.
  }
  location.reload()
}

export class StartFehler extends Component<Props, State> {
  override state: State = { fehler: null }

  static getDerivedStateFromError(fehler: Error): State {
    return { fehler }
  }

  override componentDidCatch(fehler: Error, info: ErrorInfo): void {
    console.error('Fehler beim Start:', fehler, info.componentStack)
  }

  override render(): ReactNode {
    const { fehler } = this.state
    if (!fehler) return this.props.children

    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem 1.25rem',
          textAlign: 'center',
          font: '16px/1.5 system-ui, sans-serif',
          color: '#2b2b33',
          background: '#f0efe9',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Da ist etwas schiefgegangen</h1>
        <p style={{ margin: 0, maxWidth: '30rem' }}>
          Die App konnte nicht starten. Dein Spielstand ist gespeichert und geht dabei nicht
          verloren.
        </p>
        <div
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              padding: '0.7rem 1.4rem',
              borderRadius: 999,
              border: 'none',
              background: '#2b2b33',
              color: '#fff',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Neu laden
          </button>
          <button
            type="button"
            onClick={() => void appZuruecksetzen()}
            style={{
              padding: '0.7rem 1.4rem',
              borderRadius: 999,
              border: '1px solid #2b2b33',
              background: 'transparent',
              color: '#2b2b33',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Zwischenspeicher leeren
          </button>
        </div>
        <pre
          style={{
            maxWidth: '100%',
            overflowX: 'auto',
            fontSize: '0.75rem',
            opacity: 0.7,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {fehler.message}
        </pre>
      </main>
    )
  }
}
