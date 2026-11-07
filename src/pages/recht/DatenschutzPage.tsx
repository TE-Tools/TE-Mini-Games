import { Link } from 'react-router-dom'
import { useSprache, type Sprache } from '@/i18n/sprache'
import { einwilligungAendern, werbeAnbieter, werbungAktiv } from '@/services/werbung'
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
 *
 * Zweisprachig (06.11.2026): Der Text steht zweimal da, nicht Satz für Satz
 * im Wörterbuch -- er besteht aus Absätzen mit Hervorhebungen und Links
 * mitten im Satz, und eine Erklärung, die man in Schnipsel zerlegt, liest
 * niemand mehr gegen. Wer hier etwas ändert, ändert beide Fassungen; die
 * `Record<Sprache, …>` unten lässt keine aus.
 */
export function DatenschutzPage() {
  const { sprache, t } = useSprache()
  const Text = TEXT[sprache]
  return (
    <main className={styles.page}>
      <Link to="/" className={styles.back}>
        ← {t.allgemein.zurueck}
      </Link>
      <h1 className={styles.title}>{t.recht.datenschutzerklaerung}</h1>
      <p className={styles.stand}>{t.recht.stand}</p>

      <div className={styles.text}>
        <Text />
      </div>

      <p className={styles.fuss}>
        <Link to="/impressum">{t.recht.impressum}</Link>
      </p>
    </main>
  )
}

const TEXT: Record<Sprache, () => React.JSX.Element> = { de: TextDe, en: TextEn }

const MAIL = <a href="mailto:te-alltagshelfer@outlook.de">te-alltagshelfer@outlook.de</a>

function Anbieter({ inhaber, land }: { inhaber: string; land: string }) {
  return (
    <div className={styles.kasten}>
      <p>
        <strong>TE-Digital</strong>
        <br />
        {inhaber}: Thomas Elsen
        <br />
        Holbeinstraße 6
        <br />
        41470 Neuss, {land}
        <br />
        E-Mail: {MAIL}
      </p>
    </div>
  )
}

