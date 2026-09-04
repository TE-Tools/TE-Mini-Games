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

(Enthält Schema, RLS, Username-Check, Level-500-Grenzen, Rangliste, Löschrechte
und die Schützenrunde-Multiplayer-Funktionen.)

Das Skript ist **mehrfach ausführbar** – nach einem Update einfach erneut
komplett einfügen und laufen lassen. Erzeugt wird es aus den Einzelmigrationen
mit `node scripts/build-all-in-one.mjs`.

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
- Öffentlicher Key → `VITE_SUPABASE_ANON_KEY`  
  (neues Format `sb_publishable_…` oder der alte `anon` `public` JWT – beides funktioniert)  

Niemals den **service_role** Key in die Frontend-App oder ins Git legen.

## 5. Cloudflare Pages

**Workers & Pages → te-mini-games → Settings → Environment variables**  
(Production und Preview):

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |

Danach **Redeploy** (Deployments → Retry deployment), damit Vite die Vars einbaut.

### E-Mail-Bestätigung

Standardmäßig ist **Confirm email** an: neue Konten müssen erst den Link aus der
Mail anklicken, bevor die erste Anmeldung geht. Zwei Dinge dazu:

- Der eingebaute Supabase-Mailversand ist stark limitiert (wenige Mails pro
  Stunde) und landet oft im Spam. Für echten Betrieb eigenen SMTP hinterlegen:
  Authentication → Emails → SMTP Settings.
- Zum schnellen Testen kann man die Bestätigung abschalten:
  Authentication → Providers → Email → **Confirm email** aus.

## 6. Prüfen

1. https://te-mini-games.pages.dev/auth  
2. „Konto erstellen“ mit Benutzername + E-Mail + Passwort  
3. Falls E-Mail-Confirm an ist: Inbox bestätigen, dann anmelden  
4. Eine Runde spielen, neu laden → Level/XP müssen erhalten bleiben  

Offline als Gast geht weiterhin ohne Keys.

## Nach jedem neuen Online-Spiel: ALL_IN_ONE.sql erneut ausführen

`ALL_IN_ONE.sql` ist mehrfach ausführbar (jede Migration ist idempotent
geschrieben). Wenn hier ein neues Online-Spiel dazukommt, reicht es also,
die Datei erneut komplett in den SQL-Editor zu kippen -- nichts Vorhandenes
geht dabei kaputt.

**Warum das hier so deutlich steht:** Am 04.09.2026 fiel auf, dass die
laufende Datenbank beim Stand von Migration 010 stehengeblieben war. „Finde
den Imposter" online, „Wer bin ich?" und „Stadt-Land-Fluss" hatten dort gar
keine Tabellen -- das Sammelskript war nach dem Hinzufügen der Migrationen
011 bis 014 nie neu erzeugt worden. Von aussen sah alles in Ordnung aus: Die
App wurde erfolgreich ausgeliefert, die Rangliste lief, nur die Online-Runden
brachen ab. `tests/all-in-one.test.ts` lässt das nicht wieder still passieren.

## Checkliste: was noch offen ist

| Punkt | Wo | Status |
|-------|----|--------|
| Schema, RLS, Username-Check, Level-500-Limits, Rangliste-View, **alle Online-Spiele** | `supabase/migrations/ALL_IN_ONE.sql` | im Repo, **muss von dir ausgeführt werden** |
| Auth-Provider Email (+ optional Google) | Supabase → Authentication → Providers | **du** |
| Site URL + Redirect URLs | Supabase → Authentication → URL Configuration | **du** |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages → Environment variables (Production **und** Preview) | **du** |
| Redeploy nach dem Setzen der Variablen | Cloudflare → Deployments → Retry | **du** |
| Realtime für `sr_state` und `sr_messages` | Supabase → Database → Replication | **du** (nur für Online-Runden) |

### Globale Rangliste

`005_leaderboard.sql` legt die View `public.leaderboard_top` an: pro Spieler und
Spiel das beste Ergebnis, mit **Benutzername, Spiel, Punkte, Level** – mehr nicht.
Keine User-ID, keine E-Mail, keine Profildaten. Spieler ohne Benutzernamen
tauchen nicht auf. `src/services/leaderboard.ts` liest diese View; die rohen
`game_results` bleiben durch RLS privat.


