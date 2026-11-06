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