function Extern({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function TextDe() {
  return (
    <>
      <h2>1. Verantwortlicher</h2>
      <Anbieter inhaber="Inhaber" land="Deutschland" />

      <h2>2. Kurz gesagt</h2>
      {werbungAktiv() ? (
        <p>
          TE-Mini Games ist eine Sammlung kleiner Spiele. In der App gibt es{' '}
          <strong>kein Tracking und keine Analyse-Dienste</strong>. Werbung gibt es nur als{' '}
          <strong>freiwilliges Video</strong>, das du ansehen kannst, um im Spiel eine Hilfe zu
          bekommen (siehe Abschnitt 5). Wir verkaufen keine Daten und werten sie nicht für andere
          Zwecke aus.
        </p>
      ) : (
        <p>
          TE-Mini Games ist eine Sammlung kleiner Spiele. In der App gibt es{' '}
          <strong>keine Werbung, kein Tracking und keine Analyse-Dienste</strong>. Wir verkaufen
          keine Daten und werten sie nicht für andere Zwecke aus.
        </p>
      )}
      <p>
        <strong>Ohne Konto bleibt alles auf deinem Gerät.</strong> Du kannst jedes Spiel als Gast
        spielen; Punkte, Level und Abzeichen liegen dann ausschließlich im Speicher deines Browsers
        und erreichen uns nie.
      </p>

      <h2>3. Welche Daten verarbeitet werden</h2>

      <h3>a) Auf deinem Gerät (immer)</h3>
      <p>
        Die App speichert im Browser deines Geräts (IndexedDB und localStorage): Spielstand und
        Level je Spiel, Ergebnisse, persönliche Rekorde, Abzeichen, gewähltes Gesicht (Avatar),
        Streak, die Runden des Familien-Modus, eigene Wortlisten für „Finde den Imposter", die Zahl
        der Fehlversuche je Bienen-Flow-Level (daraus entsteht der Bonus-Platz) den bei Squishy
        Dumplings gewählten Knödel den Trapbound-Fortschritt (offene Level, Tode, Bestzeiten,
        gefundene Kristalle, Ton- und Steuerungseinstellungen) sowie den Sudoku-Fortschritt (offene
        Stufen, Bestzeiten, angefangene Rätsel samt Notizen und Uhr, Einstellungen). Dazu kommen die
        gewählte Sprache und die Notiz, ob du als Gast oder mit Konto spielst. Diese Daten verlassen
        dein Gerät nur, wenn du ein Konto anlegst (siehe b). Du löschst sie, indem du die
        Websitedaten im Browser löschst.
      </p>

      <h3>b) Mit Konto (freiwillig)</h3>
      <p>
        Legst du ein Konto an, verarbeiten wir: <strong>E-Mail-Adresse</strong> und{' '}
        <strong>Passwort</strong> (bei uns nur in gehashter Form), einen{' '}
        <strong>selbst gewählten Benutzernamen</strong>, einen Anzeigenamen und das gewählte Gesicht
        sowie deinen Spielfortschritt (XP, Spielerlevel, Streak, Level je Spiel, Ergebnisse,
        Rekorde, Abzeichen). Zweck ist, dass dein Fortschritt auf mehreren Geräten zur Verfügung
        steht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
      </p>

      <h3>c) Öffentliche Rangliste</h3>
      <p>
        Sobald du dir einen <strong>Benutzernamen</strong> gibst, erscheinst du in der Rangliste.
        Für andere sichtbar sind dann: Benutzername, Spiel, Punkte, gesammelte XP, Anzahl der Runden
        und das erreichte Level — auch auf der Levelkarte.{' '}
        <strong>Wer keinen Benutzernamen hat, taucht dort nicht auf</strong>; der Benutzername ist
        die Anmeldung zur Rangliste. Nicht sichtbar sind E-Mail-Adresse, Anzeigename und alles
        Weitere. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du widerrufst,
        indem du den Benutzernamen entfernst.
      </p>

      <h3>d) Online-Runden mit Freunden (freiwillig)</h3>
      <p>
        Für gemeinsame Runden (Schützenrunde, Finde den Imposter, Wer bin ich?, Stadt-Land-Fluss)
        speichern wir für die Dauer der Runde: den Namen, den du für diese Runde eintippst, deinen
        Platz am Tisch, deine Rolle, deine Stimme bei Abstimmungen und deine Antworten. Sichtbar ist
        das nur für die Mitspielenden derselben Runde. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h3>e) Technische Daten</h3>
      <p>
        Beim Aufruf fallen bei unseren Dienstleistern technisch bedingt Server-Logdaten an (z.B.
        IP-Adresse, Zeitpunkt, abgerufene Ressource). Sie dienen Bereitstellung, Stabilität und
        Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).
      </p>
      {werbungAktiv() ? (
        <p>
          <strong>Cookies setzen wir nicht.</strong> Die App merkt sich Dinge im lokalen Speicher
          des Browsers. Erst wenn ein Spiel ein Werbevideo anbietet, wird{' '}
          {werbeAnbieter() === 'admob' ? 'Google AdMob' : 'Google AdSense'} geladen; Google kann
          dann – mit deiner Einwilligung – Cookies oder ähnliche Kennungen verwenden (siehe
          Abschnitt 5).
        </p>
      ) : (
        <p>
          <strong>Cookies setzen wir nicht.</strong> Die App merkt sich Dinge im lokalen Speicher
          des Browsers, nicht in Cookies, und es gibt nichts, was über die App hinaus verfolgt
          würde.
        </p>
      )}

      <h2>4. Kinder</h2>
      <p>
        Die Spiele sind für Kinder geeignet. Ein Konto ist dafür <strong>nicht nötig</strong> — als
        Gast funktioniert alles außer der Rangliste und den Online-Runden. Wird ein Konto für ein
        Kind angelegt, sollte das durch die Erziehungsberechtigten geschehen. Bitte bedenkt bei der
        Wahl des Benutzernamens, dass er öffentlich sichtbar ist; ein Spitzname ist einem echten
        Namen vorzuziehen.
      </p>

      <h2>5. Eingesetzte Dienstleister</h2>

      <h3>Supabase (Konto, Datenbank, Online-Runden)</h3>
      <p>
        Supabase Inc., 970 Toa Payoh North, Singapur. Wir nutzen Supabase für Anmeldung, Speicherung
        des Spielfortschritts und die Online-Runden. Die Datenbank steht in der Region, die im
        Projekt gewählt wurde; es kann zu einer Übermittlung in Drittländer kommen, abgesichert über
        EU-Standardvertragsklauseln. Details:{' '}
        <Extern href="https://supabase.com/privacy">supabase.com/privacy</Extern>
      </p>

      <h3>Cloudflare (Auslieferung)</h3>
      <p>
        Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA (für EU-Kunden: Cloudflare
        Germany GmbH). Über Cloudflare Pages wird die App ausgeliefert. Cloudflare ist nach dem
        EU-U.S. Data Privacy Framework zertifiziert. Details:{' '}
        <Extern href="https://www.cloudflare.com/privacypolicy/">
          cloudflare.com/privacypolicy
        </Extern>
      </p>

      <h3>PayPal (nur wenn du spendest)</h3>
      <p>
        Der Spenden-Knopf auf der Startseite ist ein einfacher Verweis auf{' '}
        <strong>paypal.me</strong> — <strong>kein eingebundenes Zahlungs-Widget</strong>. Solange du
        ihn nicht antippst, werden keine Daten an PayPal übertragen. Danach gilt die
        Datenschutzerklärung von PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg). Wir
        erfahren von einer Spende nur, was PayPal uns anzeigt; wir speichern dazu nichts in der App.
      </p>

      {werbungAktiv() && (
        <>
          <h3>
            {werbeAnbieter() === 'admob'
              ? 'Google AdMob (nur freiwillige Werbevideos, Android-App)'
              : 'Google AdSense (nur freiwillige Werbevideos)'}
          </h3>
          <p>
            Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Manche Spiele
            bieten an, ein kurzes Werbevideo anzusehen und dafür eine Hilfe zu bekommen – etwa einen
            Tipp, mehr Zeit oder einen zweiten Versuch. Das Video kommt in der Android-App von
            Google AdMob, im Browser von Google AdSense. Google wird{' '}
            <strong>erst geladen, wenn ein Spiel ein solches Video anbietet</strong>, nicht beim
            Start der App; ansehen musst du es nie.
          </p>
          <p>
            Dabei verarbeitet Google insbesondere deine IP-Adresse, Angaben zu Gerät und Browser und
            ob und wie lange ein Video angesehen wurde, und kann Cookies oder ähnliche Kennungen
            verwenden – in der Android-App auch die Werbe-ID deines Geräts, die du in den
            Android-Einstellungen zurücksetzen oder löschen kannst. Beim ersten Mal fragt dich ein
            Fenster von Google, ob du personalisierter Werbung zustimmst. Rechtsgrundlage ist deine
            Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Ohne Einwilligung zeigt
            Google nur nicht personalisierte Werbung. Es kann zu einer Übermittlung an Google LLC in
            den USA kommen; Google ist nach dem EU-U.S. Data Privacy Framework zertifiziert.
            Details:{' '}
            <Extern href="https://policies.google.com/technologies/ads">
              policies.google.com/technologies/ads
            </Extern>
          </p>
          <p>
            Deine Einwilligung kannst du jederzeit ändern oder widerrufen:{' '}
            <button type="button" className={styles.linkKnopf} onClick={einwilligungAendern}>
              Einstellungen für Werbung öffnen
            </button>
          </p>
        </>
      )}

      <h2>6. Speicherdauer und Löschung</h2>
      <p>
        Kontodaten bleiben gespeichert, solange das Konto besteht. In der App kannst du unter{' '}
        <strong>Profil → Konto &amp; Anmeldung</strong> deinen Fortschritt zurücksetzen – und dort
        ganz unten auch <strong>dein Konto vollständig löschen</strong>. Das entfernt Konto,
        Anmeldung, Spielstände, Bestwerte, Abzeichen und Bestenlisten-Einträge sofort und endgültig;
        wie das geht, steht auf der Seite <Link to="/konto-loeschen">Konto löschen</Link>. Kommst du
        nicht mehr an dein Konto, genügt eine formlose E-Mail an {MAIL}. Abgeschlossene
        Online-Runden werden nicht dauerhaft aufbewahrt.
      </p>

      <h2>7. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17),
        Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
        gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Erteilte
        Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Eine formlose
        E-Mail genügt.
      </p>
      <p>
        Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z.B.
        bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (
        <Extern href="https://www.ldi.nrw.de">ldi.nrw.de</Extern>
        ).
      </p>

      <h2>8. Datensicherheit</h2>
      <p>
        Die Übertragung erfolgt durchgehend verschlüsselt (TLS/HTTPS). Der Zugriff auf die Datenbank
        ist durch serverseitige Sicherheitsregeln so beschränkt, dass jede Person ausschließlich
        ihre eigenen Daten lesen und schreiben kann; die öffentliche Rangliste liest eine eigens
        dafür gebaute Ansicht, die nur Benutzername, Spiel und Zahlen enthält. Passwörter werden nie
        im Klartext gespeichert.
      </p>

      <h2>9. Änderungen dieser Erklärung</h2>
      <p>
        Wir passen diese Erklärung an, wenn sich die App oder die Rechtslage ändert. Die jeweils
        aktuelle Fassung findest du auf dieser Seite.
      </p>
    </>
  )
}

