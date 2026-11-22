import { Link } from 'react-router-dom'
import { useText } from '@/i18n/sprache'

export function NotFoundPage() {
  const t = useText().nichtGefunden
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
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{t.titel}</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>{t.text}</p>
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
        {t.zurStartseite}
      </Link>
    </main>
  )
}
