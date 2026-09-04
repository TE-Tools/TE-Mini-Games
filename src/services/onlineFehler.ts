/**
 * Fehler der Online-Runden in Sätze übersetzen, die am Tisch etwas nützen.
 *
 * Anlass (04.09.2026): Weil die Datenbank auf dem Stand einer älteren
 * Migration stand, bekam jeder, der eine Online-Runde eröffnen wollte, dies
 * hier zu lesen:
 *
 *   Could not find the function public.fdi_create_match(p_category, p_mode,
 *   p_name) in the schema cache
 *
 * Das ist keine Meldung für Mitspielende. Die Regeln unten fangen genau die
 * Fälle ab, die nicht am Spiel liegen, sondern an Einrichtung, Netz oder
 * Anmeldung -- alles andere kommt unverändert durch, denn die Meldungen aus
 * den Spielfunktionen selbst ("Du bist nicht dabei", "Im Duell tippst du nur
 * auf dein eigenes Team") sind bereits für Menschen geschrieben.
 */

/** PostgREST meldet fehlende Funktionen und Tabellen mit diesen Codes. */
const NICHT_EINGERICHTET = /PGRST202|PGRST205|schema cache|does not exist|relation .* does not exist/i
const KEIN_NETZ = /Failed to fetch|NetworkError|network|fetch failed|timeout/i
const NICHT_ANGEMELDET = /JWT|not authenticated|Nicht angemeldet|invalid claim/i
const KEIN_RECHT = /permission denied|row-level security|insufficient_privilege/i

export function onlineFehlerText(fehler: unknown): string {
  // Supabase liefert schlichte Objekte { message, code, details }, keine
  // Error-Instanzen -- String() daraus würde "[object Object]" ergeben.
  const roh = [textVon(fehler), codeVon(fehler)].filter(Boolean).join(' ')

  if (NICHT_EINGERICHTET.test(roh)) {
    return (
      'Die Online-Runden sind auf dem Server noch nicht eingerichtet. ' +
      'Am einen Gerät könnt ihr sofort weiterspielen.'
    )
  }
  if (KEIN_NETZ.test(roh)) {
    return 'Keine Verbindung zum Server. Prüf kurz das Netz und versuch es noch einmal.'
  }
  if (NICHT_ANGEMELDET.test(roh)) {
    return 'Für Online-Runden musst du angemeldet sein.'
  }
  if (KEIN_RECHT.test(roh)) {
    return 'Dafür fehlt die Berechtigung. Bist du noch in dieser Runde dabei?'
  }
  // Die Meldungen der Spielfunktionen sind schon deutsch und gemeint.
  return textVon(fehler) || 'Das hat nicht geklappt.'
}

function textVon(fehler: unknown): string {
  if (fehler instanceof Error) return fehler.message
  if (typeof fehler === 'string') return fehler
  const m = (fehler as { message?: unknown } | null)?.message
  return typeof m === 'string' ? m : ''
}

function codeVon(fehler: unknown): string {
  const c = (fehler as { code?: unknown } | null)?.code
  return typeof c === 'string' ? c : ''
}