function TextEn() {
  return (
    <>
      <p>
        <em>
          This is a translation for your convenience. If the two versions differ, the German version
          applies.
        </em>
      </p>

      <h2>1. Controller</h2>
      <Anbieter inhaber="Owner" land="Germany" />

      <h2>2. In short</h2>
      {werbungAktiv() ? (
        <p>
          TE-Mini Games is a collection of small games. The app contains{' '}
          <strong>no tracking and no analytics services</strong>. Ads only come as an{' '}
          <strong>optional video</strong> you can watch to get help in a game (see section 5). We do
          not sell any data and do not use it for any other purpose.
        </p>
      ) : (
        <p>
          TE-Mini Games is a collection of small games. The app contains{' '}
          <strong>no advertising, no tracking and no analytics services</strong>. We do not sell any
          data and do not use it for any other purpose.
        </p>
      )}
      <p>
        <strong>Without an account, everything stays on your device.</strong> You can play every
        game as a guest; points, levels and badges are then stored only in your browser&apos;s
        storage and never reach us.
      </p>

      <h2>3. What data is processed</h2>

      <h3>a) On your device (always)</h3>
      <p>
        The app stores in your device&apos;s browser (IndexedDB and localStorage): progress and
        level per game, results, personal records, badges, your chosen face (avatar), streak, the
        rounds of family mode, your own word lists for “Find the Imposter”, the number of failed
        attempts per Bee Flow level (this is what unlocks the bonus slot), the dumpling you chose in
        Squishy Dumplings, your Trapbound progress (unlocked levels, deaths, best times, crystals
        found, sound and control settings) and your Sudoku progress (unlocked tiers, best times,
        unfinished puzzles including notes and timer, settings). It also stores your chosen language
        and whether you play as a guest or with an account. This data only leaves your device if you
        create an account (see b). You delete it by clearing the site data in your browser.
      </p>

      <h3>b) With an account (optional)</h3>
      <p>
        If you create an account, we process: your <strong>email address</strong> and{' '}
        <strong>password</strong> (stored by us only in hashed form), a{' '}
        <strong>username you choose yourself</strong>, a display name and your chosen face, as well
        as your game progress (XP, player level, streak, level per game, results, records, badges).
        The purpose is to make your progress available on several devices. Legal basis: Art. 6(1)(b)
        GDPR (performance of a contract).
      </p>

      <h3>c) Public leaderboard</h3>
      <p>
        As soon as you give yourself a <strong>username</strong>, you appear on the leaderboard.
        Others can then see: username, game, points, XP collected, number of rounds and the level
        reached — also on the level map.{' '}
        <strong>If you have no username, you do not appear there</strong>; the username is your
        sign-up for the leaderboard. Your email address, display name and everything else are not
        visible. Legal basis: consent (Art. 6(1)(a) GDPR), which you withdraw by removing your
        username.
      </p>

      <h3>d) Online rounds with friends (optional)</h3>
      <p>
        For shared rounds (Marksmen Round, Find the Imposter, Who am I?, Categories) we store for
        the duration of the round: the name you type in for this round, your seat at the table, your
        role, your vote in polls and your answers. Only the other players in the same round can see
        this. Legal basis: Art. 6(1)(b) GDPR.
      </p>

      <h3>e) Technical data</h3>
      <p>
        When you open the app, our service providers necessarily receive server log data (e.g. IP
        address, time, resource requested). It is used for delivery, stability and security (Art.
        6(1)(f) GDPR).
      </p>
      {werbungAktiv() ? (
        <p>
          <strong>We do not set cookies.</strong> The app remembers things in the browser&apos;s
          local storage. Only when a game offers an ad video is{' '}
          {werbeAnbieter() === 'admob' ? 'Google AdMob' : 'Google AdSense'} loaded; Google may then
          – with your consent – use cookies or similar identifiers (see section 5).
        </p>
      ) : (
        <p>
          <strong>We do not set cookies.</strong> The app remembers things in the browser&apos;s
          local storage, not in cookies, and nothing is tracked beyond the app.
        </p>
      )}

      <h2>4. Children</h2>
      <p>
        The games are suitable for children. An account is <strong>not required</strong> — as a
        guest, everything works except the leaderboard and online rounds. If an account is created
        for a child, a parent or guardian should do so. When choosing a username, please keep in
        mind that it is publicly visible; a nickname is better than a real name.
      </p>

      <h2>5. Service providers we use</h2>

      <h3>Supabase (account, database, online rounds)</h3>
      <p>
        Supabase Inc., 970 Toa Payoh North, Singapore. We use Supabase for sign-in, storing game
        progress and online rounds. The database is located in the region selected for the project;
        data may be transferred to third countries, safeguarded by EU standard contractual clauses.
        Details: <Extern href="https://supabase.com/privacy">supabase.com/privacy</Extern>
      </p>

      <h3>Cloudflare (delivery)</h3>
      <p>
        Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA (for EU customers:
        Cloudflare Germany GmbH). The app is delivered via Cloudflare Pages. Cloudflare is certified
        under the EU-U.S. Data Privacy Framework. Details:{' '}
        <Extern href="https://www.cloudflare.com/privacypolicy/">
          cloudflare.com/privacypolicy
        </Extern>
      </p>

      <h3>PayPal (only if you donate)</h3>
      <p>
        The donate button on the home page is a plain link to <strong>paypal.me</strong> —{' '}
        <strong>not an embedded payment widget</strong>. Unless you tap it, no data is sent to
        PayPal. After that, PayPal&apos;s privacy policy applies (PayPal (Europe) S.à r.l. et Cie,
        S.C.A., Luxembourg). We only learn about a donation what PayPal shows us; we store nothing
        about it in the app.
      </p>

      {werbungAktiv() && (
        <>
          <h3>
            {werbeAnbieter() === 'admob'
              ? 'Google AdMob (optional ad videos only, Android app)'
              : 'Google AdSense (optional ad videos only)'}
          </h3>
          <p>
            Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland. Some games offer
            to show a short ad video in exchange for help – such as a hint, more time or a second
            try. In the Android app the video comes from Google AdMob, in the browser from Google
            AdSense. Google is <strong>only loaded when a game offers such a video</strong>, not
            when the app starts; you never have to watch it.
          </p>
          <p>
            Google processes in particular your IP address, device and browser details and whether
            and how long a video was watched, and may use cookies or similar identifiers – in the
            Android app also your device's advertising ID, which you can reset or delete in your
            Android settings. The first time, a Google window asks whether you agree to personalised
            ads. The legal basis is your consent (Art. 6(1)(a) GDPR, § 25(1) TDDDG). Without
            consent, Google only shows non-personalised ads. Data may be transferred to Google LLC
            in the USA; Google is certified under the EU-U.S. Data Privacy Framework. Details:{' '}
            <Extern href="https://policies.google.com/technologies/ads">
              policies.google.com/technologies/ads
            </Extern>
          </p>
          <p>
            You can change or withdraw your consent at any time:{' '}
            <button type="button" className={styles.linkKnopf} onClick={einwilligungAendern}>
              Open ad settings
            </button>
          </p>
        </>
      )}

      <h2>6. Retention and deletion</h2>
      <p>
        Account data is kept as long as the account exists. In the app, under{' '}
        <strong>Profile → Account &amp; sign-in</strong>, you can reset your progress – and at the
        very bottom you can also <strong>delete your account completely</strong>. This removes your
        account, sign-in, saved games, best scores, badges and leaderboard entries immediately and
        permanently; how to do it is described on the{' '}
        <Link to="/konto-loeschen">Delete account</Link> page. If you can no longer access your
        account, a simple email to {MAIL} is enough. Finished online rounds are not kept
        permanently.
      </p>

      <h2>7. Your rights</h2>
      <p>
        You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17),
        restriction of processing (Art. 18), data portability (Art. 20) and to object to processing
        based on legitimate interests (Art. 21). You can withdraw any consent you have given at any
        time with effect for the future. A simple email is enough.
      </p>
      <p>
        You also have the right to lodge a complaint with a data protection supervisory authority,
        e.g. the State Commissioner for Data Protection and Freedom of Information of North
        Rhine-Westphalia (<Extern href="https://www.ldi.nrw.de">ldi.nrw.de</Extern>
        ).
      </p>

      <h2>8. Data security</h2>
      <p>
        All data is transmitted encrypted (TLS/HTTPS). Access to the database is restricted by
        server-side security rules so that each person can only read and write their own data; the
        public leaderboard reads a view built specifically for it, which contains only username,
        game and numbers. Passwords are never stored in plain text.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We update this policy when the app or the law changes. You will always find the current
        version on this page.
      </p>
    </>
  )
}
