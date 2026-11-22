/**
 * Themen-Cluster für Imposter-Hilfswörter.
 * Nur Wörter aus words.ts – jedes Wort einer Kategorie steckt in mind. einer Gruppe.
 * Stand: 2026-09-06 (vollständige Abdeckung gegen words.ts geprüft).
 * Die englischen Gruppen (`en-…`) stehen in helperClusters.en.ts.
 */

import { HELPER_CLUSTERS_EN, ZU_NAH_EN } from './helperClusters.en'

export const HELPER_CLUSTERS: Record<string, string[][]> = {
  ...HELPER_CLUSTERS_EN,
  tiere: [
    ['Hund', 'Katze', 'Maus', 'Ratte', 'Hase', 'Igel', 'Eichhörnchen', 'Fledermaus'],
    ['Pferd', 'Kuh', 'Schwein', 'Huhn', 'Ente', 'Gans', 'Schaf', 'Ziege', 'Wildschwein'],
    ['Fuchs', 'Wolf', 'Bär', 'Reh', 'Hirsch'],
    ['Löwe', 'Tiger', 'Elefant', 'Giraffe', 'Affe', 'Zebra', 'Nashorn', 'Nilpferd', 'Kamel'],
    ['Pinguin', 'Delfin', 'Hai', 'Wal', 'Möwe'],
    ['Adler', 'Eule', 'Spatz', 'Storch', 'Papagei'],
    ['Biene', 'Ameise', 'Spinne', 'Schmetterling', 'Marienkäfer'],
    ['Frosch', 'Schildkröte', 'Schlange', 'Krokodil'],
  ],
  essen: [
    ['Brot', 'Brötchen', 'Brezel', 'Butter', 'Käse', 'Honig', 'Marmelade'],
    ['Apfel', 'Banane', 'Erdbeere', 'Kirsche', 'Weintraube', 'Zitrone'],
    ['Kartoffel', 'Möhre', 'Gurke', 'Tomate', 'Zwiebel', 'Knoblauch', 'Salat'],
    ['Pizza', 'Reis', 'Nudeln', 'Suppe', 'Pommes', 'Döner', 'Currywurst'],
    ['Braten', 'Schnitzel', 'Wurst', 'Schinken'],
    ['Kuchen', 'Torte', 'Keks', 'Schokolade', 'Speiseeis'],
    ['Milch', 'Joghurt', 'Müsli', 'Spiegelei', 'Pfannkuchen'],
    ['Kaffee', 'Tee', 'Kakao', 'Limonade', 'Apfelsaft', 'Mineralwasser', 'Bier', 'Wein', 'Sekt'],
  ],
  berufe: [
    ['Arzt', 'Krankenschwester', 'Zahnarzt', 'Apotheker', 'Tierarzt', 'Physiotherapeut', 'Optiker'],
    ['Lehrer', 'Erzieher', 'Bibliothekar'],
    ['Polizist', 'Feuerwehrmann', 'Soldat', 'Richter', 'Anwalt'],
    ['Bäcker', 'Metzger', 'Koch', 'Kellner'],
    ['Friseur', 'Gärtner', 'Landwirt', 'Hausmeister', 'Reinigungskraft', 'Schornsteinfeger'],
    ['Bankkaufmann', 'Verkäufer', 'Kassierer', 'Postbote', 'Steuerberater'],
    ['Busfahrer', 'Lokführer', 'Pilot', 'Flugbegleiter', 'Kapitän'],
    ['Elektriker', 'Klempner', 'Maler', 'Maurer', 'Dachdecker', 'Schreiner', 'Mechaniker'],
    ['Ingenieur', 'Architekt', 'Programmierer'],
    ['Journalist', 'Fotograf', 'Musiker', 'Schauspieler', 'Sänger'],
  ],
  sport: [
    ['Fußball', 'Handball', 'Basketball', 'Volleyball'],
    ['Tennis', 'Tischtennis', 'Badminton'],
    ['Golf', 'Hockey', 'Eishockey'],
    ['Schwimmen', 'Tauchen', 'Rudern', 'Segeln', 'Surfen'],
    [
      'Klettern',
      'Wandern',
      'Joggen',
      'Marathon',
      'Radfahren',
      'Mountainbike',
      'Rennrad',
      'Triathlon',
    ],
    ['Reiten', 'Turnen', 'Leichtathletik', 'Weitsprung', 'Hochsprung', 'Speerwurf', 'Kugelstoßen'],
    ['Boxen', 'Judo', 'Karate', 'Ringen', 'Fechten'],
    ['Skifahren', 'Snowboard', 'Rodeln', 'Eiskunstlauf', 'Biathlon', 'Skispringen'],
    ['Bogenschießen', 'Sportschießen', 'Kegeln', 'Bowling', 'Dart', 'Billard'],
    ['Yoga', 'Pilates', 'Krafttraining'],
  ],
  reisen: [
    [
      'Strand',
      'Berg',
      'Insel',
      'Wüste',
      'Dschungel',
      'Alpen',
      'Nordsee',
      'Ostsee',
      'Schwarzwald',
      'Bodensee',
    ],
    ['Hotel', 'Ferienwohnung', 'Campingplatz', 'Zelt', 'Wohnwagen'],
    ['Flughafen', 'Bahnhof', 'Hafen', 'Fähre', 'Kreuzfahrt'],
    ['Reisebüro', 'Koffer', 'Rucksack', 'Reisepass', 'Landkarte', 'Stadtführung'],
    ['Museum', 'Schloss', 'Burg', 'Leuchtturm', 'Wasserfall', 'Höhle', 'Bergsee', 'Fluss', 'Meer'],
    ['Rom', 'Paris', 'London', 'Wien', 'Amsterdam', 'Barcelona', 'Prag', 'Venedig', 'Mallorca'],
    ['Türkei', 'Italien', 'Norwegen', 'Kanada', 'Japan', 'Ägypten'],
  ],
  technik: [
    ['Handy', 'Tablet', 'Laptop', 'Computer', 'Monitor', 'Tastatur', 'Maus', 'Smartwatch'],
    ['Drucker', 'Scanner', 'Router', 'WLAN', 'Bluetooth', 'USB-Stick', 'Festplatte'],
    ['Kopfhörer', 'Lautsprecher', 'Fernseher', 'Fernbedienung', 'Beamer', 'Kamera', 'Drohne'],
    ['Ladekabel', 'Powerbank', 'Steckdose', 'Batterie', 'Taschenlampe'],
    ['Solarzelle', 'Windrad', 'Roboter', 'Sprachassistent'],
    [
      'App',
      'Passwort',
      'E-Mail',
      'Suchmaschine',
      'Videoanruf',
      'Streaming',
      'Update',
      'Virenscanner',
    ],
    ['Mikrowelle', 'Waschmaschine', 'Staubsauger', 'Kühlschrank', 'Spülmaschine'],
    ['Bohrmaschine', 'Rasenmäher', 'Navigationsgerät', 'Klimaanlage', 'Nähmaschine', 'Wärmepumpe'],
  ],
  filme: [
    [
      'Titanic',
      'Avatar',
      'Matrix',
      'Gladiator',
      'Rocky',
      'Terminator',
      'Jurassic Park',
      'Star Wars',
    ],
    ['Herr der Ringe', 'Harry Potter', 'Der Pate', 'Forrest Gump'],
    [
      'Findet Nemo',
      'König der Löwen',
      'Shrek',
      'Die Eiskönigin',
      'Minions',
      'Toy Story',
      'Ice Age',
      'Das Dschungelbuch',
    ],
    ['Tatort', 'Lindenstraße', 'Die Sendung mit der Maus', 'Tagesschau'],
    [
      'Big Bang Theory',
      'Friends',
      'Die Simpsons',
      'Game of Thrones',
      'Stranger Things',
      'Breaking Bad',
      'Dark',
    ],
    [
      'Kinosaal',
      'Popcorn',
      'Filmmusik',
      'Abspann',
      'Regisseur',
      'Drehbuch',
      'Trailer',
      'Hauptrolle',
      'Statist',
      'Kostüm',
      'Kulisse',
      'Oscar',
    ],
    [
      'Serienfinale',
      'Fortsetzung',
      'Zeichentrick',
      'Dokumentation',
      'Krimi',
      'Western',
      'Filmpremiere',
    ],
  ],
  musik: [
    ['Gitarre', 'E-Gitarre', 'Bass', 'Kontrabass', 'Harfe'],
    ['Geige', 'Cello'],
    ['Klavier', 'Flügel', 'Orgel', 'Keyboard'],
    ['Schlagzeug', 'Xylofon', 'Triangel', 'Tamburin'],
    ['Querflöte', 'Blockflöte', 'Klarinette', 'Saxofon'],
    ['Trompete', 'Posaune', 'Tuba', 'Waldhorn'],
    ['Akkordeon', 'Mundharmonika', 'Orgel', 'Keyboard'],
    ['Chor', 'Orchester', 'Band', 'Dirigent', 'Blaskapelle'],
    ['Konzert', 'Festival', 'Mikrofon'],
    ['Melodie', 'Rhythmus', 'Refrain', 'Strophe', 'Noten', 'Takt', 'Ohrwurm'],
    ['Pop', 'Rock', 'Jazz', 'Klassik', 'Hip-Hop', 'Techno', 'Schlager', 'Volksmusik'],
    ['Radio', 'Plattenspieler'],
  ],
  schule: [
    [
      'Tafel',
      'Kreide',
      'Whiteboard',
      'Schulheft',
      'Schulbuch',
      'Federmappe',
      'Bleistift',
      'Kugelschreiber',
      'Radiergummi',
      'Lineal',
      'Zirkel',
      'Geodreieck',
      'Taschenrechner',
    ],
    ['Schulranzen', 'Pausenbrot', 'Pausenhof', 'Schulklingel', 'Stundenplan', 'Hausaufgaben'],
    ['Klassenarbeit', 'Diktat', 'Zeugnis', 'Schulnote', 'Sitzenbleiben'],
    ['Klassenfahrt', 'Wandertag', 'Schulbus', 'Turnhalle', 'Sportunterricht'],
    [
      'Mathematik',
      'Deutsch',
      'Englisch',
      'Französisch',
      'Biologie',
      'Chemie',
      'Physik',
      'Erdkunde',
      'Geschichte',
    ],
    ['Kunstunterricht', 'Musikunterricht', 'Religion', 'Werken'],
    ['Lehrerzimmer', 'Sekretariat', 'Schulleiter', 'Klassensprecher', 'Elternabend'],
    ['Abitur', 'Sommerferien', 'Schulhof'],
  ],
  haus: [
    [
      'Wohnzimmer',
      'Schlafzimmer',
      'Kinderzimmer',
      'Küche',
      'Badezimmer',
      'Flur',
      'Keller',
      'Dachboden',
      'Garage',
      'Balkon',
      'Terrasse',
      'Garten',
    ],
    ['Treppe', 'Fenster', 'Haustür', 'Dach', 'Schornstein'],
    [
      'Sofa',
      'Sessel',
      'Couchtisch',
      'Esstisch',
      'Stuhl',
      'Bett',
      'Matratze',
      'Kissen',
      'Bettdecke',
    ],
    ['Kleiderschrank', 'Kommode', 'Regal', 'Bücherregal'],
    ['Teppich', 'Vorhang', 'Lampe', 'Kronleuchter', 'Spiegel', 'Bilderrahmen', 'Blumentopf'],
    ['Herd', 'Backofen', 'Spüle', 'Wasserhahn', 'Badewanne', 'Dusche', 'Waschbecken', 'Heizung'],
    ['Türklinke', 'Briefkasten', 'Zaun', 'Hecke', 'Gartenzwerg'],
  ],
  natur: [
    ['Sonne', 'Mond', 'Sterne', 'Wolke', 'Regen', 'Schnee', 'Hagel', 'Nebel', 'Wind', 'Sturm'],
    [
      'Gewitter',
      'Blitz',
      'Donner',
      'Regenbogen',
      'Frost',
      'Raureif',
      'Morgentau',
      'Hitze',
      'Dürre',
    ],
    ['Überschwemmung', 'Lawine', 'Erdbeben', 'Vulkan', 'Gletscher'],
    ['Wald', 'Wiese', 'Feld', 'Moor', 'Sumpf', 'Moos', 'Pilz', 'Farn'],
    ['Baum', 'Eiche', 'Buche', 'Tanne', 'Birke'],
    ['Blume', 'Rose', 'Tulpe', 'Sonnenblume', 'Gänseblümchen', 'Löwenzahn', 'Klee'],
    ['Bach', 'Teich', 'Quelle', 'Küste', 'Düne', 'Herbstlaub'],
  ],
  koerper: [
    [
      'Kopf',
      'Haar',
      'Stirn',
      'Auge',
      'Augenbraue',
      'Wimper',
      'Nase',
      'Mund',
      'Lippe',
      'Zahn',
      'Zunge',
      'Kinn',
      'Ohr',
    ],
    [
      'Hals',
      'Nacken',
      'Schulter',
      'Arm',
      'Ellenbogen',
      'Handgelenk',
      'Hand',
      'Finger',
      'Daumen',
      'Fingernagel',
    ],
    ['Brustkorb', 'Bauch', 'Rücken', 'Hüfte'],
    ['Bein', 'Knie', 'Wade', 'Knöchel', 'Fuß', 'Zeh', 'Ferse'],
    ['Haut', 'Muskel', 'Knochen'],
    ['Herz', 'Lunge', 'Magen', 'Leber', 'Niere', 'Gehirn', 'Blut', 'Puls'],
    ['Fieber', 'Husten', 'Schnupfen', 'Kopfschmerzen', 'Pflaster'],
  ],
  kleidung: [
    [
      'Hemd',
      'Bluse',
      'T-Shirt',
      'Pullover',
      'Strickjacke',
      'Weste',
      'Jacke',
      'Mantel',
      'Anorak',
      'Regenjacke',
    ],
    [
      'Hose',
      'Jeans',
      'Shorts',
      'Rock',
      'Kleid',
      'Anzug',
      'Krawatte',
      'Fliege',
      'Gürtel',
      'Hosenträger',
    ],
    [
      'Socken',
      'Strumpfhose',
      'Unterhemd',
      'Schlafanzug',
      'Bademantel',
      'Badehose',
      'Badeanzug',
      'Bikini',
    ],
    ['Turnschuhe', 'Sandalen', 'Stiefel', 'Gummistiefel', 'Hausschuhe', 'Wanderschuhe'],
    ['Mütze', 'Hut', 'Kappe', 'Schal', 'Handschuhe', 'Halstuch'],
    ['Brille', 'Sonnenbrille', 'Armbanduhr', 'Ring', 'Halskette', 'Ohrring'],
    ['Handtasche', 'Geldbeutel', 'Regenschirm', 'Lätzchen'],
  ],
  fahrzeuge: [
    ['Auto', 'Cabrio', 'Geländewagen', 'Sportwagen', 'Oldtimer', 'Rennwagen', 'Taxi'],
    ['Fahrrad', 'Motorrad', 'Roller', 'Moped', 'Tretroller', 'Rollstuhl'],
    ['Lastwagen', 'Lieferwagen', 'Bus', 'Reisebus', 'Müllwagen', 'Anhänger', 'Wohnmobil'],
    ['Straßenbahn', 'U-Bahn', 'S-Bahn', 'Zug', 'Lokomotive', 'Güterzug'],
    ['Krankenwagen', 'Feuerwehrauto', 'Polizeiauto'],
    ['Traktor', 'Mähdrescher', 'Bagger', 'Kran', 'Gabelstapler', 'Betonmischer', 'Schneepflug'],
    [
      'Flugzeug',
      'Hubschrauber',
      'Segelflugzeug',
      'Heißluftballon',
      'Rakete',
      'Seilbahn',
      'Skilift',
    ],
    ['Schiff', 'Segelboot', 'Ruderboot', 'Kanu', 'Schlauchboot', 'U-Boot', 'Jetski'],
  ],
  spiele: [
    [
      'Schach',
      'Dame',
      'Mühle',
      'Halma',
      'Backgammon',
      'Mensch ärgere dich nicht',
      'Monopoly',
      'Scrabble',
      'Risiko',
      'Die Siedler von Catan',
    ],
    ['Uno', 'Skat', 'Doppelkopf', 'Rommé', 'Mau-Mau', 'Poker'],
    ['Memory', 'Puzzle', 'Domino', 'Kniffel', 'Bingo', 'Sudoku', 'Kreuzworträtsel'],
    [
      'Verstecken',
      'Fangen',
      'Blinde Kuh',
      'Topfschlagen',
      'Reise nach Jerusalem',
      'Stille Post',
      'Sackhüpfen',
      'Gummitwist',
      'Seilspringen',
      'Hüpfkästchen',
    ],
    ['Murmeln', 'Drachensteigen', 'Sandburg', 'Schaukel', 'Rutsche', 'Wippe', 'Klettergerüst'],
    ['Lego', 'Playmobil', 'Modelleisenbahn', 'Sammelalbum', 'Briefmarken'],
    ['Stricken', 'Häkeln', 'Basteln', 'Gartenarbeit', 'Angeln'],
  ],
  feiertage: [
    [
      'Weihnachten',
      'Heiligabend',
      'Advent',
      'Adventskranz',
      'Weihnachtsbaum',
      'Krippe',
      'Weihnachtsmarkt',
      'Plätzchen',
      'Nikolaus',
    ],
    ['Ostern', 'Karfreitag', 'Osterhase', 'Ostereier', 'Eiersuche'],
    ['Silvester', 'Neujahr', 'Feuerwerk'],
    ['Pfingsten', 'Fronleichnam', 'Christi Himmelfahrt'],
    ['Karneval', 'Fasching', 'Rosenmontag', 'Aschermittwoch'],
    ['Muttertag', 'Vatertag', 'Valentinstag'],
    ['Halloween', 'Erntedankfest', 'Martinstag', 'Laternenumzug'],
    ['Schützenfest', 'Oktoberfest', 'Kirmes', 'Jahrmarkt'],
    ['Geburtstag', 'Geburtstagstorte', 'Geschenk', 'Girlande', 'Luftballon'],
    [
      'Hochzeit',
      'Polterabend',
      'Taufe',
      'Kommunion',
      'Konfirmation',
      'Jubiläum',
      'Richtfest',
      'Einschulung',
      'Abschlussfeier',
      'Festessen',
    ],
  ],
  gefuehle: [
    [
      'Freude',
      'Glück',
      'Liebe',
      'Zuneigung',
      'Stolz',
      'Dankbarkeit',
      'Erleichterung',
      'Hoffnung',
      'Vorfreude',
      'Neugier',
      'Begeisterung',
      'Zufriedenheit',
      'Geborgenheit',
      'Mitgefühl',
      'Heiterkeit',
      'Gelassenheit',
      'Zuversicht',
      'Respekt',
      'Bewunderung',
    ],
    ['Sehnsucht', 'Heimweh', 'Fernweh', 'Traurigkeit', 'Kummer', 'Enttäuschung', 'Einsamkeit'],
    ['Wut', 'Ärger', 'Zorn', 'Frust', 'Neid', 'Eifersucht', 'Schadenfreude'],
    ['Angst', 'Panik', 'Sorge', 'Nervosität', 'Aufregung'],
    ['Scham', 'Schuldgefühl', 'Verlegenheit', 'Peinlichkeit'],
    ['Langeweile', 'Müdigkeit', 'Erschöpfung', 'Ungeduld'],
    ['Überraschung', 'Verwirrung', 'Zweifel', 'Misstrauen'],
  ],
  stadt: [
    ['Rathaus', 'Marktplatz', 'Kirche', 'Dom', 'Fußgängerzone', 'Einkaufszentrum', 'Hochhaus'],
    [
      'Supermarkt',
      'Bäckerei',
      'Metzgerei',
      'Apotheke',
      'Drogerie',
      'Buchhandlung',
      'Blumenladen',
      'Kiosk',
      'Wochenmarkt',
    ],
    ['Postfiliale', 'Bank', 'Geldautomat', 'Bibliothek', 'Fahrkartenautomat'],
    [
      'Bushaltestelle',
      'Parkhaus',
      'Ampel',
      'Zebrastreifen',
      'Kreisverkehr',
      'Radweg',
      'Bürgersteig',
      'Brücke',
      'Tunnel',
      'Stau',
    ],
    [
      'Schwimmbad',
      'Sporthalle',
      'Stadion',
      'Kino',
      'Theater',
      'Stadtmuseum',
      'Zoo',
      'Stadtpark',
      'Spielplatz',
    ],
    ['Friedhof', 'Krankenhaus', 'Feuerwache', 'Polizeirevier'],
    ['Baustelle', 'Straßenlaterne', 'Mülleimer', 'Parkbank', 'Brunnen', 'Denkmal'],
  ],
  maerchen: [
    [
      'Schneewittchen',
      'Aschenputtel',
      'Dornröschen',
      'Rotkäppchen',
      'Rapunzel',
      'Hänsel und Gretel',
      'Frau Holle',
    ],
    [
      'Rumpelstilzchen',
      'Der Froschkönig',
      'Die Bremer Stadtmusikanten',
      'Der gestiefelte Kater',
      'Tischlein deck dich',
      'Das tapfere Schneiderlein',
      'Die Sterntaler',
      'Der Wolf und die sieben Geißlein',
    ],
    [
      'Peter Pan',
      'Pinocchio',
      'Alice im Wunderland',
      'Der kleine Prinz',
      'Robin Hood',
      'König Artus',
    ],
    [
      'Drache',
      'Ritter',
      'Prinzessin',
      'Prinz',
      'König',
      'Königin',
      'Hexe',
      'Zauberer',
      'Fee',
      'Elfe',
      'Zwerg',
      'Riese',
      'Troll',
      'Kobold',
    ],
    ['Einhorn', 'Meerjungfrau', 'Vampir', 'Werwolf', 'Gespenst'],
    [
      'Zauberstab',
      'Zaubertrank',
      'Zauberspiegel',
      'Märchenschloss',
      'Verwunschener Wald',
      'Goldene Kugel',
      'Glasschuh',
      'Spinnrad',
      'Siebenmeilenstiefel',
      'Wunschbrunnen',
    ],
  ],
  beruehmt: [
    ['Albert Einstein', 'Isaac Newton', 'Marie Curie', 'Charles Darwin', 'Alexander von Humboldt'],
    ['Leonardo da Vinci', 'Michelangelo', 'Vincent van Gogh', 'Pablo Picasso'],
    ['Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach'],
    [
      'Johann Wolfgang von Goethe',
      'Friedrich Schiller',
      'Die Gebrüder Grimm',
      'William Shakespeare',
      'Astrid Lindgren',
      'Anne Frank',
    ],
    ['Martin Luther', 'Martin Luther King', 'Mahatma Gandhi', 'Nelson Mandela', 'Mutter Teresa'],
    ['Winston Churchill', 'Konrad Adenauer', 'Angela Merkel', 'Helmut Kohl'],
    [
      'Christoph Kolumbus',
      'Neil Armstrong',
      'Karl der Große',
      'Napoleon',
      'Kleopatra',
      'Julius Cäsar',
    ],
    [
      'Elvis Presley',
      'Michael Jackson',
      'Die Beatles',
      'Freddie Mercury',
      'Marilyn Monroe',
      'Charlie Chaplin',
      'Walt Disney',
    ],
    ['Steve Jobs', 'Bill Gates'],
    [
      'Muhammad Ali',
      'Pelé',
      'Franz Beckenbauer',
      'Michael Schumacher',
      'Steffi Graf',
      'Boris Becker',
      'Dirk Nowitzki',
      'Usain Bolt',
    ],
  ],
}

