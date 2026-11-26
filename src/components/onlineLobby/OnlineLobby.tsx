/**
 * Die Bausteine der Online-Vorräume (26.11.2026): derselbe Look wie die
 * Einstellungen der Partyspiele (src/components/party), für alle Spiele mit
 * Raumcode -- Partyspiele wie Brett- und Kartenspiele.
 *
 * - `RaumCode`: der Code groß, antippen kopiert ihn, daneben „Einladen".
 * - `WarteSpieler`: wer im Raum ist, als farbige Kärtchen, und auf wie viele
 *   noch gewartet wird.
 * - `CodeFeld`: das Eingabefeld zum Beitreten, fünf Kästchen.
 * - `StatusPille`, `OderTrenner`, `LobbyMeldung`, `LobbyKnopf`: Kleinkram.
 *
 * Die Bausteine zeigen nur an. Wer beitritt, startet, verlässt, entscheidet
 * wie bisher die Seite mit ihrem Server-Aufruf; hier wird nichts aufgerufen.
 * Die Farbe kommt als `--akzent` von der Seite (`akzentStil()` bzw.
 * `brettAkzent()`).
 */
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SprachContext } from '@/i18n/sprache'
import { de } from '@/i18n/texte/de'
import { anfang, farbeFuer } from '@/pages/play/party/spielerFarbe'
import setup from '@/components/party/PartySetup.module.css'
import styles from './OnlineLobby.module.css'

/**
 * Wie in OeffentlicheRaeume.tsx: ohne SprachProvider (in manchen Tests)
 * bleiben die Texte deutsch, statt die Seite mitzureißen.
 */
function useLobbyTexte() {
  return (useContext(SprachContext)?.t ?? de).onlineLobby
}

/* ------------------------------------------------------------ Status */

export type LobbyStatus = 'online' | 'wartet' | 'laeuft'

/** Kleine Pille rechts in der Kopfzeile oder über dem Code. */
export function StatusPille({ status }: { status: LobbyStatus }) {
  const l = useLobbyTexte()
  return (
    <span className={styles.pille} data-status={status}>
      <span className={styles.punkt} aria-hidden="true" />
      {l[status]}
    </span>
  )
}

/* ---------------------------------------------------------- Raumcode */

type Meldung = 'kopiert' | 'kopierenGehtNicht' | 'einladungKopiert' | null

async function inDieAblage(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Der Code des Raums, groß und zum Antippen. „Einladen" öffnet das Teilen
 * des Geräts, wo es eins gibt, sonst landet die Einladung in der Ablage.
 * Geteilt wird nur der Text mit dem Code -- kein Link: In der App zeigte er
 * auf das Gerät selbst und nirgendwohin.
 */
export function RaumCode({
  code,
  spiel,
  status = 'wartet',
}: {
  code: string
  /** Der Name des Spiels für die Einladung. */
  spiel: string
  status?: LobbyStatus
}) {
  const l = useLobbyTexte()
  const [meldung, setMeldung] = useState<Meldung>(null)
  const uhr = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(uhr.current), [])

  const zeige = (m: Meldung) => {
    setMeldung(m)
    window.clearTimeout(uhr.current)
    uhr.current = window.setTimeout(() => setMeldung(null), 2600)
  }

  const kopieren = async () => {
    zeige((await inDieAblage(code)) ? 'kopiert' : 'kopierenGehtNicht')
  }

  const einladen = async () => {
    const text = l.einladungText(spiel, code)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: l.einladungTitel(spiel), text })
        return
      } catch (e) {
        // Abgebrochen ist kein Fehler; alles andere fällt auf die Ablage zurück.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    zeige((await inDieAblage(text)) ? 'einladungKopiert' : 'kopierenGehtNicht')
  }

  return (
    <section className={styles.raum} aria-label={l.raumcode}>
      <div className={styles.raumKopf}>
        <span className={styles.raumLabel}>{l.raumcode}</span>
        <StatusPille status={status} />
      </div>
      <button
        type="button"
        className={styles.codeKnopf}
        onClick={() => void kopieren()}
        aria-label={l.codeKopieren(code)}
        data-kopiert={meldung === 'kopiert' || undefined}
      >
        <span className={styles.codeText}>{code}</span>
        <span className={styles.codeHinweis} aria-hidden="true">
          {meldung === 'kopiert' ? `✓ ${l.kopiert}` : l.antippen}
        </span>
      </button>
      <button type="button" className={styles.einladen} onClick={() => void einladen()}>
        <span aria-hidden="true">↗</span> {l.einladen}
      </button>
      <p className={styles.meldung} aria-live="polite">
        {meldung ? l[meldung] : ''}
      </p>
    </section>
  )
}

