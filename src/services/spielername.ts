/**
 * Unter welchem Namen jemand spielt.
 *
 * Anlass (06.09.2026, Thomas): "Wenn ich Kniffel einen Raum starte, steht
 * da immer noch Gast Du und nicht mein Accountname."
 *
 * Der Grund war nicht eine Zeile, sondern eine Lücke: Der lokale Name wird
 * beim ersten Start auf "Gast" gesetzt, und danach hat ihn nie wieder
 * jemand angefasst. `setDisplayName` gab es zwar, aufgerufen wurde es aus
 * keiner einzigen Stelle der Oberfläche -- eine Profilseite mit Namensfeld
 * gibt es nicht. Blieb der Geräteabgleich, und der läuft nur, wenn er
 * gerade läuft.
 *
 * Deshalb fragt diese Stelle den Namen dort, wo er sicher steht, und
 * schreibt ihn einmal lokal fest:
 *
 *   1. ein lokal gesetzter Name (nicht der Vorgabewert) -- der gewinnt
 *   2. die Anmeldedaten des Kontos (display_name, sonst username)
 *   3. die Profilzeile auf dem Server
 *   4. "Gast", wenn niemand angemeldet ist
 *
 * Schritt 2 ist der wichtige: Er braucht keine Datenbankabfrage und kein
 * Netz, weil die Angaben in der Anmeldung selbst stecken. Damit stimmt der
 * Name auch unmittelbar nach dem Anmelden und offline.
 */

import { supabase, isSupabaseConfigured } from '@/database/supabase'
import { getCurrentUser } from '@/auth/authService'
import { GAST_NAME, getOrCreateGuestProfile, setDisplayName } from '@/offline'

/** Kürzer ist kein Name, länger passt in keine Spaltenüberschrift. */
export const NAME_MIN = 2
export const NAME_MAX = 16

/** Ist das ein Name oder nur der unangetastete Vorgabewert? */
export function istEchterName(name: string | null | undefined): boolean {
  const sauber = name?.trim()
  return Boolean(sauber) && sauber !== GAST_NAME
}

function ausAnmeldedaten(metadaten: Record<string, unknown> | undefined): string | null {
  if (!metadaten) return null
  for (const feld of ['display_name', 'full_name', 'name', 'username']) {
    const wert = metadaten[feld]
    if (typeof wert === 'string' && wert.trim()) return wert.trim()
  }
  return null
}

async function ausProfilzeile(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', userId)
      .maybeSingle()
    if (!data) return null
    const anzeige = (data.display_name as string | null)?.trim()
    if (anzeige) return anzeige
    const benutzer = (data.username as string | null)?.trim()
    return benutzer || null
  } catch {
    // Kein Netz, keine Berechtigung -- dann eben ohne.
    return null
  }
}

/**
 * Der Name für Spielrunden. Wird er aus dem Konto geholt, bleibt er
 * anschließend lokal stehen -- sonst hinge er an jeder Netzverbindung.
 */
export async function ermittleSpielerName(): Promise<string> {
  const profil = await getOrCreateGuestProfile().catch(() => null)
  if (istEchterName(profil?.displayName)) return profil!.displayName.trim()

  const user = await getCurrentUser().catch(() => null)
  if (!user) return GAST_NAME

  const ausKonto =
    ausAnmeldedaten(user.user_metadata as Record<string, unknown> | undefined) ??
    (await ausProfilzeile(user.id))

  if (!ausKonto) return GAST_NAME

  try {
    await setDisplayName(ausKonto)
  } catch {
    // Konnte nicht gespeichert werden -- angezeigt wird er trotzdem.
  }
  return ausKonto
}

/**
 * Wie der Name in einer Runde stehen soll. Ohne Konto ist "Du" freundlicher
 * als "Gast" -- gemeint ist ja der, der gerade davorsitzt.
 */
export async function spielerNameOderDu(): Promise<string> {
  const name = await ermittleSpielerName()
  return istEchterName(name) ? name : 'Du'
}

/* --------------------------------------------------- Selbst benennen */

/**
 * Prüft einen von Hand eingegebenen Namen.
 * Gibt null zurück, wenn er in Ordnung ist, sonst den Grund.
 */
export function pruefeName(eingabe: string): string | null {
  const name = eingabe.trim()
  if (name.length < NAME_MIN) return `Mindestens ${NAME_MIN} Zeichen.`
  if (name.length > NAME_MAX) return `Höchstens ${NAME_MAX} Zeichen.`
  if (name === GAST_NAME) {
    return `„${GAST_NAME}" ist der Platzhalter – nimm bitte einen eigenen Namen.`
  }
  return null
}

/**
 * Den Namen von Hand setzen.
 *
 * Er wird lokal festgehalten und -- wenn jemand angemeldet ist -- auch in
 * die Profilzeile geschrieben, damit er auf anderen Geräten mitkommt.
 * Klappt das Zweite nicht (kein Netz), gilt trotzdem der lokale Name:
 * Wer seinen Namen ändert, will ihn sofort sehen, nicht wenn das Netz
 * wieder da ist.
 */
export async function setzeSpielerName(eingabe: string): Promise<string> {
  const fehler = pruefeName(eingabe)
  if (fehler) throw new Error(fehler)
  const name = eingabe.trim()

  await setDisplayName(name)

  const user = await getCurrentUser().catch(() => null)
  if (user && isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('profiles')
        .update({ display_name: name, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    } catch {
      // Nur die Übertragung auf andere Geräte fehlt -- hier stimmt er.
    }
  }
  return name
}

/**
 * Den eigenen Namen verwerfen und wieder den aus dem Konto nehmen.
 *
 * Umgesetzt, indem lokal der Platzhalter gesetzt wird -- genau daran
 * erkennt die Auflösung oben, dass sie beim Konto nachsehen darf.
 */
export async function nameVomKontoUebernehmen(): Promise<string> {
  await setDisplayName(GAST_NAME).catch(() => undefined)
  return ermittleSpielerName()
}