/**
 * Paare, die als Hilfswort zu nah sind: Wer eins davon bekommt, kennt das
 * andere praktisch schon und gewinnt die letzte Chance geschenkt
 * (03.11.2026, Thomas: "die Imposter-Wörter"). Was ein Wort im anderen
 * enthält (Schwein/Wildschwein, Hand/Handgelenk), fängt `zuNah` von selbst
 * ab; hier stehen nur echte Synonyme und Wortfamilien ohne gemeinsamen
 * Wortstamm am Anfang.
 */
const ZU_NAH: readonly string[][] = [
  ['Karneval', 'Fasching', 'Rosenmontag'],
  ['Kirmes', 'Jahrmarkt'],
  ['Kuchen', 'Torte'],
  ['Wut', 'Ärger', 'Zorn'],
  ['Mütze', 'Kappe'],
  ['Schal', 'Halstuch'],
  ['Kegeln', 'Bowling'],
  ['Tafel', 'Whiteboard'],
  ['Klavier', 'Flügel', 'Keyboard'],
  ['Uno', 'Mau-Mau'],
  ['Kirche', 'Dom'],
  ['Blitz', 'Donner', 'Gewitter'],
  ['Angst', 'Panik'],
  ['Scham', 'Verlegenheit', 'Peinlichkeit'],
  ['Müdigkeit', 'Erschöpfung'],
  ['Freude', 'Glück'],
  ['Fernseher', 'Fernbedienung'],
  ['Joggen', 'Marathon'],
  ['Weihnachten', 'Heiligabend', 'Weihnachtsbaum', 'Weihnachtsmarkt', 'Advent', 'Adventskranz'],
  ['Ostern', 'Osterhase', 'Ostereier'],
  ['Silvester', 'Neujahr', 'Feuerwerk'],
  ['Radfahren', 'Rennrad', 'Mountainbike'],
  ['Bogenschießen', 'Sportschießen'],
  ['Skifahren', 'Skispringen'],
  ['Querflöte', 'Blockflöte'],
  ['Jacke', 'Regenjacke', 'Strickjacke', 'Anorak'],
  ['Brille', 'Sonnenbrille'],
  ['Martin Luther', 'Martin Luther King'],
  ...ZU_NAH_EN,
]

