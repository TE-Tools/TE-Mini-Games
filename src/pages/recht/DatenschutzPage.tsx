import { Link } from 'react-router-dom'
import styles from './RechtShell.module.css'

/**
 * Datenschutzerklärung für TE-Mini Games.
 *
 * BEWUSST NICHT die des Familienplaners übernommen (06.09.2026): Jene
 * beschreibt Firebase, WebUntis, Push-Nachrichten und EmailJS -- nichts davon
 * kommt hier vor, dafür Supabase und eine öffentliche Rangliste, die dort
 * fehlt. Eine Erklärung, die die falschen Dienstleister nennt, ist schlechter
 * als gar keine: Sie sieht vollständig aus und stimmt trotzdem nicht.
 *
 * Struktur, Rechtsgrundlagen und die Abschnitte zu Rechten und Aufsicht sind
 * aus te-alltagshelfer.org/datenschutz übernommen -- die gelten unverändert.
 */
export function DatenschutzPage() {
  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Zurück
      </Link>
      <h1 className={styles.title}>Datenschutzerklärung</h1>
      <p className={styles.stand}>Stand: 6. September 2026</p>

      <div className={styles.text}>
        <h2>1. Verantwortlicher</h2>
        <div className={styles.kasten}>
          <p>
            <strong>TE-Alltagshelfer</strong>
            <br />
            Inhaber: Thomas Elsen
            <br />
            Holbeinstraße 6
            <br />
            41470 Neuss, Deutschland
            <br />
            E-Mail: <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a>
          </p>
        </div>

        <h2>2. Kurz gesagt</h2>
        <p>
          TE-Mini Games ist eine Sammlung kleiner Spiele. In der App gibt es{' '}
          <strong>keine Werbung, kein Tracking und keine Analyse-Dienste</strong>. Wir verkaufen
          keine Daten und werten sie nicht für andere Zwecke aus.
        </p>
        <p>
          <strong>Ohne Konto bleibt alles auf deinem Gerät.</strong> Du kannst jedes Spiel als Gast
          spielen; Punkte, Level und Abzeichen liegen dann ausschließlich im Speicher deines
          Browsers und erreichen uns nie.
        </p>

        <h2>3. Welche Daten verarbeitet werden</h2>

        <h3>a) Auf deinem Gerät (immer)</h3>
        <p>
          Die App speichert im Browser deines Geräts (IndexedDB und localStorage): Spielstand und
          Level je Spiel, Ergebnisse, persönliche Rekorde, Abzeichen, gewähltes Gesicht (Avatar),
          Streak, die Runden des Familien-Modus, eigene Wortlisten für „Finde den Imposter" sowie
          die Zahl der Fehlversuche je Bienen-Flow-Level (daraus entsteht der Bonus-Platz). Dazu
          kommt die Notiz, ob du als Gast oder mit Konto spielst. Diese Daten verlassen dein Gerät
          nur, wenn du ein Konto anlegst (siehe b). Du löschst sie, indem du die Websitedaten im
          Browser löschst.
        </p>

        <h3>b) Mit Konto (freiwillig)</h3>
        <p>
          Legst du ein Konto an, verarbeiten wir: <strong>E-Mail-Adresse</strong> und{' '}
          <strong>Passwort</strong> (bei uns nur in gehashter Form), einen{' '}
          <strong>selbst gewählten Benutzernamen</strong>, einen Anzeigenamen und das gewählte
          Gesicht sowie deinen Spielfortschritt (XP, Spielerlevel, Streak, Level je Spiel,
          Ergebnisse, Rekorde, Abzeichen). Zweck ist, dass dein Fortschritt auf mehreren Geräten zur
          Verfügung steht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
        </p>

        <h3>c) Öffentliche Rangliste</h3>
        <p>
          Sobald du dir einen <strong>Benutzernamen</strong> gibst, erscheinst du in der Rangliste.
          Für andere sichtbar sind dann: Benutzername, Spiel, Punkte, gesammelte XP, Anzahl der
          Runden und das erreichte Level — auch auf der Levelkarte.{' '}
          <strong>Wer keinen Benutzernamen hat, taucht dort nicht auf</strong>; der Benutzername ist
          die Anmeldung zur Rangliste. Nicht sichtbar sind E-Mail-Adresse, Anzeigename und alles
          Weitere. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du widerrufst,
          indem du den Benutzernamen entfernst.
        </p>

        <h3>d) Online-Runden mit Freunden (freiwillig)</h3>
        <p>
          Für gemeinsame Runden (Schützenrunde, Finde den Imposter, Wer bin ich?, Stadt-Land-Fluss)
          speichern wir für die Dauer der Runde: den Namen, den du für diese Runde eintippst, deinen
          Platz am Tisch, deine Rolle, deine Stimme bei Abstimmungen und deine Antworten. Sichtbar
          ist das nur für die Mitspielenden derselben Runde. Rechtsgrundlage: Art. 6 Abs. 1 lit. b
          DSGVO.
        </p>

        <h3>e) Technische Daten</h3>
        <p>
          Beim Aufruf fallen bei unseren Dienstleistern technisch bedingt Server-Logdaten an (z.B.
          IP-Adresse, Zeitpunkt, abgerufene Ressource). Sie dienen Bereitstellung, Stabilität und
          Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p>
          <strong>Cookies setzen wir nicht.</strong> Die App merkt sich Dinge im lokalen Speicher
          des Browsers, nicht in Cookies, und es gibt nichts, was über die App hinaus verfolgt
          würde.
        </p>

        <h2>4. Kinder</h2>
        <p>
          Die Spiele sind für Kinder geeignet. Ein Konto ist dafür <strong>nicht nötig</strong> —
          als Gast funktioniert alles außer der Rangliste und den Online-Runden. Wird ein Konto für
          ein Kind angelegt, sollte das durch die Erziehungsberechtigten geschehen. Bitte bedenkt
          bei der Wahl des Benutzernamens, dass er öffentlich sichtbar ist; ein Spitzname ist einem
          echten Namen vorzuziehen.
        </p>

        <h2>5. Eingesetzte Dienstleister</h2>

        <h3>Supabase (Konto, Datenbank, Online-Runden)</h3>
        <p>
          Supabase Inc., 970 Toa Payoh North, Singapur. Wir nutzen Supabase für Anmeldung,
          Speicherung des Spielfortschritts und die Online-Runden. Die Datenbank steht in der
          Region, die im Projekt gewählt wurde; es kann zu einer Übermittlung in Drittländer kommen,
          abgesichert über EU-Standardvertragsklauseln. Details:{' '}
          <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">
            supabase.com/privacy
          </a>
        </p>

        <h3>Cloudflare (Auslieferung)</h3>
        <p>
          Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA (für EU-Kunden: Cloudflare
          Germany GmbH). Über Cloudflare Pages wird die App ausgeliefert. Cloudflare ist nach dem
          EU-U.S. Data Privacy Framework zertifiziert. Details:{' '}
          <a
            href="https://www.cloudflare.com/privacypolicy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            cloudflare.com/privacypolicy
          </a>
        </p>

        <h3>PayPal (nur wenn du spendest)</h3>
        <p>
          Der Spenden-Knopf auf der Startseite ist ein einfacher Verweis auf{' '}
          <strong>paypal.me</strong> — <strong>kein eingebundenes Zahlungs-Widget</strong>. Solange
          du ihn nicht antippst, werden keine Daten an PayPal übertragen. Danach gilt die
          Datenschutzerklärung von PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg). Wir
          erfahren von einer Spende nur, was PayPal uns anzeigt; wir speichern dazu nichts in der
          App.
        </p>

        <h2>6. Speicherdauer und Löschung</h2>
        <p>
          Kontodaten bleiben gespeichert, solange das Konto besteht. In der App kannst du unter{' '}
          <strong>Profil → Konto &amp; Anmeldung</strong> deine Daten selbst zurücksetzen. Für die
          vollständige Löschung des Kontos genügt eine formlose E-Mail an{' '}
          <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a>.
          Abgeschlossene Online-Runden werden nicht dauerhaft aufbewahrt.
        </p>

        <h2>7. Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art.
          17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
          Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Erteilte
          Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Eine formlose
          E-Mail genügt.
        </p>
        <p>
          Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren,
          z.B. bei der Landesbeauftragten für Datenschutz und Informationsfreiheit
          Nordrhein-Westfalen (
          <a href="https://www.ldi.nrw.de" target="_blank" rel="noopener noreferrer">
            ldi.nrw.de
          </a>
          ).
        </p>

        <h2>8. Datensicherheit</h2>
        <p>
          Die Übertragung erfolgt durchgehend verschlüsselt (TLS/HTTPS). Der Zugriff auf die
          Datenbank ist durch serverseitige Sicherheitsregeln so beschränkt, dass jede Person
          ausschließlich ihre eigenen Daten lesen und schreiben kann; die öffentliche Rangliste
          liest eine eigens dafür gebaute Ansicht, die nur Benutzername, Spiel und Zahlen enthält.
          Passwörter werden nie im Klartext gespeichert.
        </p>

        <h2>9. Änderungen dieser Erklärung</h2>
        <p>
          Wir passen diese Erklärung an, wenn sich die App oder die Rechtslage ändert. Die jeweils
          aktuelle Fassung findest du auf dieser Seite.
        </p>
      </div>

      <p className={styles.fuss}>
        <Link to="/impressum">Impressum</Link>
      </p>
    </main>
  )
}
