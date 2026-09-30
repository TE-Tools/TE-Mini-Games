/**
 * Der Weg einer Partie gegen den Rechner in die Bestenliste.
 *
 * Thomas am 30.09.2026: "Bitte auch gegen Computer mit auswerten."
 *
 * Online sieht der Server die Partie selbst; hier bekommt er eine Meldung.
 * Damit hängt alles an diesem einen Weg -- und an dem, was unterwegs NICHT
 * passiert: Die Partie darf nicht zweimal zählen, sie darf nicht verloren
 * gehen, wenn gerade kein Netz da ist, und eine Partie allein am Tisch darf
 * überhaupt nicht losgeschickt werden.
 *
 * Deshalb steht hier die Kette, nicht nur die Funktion: melden -> in die
 * Warteschlange -> hochladen -> Warteschlange leer.
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const stand = vi.hoisted(() => ({
  rufe: [] as { name: string; args: Record<string, unknown> }[],
  /** Was kniffel_melde_solo zurückgibt: true = gezählt. */
  gezaehlt: true as boolean,
  fehler: null as { code: string; message: string } | null,
  angemeldet: true as boolean,
  /** Welche Spaltenlisten die Bestenliste abgefragt hat. */
  spalten: [] as string[],
  /** Kennt die Datenbank die Online-Spalten aus Migration 022? */
  hat022: true as boolean,
}))

/**
 * Eine Attrappe des Clients. Die Kette selbst ist awaitbar -- gibt man
 * schon bei .order() ein Promise zurück, läuft das nachfolgende .limit()
 * ins Leere.
 */
function tabelle() {
  const kette: Record<string, unknown> = {}
  let ausgewaehlt = ''
  const antwort = () =>
    !stand.hat022 && ausgewaehlt.includes('siege_online')
      ? {
          data: null,
          error: {
            code: '42703',
            message: 'column kniffel_bestenliste.siege_online does not exist',
          },
        }
      : {
          data: [
            {
              username: 'thomas',
              siege: 3,
              partien: 5,
              bester_sieg: 310,
              bestes_spiel: 310,
              schnitt: 220,
              zuletzt: null,
              ...(stand.hat022
                ? { siege_online: 1, partien_online: 2, bester_sieg_online: 240 }
                : {}),
            },
          ],
          error: null,
        }
  kette.then = (aufloesen: (w: unknown) => void) => aufloesen(antwort())
  kette.select = vi.fn((s: string) => {
    ausgewaehlt = s
    stand.spalten.push(s)
    return kette
  })
  for (const m of ['eq', 'order', 'limit']) kette[m] = vi.fn(() => kette)
  return kette
}

vi.mock('@/database/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      stand.rufe.push({ name, args })
      if (stand.fehler) return { data: null, error: stand.fehler }
      return { data: stand.gezaehlt, error: null }
    }),
    from: vi.fn(() => tabelle()),
  },
}))

vi.mock('@/auth/authService', () => ({
  getCurrentUser: vi.fn(async () => (stand.angemeldet ? { id: 'u1' } : null)),
  getMyUsername: vi.fn(async () => 'thomas'),
}))

const PARTIE = {
  partieId: '11111111-2222-3333-4444-555555555555',
  punkte: 245,
  besterGegner: 198,
  mitspieler: 2,
  stufe: 'schwer' as const,
}

async function module() {
  const { meldeKniffelSoloPartie } = await import('@/services/kniffelOnline')
  const { db } = await import('@/offline/db')
  return { meldeKniffelSoloPartie, db }
}