## Schützenrunde online (Migration 007)

Die Online-Runde läuft **serverautoritativ**: Rollen, Nachtaktionen und
Abstimmungen werden in Postgres aufgelöst, nicht im Browser.

**Wie das abgesichert ist**

- Die Tabellen `sr_matches`, `sr_players`, `sr_actions`, `sr_votes`, `sr_notes`
  und `sr_events` sind für Clients komplett gesperrt (`revoke all`). Kein
  Spieler kann fremde Rollen oder die Nachtaktionen der anderen auslesen – auch
  der Gastgeber nicht.
- Gelesen wird ausschließlich über `sr_get_state()`. Die Funktion gibt fremde
  Rollen erst heraus, wenn jemand ausgeschieden oder die Runde vorbei ist.
- Geschrieben wird nur über die Funktionen `sr_night_action`, `sr_vote`,
  `sr_ready` und `sr_say`; jede prüft, dass der Aufrufer wirklich auf diesem
  Platz sitzt und noch lebt.
- Die Phasenzeit prüft der Server mit `now()`. `sr_tick()` darf jeder anstoßen,
  entschieden wird trotzdem in der Datenbank – ein manipulierter Client kann
  die Uhr also weder anhalten noch vorspulen.
- Direkt lesbar sind nur der Chat (`sr_messages`) und ein Zustandszähler
  (`sr_state`), beide nur für Mitglieder der jeweiligen Runde. Genau diese
  beiden verteilt Realtime.
- Aufrufen darf die Funktionen nur `authenticated`. **Achtung, Supabase-Falle:**
  Neue Funktionen in `public` bekommen per Default-Privileg automatisch
  `execute` für `anon` **und** `authenticated`; ein `revoke ... from public`
  nimmt diese Rollenrechte *nicht* mit weg. Die Migration entzieht deshalb
  erst allen `sr_*`-Funktionen sämtliche Rechte und gibt danach gezielt nur
  die elf Funktionen der öffentlichen Schnittstelle für `authenticated` frei.
- Jede Funktion weist zusätzlich Aufrufer ohne Anmeldung ab. Wichtig, weil
  `auth.uid()` dann `NULL` ist und ein Vergleich wie `host_id <> auth.uid()`
  zu `NULL` auswertet – also gerade *nicht* blockieren würde.

**Was du dafür einstellen musst**

1. `supabase/migrations/ALL_IN_ONE.sql` erneut ausführen (enthält 007).
2. Supabase → **Database → Replication** → Publication `supabase_realtime`:
   `sr_state` und `sr_messages` anhaken.
   Ohne diesen Schritt funktioniert alles trotzdem – die Seite fragt dann alle
   drei Sekunden nach, statt sofort benachrichtigt zu werden.

**Testen ohne Supabase**

Die Spielregeln lassen sich gegen ein leeres Postgres prüfen:

```bash
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/00_harness.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/ALL_IN_ONE.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/schuetzenrunde.test.sql
```

Der Test spielt Runden jeder Größe komplett durch und prüft Geheimhaltung,
Uhr und Beitritt. **Nicht** gegen das echte Projekt laufen lassen – er legt
Testnutzer und Runden an.


## Finde den Imposter online (Migrationen 011 + 011b)

Damit „Finde den Imposter" auch mit eigenen Handys statt an einem Gerät
gespielt werden kann, brauchst du **zwei** Dateien im SQL-Editor:

1. `supabase/migrations/011_imposter_online.sql` – Tabellen und Spiellogik
2. `supabase/migrations/011b_imposter_words.sql` – 20 Kategorien und 1000
   Wörter (rein Daten, gefahrlos mehrfach ausführbar)
3. `supabase/migrations/012_imposter_modes.sql` – die weiteren Modi (Leer,
   Nur Kategorie, Tempo, Chaos)

Sie sind **nicht** in `ALL_IN_ONE.sql` enthalten: die Datei ist schon jetzt
so lang, dass der SQL-Editor auf dem Handy daran hängenbleibt.

Wenn du 011 und 011b schon einmal ausgeführt hast, reichen jetzt 011b (die
neuen Wörter) und 012.