/** Klein, ohne Umlaute und ohne Satzzeichen -- für Vergleiche. */
function norm(w: string): string {
  return w
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z]/g, '')
}

const NAH = new Map<string, Set<string>>()
for (const gruppe of ZU_NAH) {
  for (const w of gruppe) {
    const set = NAH.get(norm(w)) ?? new Set<string>()
    for (const v of gruppe) if (v !== w) set.add(norm(v))
    NAH.set(norm(w), set)
  }
}

/** Verrät das Hilfswort das Geheimwort? */
export function zuNah(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y || x === y) return true
  const [kurz, lang] = x.length <= y.length ? [x, y] : [y, x]
  if (kurz.length >= 3 && lang.includes(kurz)) return true
  return NAH.get(x)?.has(y) ?? false
}

/**
 * So viele Hilfswörter muss es mindestens geben. Bei zwei Wörtern in einer
 * Gruppe wüsste der Imposter das Geheimwort sicher, bei drei stünde es
 * fifty-fifty -- also wird eine kleine Gruppe um ihre Nachbargruppen
 * erweitert. Die Gruppen stehen thematisch sortiert, die Nachbarn passen.
 */
export const MIN_HELFER = 3

/** Pro Kategorie und Wort: die Indizes aller Gruppen, in denen es steht. */
const LOOKUP = new Map<string, number[]>()

