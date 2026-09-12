/**
 * Offene Spiele -- alle öffentlichen Räume aller Online-Spiele auf einer Seite.
 *
 * Thomas, 12.09.2026: "auf der Startseite einen Knopf offene Spiele gesamt,
 * wo man dann alle offenen Räume und alle Spieler sieht, wo man joinen kann."
 *
 * Die Seite fragt die fünf Online-Spiele nacheinander ab (jedes hat seine
 * eigene Funktion `*_public_matches`) und zeigt je Raum, wer ihn aufgemacht
 * hat und wer schon drin sitzt. Beitreten führt auf die Spielseite mit dem
 * Code als Suchparameter -- dort öffnet sich der Online-Teil und tritt bei.
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { isSupabaseConfigured } from '@/database/supabase'
import { fetchOeffentlicheSrRaeume } from '@/services/schuetzenrundeOnline'
import { fetchOeffentlicheImposterRaeume } from '@/services/imposterOnline'
import { fetchOeffentlicheWbiRaeume } from '@/services/werBinIchOnline'
import { fetchOeffentlicheSlfRaeume } from '@/services/stadtLandFlussOnline'
import { fetchOeffentlicheKniffelRaeume } from '@/services/kniffelOnline'
import { OEFFENTLICH_ERNEUERN_MS, RAUM_PARAM, type OeffentlicherRaum } from '@/services/raeume'
import { kachelFuer } from './spiele-katalog'
import type { GameId } from '@/games/types'
import shell from './play/PlayShell.module.css'
import styles from './OffeneSpielePage.module.css'

/** Die fünf Spiele mit Räumen -- in der Reihenfolge der Startseite. */
const ONLINE_SPIELE: { id: GameId; laden: () => Promise<OeffentlicherRaum[]> }[] = [
  { id: 'kniffel', laden: fetchOeffentlicheKniffelRaeume },
  { id: 'schuetzenrunde', laden: fetchOeffentlicheSrRaeume },
  { id: 'finde-den-imposter', laden: fetchOeffentlicheImposterRaeume },
  { id: 'wer-bin-ich', laden: fetchOeffentlicheWbiRaeume },
  { id: 'stadt-land-fluss', laden: fetchOeffentlicheSlfRaeume },
]

interface Gruppe {
  id: GameId
  raeume: OeffentlicherRaum[]
  fehler: string | null
}

export function OffeneSpielePage() {
  const navigate = useNavigate()
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)
  const [gruppen, setGruppen] = useState<Gruppe[] | null>(null)

  useEffect(() => {
    let weg = false
    void getCurrentUser()
      .then((u) => {
        if (!weg) setAngemeldet(Boolean(u))
      })
      .catch(() => {
        if (!weg) setAngemeldet(false)
      })
    return () => {
      weg = true
    }
  }, [])

  useEffect(() => {
    if (angemeldet !== true) return
    let weg = false
    const hole = async () => {
      const ergebnisse = await Promise.allSettled(ONLINE_SPIELE.map((s) => s.laden()))
      if (weg) return
      setGruppen(
        ONLINE_SPIELE.map((s, i) => {
          const e = ergebnisse[i]!
          return e.status === 'fulfilled'
            ? { id: s.id, raeume: e.value, fehler: null }
            : {
                id: s.id,
                raeume: [],
                fehler: e.reason instanceof Error ? e.reason.message : 'Nicht erreichbar.',
              }
        }),
      )
    }
    void hole()
    const uhr = window.setInterval(() => void hole(), OEFFENTLICH_ERNEUERN_MS)
    return () => {
      weg = true
      window.clearInterval(uhr)
    }
  }, [angemeldet])

  const gesamt = gruppen?.reduce((n, g) => n + g.raeume.length, 0) ?? 0
  const ersterFehler = gruppen?.find((g) => g.fehler)?.fehler ?? null

  return (
    <main className={shell.page}>
      <header className={shell.header}>
        <Link to="/" className={shell.back} aria-label="Zurück">
          ←
        </Link>
        <h1 className={shell.title}>Offene Spiele</h1>
        <span className={shell.levelBadge}>{gruppen ? gesamt : '…'}</span>
      </header>

      <p className={shell.hint}>
        Alle öffentlichen Räume, in denen gerade jemand wartet – mit dem, der sie aufgemacht hat,
        und allen, die schon drin sind. Die Liste erneuert sich von selbst.
      </p>

      {!isSupabaseConfigured && (
        <p className={styles.leise}>Für Online-Räume fehlt die Verbindung zum Konto-Server.</p>
      )}

      {isSupabaseConfigured && angemeldet === false && (
        <section className={styles.kasten}>
          <p className={styles.leise}>
            Online-Räume gibt es nur mit Konto – so wissen die anderen, wer am Tisch sitzt.
          </p>
          <Link to="/auth" className={shell.primaryBtn} style={{ textAlign: 'center' }}>
            Anmelden
          </Link>
        </section>
      )}

      {angemeldet === true && gruppen === null && (
        <p className={styles.leise}>Suche nach offenen Räumen…</p>
      )}

      {gruppen && gesamt === 0 && (
        <section className={styles.kasten}>
          <p className={styles.leise}>
            Gerade wartet niemand. Öffne in einem Spiel selbst einen öffentlichen Raum – dann steht
            er hier für alle.
          </p>
          {ersterFehler && <p className={styles.leise}>{ersterFehler}</p>}
        </section>
      )}

      {gruppen &&
        gruppen
          .filter((g) => g.raeume.length > 0)
          .map((g) => {
            const kachel = kachelFuer(g.id)
            return (
              <section key={g.id} className={styles.kasten} aria-label={kachel?.name}>
                <h2 className={styles.spielTitel}>
                  <span aria-hidden="true">{kachel?.icon}</span> {kachel?.name ?? g.id}
                </h2>
                <ul className={styles.liste}>
                  {g.raeume.map((r) => {
                    const voll = r.plaetze !== null && r.size >= r.plaetze
                    return (
                      <li key={r.match_id} className={styles.zeile}>
                        <div className={styles.text}>
                          <strong className={styles.name}>Raum von {r.host_name}</strong>
                          <span className={styles.klein}>
                            {r.size} {r.size === 1 ? 'Person' : 'Personen'}
                            {r.plaetze ? ` von ${r.plaetze}` : ''} · Code {r.code}
                          </span>
                          {r.spieler?.length > 0 && (
                            <span className={styles.klein}>{r.spieler.join(', ')}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.knopf}
                          disabled={voll}
                          onClick={() =>
                            navigate(
                              `${kachel?.pfad ?? '/'}?${RAUM_PARAM}=${encodeURIComponent(r.code)}`,
                            )
                          }
                        >
                          {voll ? 'Voll' : 'Beitreten'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}

      {gruppen && gesamt > 0 && ersterFehler && <p className={styles.leise}>{ersterFehler}</p>}
    </main>
  )
}