describe('Eine Partie gegen den Rechner melden', () => {
  beforeEach(async () => {
    stand.rufe.length = 0
    stand.gezaehlt = true
    stand.fehler = null
    stand.angemeldet = true
    stand.spalten.length = 0
    stand.hat022 = true
    const { db } = await module()
    await db.syncOutbox.clear()
  })

  it('legt die Partie in die Warteschlange, nicht direkt auf die Leitung', async () => {
    const { meldeKniffelSoloPartie, db } = await module()
    await meldeKniffelSoloPartie(PARTIE)

    const warteschlange = await db.syncOutbox.toArray()
    expect(warteschlange).toHaveLength(1)
    const eintrag = warteschlange[0]
    expect(eintrag?.type).toBe('kniffel_partie')
    expect(eintrag?.payload).toMatchObject(PARTIE)
    // Noch nichts hochgeladen: Wer im Zug spielt, hat gerade kein Netz.
    expect(stand.rufe).toHaveLength(0)
  })

  it('schickt eine Partie ohne Gegner gar nicht los', async () => {
    const { meldeKniffelSoloPartie, db } = await module()
    await meldeKniffelSoloPartie({ ...PARTIE, mitspieler: 1 })
    // Gegen niemanden gewinnt man nicht -- der Server würde sie ablehnen,
    // und bis dahin läge sie in der Warteschlange herum.
    expect(await db.syncOutbox.count()).toBe(0)
  })

  it('meldet dem Server Punkte, kein Urteil', async () => {
    const { meldeKniffelSoloPartie, db } = await module()
    const { initRemoteSync, trySyncNow } = await import('@/services/remoteSync')
    initRemoteSync()

    await meldeKniffelSoloPartie(PARTIE)
    await trySyncNow()

    expect(stand.rufe).toEqual([
      {
        name: 'kniffel_melde_solo',
        args: {
          p_partie: PARTIE.partieId,
          p_punkte: 245,
          p_bester_gegner: 198,
          p_mitspieler: 2,
          p_stufe: 'schwer',
        },
      },
    ])
    // Wer gewonnen hat, steht in keinem Feld: Das rechnet der Server aus
    // den beiden Punktzahlen selbst aus.
    expect(Object.keys(stand.rufe[0]?.args ?? {})).not.toContain('p_gewonnen')
    expect(await db.syncOutbox.count()).toBe(0)
  })

  it('wiederholt nichts, wenn der Server die Partie nicht zählt', async () => {
    // false heißt "nicht gezählt" -- etwa nach der fünfzigsten Partie an
    // einem Tag. Ein zweiter Versuch käme zum selben Ergebnis.
    stand.gezaehlt = false
    const { meldeKniffelSoloPartie, db } = await module()
    const { initRemoteSync, trySyncNow } = await import('@/services/remoteSync')
    initRemoteSync()

    await meldeKniffelSoloPartie(PARTIE)
    await trySyncNow()

    expect(stand.rufe).toHaveLength(1)
    expect(await db.syncOutbox.count()).toBe(0)
  })

  it('behält die Partie, solange niemand angemeldet ist', async () => {
    stand.angemeldet = false
    const { meldeKniffelSoloPartie, db } = await module()
    const { initRemoteSync, trySyncNow } = await import('@/services/remoteSync')
    initRemoteSync()

    await meldeKniffelSoloPartie(PARTIE)
    await trySyncNow()

    // Sie ist gültig, es fehlt bloß die Gelegenheit: bleibt liegen.
    expect(stand.rufe).toHaveLength(0)
    expect(await db.syncOutbox.count()).toBe(1)
  })
})

describe('Die Liste bleibt stehen, auch vor Migration 022', () => {
  beforeEach(() => {
    stand.spalten.length = 0
    stand.hat022 = false
  })

  it('fragt ohne die neuen Spalten noch einmal, statt leer zurückzukommen', async () => {
    /*
     * Die App ist vor der Migration da -- zwischen dem Deploy und dem
     * Einspielen liegen Minuten oder Tage. PostgREST weist eine Abfrage
     * mit einer unbekannten Spalte GANZ ab, nicht nur die eine Spalte;
     * genau daran stand die Rangliste am 04.09.2026 schon einmal leer.
     */
    const { fetchKniffelBestenliste } = await import('@/services/kniffelOnline')
    const liste = await fetchKniffelBestenliste()

    expect(stand.spalten).toHaveLength(2)
    expect(stand.spalten[0]).toContain('siege_online')
    expect(stand.spalten[1]).not.toContain('siege_online')
    expect(liste).toHaveLength(1)
    // Ohne 022 ist jede Zeile eine Online-Partie -- die Gesamtzahlen SIND
    // dort die Online-Zahlen.
    const zeile = liste[0]
    expect(zeile?.siege_online).toBe(zeile?.siege)
    expect(zeile?.bester_sieg_online).toBe(zeile?.bester_sieg)
  })
})
