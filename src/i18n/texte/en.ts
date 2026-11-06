/**
 * The English texts.
 *
 * German (`de.ts`) is the source language; this file follows its shape.
 * TypeScript enforces that: a missing entry here is a build error, not a
 * silent fallback to German.
 *
 * Game titles that are proper names stay as they are. "Schützenopoly" is
 * one of them -- it is a board game about German Schützenfeste, and its
 * 22 properties are real festivals.
 */
import type { Texte } from '../sprache'

export const en: Texte = {
  sprache: {
    name: 'English',
    wechselZu: 'Auf Deutsch umschalten',
    kuerzel: 'EN',
  },

  marke: {
    spruch: 'Play · grow · compare',
  },

  start: {
    menueOeffnen: 'Open menu',
    profil: 'Profile',
    titel: 'Your game world',
    untertitel: 'A small challenge for any moment.',
    level: 'Level',
    xp: 'XP',
    serie: 'Streak',
    nochBisLevel: (fehlend: number, level: number) => `${fehlend} XP to level ${level}`,
    reiterSpiele: 'Games',
    reiterRangliste: 'Leaderboard',
    reiterErfolge: 'Badges',
    reiterTagesziel: 'Daily goal',
    zuletztGespielt: 'Recently played',
    zuletztGespieltText: 'Where you left off.',
    nochNichtsGespielt: 'Nothing played yet – pick something below.',
    spieleEntdecken: 'Discover games',
    spieleEntdeckenText: 'Choose a challenge.',
    offeneSpiele: 'Open games – who is waiting',
    spendeText: 'TE-Mini Games is free and ad-free. If you enjoy it, you can buy me a coffee.',
    spendeKnopf: 'Donate via PayPal',
    spendeHinweis: 'Opens PayPal in a new window.',
    spieleFiltern: 'Filter games',
    fortschrittBereich: 'Player progress',
    fortschrittZuLevel: (level: number) => `Progress to level ${level}`,
    bereiche: 'Sections',
    spielen: 'Play',
  },

  spielarten: {
    Timing: 'Timing',
    Wahrnehmung: 'Observation',
    Gedächtnis: 'Memory',
    Rechnen: 'Mental maths',
    Logik: 'Logic',
    Puzzle: 'Puzzle',
    'Drei gewinnt': 'Match three',
    'Jump and Run': 'Platformer',
    Survival: 'Survival',
    Würfeln: 'Dice',
    Karten: 'Cards',
    Brettspiel: 'Board game',
    Bluffen: 'Bluffing',
    Raten: 'Guessing',
    Wissen: 'Knowledge',
    Schauspiel: 'Acting',
    Wortspiel: 'Word game',
    Partyspiel: 'Party game',
  },

  spiele: {
    'perfect-second': 'The Perfect Second',
    'what-is-missing': "What's missing?",
    reihenfolge: 'Remember the Order',
    kopfrechnen: 'Mental Maths',
    sudoku: 'Sudoku',
    'bienen-flow': 'Bee Flow',
    'squishy-dumplings': 'Squishy Dumplings',
    trapbound: 'Trapbound',
    emberwake: 'Emberwake',
    kniffel: 'Yahtzee-style Dice',
    maumau: 'Mau-Mau',
    'letzte-karte': 'Last Card',
    'texas-holdem': "Texas Hold'em",
    schuetzenopoly: 'Schützenopoly',
    schuetzenrunde: 'Marksmen Round',
    'finde-den-imposter': 'Find the Imposter',
    'wer-bin-ich': 'Who am I?',
    'stadt-land-fluss': 'Categories',
    scharade: 'Charades',
    wortbombe: 'Word Bomb',
    'wer-wuerde-eher': 'Who would rather?',
  },

  reiter: {
    spiele: 'Games',
    rangliste: 'Leaderboard',
    erfolge: 'Badges',
    tagesziel: 'Daily goal',
  },

  gruppen: {
    alle: 'All',
    knobeln: 'Puzzles',
    geschick: 'Skill',
    tisch: 'Cards & dice',
    party: 'Party',
  },

  menue: {
    titel: 'Menu',
    profil: 'Profile and account',
    familie: 'Family round',
    daily: 'Daily challenge',
    rangliste: 'Leaderboard',
    abzeichen: 'Badges',
    offeneSpiele: 'Open games',
  },

  recht: {
    impressum: 'Legal notice',
    datenschutz: 'Privacy',
  },

  /** The 50 badges, keyed by id. */
  abzeichen: {
    perfectionist: {
      name: 'Perfectionist',
      beschreibung: 'Hit a time within 0.01 s.',
    },
    'eagle-eye': {
      name: 'Eagle Eye',
      beschreibung: "Reach level 50 in What's missing?",
    },
    unstoppable: {
      name: 'Unstoppable',
      beschreibung: 'A 30-day streak.',
    },
    'record-hunter': {
      name: 'Record Hunter',
      beschreibung: 'Beat 10 personal records.',
    },
    allrounder: {
      name: 'All-rounder',
      beschreibung: 'Play every available game.',
    },
    'ps-gate-100': {
      name: 'Jungle Master',
      beschreibung: 'Reach level 100 in The Perfect Second.',
    },
    'ps-gate-200': {
      name: 'Volcano Conqueror',
      beschreibung: 'Reach level 200 in The Perfect Second.',
    },
    'ps-gate-300': {
      name: 'Desert Wanderer',
      beschreibung: 'Reach level 300 in The Perfect Second.',
    },
    'ps-gate-400': {
      name: 'Ice Age Pioneer',
      beschreibung: 'Reach level 400 in The Perfect Second.',
    },
    'ps-gate-500': {
      name: 'Glacier King',
      beschreibung: 'Reach level 500 (Ice Palace) in The Perfect Second.',
    },
    'wim-gate-100': {
      name: 'Sharp Eye',
      beschreibung: "Reach level 100 in What's missing?",
    },
    'wim-gate-200': {
      name: 'Memory Artist',
      beschreibung: "Reach level 200 in What's missing?",
    },
    'wim-gate-300': {
      name: 'Master of Recall',
      beschreibung: "Reach level 300 in What's missing?",
    },
    'wim-gate-400': {
      name: 'Frozen Memory',
      beschreibung: "Reach level 400 in What's missing?",
    },
    'wim-gate-500': {
      name: 'Summit Genius',
      beschreibung: "Reach level 500 (Ice Palace) in What's missing?",
    },
    'ps-perfect-5': {
      name: 'Fine Instinct',
      beschreibung: '5 pinpoint hits in The Perfect Second.',
    },
    'ps-perfect-25': {
      name: 'Steady Hand',
      beschreibung: '25 pinpoint hits in total.',
    },
    'ps-perfect-100': {
      name: 'Chronometer',
      beschreibung: '100 pinpoint hits in total.',
    },
    'sr-first-win': {
      name: 'First Win',
      beschreibung: 'Win your first Marksmen Round.',
    },
    'sr-wins-10': {
      name: 'Seasoned Shot',
      beschreibung: 'Win 10 Marksmen Rounds.',
    },
    'sr-wins-25': {
      name: 'Veteran of the Guild',
      beschreibung: 'Win 25 Marksmen Rounds.',
    },
    'sr-king-first': {
      name: 'Crowned King',
      beschreibung: 'Take the crown for the first time.',
    },
    'sr-online-first-win': {
      name: 'Online Debut Win',
      beschreibung: 'Win your first online Marksmen Round.',
    },
    'sr-online-wins-10': {
      name: 'Online Leader',
      beschreibung: 'Win 10 online Marksmen Rounds.',
    },
    'five-star-1': {
      name: 'First Five Stars',
      beschreibung: 'Score 5 stars in a single result.',
    },
    'five-star-10': {
      name: 'Star Collector',
      beschreibung: '10 results with 5 stars.',
    },
    'five-star-50': {
      name: 'Starry Sky',
      beschreibung: '50 results with 5 stars.',
    },
    'record-hunter-25': {
      name: 'Record Collector',
      beschreibung: 'Beat 25 personal records.',
    },
    'record-hunter-50': {
      name: 'Record Legend',
      beschreibung: 'Beat 50 personal records.',
    },
    'streak-3': {
      name: 'Good Start',
      beschreibung: 'A 3-day streak.',
    },
    'streak-7': {
      name: 'One Week In',
      beschreibung: 'A 7-day streak.',
    },
    'streak-14': {
      name: 'Two Weeks In',
      beschreibung: 'A 14-day streak.',
    },
    'streak-60': {
      name: 'Two Months In',
      beschreibung: 'A 60-day streak.',
    },
    'player-level-5': {
      name: 'Climber',
      beschreibung: 'Reach player level 5.',
    },
    'player-level-10': {
      name: 'Experienced',
      beschreibung: 'Reach player level 10.',
    },
    'player-level-20': {
      name: 'Pro',
      beschreibung: 'Reach player level 20.',
    },
    'player-level-30': {
      name: 'Master',
      beschreibung: 'Reach player level 30.',
    },
    'games-10': {
      name: 'First Taste',
      beschreibung: 'Played 10 games in total.',
    },
    'games-50': {
      name: 'Stuck Around',
      beschreibung: 'Played 50 games in total.',
    },
    'games-100': {
      name: 'Regular',
      beschreibung: 'Played 100 games in total.',
    },
    'games-250': {
      name: 'Tireless',
      beschreibung: 'Played 250 games in total.',
    },
    'daily-first': {
      name: 'First Challenge',
      beschreibung: 'Solve your first daily challenge.',
    },
    'daily-7': {
      name: 'Weekly Routine',
      beschreibung: 'Solved 7 daily challenges.',
    },
    'daily-30': {
      name: 'Challenge Pro',
      beschreibung: 'Solved 30 daily challenges.',
    },
    'family-first': {
      name: 'Family Round',
      beschreibung: 'Finish your first family round.',
    },
    'family-5': {
      name: 'Game Night Streak',
      beschreibung: 'Finish 5 family rounds.',
    },
    'night-owl': {
      name: 'Night Owl',
      beschreibung: 'Play after 10 pm.',
    },
    'early-bird': {
      name: 'Early Bird',
      beschreibung: 'Play before 7 am.',
    },
    'weekend-warrior': {
      name: 'Weekend Warrior',
      beschreibung: 'Play at the weekend.',
    },
    collector: {
      name: 'Collector',
      beschreibung: 'Unlock 40 other badges.',
    },
  },

  erfolge: {
    titel: 'Badges',
    einleitung: 'Play, collect XP and beat records – that is how badges unlock.',
    freigeschaltet: (offen: number, gesamt: number) => `${offen} of ${gesamt} badges unlocked.`,
    alleAnsehen: 'See all',
    nochKeins: 'None yet – the first one comes sooner than you think.',
    zustandOffen: 'unlocked',
    zustandGesperrt: 'still locked',
  },

  anmeldung: {
    titelGast: 'TE-Mini Games',
    titelAnmelden: 'Sign in',
    titelRegistrieren: 'Create account',
    einleitungGast: 'Sign in to load your progress – or play as a guest without the cloud.',
    einleitung: 'With an account your progress is stored online.',
    email: 'Email *',
    passwort: 'Password *',
    neuesPasswort: 'New password *',
    neuesPasswortTitel: 'New password',
    neuesPasswortText: 'Choose a new password for your account.',
    passwortSpeichern: 'Save password',
    benutzername: 'Username',
    benutzernamePflicht: 'Username *',
    anzeigename: 'Display name (optional)',
    bereitsVergeben: 'Already taken',
    benutzernameSpeichern: 'Save username',
    benutzernameWirdGespeichert: 'Saving…',
    benutzernameGespeichert: 'Username saved – you now appear in the leaderboard.',
    fehltBenutzername: 'You still need a username',
    fehltBenutzernameText:
      'Leaderboards show your username, not your email. Without one you do not appear there.',
    mitGoogle: 'Sign in with Google',
    passwortVergessen: 'Forgot your password?',
    wechselZuRegistrieren: 'No account yet? Sign up',
    wechselZuAnmelden: 'Already have an account? Sign in',
    alsGast: 'Play as a guest',
    gastHinweis: 'Guest: nothing is loaded from an account – only on this device, no cloud sync.',
    zurStartseite: 'To the home screen',
    nichtKonfiguriert:
      'Online sign-in is not configured yet. You can play as a guest – without cloud loading.',
    nichtKonfiguriertHinweis:
      'For account sign-in: set the Supabase keys in Cloudflare (see docs/supabase-setup.md).',
    nichtAktiv: 'Online sign-in is not active yet. You can play offline as a guest.',
    konto: 'Account',
    angemeldet: 'Signed in',
    abmelden: 'Sign out',
    abbrechen: 'Cancel',
    synchronisiert: 'Syncing…',
    bestaetigungLabel: 'Confirm deletion',
    jetztSynchronisieren: 'Sync now',
    fortschrittZuruecksetzen: 'Reset progress',
    fortschrittZuruecksetzenText:
      'Deletes levels, scores, records, XP and badges – on this device and in your account. This cannot be undone.',
    kontoLoeschen: 'Delete account',
    kontoLoeschenKnopf: 'Delete account permanently',
    kontoWirdGeloescht: 'Deleting…',
    kontoLoeschenText:
      'Deletes your account and everything attached to it: saves, best scores, badges, leaderboard entries and your sign-in. After this you can no longer sign in with this email. It cannot be undone.',
    bestaetigungWort: 'DELETE',
    bestaetigungTippe: 'Type',
    bestaetigungEin: 'to confirm',
  },

  profil: {
    titel: 'Profile',
    zurueck: 'Back',
    nameLabel: 'Your name in the game',
    nameHinweis:
      'This is how you appear in rounds and on the leaderboard. When signed in it carries over to your other devices.',
    speichern: 'Save',
    gespeichert: 'Saved.',
    nameAusKonto: 'Take the name from my account',
    gesichtHinweis: 'Pick your face – it shows up on the level map.',
    kontoTitel: 'Account & sign-in',
    kontoHinweis: 'Username, sign-in, syncing',
    zurStartseite: 'To the home screen',
  },

  rangliste: {
    titel: 'Leaderboard',
    zurueck: 'Back',
    markeLokal: 'Local',
    markeNichtAngemeldet: 'Not signed in',
    reiterAlle: 'All games',
    reiterRekorde: 'My records',
    global: 'Global',
    nichtAngemeldetTitel: 'You are not signed in',
    nichtAngemeldetText:
      'Your rounds are stored on this device, but they only reach the leaderboard once you are signed in.',
    wartenNachAnmelden: (anzahl: number) =>
      `${anzahl} ${anzahl === 1 ? 'entry is' : 'entries are'} waiting to upload – they go out automatically once you sign in.`,
    jetztAnmelden: 'Sign in now',
    fehltNameTitel: 'You need a username',
    fehltNameText:
      'You are signed in, but leaderboards show your username – and signing in with Google does not create one. Without it you do not appear here, even though your rounds are uploaded.',
    nameFestlegen: 'Choose a username',
    wartenAktualisieren: (anzahl: number) =>
      `${anzahl} ${anzahl === 1 ? 'entry is' : 'entries are'} waiting to upload – tap “Refresh”.`,
    gesamtXpTitel: 'Total XP across all games',
    gesamtXpText:
      'All XP from every round of every game added up. Every round counts, record or not.',
    brauchtSupabase: 'The shared leaderboard needs a configured Supabase project.',
    nochKeineEintraege: 'No entries yet. After one round with an account they appear here.',
    bestleistungenTitel: 'Personal bests',
    nochKeineRekorde: 'No records yet – play a round!',
    besteRundenTitel: 'Best rounds',
    nochKeineErgebnisse: 'No results yet.',
    gesamtpunkteTitel: 'Total points per game',
    gesamtpunkteText:
      'Added up over every round of this game ever played – it grows with each round, record or not.',
    globalBrauchtSupabase:
      'Global leaderboards need a configured Supabase project. Until then you see your local values under “My records”.',
    runden: (anzahl: number) => `${anzahl} rounds`,
    punkte: (zahl: string) => `${zahl} pts`,
    deinPlatz: 'Your place:',
    deinPlatzMit: (xp: string, runden: number) => `with ${xp} XP from ${runden} rounds`,
    summeAllerXp: 'the sum of all XP',
    gezeigtWirdDie: 'Shown is',
    gezeigtWirdRest:
      'from every round played – each new round counts immediately, whether or not it was a record.',
    keineEintraegeSpiel: 'No entries for this game yet. After one round they appear here.',
  },

  daily: {
    titel: 'Daily challenge',
    levelVersuch: (level: number) => `Level ${level} · one attempt today`,
    hinweis: 'Everyone gets the same task today. Fair and comparable.',
    starten: 'Start challenge',
    timerLaeuft: 'Timer running…',
    welchesObjekt: 'Which object is missing?',
    punkte: (p: number) => `${p} points`,
    schonGespielt: 'Come back tomorrow for the next challenge.',
    gespeichert: 'Result saved. A new challenge waits tomorrow.',
    zurStartseite: 'To the home screen',
  },

  familie: {
    titel: 'Family',
    markeLokal: 'Local',
    spielernamen: 'Player names',
    spiel: 'Game',
    rundeStarten: 'Start round',
    binBereit: "I'm ready",
    welchesObjekt: 'Which object is missing?',
    neueRunde: 'New round',
    zurStartseite: 'To the home screen',
  },

  spiel: {
    zurueck: 'Back',
    zurStartseite: 'To the home screen',
    zurUebersicht: 'To the overview',
    nochEinmal: 'Again',
    weiterSpielen: (level: number) => `Continue · level ${level}`,
    avatarAendern: 'Change avatar',
    neuerRekord: '🏆 New record!',
    levelGeschafft: 'Level complete!',
    punkteUndXp: 'points ·',
  },

  perfekteSekunde: {
    zielzeit: 'Target time',
    jetzt: 'Now!',
    deineZeit: 'Your time:',
    daneben: 'Missed – try again',
    ziel: 'Target',
    abweichung: 'Deviation',
    alleTreffer: 'All hits:',
    meilenstein: (xp: number) => `🎉 Milestone bonus +${xp} XP!`,
    haargenau: '✨ Spot on! Bonus XP for a perfect hit',
  },

  levelkarte: {
    titel: 'Level map',
    karteVon: (spiel: string) => `Level map ${spiel}`,
    level: (nr: number) => `Level ${nr}`,
    freiBis: (nr: number) => ` · open up to ${nr}`,
    torOffen: ' · the gate above is open',
    duBistHier: 'You are here:',
    abschnitt: (nr: number) => `Section ${nr}`,
    zurueckZuAbschnitt: (nr: number) => `Back to section ${nr}`,
    abschnittVonBis: (nr: number, von: number, bis: number) =>
      `Section ${nr} · levels ${von}–${bis}`,
    torOeffnet: (level: number) => ` · gate opens after level ${level}`,
  },

  sudoku: {
    titel: 'Sudoku',
    einleitung: (proStufe: number) =>
      `Three levels of ${proStufe} puzzles each. Each one is its own track – you do not have to clear the easy ones first.`,
    stufen: {
      leicht: 'Easy',
      mittel: 'Medium',
      schwer: 'Hard',
    },
    stufenText: {
      leicht: 'Singles only: every cell follows from what is already there.',
      mittel: 'Pairs, triples, pointing pairs – this is where notes come in.',
      schwer: 'Fish, wings, chains. Towards the end, puzzles you sit with for hours.',
    },
    techniken: {
      'nackter-single': 'Naked single',
      'versteckter-single': 'Hidden single',
      'zeigendes-paar': 'Pointing pair',
      'kasten-linie': 'Box/line reduction',
      'nacktes-paar': 'Naked pair',
      'verstecktes-paar': 'Hidden pair',
      'nacktes-tripel': 'Naked triple',
      'verstecktes-tripel': 'Hidden triple',
      'x-wing': 'X-Wing',
      'xy-wing': 'XY-Wing',
      'nacktes-quartett': 'Naked quad',
      'xyz-wing': 'XYZ-Wing',
      schwertfisch: 'Swordfish',
      qualle: 'Jellyfish',
      faerbung: 'Colouring',
      kette: 'Contradiction chain',
      'rohe-gewalt': 'Nested chains',
    },
    punkte: 'points ·',
    fehler: 'mistakes',
    tipp: 'hint',
    tipps: 'hints',
    zeitBonus: (bonus: number) => ` · +${bonus} for time`,
    technik: (name: string) => `Technique: ${name}`,
    zifferSetzen: (ziffer: number) => `Enter ${ziffer}`,
    vonVornFrage: 'Start this puzzle over?',
    weiter: 'Continue',
    alleKandidaten: 'All candidates filled in -- counts as a hint.',
    fussSchwer:
      'Hard: mistakes are not shown. A hint tells you whether something wrong is in the grid.',
    fussNormal: 'Tap a cell, then a digit. With notes on you enter candidates.',
    fortsetzen: (name: string) => `Resume · ${name}`,
    alleGeloest: 'All solved · play again',
    weiterStufe: (nr: number) => `Continue · puzzle ${nr}`,
    spielenStufe: (nr: number) => `Play · puzzle ${nr}`,
    karte: 'Map',
    einstellungen: 'Settings',
    fehlerZeigen: 'Show mistakes in red right away',
    fehlerZeigenHinweis: 'On Hard nothing is revealed.',
    notizenAufraeumen: 'Tidy up notes',
    notizenAufraeumenHinweis: 'A placed digit disappears from the notes around it.',
    gleicheZeigen: 'Highlight matching digits',
    fortschrittLoeschen: 'Delete progress',
    fortschrittLoeschenFrage: 'Really delete all Sudoku progress?',
    pause: 'Paused',
    vonVorn: 'Start over',
    geloest: 'Solved!',
    schwersterSchritt: 'Hardest step needed:',
    nochMal: 'Again',
    selbstWeiter: 'Carry on myself',
    alleNotizen: 'Fill in all notes (counts as a hint)',
    tastatur: {
      amRechner: 'On a computer:',
      eintragen: 'to enter,',
      bewegen: 'to move,',
      notizen: 'notes,',
      zurueck: 'undo,',
      pause: 'pause.',
      pfeile: 'Arrows',
    },
    zifferEintragen: (ziffer: number, uebrig: number) => `enter ${ziffer}, ${uebrig} left`,
  },

  allgemein: {
    zurueck: 'Back',
    weiter: 'Next',
    abbrechen: 'Cancel',
    schliessen: 'Close',
    laden: 'Loading…',
    zumMenue: 'To the menu',
    gegenRechner: 'Against the computer',
    onlineSpielen: 'Play online',
    ton: 'Sound',
  },
}