/* ----------------------------------------------------- Warteliste */

export interface LobbySpieler {
  seat: number
  name: string
  is_you: boolean
  is_bot?: boolean
}

/**
 * Wer im Raum ist. Gastgeber ist, wer den Raum eröffnet hat -- der Server
 * setzt ihn auf einen festen Platz (siehe die `*_create_match` der
 * Migrationen); die Seite reicht diesen Platz herein.
 *
 * Unter `min` stehen leere Plätze da und die Zeile „Wartet auf …". Wer
 * starten darf, entscheidet weiter die Seite (und der Server).
 */
export function WarteSpieler({
  spieler,
  gastgeberPlatz,
  min,
  ichBinGastgeber,
  hinweis,
}: {
  spieler: readonly LobbySpieler[]
  gastgeberPlatz: number
  /** Ab so vielen kann es losgehen. */
  min: number
  ichBinGastgeber: boolean
  /** Ersetzt die Statuszeile, z. B. „freie Plätze übernimmt der Rechner". */
  hinweis?: ReactNode
}) {
  const l = useLobbyTexte()
  const titelId = useId()
  const fehlend = Math.max(0, min - spieler.length)
  // Mehr als ein paar leere Plätze sagen nichts Neues.
  const leer = Math.min(fehlend, 4)
  return (
    <section className={styles.warte} aria-labelledby={titelId}>
      <div className={styles.warteKopf}>
        <h2 id={titelId} className={styles.warteTitel}>
          {l.imRaum}
        </h2>
        <span className={styles.zahl}>{l.anzahl(spieler.length)}</span>
      </div>
      <ul className={styles.liste}>
        {spieler.map((p) => {
          const [a, b] = farbeFuer(p.name)
          // Den eigenen Platz kennt der Server sicher (is_host), den der anderen über den Platz.
          const gastgeber = p.is_you
            ? ichBinGastgeber
            : !ichBinGastgeber && p.seat === gastgeberPlatz
          return (
            <li key={p.seat} className={styles.kaertchen} data-du={p.is_you || undefined}>
              <span
                className={styles.bild}
                style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}
                aria-hidden="true"
              >
                {p.is_bot ? '🤖' : anfang(p.name)}
              </span>
              <span className={styles.name}>{p.name}</span>
              {gastgeber && (
                <span className={styles.marke} data-art="gastgeber">
                  <span aria-hidden="true">★ </span>
                  {l.gastgeber}
                </span>
              )}
              {p.is_you && (
                <span className={styles.marke} data-art="du">
                  {l.du}
                </span>
              )}
            </li>
          )
        })}
        {Array.from({ length: leer }, (_, i) => (
          <li key={`frei-${i}`} className={styles.frei} aria-hidden="true">
            <span className={styles.freiBild}>?</span>
            <span>{l.frei}</span>
          </li>
        ))}
      </ul>
      <p className={styles.status} aria-live="polite" data-fehlt={fehlend > 0 || undefined}>
        {hinweis ??
          (fehlend > 0
            ? l.nochFehlen(fehlend)
            : ichBinGastgeber
              ? l.alleDaGastgeber
              : l.alleDaGast)}
      </p>
    </section>
  )
}

/* ---------------------------------------------------------- Codefeld */

