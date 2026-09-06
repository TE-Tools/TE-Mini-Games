import { Link } from 'react-router-dom'
import styles from './RechtShell.module.css'

/**
 * Impressum nach § 5 DDG.
 *
 * Die Angaben sind wörtlich die von te-alltagshelfer.org/impressum — es ist
 * derselbe Anbieter, dieselbe Anschrift. Anders als bei der
 * Datenschutzerklärung gibt es hier nichts app-spezifisch anzupassen: Wer
 * verantwortlich ist, hängt nicht davon ab, welches Werkzeug man gerade
 * benutzt (06.09.2026).
 */
export function ImpressumPage() {
  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Zurück
      </Link>
      <h1 className={styles.title}>Impressum</h1>

      <div className={styles.text}>
        <h2>Angaben gemäß § 5 DDG</h2>
        <div className={styles.kasten}>
          <p>
            <strong>TE-Alltagshelfer</strong>
            <br />
            Inhaber: Thomas Elsen
            <br />
            Holbeinstraße 6
            <br />
            41470 Neuss
            <br />
            Deutschland
          </p>
        </div>

        <h2>Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a>
        </p>

        <h2>Umsatzsteuer</h2>
        <p>
          Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen
          (Kleinunternehmerregelung).
        </p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>Thomas Elsen, Anschrift wie oben</p>

        <h2>Streitbeilegung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur
          Online-Streitbeilegung (OS) bereit:{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
            ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht bereit und nicht verpflichtet, an
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          teilzunehmen.
        </p>

        <h2>Spenden</h2>
        <p>
          TE-Mini Games ist kostenlos. Über den Spenden-Knopf auf der Startseite
          gelangt ihr zu PayPal; eine Spende ist freiwillig, begründet keinen
          Vertrag und schaltet nichts im Spiel frei.
        </p>
      </div>

      <p className={styles.fuss}>
        <Link to="/datenschutz">Datenschutzerklärung</Link>
      </p>
    </main>
  )
}