for (const [categoryId, groups] of Object.entries(HELPER_CLUSTERS)) {
  groups.forEach((group, gi) => {
    for (const word of group) {
      const key = `${categoryId}|${norm(word)}`
      // Steht ein Wort in zwei Gruppen, zählen beide (vorher gewann die letzte).
      LOOKUP.set(key, [...(LOOKUP.get(key) ?? []), gi])
    }
  })
}

/** Cluster-Nachbarn im Pool, sonst restliche Kategorie (ohne Geheimwort). */
export function helperCandidates(secretWord: string, categoryId: string, pool: string[]): string[] {
  const poolOthers = pool.filter((w) => !zuNah(w, secretWord))
  if (poolOthers.length === 0) {
    // Eigene Listen können nur aus Verwandten bestehen -- dann lieber ein
    // nahes Wort als gar keins.
    return pool.filter((w) => norm(w) !== norm(secretWord))
  }

  const groups = HELPER_CLUSTERS[categoryId] ?? []
  const start = LOOKUP.get(`${categoryId}|${norm(secretWord)}`)
  if (!start || groups.length === 0) return poolOthers

  const imPool = new Map(poolOthers.map((w) => [norm(w), w]))
  const treffer = new Map<string, string>()
  const nimm = (gi: number) => {
    for (const w of groups[gi] ?? []) {
      const p = imPool.get(norm(w))
      if (p) treffer.set(norm(w), p)
    }
  }
  for (const gi of start) nimm(gi)
  // Zu wenig? Ringweise die Nachbargruppen dazunehmen.
  for (let weite = 1; treffer.size < MIN_HELFER && weite < groups.length; weite++) {
    for (const gi of start) {
      if (gi - weite >= 0) nimm(gi - weite)
      if (gi + weite < groups.length) nimm(gi + weite)
    }
  }
  return treffer.size > 0 ? [...treffer.values()] : poolOthers
}
