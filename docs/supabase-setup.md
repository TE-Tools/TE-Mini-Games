# Supabase Setup (Phase 7)

## 1. Project anlegen

1. [supabase.com](https://supabase.com) → New Project
2. Project URL und **anon** key kopieren (Settings → API)

## 2. Environment

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never commit `.env` or service-role keys.

## 3. Migrations

In the Supabase SQL Editor, run in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls.sql`

## 4. Auth

Enable Email auth under Authentication → Providers.

## 5. Conflict rules

| Data | Rule |
|------|------|
| Personal record | Keep higher `best_score` |
| XP / player level | Take max `total_xp` |
| Game progress | Highest levels + max XP |
| Results | Append-only |
| Achievements | Insert if not exists |

## 6. Score validation

RLS rejects impossible ranges (`score` 0–1000, `level` 1–100). Client may report; server validates ranges.
