# Supabase Setup – TE-Mini Games

Der **App-Code** (Auth, Sync, Offline-First) ist fertig.  
Damit Login live läuft, brauchst du **einmal** dein Supabase-Projekt + Keys in Cloudflare.

## Was von hier aus möglich ist

| Schritt | Wer |
|---------|-----|
| Migrations-SQL, Auth-UI, Sync-Code | bereits im Repo |
| Supabase-Projekt anlegen | **du** (supabase.com) |
| SQL ausführen | **du** (SQL Editor) |
| Cloudflare Env-Variablen | **du** (Pages → Settings) |

Wir können **kein** Passwort und keinen **service_role**-Key verwenden.  
Reichen tut: **Project URL** + **anon public key**.

---

## 1. Projekt

1. [supabase.com](https://supabase.com) → New Project  
2. Region wählen, warten bis grün  

## 2. Schema + RLS (einmal)

**SQL Editor** → New query → Inhalt von  
`supabase/migrations/ALL_IN_ONE.sql`  
einfügen → **Run**.

(Enthält Schema, RLS, Username-Check.)

## 3. Auth aktivieren

**Authentication → Providers:**

- **Email** einschalten  
- Optional **Google**: Client ID/Secret, Redirect  
  `https://<PROJECT_REF>.supabase.co/auth/v1/callback`  
  und Site URL: `https://te-mini-games.pages.dev`

**URL Configuration:**

- Site URL: `https://te-mini-games.pages.dev`  
- Redirect URLs: `https://te-mini-games.pages.dev/**` und `http://localhost:5173/**`

## 4. Keys holen

**Settings → API:**

- Project URL → `VITE_SUPABASE_URL`  
- `anon` `public` key → `VITE_SUPABASE_ANON_KEY`  

Niemals den **service_role** Key in die Frontend-App oder ins Git legen.

## 5. Cloudflare Pages

**Workers & Pages → te-mini-games → Settings → Environment variables**  
(Production und Preview):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |

Danach **Redeploy** (Deployments → Retry deployment), damit Vite die Vars einbaut.

## 6. Prüfen

1. https://te-mini-games.pages.dev/auth  
2. „Konto erstellen“ mit Benutzername + E-Mail + Passwort  
3. Falls E-Mail-Confirm an ist: Inbox bestätigen, dann anmelden  

Offline als Gast geht weiterhin ohne Keys.

## Konfliktregeln (Sync)

| Daten | Regel |
|-------|--------|
| Personal record | höherer `best_score` |
| XP / Level | max `total_xp` |
| Game progress | höchste Levels |
| Results | append-only |
| Achievements | insert if not exists |

## GitHub ↔ Supabase

Eine GitHub-Verbindung in Supabase (Branching) ersetzt **nicht** die Env-Vars in Cloudflare.  
Die App liest nur `VITE_SUPABASE_*` zur Build-Zeit.
