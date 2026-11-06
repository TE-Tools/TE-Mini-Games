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
