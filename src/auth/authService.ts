import { supabase, isSupabaseConfigured } from '@/database/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type AuthState = {
  user: User | null
  session: Session | null
  configured: boolean
}

export function getAuthConfigured(): boolean {
  return isSupabaseConfigured
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error: error?.message ?? null }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert' }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName ?? 'Spieler' },
    },
  })
  return { error: error?.message ?? null }
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export function onAuthStateChange(
  callback: (user: User | null) => void,
): () => void {
  if (!supabase) {
    callback(null)
    return () => undefined
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null)
  })
  return () => data.subscription.unsubscribe()
}
