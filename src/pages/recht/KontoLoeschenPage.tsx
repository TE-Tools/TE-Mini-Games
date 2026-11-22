import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
import { useSprache, type Sprache } from '@/i18n/sprache'
import styles from './RechtShell.module.css'

/**
 * „Wie lösche ich mein Konto?" -- als eigene, öffentliche Seite.
 *
 * Warum sie für sich steht und nicht nur ein Absatz in der
 * Datenschutzerklärung ist: Google Play verlangt für Apps, in denen man
 * ein Konto anlegen kann, zwei Dinge -- einen Löschweg IN der App und
 * eine Adresse, die man **ohne** die App erreicht, aus jedem Browser,
 * auch ohne Anmeldung. Diese Seite ist diese Adresse.
 *
 * Deshalb erklärt sie zuerst, was gelöscht wird, und führt dann zum
 * Knopf -- angemeldet direkt, abgemeldet über die Anmeldung. Der Weg per
 * E-Mail bleibt als dritter stehen: für den Fall, dass jemand nicht mehr
 * an sein Konto kommt.
 *
 * Zweisprachig wie die Datenschutzerklärung: zwei Fassungen, beide
 * erzwungen durch `Record<Sprache, …>`. Das Bestätigungswort bleibt in
 * jeder Fassung das, was die Kontoseite wirklich verlangt.
 */
export function KontoLoeschenPage() {
  const { sprache, t } = useSprache()
  const [angemeldet, setAngemeldet] = useState<boolean | null>(null)

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

  const Text = TEXT[sprache]
  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        ← {t.allgemein.zurueck}
      </Link>
      <h1 className={styles.title}>{t.recht.kontoLoeschen}</h1>

      <div className={styles.text}>
        <Text angemeldet={angemeldet === true} wort={t.anmeldung.bestaetigungWort} />
      </div>
    </main>
  )
}

interface TextProps {
  angemeldet: boolean
  /** Das Wort, das die Kontoseite zur Bestätigung verlangt. */
  wort: string
}

const TEXT: Record<Sprache, (p: TextProps) => React.JSX.Element> = { de: TextDe, en: TextEn }

const MAIL = <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a>

function TextDe({ angemeldet, wort }: TextProps) {
  return (
    <>
      <p>
        Du kannst dein Konto bei TE-Mini Games jederzeit selbst löschen – in der App, ohne Nachfrage
        bei uns.
      </p>

      <h2>Was gelöscht wird</h2>
      <ul>
        <li>dein Konto und deine Anmeldung (E-Mail, Benutzername, Anzeigename)</li>
        <li>Spielstände, Level und XP</li>
        <li>Bestwerte und Abzeichen</li>
        <li>deine Einträge in den Bestenlisten</li>
        <li>
          dein Name in Online-Räumen, in denen du gerade sitzt – laufende Partien der anderen
          bleiben davon unberührt
        </li>
      </ul>
      <p>
        Das geschieht sofort und vollständig; es gibt keine Wartezeit und keine Kopie, die danach
        noch irgendwo liegt. Rückgängig machen lässt es sich nicht.
      </p>

      <h2>So geht es</h2>
      {angemeldet ? (
        <>
          <p>Du bist angemeldet – der Weg führt direkt dorthin:</p>
          <p>
            <Link to="/auth" className={styles.kasten} style={{ display: 'block' }}>
              <strong>Konto &amp; Anmeldung öffnen</strong>
              <br />
              Dort ganz unten: „Konto löschen“
            </Link>
          </p>
        </>
      ) : (
        <ol>
          <li>
            In der App auf <strong>Profil → Konto &amp; Anmeldung</strong> gehen (
            <Link to="/auth">hier entlang</Link>) und anmelden.
          </li>
          <li>
            Ganz unten auf <strong>Konto löschen</strong> tippen.
          </li>
          <li>
            Zur Sicherheit <strong>{wort}</strong> eintippen und bestätigen.
          </li>
        </ol>
      )}

      <h2>Wenn du nicht mehr an dein Konto kommst</h2>
      <p>
        Dann schreib uns formlos an {MAIL} – nach Möglichkeit von der E-Mail-Adresse, mit der das
        Konto angelegt wurde. Wir löschen es dann von Hand.
      </p>

      <p>
        Mehr dazu, welche Daten überhaupt anfallen, steht in der{' '}
        <Link to="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </>
  )
}

function TextEn({ angemeldet, wort }: TextProps) {
  return (
    <>
      <p>
        You can delete your TE-Mini Games account yourself at any time – in the app, without having
        to ask us.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>your account and sign-in (email, username, display name)</li>
        <li>saved games, levels and XP</li>
        <li>best scores and badges</li>
        <li>your entries on the leaderboards</li>
        <li>
          your name in online rooms you are currently sitting in – other players&apos; ongoing games
          are not affected
        </li>
      </ul>
      <p>
        This happens immediately and completely; there is no waiting period and no copy left
        anywhere afterwards. It cannot be undone.
      </p>

      <h2>How to do it</h2>
      {angemeldet ? (
        <>
          <p>You are signed in – this takes you straight there:</p>
          <p>
            <Link to="/auth" className={styles.kasten} style={{ display: 'block' }}>
              <strong>Open Account &amp; sign-in</strong>
              <br />
              At the very bottom: “Delete account”
            </Link>
          </p>
        </>
      ) : (
        <ol>
          <li>
            In the app, go to <strong>Profile → Account &amp; sign-in</strong> (
            <Link to="/auth">this way</Link>) and sign in.
          </li>
          <li>
            At the very bottom, tap <strong>Delete account</strong>.
          </li>
          <li>
            To be safe, type <strong>{wort}</strong> and confirm.
          </li>
        </ol>
      )}

      <h2>If you can no longer access your account</h2>
      <p>
        Then send us a simple email to {MAIL} – if possible from the email address the account was
        created with. We will then delete it by hand.
      </p>

      <p>
        You can read more about what data is collected at all in the{' '}
        <Link to="/datenschutz">privacy policy</Link>.
      </p>
    </>
  )
}