**Wie das abgesichert ist**

Gleiches Muster wie bei der Schützenrunde: `fdi_matches`, `fdi_players`,
`fdi_words` und `fdi_categories` sind für Clients gesperrt, alles läuft über
`security definer`-Funktionen. Der wichtigste Punkt ist spielspezifisch:

- **Der Server zieht das geheime Wort**, nicht der Browser des Gastgebers –
  sonst könnte ein Gastgeber, der selbst Imposter ist, es einfach ablesen.
- `fdi_get_state()` gibt jedem Aufrufer nur seine eigene Sicht: das geheime
  Wort ausschließlich an Nicht-Imposter, das Hilfswort ausschließlich an
  Imposter, und wer Imposter war, erst wenn die Runde im Ergebnis steht.
- **Der Modus ändert daran nichts, er verschärft es nur:** Im Modus „Nur
  Kategorie" gibt der Server gar kein Hilfswort heraus, im Modus „Leer"
  zusätzlich auch den Namen der Kategorie nicht – erst im Ergebnis.
- Direkt lesbar ist nur ein Zähler (`fdi_state.version`), und auch der nur
  für Mitglieder der jeweiligen Runde.

**Was du dafür einstellen musst**

1. Die beiden Dateien oben im SQL-Editor ausführen.
2. Supabase → **Database → Replication** → Publication `supabase_realtime`:
   zusätzlich `fdi_state` anhaken. Ohne das läuft alles trotzdem, die Seite
   fragt dann alle drei Sekunden nach.

**Testen ohne Supabase**

```bash
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/tests/00_harness.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/011_imposter_online.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/011b_imposter_words.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/012_imposter_modes.sql
psql "$PGURL" -f supabase/tests/imposter_online_test.sql
psql "$PGURL" -f supabase/tests/imposter_modes_test.sql
```

Jede Zeile der Ausgabe beginnt mit `OK` oder `FEHLER`; am Ende steht
`ALLE PRUEFUNGEN BESTANDEN`. **Nicht** gegen das echte Projekt laufen lassen –
der Test legt Testnutzer und Runden an und räumt die `fdi_`-Tabellen leer.


## „Wer bin ich?" online (Migration 013)

`supabase/migrations/013_wer_bin_ich.sql` im SQL-Editor ausführen. Die
Migration setzt 011/011b voraus: Kategorien und Wörter kommen aus
`fdi_categories` und `fdi_words`, damit es den Wortschatz nur einmal gibt.

**Wie das abgesichert ist** – hier ist es genau umgekehrt zum Imposter: Jeder
soll die Begriffe der *anderen* sehen, aber niemals seinen eigenen. Der
gesamte Trick steckt in einer Zeile in `wbi_get_state()`, die dem Aufrufer
sein eigenes Wort herausstreicht. Deshalb zieht auch hier der Server die
Wörter, und die Tabellen sind für Clients gesperrt. Ausgewertet wird der Tipp
ebenfalls serverseitig – der Browser kennt das eigene Wort gar nicht und
könnte gar nicht vergleichen.

Optional: Supabase → Database → Replication → `wbi_state` anhaken.


## „Stadt-Land-Fluss" online (Migration 014)

`supabase/migrations/014_stadt_land_fluss.sql` im SQL-Editor ausführen.

**Wie das abgesichert ist:** Es gibt kein Geheimnis zu hüten, aber zwei
Gründe für den Server. Erstens werden die Punkte dort vergeben – wer sich
selbst zählt, zählt sich gern zu viel. Zweitens hält `slf_get_state()` die
Antworten der anderen zurück, solange geschrieben wird; sonst schriebe man
einfach ab. Die Uhr läuft ebenfalls auf dem Server (`slf_tick` prüft `now()`
selbst), ein vorgestelltes Handy bringt also nichts.

Optional: Supabase → Database → Replication → `slf_state` anhaken.

```bash
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/013_wer_bin_ich.sql
psql "$PGURL" -v ON_ERROR_STOP=1 -f supabase/migrations/014_stadt_land_fluss.sql
psql "$PGURL" -f supabase/tests/wer_bin_ich_test.sql
psql "$PGURL" -f supabase/tests/stadt_land_fluss_test.sql
```