/**
 * Das Feld für den Code: fünf Kästchen, darunter ein echtes Eingabefeld
 * (unsichtbar darübergelegt) -- so bleiben Tastatur, Einfügen und
 * Vorlesegeräte, wie sie sind. Erlaubt sind Buchstaben und Ziffern.
 */
export function CodeFeld({
  wert,
  onWert,
  beschriftung,
  laenge = 5,
  onFertig,
}: {
  wert: string
  onWert: (wert: string) => void
  beschriftung?: string
  laenge?: number
  /** Enter bei vollständigem Code. */
  onFertig?: () => void
}) {
  const l = useLobbyTexte()
  const id = useId()
  const zeichen = [...wert].slice(0, laenge)
  const aktiv = Math.min(zeichen.length, laenge - 1)
  return (
    <div className={styles.codeFeld}>
      <label htmlFor={id} className={styles.codeBeschriftung}>
        {beschriftung ?? l.codeFeld}
      </label>
      <div className={styles.kaestchen} style={{ ['--laenge' as string]: laenge }}>
        {Array.from({ length: laenge }, (_, i) => (
          <span
            key={i}
            className={styles.kaestchenZeichen}
            data-voll={zeichen[i] ? true : undefined}
            data-aktiv={i === aktiv || undefined}
            aria-hidden="true"
          >
            {zeichen[i] ?? ''}
          </span>
        ))}
        <input
          id={id}
          className={styles.codeEingabe}
          value={wert}
          onChange={(e) =>
            onWert(
              e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '')
                .slice(0, laenge),
            )
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && zeichen.length === laenge) onFertig?.()
          }}
          maxLength={laenge}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Kleinkram */

/** „oder" zwischen Eröffnen und Beitreten. */
export function OderTrenner() {
  const l = useLobbyTexte()
  return (
    <div className={styles.oder} role="separator">
      <span>{l.oder}</span>
    </div>
  )
}

/** Fehler oder Hinweis als eigene Zeile mit Zeichen davor. */
export function LobbyMeldung({
  art = 'fehler',
  children,
}: {
  art?: 'fehler' | 'hinweis'
  children: ReactNode
}) {
  return (
    <p className={styles.lobbyMeldung} data-art={art} role={art === 'fehler' ? 'alert' : undefined}>
      <span className={styles.lobbyMeldungIcon} aria-hidden="true">
        {art === 'fehler' ? '!' : 'i'}
      </span>
      <span>{children}</span>
    </p>
  )
}

/**
 * Ein Kasten für die Fälle ohne Vorraum: kein Server, nicht angemeldet,
 * es lädt. Bild, ein Satz, darunter die Wege weiter.
 */
export function LobbyHinweis({
  icon,
  children,
  aktionen,
}: {
  icon: string
  children: ReactNode
  aktionen?: ReactNode
}) {
  return (
    <section className={styles.hinweis}>
      <span className={styles.hinweisIcon} aria-hidden="true">
        {icon}
      </span>
      <p className={styles.hinweisText}>{children}</p>
      {aktionen && <div className={styles.hinweisAktionen}>{aktionen}</div>}
    </section>
  )
}

/**
 * Der Hauptknopf eines Vorraums -- sieht aus wie der Startknopf der
 * Partyspiele, klebt aber nicht unten fest (ein Vorraum hat davon mehrere).
 */
export function LobbyKnopf({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className={setup.start} onClick={onClick} disabled={disabled}>
      <span className={setup.startText}>{children}</span>
      <span className={setup.startPfeil} aria-hidden="true">
        ▶
      </span>
    </button>
  )
}

/** Wie `LobbyKnopf`, aber ein Link (Anmelden). */
export function LobbyKnopfLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${setup.start} ${styles.link}`}>
      <span className={setup.startText}>{children}</span>
      <span className={setup.startPfeil} aria-hidden="true">
        ▶
      </span>
    </Link>
  )
}

/** Der ruhige zweite Knopf (Beitreten, Verlassen, zurück). */
export function LobbyZweitKnopf({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`${setup.zweit} ${styles.zweit}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
