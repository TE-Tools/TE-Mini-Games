import { supabase, isSupabaseConfigured } from '@/database/supabase'
import type { User, Session } from '@supabase/supabase-js'

export type AuthState = {
  user: User | null
  session: Session | null
  configured: boolean
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export function getAuthConfigured(): boolean {
  return isSupabaseConfigured
}

export function validateUsername(username: string): string | null {
  const u = username.trim()
  if (u.length < 3) return 'Benutzername mindestens 3 Zeichen'
  if (u.length > 20) return 'Benutzername maximal 20 Zeichen'
  if (!USERNAME_RE.test(u)) return 'Nur Buchstaben, Zahlen und _'
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Passwort mindestens 8 Zeichen'
  return null
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

export async function isUsernameAvailable(username: string): Promise<{
  available: boolean
  error: string | null
}> {
  if (!supabase) return { available: false, error: 'Supabase nicht konfiguriert' }
  const u = username.trim().toLowerCase()
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: u,
  })
  if (error) return { available: false, error: error.message }
  return { available: Boolean(data), error: null }
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
  username: string,
  displayName?: string,
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert' }

  const nameErr = validateUsername(username)
  if (nameErr) return { error: nameErr }
  const passErr = validatePassword(password)
  if (passErr) return { error: passErr }

  const { available, error: checkErr } = await isUsernameAvailable(username)
  if (checkErr) return { error: checkErr }
  if (!available) return { error: 'Benutzername ist bereits vergeben' }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      // Without this the confirmation mail uses Supabase's Site URL, which
      // defaults to localhost:3000.
      emailRedirectTo: `${window.location.origin}/auth`,
      data: {
        display_name: displayName?.trim() || username.trim(),
        username: username.trim().toLowerCase(),
      },
    },
  })
  if (error) return { error: error.message }

  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      display_name: displayName?.trim() || username.trim(),
      username: username.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    })
  }

  return { error: null }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert' }
  const redirectTo = `${window.location.origin}/auth`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  return { error: error?.message ?? null }
}

/** Send the "forgot password" mail. The link comes back to /auth. */
export async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert' }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/auth`,
  })
  return { error: error?.message ?? null }
}

/** Set a new password – used after following the reset link. */
export async function updatePassword(password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert' }
  const passErr = validatePassword(password)
  if (passErr) return { error: passErr }
  const { error } = await supabase.auth.updateUser({ password })
  return { error: error?.message ?? null }
}

/** Username of the signed-in player, or null. */
export async function getMyUsername(): Promise<string | null> {
  if (!supabase) return null
  const { data: userData } = await supabase.auth.getUser()
  const id = userData.user?.id
  if (!id) return null
  const { data } = await supabase.from('profiles').select('username').eq('id', id).maybeSingle()
  return (data?.username as string | null) ?? null
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

/** Fires when the user arrives through a password-reset link. */
/**
 * Supabase reports failed mail links as a URL hash
 * (#error=...&error_description=...). Read and clear it so the page can show
 * what went wrong instead of looking broken.
 */
export function takeAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.includes('error')) return null
  const params = new URLSearchParams(hash)
  const description = params.get('error_description') ?? params.get('error')
  if (!description) return null
  window.history.replaceState(null, '', window.location.pathname)
  return decodeURIComponent(description.replace(/\+/g, ' '))
}

export function onPasswordRecovery(callback: () => void): () => void {
  if (!supabase) return () => undefined
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') callback()
  })
  return () => data.subscription.unsubscribe()
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
