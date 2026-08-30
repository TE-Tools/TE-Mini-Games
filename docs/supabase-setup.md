# Supabase Setup – TE-Mini Games

Der **App-Code** (Auth, Sync, Offline-First) ist fertig.  
Damit Login live läuft, brauchst du **einmal** dein Supabase-Projekt + Keys in Cloudflare.

> **Wenn du das Schema schon einmal eingespielt hast:**
> `ALL_IN_ONE.sql` einfach erneut ausführen – das Skript ist idempotent und zieht
> `004_level_500.sql` (Level bis 500, Profil-Upsert) und `005_leaderboard.sql`
> (Rangliste-View) nach.

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
4. Eine Runde spielen, neu laden → Level/XP müssen erhalten bleiben  

Offline als Gast geht weiterhin ohne Keys.

## Checkliste: was noch offen ist

| Punkt | Wo | Status |
|-------|----|--------|
| Schema, RLS, Username-Check, Level-500-Limits, Rangliste-View | `supabase/migrations/ALL_IN_ONE.sql` | im Repo, **muss von dir ausgeführt werden** |
| Auth-Provider Email (+ optional Google) | Supabase → Authentication → Providers | **du** |
| Site URL + Redirect URLs | Supabase → Authentication → URL Configuration | **du** |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages → Environment variables (Production **und** Preview) | **du** |
| Redeploy nach dem Setzen der Variablen | Cloudflare → Deployments → Retry | **du** |

### Globale Rangliste

`005_leaderboard.sql` legt die View `public.leaderboard_top` an: pro Spieler und
Spiel das beste Ergebnis, mit **Benutzername, Spiel, Punkte, Level** – mehr nicht.
Keine User-ID, keine E-Mail, keine Profildaten. Spieler ohne Benutzernamen
tauchen nicht auf. `src/services/leaderboard.ts` liest diese View; die rohen
`game_results` bleiben durch RLS privat.
