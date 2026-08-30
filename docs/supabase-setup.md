# Supabase Setup – TE-Mini Games

Der **App-Code** (Auth, Sync, Offline-First) ist fertig.  
Damit Login live läuft, brauchst du **einmal** dein Supabase-Projekt + Keys in Cloudflare.

> **Wenn du das Schema schon vor dem 30.08.2026 eingespielt hast:**
> bitte `supabase/migrations/004_level_500.sql` nachziehen (SQL Editor → Run).
> Ohne das lehnt die Datenbank alle Ergebnisse über Level 100 ab und der
> Profil-Upsert beim Registrieren scheitert an RLS.

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
| Schema, RLS, Username-Check, Level-500-Limits | `supabase/migrations/ALL_IN_ONE.sql` | im Repo, **muss von dir ausgeführt werden** |
| Auth-Provider Email (+ optional Google) | Supabase → Authentication → Providers | **du** |
| Site URL + Redirect URLs | Supabase → Authentication → URL Configuration | **du** |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages → Environment variables (Production **und** Preview) | **du** |
| Redeploy nach dem Setzen der Variablen | Cloudflare → Deployments → Retry | **du** |

### Bekannte Einschränkung: globale Rangliste

`getRemoteTopScores()` liest `game_results` aller Spieler, die RLS erlaubt aber
nur **eigene** Zeilen (`game_results_select_own`). Die Online-Rangliste zeigt
deshalb bisher nur die eigenen Ergebnisse. Zwei Wege, beides eine bewusste
Entscheidung über Sichtbarkeit fremder Daten:

1. **View** `public.leaderboard_top` (nur `display_name`, `game_id`, `score`,
   `level`) mit `grant select … to authenticated` – Namen und Punkte werden
   für angemeldete Spieler sichtbar, E-Mails bleiben privat. Dafür muss
   `src/services/leaderboard.ts` auf die View umgestellt werden.
2. Rangliste bleibt rein lokal/persönlich – dann sollte die Online-Sektion
   in der UI entfallen.

Sag Bescheid, welchen Weg du willst; beides ist ein kleiner Umbau.

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
