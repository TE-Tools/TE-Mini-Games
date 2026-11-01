import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '@/auth/authService'
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
 */
export function KontoLoeschenPage() {
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

  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Zurück
      </Link>
      <h1 className={styles.title}>Konto löschen</h1>

      <div className={styles.text}>
        <p>
          Du kannst dein Konto bei TE-Mini Games jederzeit selbst löschen – in der App, ohne
          Nachfrage bei uns.
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
        {angemeldet === true ? (
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
              Zur Sicherheit <strong>LÖSCHEN</strong> eintippen und bestätigen.
            </li>
          </ol>
        )}

        <h2>Wenn du nicht mehr an dein Konto kommst</h2>
        <p>
          Dann schreib uns formlos an{' '}
          <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a> – nach
          Möglichkeit von der E-Mail-Adresse, mit der das Konto angelegt wurde. Wir löschen es dann
          von Hand.
        </p>

        <p>
          Mehr dazu, welche Daten überhaupt anfallen, steht in der{' '}
          <Link to="/datenschutz">Datenschutzerklärung</Link>.
        </p>
      </div>
    </main>
  )
}
