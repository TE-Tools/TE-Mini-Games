/**
 * Die deutschen Texte -- die Ausgangssprache.
 *
 * Hier wird geschrieben, hier wird geändert. `en.ts` folgt der Form
 * dieser Datei; TypeScript erzwingt das.
 *
 * Nicht hier hinein gehören Inhalte, die sich nicht übersetzen lassen,
 * sondern eigene brauchen: die Wortlisten von Stadt-Land-Fluss, Wer bin
 * ich? und Scharade etwa. Ein englischer Spieler braucht englische
 * Wörter, keine übersetzten deutschen. Und die 22 Grundstücke von
 * Schützenopoly stehen für echte Feste -- ihre Namen bleiben, wie sie
 * sind, in jeder Sprache.
 */
export const de = {
  sprache: {
    name: 'Deutsch',
    wechselZu: 'Switch to English',
    kuerzel: 'DE',
  },

  marke: {
    spruch: 'Spielen · wachsen · vergleichen',
  },

  start: {
    menueOeffnen: 'Menü öffnen',
    profil: 'Profil',
    titel: 'Deine Spielewelt',
    untertitel: 'Eine kleine Herausforderung für jeden Moment.',
    level: 'Level',
    xp: 'XP',
    serie: 'Serie',
    nochBisLevel: (fehlend: number, level: number) => `Noch ${fehlend} XP bis Level ${level}`,
    reiterSpiele: 'Spiele',
    reiterRangliste: 'Rangliste',
    reiterErfolge: 'Erfolge',
    reiterTagesziel: 'Tagesziel',
    zuletztGespielt: 'Zuletzt gespielt',
    zuletztGespieltText: 'Da warst du gerade unterwegs.',
    nochNichtsGespielt: 'Noch nichts gespielt – such dir unten etwas aus.',
    spieleEntdecken: 'Spiele entdecken',
    spieleEntdeckenText: 'Wähle eine Herausforderung.',
    offeneSpiele: 'Offene Spiele – wer gerade wartet',
    spendeText:
      'TE-Mini Games ist kostenlos und ohne Werbung. Wenn es dir Freude macht, kannst du einen Kaffee ausgeben.',
    spendeKnopf: 'Spenden über PayPal',
    spendeHinweis: 'Öffnet PayPal in einem neuen Fenster.',
    spieleFiltern: 'Spiele filtern',
    fortschrittBereich: 'Spielerfortschritt',
    fortschrittZuLevel: (level: number) => `Fortschritt zu Level ${level}`,
    bereiche: 'Bereiche',
    spielen: 'Spielen',
  },

  spielarten: {
    Timing: 'Timing',
    Wahrnehmung: 'Wahrnehmung',
    Gedächtnis: 'Gedächtnis',
    Rechnen: 'Rechnen',
    Logik: 'Logik',
    Puzzle: 'Puzzle',
    'Drei gewinnt': 'Drei gewinnt',
    'Jump and Run': 'Jump and Run',
    Survival: 'Survival',
    Würfeln: 'Würfeln',
    Karten: 'Karten',
    Brettspiel: 'Brettspiel',
    Bluffen: 'Bluffen',
    Raten: 'Raten',
    Wissen: 'Wissen',
    Schauspiel: 'Schauspiel',
    Wortspiel: 'Wortspiel',
    Partyspiel: 'Partyspiel',
  },

  spiele: {
    'perfect-second': 'Die perfekte Sekunde',
    'what-is-missing': 'Was fehlt?',
    reihenfolge: 'Reihenfolge merken',
    kopfrechnen: 'Kopfrechnen',
    sudoku: 'Sudoku',
    'bienen-flow': 'Bienen-Flow',
    'squishy-dumplings': 'Squishy Dumplings',
    trapbound: 'Trapbound',
    emberwake: 'Emberwake',
    kniffel: 'Kniffel',
    maumau: 'Mau-Mau',
    'letzte-karte': 'Letzte Karte',
    'texas-holdem': "Texas Hold'em",
    schuetzenopoly: 'Schützenopoly',
    schuetzenrunde: 'Schützenrunde',
    'finde-den-imposter': 'Finde den Imposter',
    'wer-bin-ich': 'Wer bin ich?',
    'stadt-land-fluss': 'Stadt-Land-Fluss',
    scharade: 'Scharade',
    wortbombe: 'Wortbombe',
    'wer-wuerde-eher': 'Wer würde eher?',
  },

  reiter: {
    spiele: 'Spiele',
    rangliste: 'Rangliste',
    erfolge: 'Erfolge',
    tagesziel: 'Tagesziel',
  },

  gruppen: {
    alle: 'Alle',
    knobeln: 'Knobeln',
    geschick: 'Geschick',
    tisch: 'Karten & Würfel',
    party: 'Party',
  },

  menue: {
    titel: 'Menü',
    profil: 'Profil und Konto',
    familie: 'Familienrunde',
    daily: 'Daily Challenge',
    rangliste: 'Rangliste',
    abzeichen: 'Abzeichen',
    offeneSpiele: 'Offene Spiele',
  },

  recht: {
    impressum: 'Impressum',
    datenschutz: 'Datenschutz',
    datenschutzerklaerung: 'Datenschutzerklärung',
    kontoLoeschen: 'Konto löschen',
    stand: 'Stand: 6. September 2026',
  },

  /** Die 50 Abzeichen. Schlüssel ist die Kennung, nicht der Name. */
  abzeichen: {
    perfectionist: {
      name: 'Perfektionist',
      beschreibung: 'Triff eine Zeit mit maximal 0,01 s Abweichung.',
    },
    'eagle-eye': {
      name: 'Adlerauge',
      beschreibung: 'Erreiche Level 50 bei Was fehlt?',
    },
    unstoppable: {
      name: 'Unaufhaltsam',
      beschreibung: '30 Tage Streak.',
    },
    'record-hunter': {
      name: 'Rekordjäger',
      beschreibung: 'Verbessere 10 persönliche Rekorde.',
    },
    allrounder: {
      name: 'Allround-Talent',
      beschreibung: 'Spiele alle verfügbaren Spiele.',
    },
    'ps-gate-100': {
      name: 'Dschungel-Meister',
      beschreibung: 'Erreiche Level 100 bei Die perfekte Sekunde.',
    },
    'ps-gate-200': {
      name: 'Vulkan-Bezwinger',
      beschreibung: 'Erreiche Level 200 bei Die perfekte Sekunde.',
    },
    'ps-gate-300': {
      name: 'Wüsten-Wanderer',
      beschreibung: 'Erreiche Level 300 bei Die perfekte Sekunde.',
    },
    'ps-gate-400': {
      name: 'Eiszeit-Pionier',
      beschreibung: 'Erreiche Level 400 bei Die perfekte Sekunde.',
    },
    'ps-gate-500': {
      name: 'Gletscherkönig',
      beschreibung: 'Erreiche Level 500 (Eispalast) bei Die perfekte Sekunde.',
    },
    'wim-gate-100': {
      name: 'Scharfer Blick',
      beschreibung: 'Erreiche Level 100 bei Was fehlt?',
    },
    'wim-gate-200': {
      name: 'Gedächtniskünstler',
      beschreibung: 'Erreiche Level 200 bei Was fehlt?',
    },
    'wim-gate-300': {
      name: 'Merkmeister',
      beschreibung: 'Erreiche Level 300 bei Was fehlt?',
    },
    'wim-gate-400': {
      name: 'Eisgedächtnis',
      beschreibung: 'Erreiche Level 400 bei Was fehlt?',
    },
    'wim-gate-500': {
      name: 'Gipfel-Genie',
      beschreibung: 'Erreiche Level 500 (Eispalast) bei Was fehlt?',
    },
    'ps-perfect-5': {
      name: 'Feines Gespür',
      beschreibung: '5 haargenaue Treffer insgesamt bei Die perfekte Sekunde.',
    },
    'ps-perfect-25': {
      name: 'Zielwasser',
      beschreibung: '25 haargenaue Treffer insgesamt.',
    },
    'ps-perfect-100': {
      name: 'Chronometer',
      beschreibung: '100 haargenaue Treffer insgesamt.',
    },
    'sr-first-win': {
      name: 'Erster Sieg',
      beschreibung: 'Gewinne deine erste Schützenrunde.',
    },
    'sr-wins-10': {
      name: 'Erfahrener Schütze',
      beschreibung: 'Gewinne 10 Schützenrunden.',
    },
    'sr-wins-25': {
      name: 'Veteran der Bruderschaft',
      beschreibung: 'Gewinne 25 Schützenrunden.',
    },
    'sr-king-first': {
      name: 'Königswürde',
      beschreibung: 'Trage zum ersten Mal die Königswürde.',
    },
    'sr-online-first-win': {
      name: 'Online-Debütsieg',
      beschreibung: 'Gewinne deine erste Online-Schützenrunde.',
    },
    'sr-online-wins-10': {
      name: 'Online-Anführer',
      beschreibung: 'Gewinne 10 Online-Schützenrunden.',
    },
    'five-star-1': {
      name: 'Erste fünf Sterne',
      beschreibung: 'Erziele 5 Sterne in einem Ergebnis.',
    },
    'five-star-10': {
      name: 'Sternensammler',
      beschreibung: '10 Ergebnisse mit 5 Sternen.',
    },
    'five-star-50': {
      name: 'Sternenhimmel',
      beschreibung: '50 Ergebnisse mit 5 Sternen.',
    },
    'record-hunter-25': {
      name: 'Rekordsammler',
      beschreibung: 'Verbessere 25 persönliche Rekorde.',
    },
    'record-hunter-50': {
      name: 'Rekordlegende',
      beschreibung: 'Verbessere 50 persönliche Rekorde.',
    },
    'streak-3': {
      name: 'Guter Anfang',
      beschreibung: '3 Tage Streak.',
    },
    'streak-7': {
      name: 'Eine Woche dabei',
      beschreibung: '7 Tage Streak.',
    },
    'streak-14': {
      name: 'Zwei Wochen dabei',
      beschreibung: '14 Tage Streak.',
    },
    'streak-60': {
      name: 'Zwei Monate dabei',
      beschreibung: '60 Tage Streak.',
    },
    'player-level-5': {
      name: 'Aufsteiger',
      beschreibung: 'Erreiche Spieler-Level 5.',
    },
    'player-level-10': {
      name: 'Erfahren',
      beschreibung: 'Erreiche Spieler-Level 10.',
    },
    'player-level-20': {
      name: 'Profi',
      beschreibung: 'Erreiche Spieler-Level 20.',
    },
    'player-level-30': {
      name: 'Meister',
      beschreibung: 'Erreiche Spieler-Level 30.',
    },
    'games-10': {
      name: 'Reingeschnuppert',
      beschreibung: '10 Spiele insgesamt gespielt.',
    },
    'games-50': {
      name: 'Dabeigeblieben',
      beschreibung: '50 Spiele insgesamt gespielt.',
    },
    'games-100': {
      name: 'Stammspieler',
      beschreibung: '100 Spiele insgesamt gespielt.',
    },
    'games-250': {
      name: 'Unermüdlich',
      beschreibung: '250 Spiele insgesamt gespielt.',
    },
    'daily-first': {
      name: 'Erste Challenge',
      beschreibung: 'Löse deine erste Daily Challenge.',
    },
    'daily-7': {
      name: 'Wochenroutine',
      beschreibung: '7 Daily Challenges gelöst.',
    },
    'daily-30': {
      name: 'Challenge-Profi',
      beschreibung: '30 Daily Challenges gelöst.',
    },
    'family-first': {
      name: 'Familienrunde',
      beschreibung: 'Spiele deine erste Familienrunde zu Ende.',
    },
    'family-5': {
      name: 'Spieleabend-Serie',
      beschreibung: 'Beende 5 Familienrunden.',
    },
    'night-owl': {
      name: 'Nachteule',
      beschreibung: 'Spiele nach 22 Uhr.',
    },
    'early-bird': {
      name: 'Frühaufsteher',
      beschreibung: 'Spiele vor 7 Uhr.',
    },
    'weekend-warrior': {
      name: 'Wochenend-Krieger',
      beschreibung: 'Spiele am Wochenende.',
    },
    collector: {
      name: 'Sammler',
      beschreibung: 'Schalte 40 andere Abzeichen frei.',
    },
  },

  erfolge: {
    titel: 'Abzeichen',
    einleitung: 'Spiele, sammle XP und knacke Rekorde – so schaltest du Abzeichen frei.',
    freigeschaltet: (offen: number, gesamt: number) =>
      `${offen} von ${gesamt} Abzeichen freigeschaltet.`,
    alleAnsehen: 'Alle ansehen',
    nochKeins: 'Noch keins – das erste kommt schneller als du denkst.',
    zustandOffen: 'freigeschaltet',
    zustandGesperrt: 'noch gesperrt',
  },

  anmeldung: {
    titelGast: 'TE-Mini Games',
    titelAnmelden: 'Anmelden',
    titelRegistrieren: 'Konto erstellen',
    einleitungGast:
      'Melde dich an, damit dein Fortschritt geladen wird – oder spiele als Gast ohne Cloud.',
    einleitung: 'Mit Konto speicherst du Fortschritt online.',
    email: 'E-Mail *',
    passwort: 'Passwort *',
    neuesPasswort: 'Neues Passwort *',
    neuesPasswortTitel: 'Neues Passwort',
    neuesPasswortText: 'Wähle ein neues Passwort für dein Konto.',
    passwortSpeichern: 'Passwort speichern',
    benutzername: 'Benutzername',
    benutzernamePflicht: 'Benutzername *',
    anzeigename: 'Anzeigename (optional)',
    bereitsVergeben: 'Bereits vergeben',
    benutzernameSpeichern: 'Benutzername speichern',
    benutzernameWirdGespeichert: 'Speichere…',
    benutzernameGespeichert: 'Benutzername gespeichert – du bist ab jetzt in der Rangliste.',
    fehltBenutzername: 'Dir fehlt noch ein Benutzername',
    fehltBenutzernameText:
      'In den Ranglisten steht dein Benutzername, nicht deine E-Mail. Ohne ihn tauchst du dort nicht auf.',
    mitGoogle: 'Mit Google anmelden',
    passwortVergessen: 'Passwort vergessen?',
    wechselZuRegistrieren: 'Noch kein Konto? Registrieren',
    wechselZuAnmelden: 'Schon Konto? Anmelden',
    alsGast: 'Als Gast spielen',
    gastHinweis:
      'Gast: nichts vom Konto wird geladen – nur lokal auf diesem Gerät, ohne Cloud-Sync.',
    zurStartseite: 'Zur Startseite',
    nichtKonfiguriert:
      'Online-Login ist noch nicht konfiguriert. Du kannst als Gast spielen – ohne Cloud-Laden.',
    nichtKonfiguriertHinweis:
      'Für Konto-Login: Supabase-Keys in Cloudflare setzen (siehe docs/supabase-setup.md).',
    nichtAktiv: 'Online-Login ist noch nicht aktiv. Du kannst offline als Gast spielen.',
    konto: 'Konto',
    angemeldet: 'Angemeldet',
    abmelden: 'Abmelden',
    abbrechen: 'Abbrechen',
    synchronisiert: 'Synchronisiere…',
    bestaetigungLabel: 'Löschen bestätigen',
    jetztSynchronisieren: 'Jetzt synchronisieren',
    fortschrittZuruecksetzen: 'Fortschritt zurücksetzen',
    fortschrittZuruecksetzenText:
      'Löscht Level, Punkte, Rekorde, XP und Abzeichen – auf diesem Gerät und im Konto. Das lässt sich nicht rückgängig machen.',
    kontoLoeschen: 'Konto löschen',
    kontoLoeschenKnopf: 'Konto endgültig löschen',
    kontoWirdGeloescht: 'Lösche…',
    kontoLoeschenText:
      'Löscht dein Konto und alles, was daran hängt: Spielstände, Bestwerte, Abzeichen, Einträge in den Bestenlisten und deine Anmeldung. Danach kannst du dich mit dieser E-Mail nicht mehr anmelden. Das lässt sich nicht rückgängig machen.',
    bestaetigungWort: 'LÖSCHEN',
    bestaetigungTippe: 'Tippe',
    bestaetigungEin: 'ein, um es zu bestätigen',
  },

  profil: {
    titel: 'Profil',
    zurueck: 'Zurück',
    nameLabel: 'Dein Name im Spiel',
    nameHinweis:
      'So stehst du in Runden und in der Rangliste. Angemeldet wird er auch auf deine anderen Geräte übernommen.',
    speichern: 'Speichern',
    gespeichert: 'Gespeichert.',
    nameAusKonto: 'Namen aus dem Konto übernehmen',
    gesichtHinweis: 'Wähle dein Gesicht – es erscheint auf der Levelkarte.',
    kontoTitel: 'Konto & Anmeldung',
    kontoHinweis: 'Benutzername, Anmeldung, Synchronisierung',
    zurStartseite: 'Zur Startseite',
  },

  rangliste: {
    titel: 'Rangliste',
    zurueck: 'Zurück',
    markeLokal: 'Lokal',
    markeNichtAngemeldet: 'Nicht angemeldet',
    reiterAlle: 'Alle Spiele',
    reiterRekorde: 'Meine Rekorde',
    global: 'Global',
    nichtAngemeldetTitel: 'Du bist nicht angemeldet',
    nichtAngemeldetText:
      'Deine Runden werden auf diesem Gerät gespeichert, kommen aber erst in die Rangliste, wenn du angemeldet bist.',
    wartenNachAnmelden: (anzahl: number) =>
      `${anzahl} ${anzahl === 1 ? 'Eintrag wartet' : 'Einträge warten'} aufs Hochladen – nach dem Anmelden gehen sie automatisch raus.`,
    jetztAnmelden: 'Jetzt anmelden',
    fehltNameTitel: 'Dir fehlt ein Benutzername',
    fehltNameText:
      'Du bist angemeldet, aber in den Ranglisten steht der Benutzername – und über Google wird keiner vergeben. Ohne ihn tauchst du hier nicht auf, auch wenn deine Runden hochgeladen werden.',
    nameFestlegen: 'Benutzername festlegen',
    wartenAktualisieren: (anzahl: number) =>
      `${anzahl} ${anzahl === 1 ? 'Eintrag wartet' : 'Einträge warten'} aufs Hochladen – tippe auf „Aktualisieren“.`,
    gesamtXpTitel: 'Gesamt-XP über alle Spiele',
    gesamtXpText:
      'Alle XP aus jeder Runde aller Spiele zusammengerechnet. Jede gespielte Runde zählt mit, egal ob Rekord oder nicht.',
    brauchtSupabase: 'Die gemeinsame Rangliste braucht ein konfiguriertes Supabase-Projekt.',
    nochKeineEintraege:
      'Noch keine Einträge. Nach einer Runde mit Konto landen sie automatisch hier.',
    bestleistungenTitel: 'Persönliche Bestleistungen',
    nochKeineRekorde: 'Noch keine Rekorde – spiel eine Runde!',
    besteRundenTitel: 'Beste Runden',
    nochKeineErgebnisse: 'Noch keine Ergebnisse.',
    gesamtpunkteTitel: 'Gesamtpunkte je Spiel',
    gesamtpunkteText:
      'Aufsummiert über alle jemals gespielten Runden dieses Spiels – wächst bei jeder Runde, unabhängig vom Rekord.',
    globalBrauchtSupabase:
      'Globale Ranglisten brauchen ein konfiguriertes Supabase-Projekt. Bis dahin siehst du hier deine lokalen Werte unter „Meine Rekorde“.',
    runden: (anzahl: number) => `${anzahl} Runden`,
    punkte: (zahl: string) => `${zahl} Pkt.`,
    deinPlatz: 'Dein Platz:',
    deinPlatzMit: (xp: string, runden: number) => `mit ${xp} XP aus ${runden} Runden`,
    summeAllerXp: 'Summe aller XP',
    gezeigtWirdDie: 'Gezeigt wird die',
    gezeigtWirdRest:
      'aus jeder gespielten Runde – jede neue Runde zählt sofort mit dazu, unabhängig davon, ob sie ein Rekord war.',
    keineEintraegeSpiel:
      'Noch keine Einträge für dieses Spiel. Nach einer Runde landen sie automatisch hier.',
  },

  daily: {
    titel: 'Daily Challenge',
    levelVersuch: (level: number) => `Level ${level} · ein Versuch heute`,
    hinweis: 'Alle Spieler bekommen heute dieselbe Aufgabe. Fair und vergleichbar.',
    starten: 'Challenge starten',
    timerLaeuft: 'Timer läuft…',
    welchesObjekt: 'Welches Objekt fehlt?',
    punkte: (p: number) => `${p} Punkte`,
    schonGespielt: 'Komm morgen für die nächste Challenge zurück.',
    gespeichert: 'Ergebnis gespeichert. Morgen wartet eine neue Challenge.',
    zurStartseite: 'Zur Startseite',
  },

  familie: {
    titel: 'Familie',
    markeLokal: 'Lokal',
    spielernamen: 'Spielernamen',
    spiel: 'Spiel',
    rundeStarten: 'Runde starten',
    binBereit: 'Ich bin bereit',
    welchesObjekt: 'Welches Objekt fehlt?',
    neueRunde: 'Neue Runde',
    zurStartseite: 'Zur Startseite',
  },

  spiel: {
    zurueck: 'Zurück',
    zurStartseite: 'Zur Startseite',
    zurUebersicht: 'Zur Übersicht',
    nochEinmal: 'Noch einmal',
    weiterSpielen: (level: number) => `Weiter spielen · Level ${level}`,
    avatarAendern: 'Avatar ändern',
    neuerRekord: '🏆 Neuer Rekord!',
    levelGeschafft: 'Level geschafft!',
    punkteUndXp: 'Punkte ·',
  },

  perfekteSekunde: {
    zielzeit: 'Zielzeit',
    jetzt: 'Jetzt!',
    deineZeit: 'Deine Zeit:',
    daneben: 'Daneben – versuch’s nochmal',
    ziel: 'Ziel',
    abweichung: 'Abweichung',
    alleTreffer: 'Alle Treffer:',
    meilenstein: (xp: number) => `🎉 Meilenstein-Bonus +${xp} XP!`,
    haargenau: '✨ Haargenau! Sonder-XP für perfekten Treffer',
  },

  levelkarte: {
    titel: 'Levelübersicht',
    karteVon: (spiel: string) => `Levelkarte ${spiel}`,
    level: (nr: number) => `Level ${nr}`,
    freiBis: (nr: number) => ` · frei bis ${nr}`,
    torOffen: ' · Tor oben ist offen',
    duBistHier: 'Du bist hier:',
    abschnitt: (nr: number) => `Abschnitt ${nr}`,
    zurueckZuAbschnitt: (nr: number) => `Zurück zu Abschnitt ${nr}`,
    abschnittVonBis: (nr: number, von: number, bis: number) =>
      `Abschnitt ${nr} · Level ${von}–${bis}`,
    torOeffnet: (level: number) => ` · Tor öffnet nach Level ${level}`,
  },

  sudoku: {
    titel: 'Sudoku',
    einleitung: (proStufe: number) =>
      `Drei Stufen zu je ${proStufe} Rätseln. Jede Stufe ist eine eigene Strecke -- du musst nicht erst alle leichten lösen.`,
    stufen: {
      leicht: 'Leicht',
      mittel: 'Mittel',
      schwer: 'Schwer',
    },
    stufenText: {
      leicht: 'Nur Singles: Jedes Feld ergibt sich aus dem, was schon dasteht.',
      mittel: 'Paare, Tripel, zeigende Paare -- hier braucht es Notizen.',
      schwer: 'Fische, Wings, Ketten. Am Ende Rätsel, an denen man Stunden sitzt.',
    },
    techniken: {
      'nackter-single': 'Nackter Single',
      'versteckter-single': 'Versteckter Single',
      'zeigendes-paar': 'Zeigendes Paar',
      'kasten-linie': 'Kasten-Linie',
      'nacktes-paar': 'Nacktes Paar',
      'verstecktes-paar': 'Verstecktes Paar',
      'nacktes-tripel': 'Nacktes Tripel',
      'verstecktes-tripel': 'Verstecktes Tripel',
      'x-wing': 'X-Wing',
      'xy-wing': 'XY-Wing',
      'nacktes-quartett': 'Nacktes Quartett',
      'xyz-wing': 'XYZ-Wing',
      schwertfisch: 'Schwertfisch',
      qualle: 'Qualle',
      faerbung: 'Färbung',
      kette: 'Widerspruchskette',
      'rohe-gewalt': 'Verschachtelte Ketten',
    },
    punkte: 'Punkte ·',
    fehler: 'Fehler',
    tipp: 'Tipp',
    tipps: 'Tipps',
    zeitBonus: (bonus: number) => ` · +${bonus} für die Zeit`,
    technik: (name: string) => `Technik: ${name}`,
    zifferSetzen: (ziffer: number) => `${ziffer} eintragen`,
    vonVornFrage: 'Dieses Rätsel von vorn anfangen?',
    weiter: 'Weiter',
    alleKandidaten: 'Alle Kandidaten eingetragen -- zählt wie ein Tipp.',
    fussSchwer:
      'Schwer: Fehler werden nicht angezeigt. Ein Tipp verrät, ob etwas Falsches im Gitter steht.',
    fussNormal: 'Tippe ein Feld an, dann eine Ziffer. Mit Notizen an trägst du Kandidaten ein.',
    zumMenue: 'Zum Menü',
    zurKarte: 'Zur Karte',
    menue: 'Menü',
    loeschen: 'Löschen',
    zurueck: 'Zurück',
    fortsetzen: (name: string) => `Fortsetzen · ${name}`,
    alleGeloest: 'Alle gelöst · noch mal',
    weiterStufe: (nr: number) => `Weiter · Stufe ${nr}`,
    spielenStufe: (nr: number) => `Spielen · Stufe ${nr}`,
    karte: 'Karte',
    einstellungen: 'Einstellungen',
    fehlerZeigen: 'Fehler sofort rot zeigen',
    fehlerZeigenHinweis: 'Bei Schwer wird nichts verraten.',
    notizenAufraeumen: 'Notizen aufräumen',
    notizenAufraeumenHinweis: 'Eine gesetzte Ziffer verschwindet aus den Notizen ringsum.',
    gleicheZeigen: 'Gleiche Ziffern hervorheben',
    fortschrittLoeschen: 'Fortschritt löschen',
    fortschrittLoeschenFrage: 'Wirklich den ganzen Sudoku-Fortschritt löschen?',
    pause: 'Pause',
    vonVorn: 'Von vorn',
    geloest: 'Gelöst!',
    schwersterSchritt: 'Schwerster nötiger Schritt:',
    nochMal: 'Noch mal',
    selbstWeiter: 'Selbst weiter',
    alleNotizen: 'Alle Notizen eintragen (zählt als Tipp)',
    tastatur: {
      amRechner: 'Am Rechner:',
      eintragen: 'eintragen,',
      bewegen: 'bewegen,',
      notizen: 'Notizen,',
      zurueck: 'zurück,',
      pause: 'Pause.',
      pfeile: 'Pfeile',
    },
    zifferEintragen: (ziffer: number, uebrig: number) =>
      `${ziffer} eintragen, noch ${uebrig} übrig`,
  },

  allgemein: {
    zurueck: 'Zurück',
    weiter: 'Weiter',
    abbrechen: 'Abbrechen',
    schliessen: 'Schließen',
    laden: 'Laden…',
    zumMenue: 'Zum Menü',
    gegenRechner: 'Gegen den Rechner',
    onlineSpielen: 'Online spielen',
    ton: 'Ton',
  },
}
