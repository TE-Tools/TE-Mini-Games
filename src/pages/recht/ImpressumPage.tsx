import { Link } from 'react-router-dom'
import { useSprache, type Sprache } from '@/i18n/sprache'
import styles from './RechtShell.module.css'

/**
 * Impressum nach § 5 DDG.
 *
 * Die Angaben sind wörtlich die von te-alltagshelfer.org/impressum — es ist
 * derselbe Anbieter, dieselbe Anschrift. Anders als bei der
 * Datenschutzerklärung gibt es hier nichts app-spezifisch anzupassen: Wer
 * verantwortlich ist, hängt nicht davon ab, welches Werkzeug man gerade
 * benutzt (06.09.2026).
 *
 * Zweisprachig wie die Datenschutzerklärung: zwei Fassungen, beide
 * erzwungen durch `Record<Sprache, …>`. Die Paragrafen bleiben deutsch --
 * es ist deutsches Recht, das hier erfüllt wird.
 */
export function ImpressumPage() {
  const { sprache, t } = useSprache()
  const Text = TEXT[sprache]
  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        ← {t.allgemein.zurueck}
      </Link>
      <h1 className={styles.title}>{t.recht.impressum}</h1>

      <div className={styles.text}>
        <Text />
      </div>

      <p className={styles.fuss}>
        <Link to="/datenschutz">{t.recht.datenschutzerklaerung}</Link>
      </p>
    </main>
  )
}

const TEXT: Record<Sprache, () => React.JSX.Element> = { de: TextDe, en: TextEn }

function Anschrift({ inhaber, land }: { inhaber: string; land: string }) {
  return (
    <div className={styles.kasten}>
      <p>
        <strong>TE-Digital</strong>
        <br />
        {inhaber}: Thomas Elsen
        <br />
        Holbeinstraße 6
        <br />
        41470 Neuss
        <br />
        {land}
      </p>
    </div>
  )
}

const MAIL = <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a>

const OS = (
  <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
    ec.europa.eu/consumers/odr
  </a>
)

function TextDe() {
  return (
    <>
      <h2>Angaben gemäß § 5 DDG</h2>
      <Anschrift inhaber="Inhaber" land="Deutschland" />

      <h2>Kontakt</h2>
      <p>E-Mail: {MAIL}</p>

      <h2>Umsatzsteuer</h2>
      <p>Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).</p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>Thomas Elsen, Anschrift wie oben</p>

      <h2>Streitbeilegung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        {OS}. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Spenden</h2>
      <p>
        TE-Mini Games ist kostenlos. Über den Spenden-Knopf auf der Startseite gelangt ihr zu
        PayPal; eine Spende ist freiwillig, begründet keinen Vertrag und schaltet nichts im Spiel
        frei.
      </p>
    </>
  )
}

function TextEn() {
  return (
    <>
      <h2>Information pursuant to § 5 DDG (German Digital Services Act)</h2>
      <Anschrift inhaber="Owner" land="Germany" />

      <h2>Contact</h2>
      <p>Email: {MAIL}</p>

      <h2>VAT</h2>
      <p>No VAT is shown pursuant to § 19 UStG (German small business scheme).</p>

      <h2>Responsible for content pursuant to § 18 Abs. 2 MStV</h2>
      <p>Thomas Elsen, address as above</p>

      <h2>Dispute resolution</h2>
      <p>
        The European Commission provides a platform for online dispute resolution (ODR): {OS}. We
        are neither willing nor obliged to take part in dispute resolution proceedings before a
        consumer arbitration board.
      </p>

      <h2>Donations</h2>
      <p>
        TE-Mini Games is free. The donate button on the home page takes you to PayPal; a donation is
        voluntary, does not create a contract and does not unlock anything in the game.
      </p>
    </>
  )
}
