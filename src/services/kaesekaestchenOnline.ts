/**
 * Online-Partien für Käsekästchen.
 *
 * Der Server führt ein Zugbuch, keine Regel (Migration 032). Er weiß, wer
 * am Blatt sitzt, wer anfängt und wer laut Buch am Zug ist -- was eine
 * Linie bewirkt und ob die mitgemeldete Angabe „wer ist dran" stimmt,
 * rechnet jeder Mitspieler selbst aus (`src/games/kaesekaestchen/online.ts`).
 *
 * Ist die Migration noch nicht eingespielt, kommt aus jedem Aufruf die
 * freundliche Meldung aus onlineFehler.ts („noch nicht eingerichtet") --
 * die Seite zeigt sie an, statt zu brechen.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { onlineFehlerText } from './onlineFehler'
import { raumFunktionen } from './raeume'
import type { KaestchenAktion, KaestchenEintrag } from '@/games/kaesekaestchen'

export const isKaesekaestchenOnlineAvailable = isSupabaseConfigured

export interface KaestchenSitz {
  seat: number
  name: string
  is_you: boolean
}

export interface KaestchenMatch {
  id: string
  code: string
  phase: 'lobby' | 'spiel' | 'ende'
  breite: number
  hoehe: number
  /** Die Sitze in Zugreihenfolge -- erst ab dem Start gesetzt. */
  sitze: number[]
  /** Wer anfängt -- erst ab dem Start gesetzt. */
  beginner: number | null
  /** Die wievielte Partie an diesem Blatt (Revanchen zählen mit). */
  partie: number
  am_zug: number
  is_public: boolean
  is_host: boolean
  size: number
  zug_nr: number
}

export interface KaestchenOnlineState {
  match: KaestchenMatch
  me: { seat: number }
  players: KaestchenSitz[]
  zuege: KaestchenEintrag[]
}

export interface KaestchenOpenMatch {
  match_id: string
  code: string
  phase: string
  size: number
}

function client() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Für Online-Partien fehlt die Verbindung zum Konto-Server.')
  }
  return supabase
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(name, args)
  if (error) throw new Error(onlineFehlerText(error))
  return data as T
}

const raum = raumFunktionen('kaestchen', client)
export const herzschlagKaesekaestchen = raum.herzschlag
export const fetchOeffentlicheKaesekaestchenRaeume = raum.oeffentlicheRaeume

export async function createKaesekaestchenMatch(
  name: string | undefined,
  breite: number,
  hoehe: number,
  oeffentlich = false,
): Promise<{ match_id: string; code: string }> {
  const rows = await rpc<{ match_id: string; code: string }[]>('kaestchen_create_match', {
    p_name: name ?? null,
    p_breite: breite,
    p_hoehe: hoehe,
  })
  const erster = Array.isArray(rows)
    ? rows[0]
    : (rows as unknown as { match_id: string; code: string })
  if (!erster) throw new Error('Das Blatt konnte nicht eröffnet werden.')
  if (oeffentlich) await raum.oeffentlichSchalten(erster.match_id, true)
  return erster
}

export const joinKaesekaestchenMatch = (code: string, name?: string) =>
  rpc<string>('kaestchen_join_match', { p_code: code.trim().toUpperCase(), p_name: name ?? null })

export const leaveKaesekaestchenMatch = (matchId: string) =>
  rpc<void>('kaestchen_leave_match', { p_match: matchId })

/** Starten -- oder nach einer Partie die Revanche; der nächste Sitz fängt an. */
export const startKaesekaestchenMatch = (matchId: string) =>
  rpc<void>('kaestchen_start', { p_match: matchId })

export const sendeKaesekaestchenAktion = (matchId: string, aktion: KaestchenAktion, ende = false) =>
  rpc<number>('kaestchen_aktion', { p_match: matchId, p_aktion: aktion, p_ende: ende })

export const fetchKaesekaestchenState = (matchId: string, ab = 0) =>
  rpc<KaestchenOnlineState>('kaestchen_get_state', { p_match: matchId, p_ab: ab })

export const fetchMyKaesekaestchenMatches = () =>
  rpc<KaestchenOpenMatch[]>('kaestchen_my_matches', {})

/** Auf Änderungen horchen: Der Server zählt bei jeder Aktion eine Version hoch. */
export function subscribeToKaesekaestchenMatch(matchId: string, onChange: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => undefined
  const sb = supabase
  const channel = sb
    .channel(`kaestchen:${matchId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'kaestchen_state', filter: `match_id=eq.${matchId}` },
      () => onChange(),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}
