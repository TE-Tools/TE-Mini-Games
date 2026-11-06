import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Seite nicht gefunden</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Diese Seite gibt es noch nicht.
      </p>
      <Link
        to="/"
        style={{
          minHeight: '48px',
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          background: 'var(--color-primary)',
          color: 'var(--color-primary-text)',
          borderRadius: 'var(--radius-lg)',
          fontWeight: 600,
        }}
      >
        Zur Startseite
      </Link>
    </main>
  )
}
